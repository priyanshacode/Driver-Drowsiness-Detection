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
    <div className="flex items-center gap-3">
      {recording.phase === 'recording' && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-100">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          {formatDuration(elapsedMs)}
        </div>
      )}

      {recording.phase === 'idle' || recording.phase === 'complete' ? (
        <button
          onClick={onStart}
          disabled={disabled}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <circle cx="12" cy="12" r="6" fill="currentColor" />
          </svg>
          Start Recording
        </button>
      ) : (
        <button
          onClick={onStop}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <rect x="6" y="6" width="12" height="12" fill="currentColor" />
          </svg>
          Stop
        </button>
      )}
    </div>
  )
}
