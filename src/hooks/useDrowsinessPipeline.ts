import { useEffect, useRef, useState } from 'react'
import { FaceLandmarkerService } from '../mediapipe/faceLandmarkerService'
import { computeEar } from '../features/ear'
import { computeMar } from '../features/mar'
import { computeHeadPose, type MediaPipeMatrix } from '../features/headPose'
import { DrowsinessEvaluator } from '../features/drowsinessRules'
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
  faceBox: null,
  ear: null,
  mar: null,
  perclos: null,
  headPose: null,
  alert: { level: 'tracking-lost', reason: 'Waiting for face detection' },
}

/**
 * Wires camera -> MediaPipe -> feature extraction -> PERCLOS -> drowsiness evaluation
 * -> a single CurrentMetrics object, and fans that out to the UI, the canvas overlay,
 * and the (optional, in-memory) recording buffer. This is the one place
 * that owns the real-time processing loop.
 */
export function useDrowsinessPipeline(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  cameraStatus: CameraStatus,
  toggles: OverlayToggles,
  getMobileViTPrediction?: () => {
    drowsyProbability: number
    nonDrowsyProbability: number
    label: 'Drowsy' | 'Non Drowsy' | 'Uncertain'
    inferenceTimeMs: number
  } | null,
) {
  const [mediaPipeStatus, setMediaPipeStatus] = useState<MediaPipeStatus>('loading')
  const [mediaPipeError, setMediaPipeError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<CurrentMetrics>(EMPTY_METRICS)
  const [recording, setRecording] = useState<RecordingState>({ phase: 'idle' })

  const serviceRef = useRef<FaceLandmarkerService | null>(null)
  const perclosRef = useRef(new PerclosTracker())
  const evaluatorRef = useRef(new DrowsinessEvaluator())
  const recordingBufferRef = useRef(new RecordingBuffer())
  const rafRef = useRef<number | null>(null)
  const togglesRef = useRef(toggles)
  const recordingPhaseRef = useRef<RecordingState['phase']>('idle')
  const lastUiUpdateRef = useRef(0)
  const getMobileViTPredictionRef = useRef(getMobileViTPrediction)

  useEffect(() => {
    getMobileViTPredictionRef.current = getMobileViTPrediction
  }, [getMobileViTPrediction])

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

          let minX = 1
          let maxX = 0
          let minY = 1
          let maxY = 0
          for (let i = 0; i < faceLandmarks.length; i++) {
            const p = faceLandmarks[i]
            if (p.x < minX) minX = p.x
            if (p.x > maxX) maxX = p.x
            if (p.y < minY) minY = p.y
            if (p.y > maxY) maxY = p.y
          }
          const faceBox = {
            x: Math.max(0, minX),
            y: Math.max(0, minY),
            width: Math.min(1, Math.max(0, maxX - minX)),
            height: Math.min(1, Math.max(0, maxY - minY)),
          }

          const matrix = result?.facialTransformationMatrixes?.[0] as MediaPipeMatrix | undefined
          const headPose = matrix ? computeHeadPose(matrix) : null

          perclosRef.current.addSample(now, ear.average)
          const perclos = perclosRef.current.getPerclos(now)

          const alert = evaluatorRef.current.evaluate(now, {
            faceDetected: true,
            ear,
            mar,
            perclos,
            headPose,
          })

          const nextMetrics: CurrentMetrics = {
            timestamp: now,
            faceDetected: true,
            faceBox,
            ear,
            mar,
            perclos,
            headPose,
            alert,
          }

          if (ctx && canvas) {
            drawOverlay(ctx, canvas.width, canvas.height, faceLandmarks, togglesRef.current, headPose)
          }

          if (recordingPhaseRef.current === 'recording') {
            const mvPred = getMobileViTPredictionRef.current?.() ?? null
            recordingBufferRef.current.maybeAddSample(nextMetrics, mvPred)
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
          const alert = evaluatorRef.current.evaluate(now, {
            faceDetected: false,
            ear: null,
            mar: null,
            perclos: null,
            headPose: null,
          })

          const missingFaceMetrics: CurrentMetrics = {
            ...EMPTY_METRICS,
            timestamp: now,
            faceDetected: false,
            alert,
          }

          if (recordingPhaseRef.current === 'recording') {
            const mvPred = getMobileViTPredictionRef.current?.() ?? null
            recordingBufferRef.current.maybeAddSample(missingFaceMetrics, mvPred)
          }

          if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
          if (now - lastUiUpdateRef.current > 66) {
            lastUiUpdateRef.current = now
            setMetrics(missingFaceMetrics)
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

  // Reset PERCLOS and evaluator history if the camera restarts.
  useEffect(() => {
    if (cameraStatus === 'active') {
      perclosRef.current.reset()
      evaluatorRef.current.reset()
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
    alert: metrics.alert ?? EMPTY_METRICS.alert!,
    recording,
    startRecording,
    stopRecording,
    discardRecording,
  }
}
