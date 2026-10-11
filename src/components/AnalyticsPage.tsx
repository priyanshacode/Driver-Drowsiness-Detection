import type { SessionRecord } from '../App'
import { useMemo } from 'react'

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function AnalyticsPage({
  sessions,
  onDeleteSession,
}: {
  sessions: SessionRecord[]
  onDeleteSession: (id: string) => void
}) {
  const hasSessions = sessions.length > 0

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Session Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Review historical telemetry and derived fatigue metrics.</p>
      </header>

      {!hasSessions ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1} stroke="currentColor" className="mb-4 h-12 w-12 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="text-sm font-medium text-slate-600">No session data available</p>
          <p className="mt-1 text-xs text-slate-500">Record a session in the Live Monitoring tab to see analytics here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} onDelete={() => onDeleteSession(session.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function SessionCard({ session, onDelete }: { session: SessionRecord; onDelete: () => void }) {
  const dateStr = new Date(session.date).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Derive some basic stats from the samples.
  const stats = useMemo(() => {
    let validSamples = 0
    let minEar = 1.0
    let maxEar = 0.0
    let sumPerclos = 0
    let perclosCount = 0

    session.samples.forEach((s) => {
      validSamples++
      if (s.earAverage < minEar) minEar = s.earAverage
      if (s.earAverage > maxEar) maxEar = s.earAverage
      
      if (s.perclos !== null) {
        sumPerclos += s.perclos
        perclosCount++
      }
    })

    const avgPerclos = perclosCount > 0 ? sumPerclos / perclosCount : null
    const avgFps = session.durationMs > 0 ? (validSamples / session.durationMs) * 1000 : 0

    return {
      validSamples,
      minEar: validSamples > 0 ? minEar : null,
      maxEar: validSamples > 0 ? maxEar : null,
      avgPerclos,
      avgFps,
    }
  }, [session.samples, session.durationMs])

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-200 text-slate-600">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{dateStr}</h3>
            <p className="text-xs text-slate-500">
              Duration: {formatDuration(session.durationMs)} &nbsp;·&nbsp; Samples: {session.samples.length}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          title="Delete Session"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Average FPS</p>
            <p className="mt-1 font-mono text-lg font-medium text-slate-900">{stats.avgFps.toFixed(1)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Min EAR</p>
            <p className="mt-1 font-mono text-lg font-medium text-slate-900">{stats.minEar?.toFixed(3) ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Max EAR</p>
            <p className="mt-1 font-mono text-lg font-medium text-slate-900">{stats.maxEar?.toFixed(3) ?? '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg PERCLOS</p>
            <p className="mt-1 font-mono text-lg font-medium text-slate-900">
              {stats.avgPerclos !== null ? `${stats.avgPerclos.toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Minimal inline chart representation for EAR */}
        <div className="h-24 w-full flex items-end gap-px bg-slate-50 rounded p-2 border border-slate-100 overflow-hidden">
          {session.samples.length > 0 ? (
            session.samples.map((s, i) => {
              // downsample heavily for display: e.g. show ~100 bars max
              const step = Math.max(1, Math.floor(session.samples.length / 100))
              if (i % step !== 0) return null
              
              const h = (s.earAverage / 0.4) * 100
              return (
                <div 
                  key={i} 
                  className="flex-1 bg-blue-400"
                  style={{ height: `${Math.min(100, Math.max(0, h))}%` }}
                />
              )
            })
          ) : null}
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400 uppercase tracking-wider">EAR over time</p>
      </div>
    </div>
  )
}
