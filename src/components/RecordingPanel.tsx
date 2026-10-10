import { useEffect, useState } from 'react'
import type { RecordingState } from '../hooks/useDrowsinessPipeline'

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function RecordingPanel({
  recording,
  onStart,
  onStop,
  onDiscard,
  disabled,
}: {
  recording: RecordingState
  onStart: () => void
  onStop: () => void
  onDiscard: () => void
  disabled: boolean
}) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (recording.phase !== 'recording') return
    const id = setInterval(() => {
      setElapsedMs(performance.now() - recording.startedAt)
    }, 250)
    return () => clearInterval(id)
  }, [recording])

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            recording.phase === 'recording' ? 'bg-red-100' : 'bg-slate-100'
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${recording.phase === 'recording' ? 'animate-pulse bg-red-500' : 'bg-slate-400'}`} />
        </span>
        <div>
          <p className="font-semibold text-slate-900">
            {recording.phase === 'complete' ? 'Recording Complete' : 'Record Session'}
          </p>
          {recording.phase === 'idle' && (
            <p className="text-sm text-slate-500">Record your facial metrics for later analysis.</p>
          )}
          {recording.phase === 'recording' && (
            <p className="text-sm text-slate-500">Recording ● {formatDuration(elapsedMs)}</p>
          )}
          {recording.phase === 'complete' && (
            <p className="text-sm text-slate-500">
              Duration: {formatDuration(recording.durationMs)} &nbsp;·&nbsp; Metric samples: {recording.sampleCount}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {recording.phase === 'idle' && (
          <button
            onClick={onStart}
            disabled={disabled}
            className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            Start Recording
          </button>
        )}
        {recording.phase === 'recording' && (
          <button
            onClick={onStop}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <span className="h-2.5 w-2.5 rounded-sm bg-white" />
            Stop Recording
          </button>
        )}
        {recording.phase === 'complete' && (
          <button
            onClick={onDiscard}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Discard
          </button>
        )}
      </div>
    </div>
  )
}
