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
    <div className="py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="text-lg font-mono font-semibold text-slate-900">{value}</span>
      </div>
      {barPct !== undefined && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-75"
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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Telemetry Stream</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {active ? 'Receiving' : 'No Signal'}
          </span>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="divide-y divide-slate-100">
          <ValueRow
            label="EAR"
            value={fmt(metrics.ear?.average)}
            barPct={metrics.ear ? (metrics.ear.average / 0.4) * 100 : 0}
            barColor="#3b82f6"
          />
          <ValueRow
            label="MAR"
            value={fmt(metrics.mar)}
            barPct={metrics.mar ? (metrics.mar / 1) * 100 : 0}
            barColor="#8b5cf6"
          />
          <ValueRow
            label="PERCLOS (30s)"
            value={metrics.perclos === null ? '—' : `${metrics.perclos.toFixed(1)}%`}
            barPct={metrics.perclos ?? 0}
            barColor="#10b981"
          />
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Head Pose Matrix</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="text-[10px] uppercase text-slate-400">Pitch</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{fmtDeg(metrics.headPose?.pitch)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="text-[10px] uppercase text-slate-400">Yaw</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{fmtDeg(metrics.headPose?.yaw)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
              <p className="text-[10px] uppercase text-slate-400">Roll</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-800">{fmtDeg(metrics.headPose?.roll)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-slate-900 p-3 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System State</span>
            <span className="text-[10px] font-mono text-slate-500">T+{(metrics.timestamp / 1000).toFixed(1)}s</span>
          </div>
          {metrics.alert?.level === 'critical' ? (
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-red-400 animate-pulse">
                &gt; ALERT: PROLONGED_CLOSURE
              </div>
              <p className="mt-1 text-[11px] text-red-300/80 leading-snug">{metrics.alert.reason}</p>
            </div>
          ) : metrics.alert?.level === 'warning' ? (
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
                &gt; WARNING: ELEVATED_FATIGUE
              </div>
              <p className="mt-1 text-[11px] text-amber-300/80 leading-snug">{metrics.alert.reason}</p>
            </div>
          ) : active ? (
            <div>
              <div className="font-mono text-xs font-semibold text-emerald-400">&gt; STATUS: DRIVER_ALERT</div>
              <p className="mt-1 text-[11px] text-slate-400">Normal facial telemetry</p>
            </div>
          ) : (
            <div>
              <div className="font-mono text-xs text-slate-400">&gt; STATUS: AWAITING_SUBJECT</div>
              <p className="mt-1 text-[11px] text-slate-500">Reposition within camera view</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-[10px] text-slate-400 leading-tight">
          Prototype heuristic rules for engineering evaluation. Not clinically validated.
        </p>
      </div>
    </div>
  )
}
