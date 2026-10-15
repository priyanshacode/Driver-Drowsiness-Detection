import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera } from '../camera/useCamera'
import { useDrowsinessPipeline } from '../hooks/useDrowsinessPipeline'
import { useMobileViT } from '../hooks/useMobileViT'
import { CameraView } from './CameraView'
import { MetricsPanel } from './MetricsPanel'
import { RecordingPanel } from './RecordingPanel'
import { AlertAudioManager } from '../audio/alertAudio'
import type { OverlayToggles } from '../config/constants'
import type { RecordingSample } from '../metrics/types'
import type { AlertEvent } from '../App'
import type { MobileViTPrediction } from '../mediapipe/mobileViTService'

export function MonitorPage({
  toggles,
  onSaveSession,
}: {
  toggles: OverlayToggles
  onSaveSession: (
    durationMs: number,
    samples: RecordingSample[],
    alerts: AlertEvent[],
  ) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const camera = useCamera(videoRef)

  const latestMobileViTRef = useRef<MobileViTPrediction | null>(null)
  const getMobileViTPrediction = useCallback(() => latestMobileViTRef.current, [])

  const {
    mediaPipeStatus,
    mediaPipeError,
    metrics,
    recording,
    startRecording,
    stopRecording,
    discardRecording,
  } = useDrowsinessPipeline(
    videoRef,
    canvasRef,
    camera.status,
    toggles,
    getMobileViTPrediction,
  )

  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const alertsHistoryRef = useRef<AlertEvent[]>([])
  const lastAlertKeyRef = useRef<string | null>(null)

  // Experimental MobileViT inference, kept separate from existing alerts.
  const mobileViT = useMobileViT(
    videoRef,
    camera.status === 'active',
    metrics.faceDetected,
    metrics.faceBox,
    { includeCropPreview: showDiagnostics },
  )

  useEffect(() => {
    latestMobileViTRef.current = mobileViT.prediction
  }, [mobileViT.prediction])

  // Web Audio alert synthesizer (lazy initialized).
  const [audioManager] = useState(() => new AlertAudioManager())
  const [isMuted, setIsMuted] = useState(false)

  const handleToggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    audioManager.setMuted(next)

    if (!next) {
      audioManager.initOrResume()
    }
  }

  // Existing MediaPipe audio alerts remain unchanged.
  useEffect(() => {
    if (camera.status === 'active' && metrics.alert) {
      audioManager.playAlert(metrics.alert.level, performance.now())
    }
  }, [camera.status, metrics.alert, audioManager])

  // Track alert timeline events during recording session
  const recordingPhase = recording.phase
  const recordingStartedAt = recording.phase === 'recording' ? recording.startedAt : undefined

  useEffect(() => {
    if (recordingPhase === 'recording' && metrics.alert) {
      const { level, reason } = metrics.alert
      if (level === 'warning' || level === 'critical') {
        const key = `${level}:${reason}`
        if (lastAlertKeyRef.current !== key) {
          lastAlertKeyRef.current = key
          const alertEvent: AlertEvent = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            elapsedTimeMs: recordingStartedAt ? performance.now() - recordingStartedAt : 0,
            level,
            reason,
            ear: metrics.ear?.average ?? null,
            perclos: metrics.perclos ?? null,
            mar: metrics.mar ?? null,
          }
          alertsHistoryRef.current.push(alertEvent)
        }
      } else {
        lastAlertKeyRef.current = null
      }
    } else if (recordingPhase === 'idle') {
      lastAlertKeyRef.current = null
    }
  }, [recordingPhase, recordingStartedAt, metrics.alert, metrics.ear, metrics.perclos, metrics.mar])

  // Release audio resources on unmount.
  useEffect(() => {
    return () => {
      audioManager.close()
    }
  }, [audioManager])

  // Automatically save and discard when a recording completes.
  useEffect(() => {
    if (recording.phase === 'complete') {
      onSaveSession(recording.durationMs, recording.samples, [...alertsHistoryRef.current])
      alertsHistoryRef.current = []
      discardRecording()
    }
  }, [recording, onSaveSession, discardRecording])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Live Telemetry
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time geometric feature extraction pipeline and rule-based
            safety alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleMute}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
              isMuted
                ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
            aria-label={
              isMuted ? 'Unmute audible alerts' : 'Mute audible alerts'
            }
            title={
              isMuted
                ? 'Alerts muted (Click to unmute)'
                : 'Alert audio active (Click to mute)'
            }
          >
            {isMuted ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            )}
            <span>{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>

          <RecordingPanel
            recording={recording}
            onStart={() => {
              audioManager.initOrResume()
              startRecording()
            }}
            onStop={stopRecording}
            onDiscard={discardRecording}
            disabled={
              camera.status !== 'active' ||
              mediaPipeStatus !== 'ready'
            }
          />
        </div>
      </header>

      {/* Existing critical alert banner */}
      {metrics.alert?.level === 'critical' && (
        <div className="flex animate-pulse items-center gap-4 rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-md">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold tracking-wide text-red-950 uppercase">
              CRITICAL ALERT: PROLONGED EYE CLOSURE
            </h2>
            <p className="mt-0.5 text-xs font-medium text-red-800">
              {metrics.alert.reason}
            </p>
          </div>
        </div>
      )}

      {/* Existing warning alert banner */}
      {metrics.alert?.level === 'warning' && (
        <div className="flex items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-md">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold tracking-wide text-amber-950 uppercase">
              WARNING: ELEVATED FATIGUE PATTERN
            </h2>
            <p className="mt-0.5 text-xs font-medium text-amber-800">
              {metrics.alert.reason}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* Camera feed */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">
                Camera Feed
              </h2>
            </div>

            <div className="p-4">
              <CameraView
                videoRef={videoRef}
                canvasRef={canvasRef}
                containerRef={containerRef}
                cameraStatus={camera.status}
                cameraError={camera.errorMessage}
                mediaPipeStatus={mediaPipeStatus}
                mediaPipeError={mediaPipeError}
                faceDetected={metrics.faceDetected}
                alert={metrics.alert}
              />
            </div>
          </div>

          {/* Module 2: Experimental MobileViT output */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  Appearance-Based Features (Module 2)
                </h2>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 uppercase">
                  Experimental
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics((prev) => !prev)}
                  className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                    showDiagnostics
                      ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Toggle MobileViT Development Diagnostics"
                >
                  {showDiagnostics ? 'Diagnostics ON' : 'Dev Diagnostics'}
                </button>

                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    mobileViT.status === 'ready'
                      ? 'bg-green-100 text-green-700'
                      : mobileViT.status === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {mobileViT.status === 'ready'
                    ? 'Model Ready'
                    : mobileViT.status === 'error'
                      ? 'Model Error'
                      : 'Loading'}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-6 w-6 text-slate-500"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 3H5a2 2 0 00-2 2v4m18 0V5a2 2 0 00-2-2h-4m0 18h4a2 2 0 002-2v-4M3 15v4a2 2 0 002 2h4"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 8h8v8H8z"
                    />
                  </svg>
                </div>

                <h3 className="text-sm font-semibold text-slate-900">
                  Experimental MobileViT Classification
                </h3>

                {mobileViT.status === 'loading' && (
                  <p className="mt-2 text-xs text-slate-500">
                    Loading the ONNX model runtime...
                  </p>
                )}

                {mobileViT.status === 'error' && (
                  <p className="mt-2 max-w-sm break-words text-xs text-red-600">
                    {mobileViT.error ?? 'Unable to load the MobileViT model.'}
                  </p>
                )}

                {mobileViT.status === 'ready' && (
                  <>
                    <p className="mt-2 text-xs text-slate-500">
                      {camera.status !== 'active'
                        ? 'Start the camera to run experimental predictions.'
                        : !metrics.faceDetected
                          ? 'No face detected in camera feed. Position face within view for analysis.'
                          : mobileViT.prediction
                            ? `Inference running (~1.5s interval)${mobileViT.isInferring ? ' • Analyzing...' : ''}`
                            : 'Waiting for first face prediction...'}
                    </p>

                    {metrics.faceDetected && mobileViT.prediction && (
                      <div className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Temporal Decision Policy
                          </p>
                          {mobileViT.isInferring ? (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
                              Evaluating frame
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              Paced at 1.5s
                            </span>
                          )}
                        </div>

                        {/* Status Heading */}
                        <div className="mt-2 flex items-baseline gap-2">
                          <span
                            className={`text-2xl font-bold ${
                              mobileViT.prediction.temporalState === 'sustained_drowsy'
                                ? 'text-amber-700'
                                : mobileViT.prediction.temporalState === 'alert'
                                  ? 'text-emerald-700'
                                  : mobileViT.prediction.temporalState === 'evaluating_evidence'
                                    ? 'text-blue-700'
                                    : 'text-slate-700'
                            }`}
                          >
                            {mobileViT.prediction.temporalState === 'sustained_drowsy'
                              ? 'Drowsy (Sustained)'
                              : mobileViT.prediction.temporalState === 'evaluating_evidence'
                                ? `Elevated (Monitoring ${mobileViT.prediction.sustainedCount}/${mobileViT.prediction.sustainedRequiredFrames})`
                                : mobileViT.prediction.temporalState === 'alert'
                                  ? 'Non Drowsy'
                                  : 'Uncertain / Inconclusive'}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({mobileViT.prediction.confidence.toFixed(1)}% score)
                          </span>
                        </div>

                        {/* Score breakdown grid */}
                        <div className="mt-3 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                          <div className="rounded bg-white p-2.5 border border-slate-200/80">
                            <p className="text-[10px] font-semibold uppercase text-slate-500">
                              Raw Drowsy
                            </p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                              {mobileViT.prediction.drowsyProbability.toFixed(1)}%
                            </p>
                          </div>

                          <div className="rounded bg-white p-2.5 border border-slate-200/80">
                            <p className="text-[10px] font-semibold uppercase text-slate-500">
                              Raw Non-Drowsy
                            </p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                              {mobileViT.prediction.nonDrowsyProbability.toFixed(1)}%
                            </p>
                          </div>

                          <div className="rounded bg-white p-2.5 border border-slate-200/80">
                            <p className="text-[10px] font-semibold uppercase text-slate-500">
                              Smoothed Drowsy
                            </p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                              {mobileViT.prediction.smoothedDrowsyProb.toFixed(1)}%
                            </p>
                          </div>

                          <div className="rounded bg-white p-2.5 border border-slate-200/80">
                            <p className="text-[10px] font-semibold uppercase text-slate-500">
                              Inference Latency
                            </p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                              {mobileViT.prediction.inferenceTimeMs} ms
                            </p>
                          </div>
                        </div>

                        {/* Development Diagnostics Panel (collapsible) */}
                        {showDiagnostics && (
                          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3.5 text-left text-xs">
                            <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                              <h4 className="font-semibold text-blue-900">
                                Real-Time Diagnostic Telemetry
                              </h4>
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-800">
                                224x224 RGB
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-4 items-start">
                              {mobileViT.prediction.cropDataUrl && (
                                <div className="flex flex-col items-center gap-1">
                                  <img
                                    src={mobileViT.prediction.cropDataUrl}
                                    alt="Model input face crop"
                                    className="h-24 w-24 rounded-md border border-blue-300 bg-black object-cover shadow-sm"
                                  />
                                  <span className="text-[10px] text-slate-500">
                                    Input Face Crop
                                  </span>
                                </div>
                              )}

                              <div className="flex-1 min-w-[200px] space-y-1.5 font-mono text-[11px] text-slate-700">
                                <div className="flex justify-between">
                                  <span>Logit[0] (Drowsy):</span>
                                  <span className="font-semibold text-slate-900">
                                    {mobileViT.prediction.logitDrowsy.toFixed(3)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Logit[1] (Non-Drowsy):</span>
                                  <span className="font-semibold text-slate-900">
                                    {mobileViT.prediction.logitNonDrowsy.toFixed(3)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Sustained Cycles:</span>
                                  <span className="font-semibold text-blue-700">
                                    {mobileViT.prediction.sustainedCount} / {mobileViT.prediction.sustainedRequiredFrames} (&gt;=65%)
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Crop Coordinates:</span>
                                  <span className="text-slate-600">
                                    [{mobileViT.prediction.cropBox.sx}, {mobileViT.prediction.cropBox.sy}, {mobileViT.prediction.cropBox.sWidth}x{mobileViT.prediction.cropBox.sHeight}]
                                  </span>
                                </div>
                              </div>
                            </div>

                            <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">
                              <strong>Evaluation Strategy Note:</strong> Checkpoint was trained on academic dataset crops. Single-frame scores below 65% are classified as Uncertain to prevent webcam lighting false-positives; sustained evidence across &gt;= 3 consecutive cycles (~4.5s) is required to trigger stable Drowsy.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {mobileViT.error && (
                      <p className="mt-3 max-w-sm break-words text-xs text-red-600">
                        Latest prediction error: {mobileViT.error}
                      </p>
                    )}
                  </>
                )}

                <p className="mt-4 max-w-sm text-xs text-slate-500">
                  This is an experimental image-based classification result.
                  It does not change existing MediaPipe measurements, safety
                  alerts, audio notifications, or recording.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Existing metrics panel */}
        <div>
          <MetricsPanel metrics={metrics} />
        </div>
      </div>
    </div>
  )
}