import { useRef } from 'react'
import { useCamera } from '../camera/useCamera'
import { useDrowsinessPipeline } from '../hooks/useDrowsinessPipeline'
import { CameraView } from './CameraView'
import { MetricsPanel } from './MetricsPanel'
import { RecordingPanel } from './RecordingPanel'
import type { OverlayToggles } from '../config/constants'

export function MonitorPage({ toggles }: { toggles: OverlayToggles }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const camera = useCamera(videoRef)
  const { mediaPipeStatus, mediaPipeError, metrics, recording, startRecording, stopRecording, discardRecording } =
    useDrowsinessPipeline(videoRef, canvasRef, camera.status, toggles)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Driver Drowsiness Monitor</h1>
          <p className="mt-1 text-slate-500">Use your webcam to monitor facial measurements in real time.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5 text-blue-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
          </svg>
          <div className="text-sm">
            <p className="font-semibold text-blue-700">Measurement Prototype</p>
            <p className="text-blue-500">Facial features only — no drowsiness classification yet.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <CameraView
          videoRef={videoRef}
          canvasRef={canvasRef}
          containerRef={containerRef}
          cameraStatus={camera.status}
          cameraError={camera.errorMessage}
          mediaPipeStatus={mediaPipeStatus}
          mediaPipeError={mediaPipeError}
          faceDetected={metrics.faceDetected}
        />
        <MetricsPanel metrics={metrics} />
      </div>

      <RecordingPanel
        recording={recording}
        onStart={startRecording}
        onStop={stopRecording}
        onDiscard={discardRecording}
        disabled={camera.status !== 'active' || mediaPipeStatus !== 'ready'}
      />

      <p className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4 shrink-0 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
        </svg>
        This tool is a facial-measurement research prototype only. It does not detect drowsiness and is not medical advice.
      </p>
    </div>
  )
}
