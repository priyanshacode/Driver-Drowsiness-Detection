import { useState } from 'react'
import type { CameraStatus } from '../camera/useCamera'
import type { MediaPipeStatus } from '../hooks/useDrowsinessPipeline'
import type { DrowsinessAlert } from '../metrics/types'

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  cameraStatus: CameraStatus
  cameraError: string | null
  mediaPipeStatus: MediaPipeStatus
  mediaPipeError: string | null
  faceDetected: boolean
  alert?: DrowsinessAlert
}

export function CameraView({
  videoRef,
  canvasRef,
  containerRef,
  cameraStatus,
  cameraError,
  mediaPipeStatus,
  mediaPipeError,
  faceDetected,
  alert,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const showErrorOverlay = cameraStatus === 'denied' || cameraStatus === 'unavailable' || cameraStatus === 'error'
  const showMediaPipeError = mediaPipeStatus === 'error'

  const borderClass =
    alert?.level === 'critical'
      ? 'border-2 border-red-500 ring-4 ring-red-500/50'
      : alert?.level === 'warning'
        ? 'border-2 border-amber-500 ring-2 ring-amber-500/30'
        : 'border border-slate-200'

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 transition-all ${borderClass}`}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Status badges */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        {cameraStatus === 'active' ? (
          <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Camera Active
          </span>
        ) : cameraStatus === 'requesting' ? (
          <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Requesting camera...
          </span>
        ) : null}

        {cameraStatus === 'active' && mediaPipeStatus === 'ready' && !faceDetected && (
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-amber-300 backdrop-blur">
            No face detected
          </span>
        )}
        {cameraStatus === 'active' && mediaPipeStatus === 'loading' && (
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            Loading landmark model...
          </span>
        )}

        {/* Real-time Drowsiness Alert Badges */}
        {alert?.level === 'critical' && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-lg animate-pulse backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-white" />
            MICROSLEEP ALERT
          </span>
        )}
        {alert?.level === 'warning' && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 shadow-md backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-amber-950" />
            FATIGUE WARNING
          </span>
        )}
      </div>

      {cameraStatus === 'active' && (
        <button
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? (
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 5V4h5M15 9l5-5m0 5V4h-5M9 15l-5 5m0-5v5h5M15 15l5 5m0-5v5h-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
            </svg>
          )}
        </button>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-3.5 w-3.5">
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 10l6-3v10l-6-3" />
        </svg>
        Webcam
      </div>

      {showErrorOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 p-8 text-center">
          <div className="max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Camera unavailable</p>
            <p className="text-sm text-slate-300">{cameraError}</p>
          </div>
        </div>
      )}

      {showMediaPipeError && !showErrorOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 p-8 text-center">
          <div className="max-w-sm">
            <p className="mb-2 text-lg font-semibold text-white">Landmark model failed to load</p>
            <p className="text-sm text-slate-300">{mediaPipeError}</p>
          </div>
        </div>
      )}
    </div>
  )
}
