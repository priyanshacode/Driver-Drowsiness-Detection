import { useEffect, useRef, useState } from 'react'
import { FaceLandmarkerService } from '../mediapipe/faceLandmarkerService'
import { computeEar } from '../features/ear'
import { computeMar } from '../features/mar'
import { computeHeadPose, type MediaPipeMatrix } from '../features/headPose'
import { BlinkTracker } from '../features/blinks'
import { PerclosTracker } from '../metrics/perclos'
import { drawOverlay } from '../visualization/overlay'
import { RecordingBuffer } from '../recording/recordingBuffer'
import type { CurrentMetrics, RecordingSample } from '../metrics/types'
import type { OverlayToggles } from '../config/constants'
import type { CameraStatus } from '../camera/useCamera'

export type MediaPipeStatus = 'loading' | 'ready' | 'error'

export type RecordingState =
  | { phase: 'idle' }
  | { phase: 'recording'; startedAt: number }
  | { phase: 'complete'; durationMs: number; sampleCount: number; samples: RecordingSample[] }

const EMPTY_METRICS: CurrentMetrics = {
  timestamp: 0,
  faceDetected: false,
  ear: null,
  mar: null,
  perclos: null,
  blinkCount: 0,
  blinkRate: 0,
  headPose: null,
}

/**
 * Wires camera -> MediaPipe -> feature extraction -> PERCLOS -> a single
 * CurrentMetrics object, and fans that out to the UI, the canvas overlay,
 * and the (optional, in-memory) recording buffer. This is the one place
 * that owns the real-time processing loop.
 */
export function useDrowsinessPipeline(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraStatus: CameraStatus,
  toggles: OverlayToggles,
) {
  const [mediaPipeStatus, setMediaPipeStatus] = useState<MediaPipeStatus>('loading')
  const [mediaPipeError, setMediaPipeError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<CurrentMetrics>(EMPTY_METRICS)
  const [recording, setRecording] = useState<RecordingState>({ phase: 'idle' })

  const serviceRef = useRef<FaceLandmarkerService | null>(null)
  const perclosRef = useRef(new PerclosTracker())
  const blinkTrackerRef = useRef(new BlinkTracker())
  const recordingBufferRef = useRef(new RecordingBuffer())
  const rafRef = useRef<number | null>(null)
  const togglesRef = useRef(toggles)
  const recordingPhaseRef = useRef<RecordingState['phase']>('idle')
  const lastUiUpdateRef = useRef(0)

  useEffect(() => {
    togglesRef.current = toggles
  }, [toggles])

  // Initialize MediaPipe once.
  useEffect(() => {
    const service = new FaceLandmarkerService()
    serviceRef.current = service
    let cancelled = false

    service
      .init()
      .then(() => {
        if (!cancelled) setMediaPipeStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setMediaPipeStatus('error')
        setMediaPipeError(err instanceof Error ? err.message : 'Failed to initialize MediaPipe.')
      })

    return () => {
      cancelled = true
      service.close()
    }
  }, [])

  // Main processing loop.
  useEffect(() => {
    if (cameraStatus !== 'active' || mediaPipeStatus !== 'ready') return

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      const service = serviceRef.current

      if (video && service && video.readyState >= 2 && video.videoWidth > 0) {
        const now = performance.now()
        const result = service.detectForVideo(video, now)
        const faceLandmarks = result?.faceLandmarks?.[0]

        if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        const ctx = canvas?.getContext('2d') ?? null

        if (faceLandmarks && faceLandmarks.length > 0) {
          const ear = computeEar(faceLandmarks)
          const mar = computeMar(faceLandmarks)

          const matrix = result?.facialTransformationMatrixes?.[0] as MediaPipeMatrix | undefined
          const headPose = matrix ? computeHeadPose(matrix) : null

          perclosRef.current.addSample(now, ear.average)
          const perclos = perclosRef.current.getPerclos(now)

          blinkTrackerRef.current.addSample(now, ear.average)
          const blinkCount = blinkTrackerRef.current.getTotalBlinks()
          const blinkRate = blinkTrackerRef.current.getBlinkRate(now)

          const nextMetrics: CurrentMetrics = {
            timestamp: now,
            faceDetected: true,
            ear,
            mar,
            perclos,
            blinkCount,
            blinkRate,
            headPose,
          }

          if (ctx && canvas) {
            drawOverlay(ctx, canvas.width, canvas.height, faceLandmarks, togglesRef.current, headPose)
          }

          if (recordingPhaseRef.current === 'recording') {
            recordingBufferRef.current.maybeAddSample(nextMetrics)
          }

          // Throttle React state updates to ~15Hz to avoid excessive rerenders
          // while keeping canvas drawing at full frame rate above.
          if (now - lastUiUpdateRef.current > 66) {
            lastUiUpdateRef.current = now
            setMetrics(nextMetrics)
          }
        } else {
          // No face: do not report stale measurements.
          perclosRef.current.addSample(now, null)
          blinkTrackerRef.current.addSample(now, null)

          const blinkCount = blinkTrackerRef.current.getTotalBlinks()
          const blinkRate = blinkTrackerRef.current.getBlinkRate(now)

          if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
          if (now - lastUiUpdateRef.current > 66) {
            lastUiUpdateRef.current = now
            setMetrics({ ...EMPTY_METRICS, timestamp: now, faceDetected: false, blinkCount, blinkRate })
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [cameraStatus, mediaPipeStatus, videoRef, canvasRef])

  // Reset PERCLOS and blink history if the camera restarts.
  useEffect(() => {
    if (cameraStatus === 'active') {
      perclosRef.current.reset()
      blinkTrackerRef.current.reset()
    }
  }, [cameraStatus])

  function startRecording() {
    const now = performance.now()
    recordingBufferRef.current.start(now)
    recordingPhaseRef.current = 'recording'
    setRecording({ phase: 'recording', startedAt: now })
  }

  function stopRecording() {
    const { samples, durationMs } = recordingBufferRef.current.stop()
    recordingPhaseRef.current = 'idle'
    setRecording({ phase: 'complete', durationMs, sampleCount: samples.length, samples })
  }

  function discardRecording() {
    recordingBufferRef.current.discard()
    recordingPhaseRef.current = 'idle'
    setRecording({ phase: 'idle' })
  }

  return {
    mediaPipeStatus,
    mediaPipeError,
    metrics,
    recording,
    startRecording,
    stopRecording,
    discardRecording,
  }
}
