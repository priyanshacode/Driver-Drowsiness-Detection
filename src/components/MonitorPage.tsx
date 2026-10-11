import { useEffect, useRef, useState } from 'react'
import { useCamera } from '../camera/useCamera'
import { useDrowsinessPipeline } from '../hooks/useDrowsinessPipeline'
import { CameraView } from './CameraView'
import { MetricsPanel } from './MetricsPanel'
import { RecordingPanel } from './RecordingPanel'
import { AlertAudioManager } from '../audio/alertAudio'
import type { OverlayToggles } from '../config/constants'
import type { RecordingSample } from '../metrics/types'

export function MonitorPage({
  toggles,
  onSaveSession
}: {
  toggles: OverlayToggles
  onSaveSession: (durationMs: number, samples: RecordingSample[]) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const camera = useCamera(videoRef)
  const { mediaPipeStatus, mediaPipeError, metrics, recording, startRecording, stopRecording, discardRecording } =
    useDrowsinessPipeline(videoRef, canvasRef, camera.status, toggles)

  // Web Audio alert synthesizer (lazy initialized)
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

  // Play audio alerts when active and triggered (cooldown is handled inside audio manager)
  useEffect(() => {
    if (camera.status === 'active' && metrics.alert) {
      audioManager.playAlert(metrics.alert.level, performance.now())
    }
  }, [camera.status, metrics.alert, audioManager])

  // Release audio resources on unmount
  useEffect(() => {
    return () => {
      audioManager.close()
    }
  }, [audioManager])

  // Automatically save and discard when a recording completes
  useEffect(() => {
    if (recording.phase === 'complete') {
      onSaveSession(recording.durationMs, recording.samples)
      discardRecording()
    }
  }, [recording, onSaveSession, discardRecording])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Telemetry</h1>
          <p className="mt-1 text-sm text-slate-500">Real-time geometric feature extraction pipeline and rule-based safety alerts.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Accessible Audio Mute/Unmute Toggle */}
          <button
            onClick={handleToggleMute}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
              isMuted
                ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
            aria-label={isMuted ? 'Unmute audible alerts' : 'Mute audible alerts'}
            title={isMuted ? 'Alerts muted (Click to unmute)' : 'Alert audio active (Click to mute)'}
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
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
            disabled={camera.status !== 'active' || mediaPipeStatus !== 'ready'}
          />
        </div>
      </header>

      {/* Prominent High-Visibility Alert Banners */}
      {metrics.alert?.level === 'critical' && (
        <div className="flex items-center gap-4 rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm animate-pulse">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-md">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold tracking-wide text-red-950 uppercase">CRITICAL ALERT: PROLONGED EYE CLOSURE</h2>
            <p className="mt-0.5 text-xs font-medium text-red-800">{metrics.alert.reason}</p>
          </div>
        </div>
      )}

      {metrics.alert?.level === 'warning' && (
        <div className="flex items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-md">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold tracking-wide text-amber-950 uppercase">WARNING: ELEVATED FATIGUE PATTERN</h2>
            <p className="mt-0.5 text-xs font-medium text-amber-800">{metrics.alert.reason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">Camera Feed</h2>
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

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Appearance-Based Features (Module 2)</h2>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending</span>
            </div>
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">MobileViT Model Not Loaded</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Module 2 will integrate a MobileViT deep learning model to extract spatial features directly from image crops, complementing the geometric heuristics.
              </p>
            </div>
          </div>
        </div>

        <div>
          <MetricsPanel metrics={metrics} />
        </div>
      </div>
    </div>
  )
}
