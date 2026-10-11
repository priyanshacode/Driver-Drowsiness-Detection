import { useEffect, useRef, useState } from 'react'
import { useCamera } from '../camera/useCamera'
import { useDrowsinessPipeline } from '../hooks/useDrowsinessPipeline'
import { CameraView } from './CameraView'
import { CalibrationTracker, type CalibrationResult } from '../features/calibration'
import type { OverlayToggles } from '../config/constants'

type CalibrationStep = 'intro' | 'gathering' | 'done' | 'error'

const CALIBRATION_DURATION_MS = 5000
const MIN_SAMPLES = 20
const TIMEOUT_MS = 15000

export function CalibrationPage({ toggles }: { toggles: OverlayToggles }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const camera = useCamera(videoRef)
  const { mediaPipeStatus, mediaPipeError, metrics } = useDrowsinessPipeline(
    videoRef,
    canvasRef,
    camera.status,
    toggles
  )

  const [step, setStep] = useState<CalibrationStep>('intro')
  const [progress, setProgress] = useState(0)
  const [validSampleCount, setValidSampleCount] = useState(0)
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Keep a ref to the latest metrics so rAF loop always reads fresh data
  // WITHOUT re-triggering the calibration loop on every metrics update!
  const metricsRef = useRef(metrics)
  useEffect(() => {
    metricsRef.current = metrics
  }, [metrics])

  const startGathering = () => {
    setErrorMessage(null)
    setProgress(0)
    setValidSampleCount(0)
    setStep('gathering')
  }

  useEffect(() => {
    if (step !== 'gathering') return

    const tracker = new CalibrationTracker(CALIBRATION_DURATION_MS, MIN_SAMPLES, TIMEOUT_MS)
    tracker.start(performance.now())

    let animId: number

    const tick = (now: number) => {
      const res = tracker.tick(now, metricsRef.current)
      setProgress(res.progress)
      setValidSampleCount(res.validSampleCount)

      if (res.status === 'complete' && res.result) {
        setCalibrationResult(res.result)
        setStep('done')
        return
      }

      if (res.status === 'timeout' || res.status === 'insufficient_samples') {
        setErrorMessage(res.error || 'Calibration failed. Please try again.')
        setStep('error')
        return
      }

      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [step])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Personalization Wizard</h1>
        <p className="mt-1 text-sm text-slate-500">Calibrate the baseline thresholds for your facial structure.</p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2">
          
          <div className="border-b border-slate-200 md:border-b-0 md:border-r bg-slate-900 p-6 flex flex-col relative overflow-hidden">
            <div className="relative z-10 flex-1">
              <div className="mb-4 aspect-video w-full overflow-hidden rounded-lg border border-slate-700 bg-black">
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
              </div>

              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${metrics.faceDetected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-xs font-mono text-slate-300">
                  {metrics.faceDetected ? 'SUBJECT ALIGNED' : 'AWAITING SUBJECT ALIGNMENT...'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-8 flex flex-col justify-center">
            {step === 'intro' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Baseline Calibration</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Facial geometries differ between individuals. To accurately measure Eye Aspect Ratio (EAR) and Mouth Aspect Ratio (MAR), we need to sample your neutral resting face.
                </p>
                <ol className="mb-8 space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">1</span>
                    Look directly at the camera.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">2</span>
                    Keep your eyes fully open and mouth relaxed.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">3</span>
                    Remain still for 5 seconds.
                  </li>
                </ol>
                <button
                  onClick={startGathering}
                  disabled={!metrics.faceDetected}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Calibration
                </button>
              </div>
            )}

            {step === 'gathering' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Sampling Data</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Hold still and maintain a neutral expression.
                </p>
                
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Progress</span>
                  <span className="flex items-center gap-2">
                    {!metrics.faceDetected && (
                      <span className="text-[10px] font-normal text-amber-600">Paused (face lost)</span>
                    )}
                    <span>{Math.round(progress)}%</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 mb-6">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-500">
                  <p className="mb-1">CURRENT_EAR: {metrics.ear ? metrics.ear.average.toFixed(3) : '---'}</p>
                  <p className="mb-1">CURRENT_MAR: {metrics.mar !== null ? metrics.mar.toFixed(3) : '---'}</p>
                  <p>VALID_SAMPLES: {validSampleCount} / {MIN_SAMPLES} min</p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setStep('intro')}
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Calibration Complete</h2>
                <p className="text-sm text-slate-600 mb-6">
                  Baseline metrics successfully recorded. These thresholds will improve accuracy during monitoring sessions.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Base EAR</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-900">{calibrationResult?.baseEar.toFixed(3) ?? '—'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Base MAR</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-900">{calibrationResult?.baseMar.toFixed(3) ?? '—'}</p>
                  </div>
                </div>

                <p className="mb-6 font-mono text-[10px] text-slate-400">
                  Calibrated across {calibrationResult?.sampleCount ?? validSampleCount} valid samples over 5.0s
                </p>

                <button
                  onClick={startGathering}
                  disabled={!metrics.faceDetected}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Recalibrate
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Calibration Failed</h2>
                <p className="text-sm text-slate-600 mb-6">
                  {errorMessage || 'Unable to collect sufficient facial landmark data. Please try again.'}
                </p>

                <div className="rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-500 mb-6">
                  <p className="mb-1">VALID_SAMPLES_COLLECTED: {validSampleCount} / {MIN_SAMPLES} min</p>
                  <p>STATUS: UNRELIABLE_DATA</p>
                </div>

                <button
                  onClick={startGathering}
                  disabled={!metrics.faceDetected}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retry Calibration
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
