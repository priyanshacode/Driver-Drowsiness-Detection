import type { CurrentMetrics } from '../metrics/types'

function fmt(n: number | null | undefined, decimals = 2): string {
  return n === null || n === undefined || Number.isNaN(n) ? '—' : n.toFixed(decimals)
}

function fmtDeg(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}°`
}

function ValueRow({
  label,
  value,
  barPct,
  barColor,
}: {
  label: string
  value: string
  barPct?: number | null
  barColor?: string
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-lg font-semibold text-slate-900">{value}</span>
      </div>
      {barPct !== undefined && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, barPct ?? 0))}%`,
              backgroundColor: barColor ?? '#3b82f6',
            }}
          />
        </div>
      )}
    </div>
  )
}

export function MetricsPanel({ metrics }: { metrics: CurrentMetrics }) {
  const active = metrics.faceDetected

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5 text-blue-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2 7 4-14 2 7h6" />
          </svg>
          Live Metrics
        </h2>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          {active ? 'Monitoring...' : 'Waiting for face'}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        <ValueRow
          label="EAR (Eye Aspect Ratio)"
          value={fmt(metrics.ear?.average)}
          barPct={metrics.ear ? (metrics.ear.average / 0.4) * 100 : 0}
          barColor="#3b82f6"
        />
        <ValueRow
          label="MAR (Mouth Aspect Ratio)"
          value={fmt(metrics.mar)}
          barPct={metrics.mar ? (metrics.mar / 1) * 100 : 0}
          barColor="#a855f7"
        />
        <ValueRow
          label="Blink Rate (1m window)"
          value={`${fmt(metrics.blinkRate, 1)} / min`}
        />
        <ValueRow
          label="Total Blinks"
          value={`${metrics.blinkCount}`}
        />
        <ValueRow
          label="PERCLOS (30s window)"
          value={metrics.perclos === null ? '—' : `${metrics.perclos.toFixed(1)}%`}
          barPct={metrics.perclos ?? 0}
          barColor="#22c55e"
        />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-medium text-slate-500">Head Pose</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-xs text-slate-400">Pitch</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{fmtDeg(metrics.headPose?.pitch)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-xs text-slate-400">Yaw</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{fmtDeg(metrics.headPose?.yaw)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-xs text-slate-400">Roll</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{fmtDeg(metrics.headPose?.roll)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-medium text-slate-500">Current Status</p>
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-lg font-semibold text-slate-400">—</p>
        </div>
      </div>
    </div>
  )
}
