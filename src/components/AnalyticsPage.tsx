import { useMemo, useState } from 'react'
import type { SessionRecord } from '../App'

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const tenths = Math.floor((ms % 1000) / 100)
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${tenths}`
}

function exportSessionToCsv(session: SessionRecord): void {
  const headers = [
    'timestamp_epoch_ms',
    'elapsed_seconds',
    'face_detected',
    'ear_left',
    'ear_right',
    'ear_average',
    'mar',
    'perclos_pct',
    'head_pitch_deg',
    'head_yaw_deg',
    'head_roll_deg',
    'alert_level',
    'alert_reason',
    'mobilevit_drowsy_pct',
    'mobilevit_nondrowsy_pct',
    'mobilevit_label',
    'mobilevit_latency_ms',
  ]

  const rows = session.samples.map((s) => [
    s.timestamp,
    (s.elapsedTime / 1000).toFixed(2),
    s.faceDetected ? '1' : '0',
    s.earLeft !== null ? s.earLeft.toFixed(4) : '',
    s.earRight !== null ? s.earRight.toFixed(4) : '',
    s.earAverage !== null ? s.earAverage.toFixed(4) : '',
    s.mar !== null ? s.mar.toFixed(4) : '',
    s.perclos !== null ? s.perclos.toFixed(2) : '',
    s.pitch !== null ? s.pitch.toFixed(2) : '',
    s.yaw !== null ? s.yaw.toFixed(2) : '',
    s.roll !== null ? s.roll.toFixed(2) : '',
    s.alertLevel ?? 'normal',
    s.alertReason ? `"${s.alertReason.replace(/"/g, '""')}"` : '',
    s.mobileViTScore !== null && s.mobileViTScore !== undefined ? s.mobileViTScore.toFixed(1) : '',
    s.mobileViTNonDrowsy !== null && s.mobileViTNonDrowsy !== undefined ? s.mobileViTNonDrowsy.toFixed(1) : '',
    s.mobileViTLabel ?? '',
    s.mobileViTLatencyMs ?? '',
  ])

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  let dateSlug = 'session'
  try {
    dateSlug = new Date(session.date).toISOString().replace(/[:.]/g, '-').slice(0, 19)
  } catch {
    dateSlug = String(session.id || 'export')
  }
  link.setAttribute('download', `drivewatch_telemetry_${dateSlug}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * High-performance, responsive SVG Time-Series Chart.
 * Pure React SVG rendering with zero external library dependencies.
 */
function TelemetrySvgChart({
  title,
  subtitle,
  data,
  thresholds = [],
  color = '#2563eb',
  unit = '',
  yMin,
  yMax,
  height = 180,
}: {
  title: string
  subtitle?: string
  data: { x: number; y: number | null }[]
  thresholds?: { value: number; label: string; color: string }[]
  color?: string
  unit?: string
  yMin?: number
  yMax?: number
  height?: number
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const validPoints = useMemo(() => data.filter((d) => d.y !== null && Number.isFinite(d.y)), [data])

  const { computedMinY, computedMaxY } = useMemo(() => {
    if (validPoints.length === 0) return { computedMinY: 0, computedMaxY: 1 }
    const vals = validPoints.map((d) => d.y as number)
    const minVal = yMin !== undefined ? yMin : Math.min(...vals, ...thresholds.map((t) => t.value))
    const maxVal = yMax !== undefined ? yMax : Math.max(...vals, ...thresholds.map((t) => t.value))
    const range = maxVal - minVal || 1
    return {
      computedMinY: yMin !== undefined ? yMin : Math.max(0, minVal - range * 0.05),
      computedMaxY: yMax !== undefined ? yMax : maxVal + range * 0.05,
    }
  }, [validPoints, yMin, yMax, thresholds])

  const maxX = useMemo(() => {
    if (data.length === 0) return 1
    return Math.max(...data.map((d) => d.x)) || 1
  }, [data])

  // Chart coordinates
  const svgWidth = 800
  const svgHeight = height
  const padLeft = 46
  const padRight = 16
  const padTop = 16
  const padBottom = 26
  const plotWidth = svgWidth - padLeft - padRight
  const plotHeight = svgHeight - padTop - padBottom

  const scaleX = (x: number) => padLeft + (x / maxX) * plotWidth
  const scaleY = (y: number) =>
    padTop + plotHeight - ((y - computedMinY) / (computedMaxY - computedMinY || 1)) * plotHeight

  // Generate SVG path for line
  const { pathD, areaD } = useMemo(() => {
    if (data.length === 0) return { pathD: '', areaD: '' }

    let path = ''
    let isDrawing = false

    data.forEach((pt) => {
      if (pt.y === null || !Number.isFinite(pt.y)) {
        isDrawing = false
        return
      }
      const x = padLeft + (pt.x / maxX) * plotWidth
      const y =
        padTop + plotHeight - ((pt.y - computedMinY) / (computedMaxY - computedMinY || 1)) * plotHeight

      if (!isDrawing) {
        path += `M ${x.toFixed(1)} ${y.toFixed(1)} `
        isDrawing = true
      } else {
        path += `L ${x.toFixed(1)} ${y.toFixed(1)} `
      }
    })

    const area = path
      ? `${path} L ${padLeft + plotWidth} ${padTop + plotHeight} L ${padLeft} ${padTop + plotHeight} Z`
      : ''

    return { pathD: path, areaD: area }
  }, [data, maxX, computedMinY, computedMaxY, padLeft, padTop, plotWidth, plotHeight])

  const hoveredPoint = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {hoveredPoint && hoveredPoint.y !== null && (
          <div className="font-mono text-xs font-semibold text-slate-700">
            t={(hoveredPoint.x / 1000).toFixed(1)}s: {hoveredPoint.y.toFixed(2)}
            {unit}
          </div>
        )}
      </div>

      <div className="relative mt-2 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full select-none"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const ratio = (mouseX / rect.width) * svgWidth
            const plotX = ratio - padLeft
            if (plotX >= 0 && plotX <= plotWidth && data.length > 0) {
              const targetX = (plotX / plotWidth) * maxX
              // Find closest point
              let closestIdx = 0
              let minDiff = Infinity
              data.forEach((d, idx) => {
                const diff = Math.abs(d.x - targetX)
                if (diff < minDiff) {
                  minDiff = diff
                  closestIdx = idx
                }
              })
              setHoverIndex(closestIdx)
            }
          }}
        >
          {/* Background plot rect */}
          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            fill="#f8fafc"
            rx={4}
          />

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const yVal = computedMinY + pct * (computedMaxY - computedMinY)
            const yPos = scaleY(yVal)
            return (
              <g key={pct}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={padLeft + plotWidth}
                  y2={yPos}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={yPos + 3}
                  textAnchor="end"
                  className="font-mono text-[9px] fill-slate-400"
                >
                  {yVal.toFixed(1)}
                  {unit}
                </text>
              </g>
            )
          })}

          {/* Configured Threshold lines */}
          {thresholds.map((th) => {
            if (th.value < computedMinY || th.value > computedMaxY) return null
            const yPos = scaleY(th.value)
            return (
              <g key={th.label}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={padLeft + plotWidth}
                  y2={yPos}
                  stroke={th.color}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text
                  x={padLeft + plotWidth - 4}
                  y={yPos - 3}
                  textAnchor="end"
                  fill={th.color}
                  className="font-mono text-[9px] font-semibold"
                >
                  {th.label} ({th.value.toFixed(2)}
                  {unit})
                </text>
              </g>
            )
          })}

          {/* Area fill */}
          {areaD && <path d={areaD} fill={color} fillOpacity="0.08" />}

          {/* Main data curve */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover Crosshair & Dot */}
          {hoveredPoint && hoveredPoint.y !== null && (
            <g>
              <line
                x1={scaleX(hoveredPoint.x)}
                y1={padTop}
                x2={scaleX(hoveredPoint.x)}
                y2={padTop + plotHeight}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={scaleX(hoveredPoint.x)}
                cy={scaleY(hoveredPoint.y)}
                r="4.5"
                fill={color}
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X-axis time ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const timeSec = (pct * maxX) / 1000
            const xPos = padLeft + pct * plotWidth
            return (
              <text
                key={pct}
                x={xPos}
                y={padTop + plotHeight + 15}
                textAnchor="middle"
                className="font-mono text-[9px] fill-slate-400"
              >
                {timeSec.toFixed(0)}s
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export function AnalyticsPage({
  sessions,
  onDeleteSession,
}: {
  sessions: SessionRecord[]
  onDeleteSession: (id: string) => void
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessions.length > 0 ? sessions[0].id : null,
  )
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'warning'>('all')

  const activeSession = useMemo(() => {
    if (sessions.length === 0) return null
    if (!selectedSessionId) return sessions[0]
    return sessions.find((s) => s.id === selectedSessionId) ?? sessions[0]
  }, [sessions, selectedSessionId])

  // Derive comprehensive telemetry statistics from the active session
  const stats = useMemo(() => {
    if (!activeSession || activeSession.samples.length === 0) return null

    const totalSamples = activeSession.samples.length
    let trackedSamples = 0
    let minEar = Infinity
    let maxEar = -Infinity
    let sumEar = 0
    let earCount = 0

    let minMar = Infinity
    let maxMar = -Infinity
    let sumMar = 0
    let marCount = 0

    let sumPerclos = 0
    let maxPerclos = 0
    let perclosCount = 0

    let mobileViTDrowsyCount = 0
    let mobileViTNonDrowsyCount = 0
    let mobileViTUncertainCount = 0
    let sumLatency = 0
    let latencyCount = 0

    activeSession.samples.forEach((s) => {
      if (s.faceDetected) {
        trackedSamples++
      }

      if (s.earAverage !== null && Number.isFinite(s.earAverage)) {
        if (s.earAverage < minEar) minEar = s.earAverage
        if (s.earAverage > maxEar) maxEar = s.earAverage
        sumEar += s.earAverage
        earCount++
      }

      if (s.mar !== null && Number.isFinite(s.mar)) {
        if (s.mar < minMar) minMar = s.mar
        if (s.mar > maxMar) maxMar = s.mar
        sumMar += s.mar
        marCount++
      }

      if (s.perclos !== null && Number.isFinite(s.perclos)) {
        sumPerclos += s.perclos
        if (s.perclos > maxPerclos) maxPerclos = s.perclos
        perclosCount++
      }

      if (s.mobileViTLabel) {
        if (s.mobileViTLabel === 'Drowsy') mobileViTDrowsyCount++
        else if (s.mobileViTLabel === 'Non Drowsy') mobileViTNonDrowsyCount++
        else if (s.mobileViTLabel === 'Uncertain') mobileViTUncertainCount++
      }

      if (s.mobileViTLatencyMs !== null && s.mobileViTLatencyMs !== undefined && s.mobileViTLatencyMs > 0) {
        sumLatency += s.mobileViTLatencyMs
        latencyCount++
      }
    })

    const trackingPct = totalSamples > 0 ? (trackedSamples / totalSamples) * 100 : 0
    const missingDurationMs = ((totalSamples - trackedSamples) / (totalSamples || 1)) * activeSession.durationMs
    const avgFps = activeSession.durationMs > 0 ? (totalSamples / (activeSession.durationMs / 1000)) : 0

    const criticalAlertsCount = activeSession.alerts?.filter((a) => a.level === 'critical').length ?? 0
    const warningAlertsCount = activeSession.alerts?.filter((a) => a.level === 'warning').length ?? 0

    return {
      totalSamples,
      trackedSamples,
      trackingPct,
      missingDurationMs,
      avgFps,
      minEar: earCount > 0 ? minEar : null,
      maxEar: earCount > 0 ? maxEar : null,
      avgEar: earCount > 0 ? sumEar / earCount : null,
      minMar: marCount > 0 ? minMar : null,
      maxMar: marCount > 0 ? maxMar : null,
      avgMar: marCount > 0 ? sumMar / marCount : null,
      avgPerclos: perclosCount > 0 ? sumPerclos / perclosCount : null,
      maxPerclos: perclosCount > 0 ? maxPerclos : null,
      criticalAlertsCount,
      warningAlertsCount,
      totalAlertsCount: criticalAlertsCount + warningAlertsCount,
      mobileViTTotal: mobileViTDrowsyCount + mobileViTNonDrowsyCount + mobileViTUncertainCount,
      mobileViTDrowsyCount,
      mobileViTNonDrowsyCount,
      mobileViTUncertainCount,
      avgLatencyMs: latencyCount > 0 ? Math.round(sumLatency / latencyCount) : null,
    }
  }, [activeSession])

  // Filtered alert list
  const filteredAlerts = useMemo(() => {
    if (!activeSession || !activeSession.alerts) return []
    if (alertFilter === 'all') return activeSession.alerts
    return activeSession.alerts.filter((a) => a.level === alertFilter)
  }, [activeSession, alertFilter])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Page Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Telemetry & Model Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Comprehensive session review of geometric fatigue metrics, alert timelines, and experimental MobileViT evaluations.
          </p>
        </div>

        {sessions.length > 0 && activeSession && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => exportSessionToCsv(activeSession)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-blue-700"
              title="Download entire session telemetry as standard CSV"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.5V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Export Session CSV</span>
            </button>

            <button
              onClick={() => onDeleteSession(activeSession.id)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
              title="Delete this session"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete</span>
            </button>
          </div>
        )}
      </header>

      {/* In-Memory Persistence Transparency Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 shadow-xs">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <div>
          <span className="font-semibold">Local Session Storage:</span> Recorded sessions reside in browser runtime memory and are cleared on page reload. Click <strong>Export Session CSV</strong> to preserve records for academic project evaluation and model fine-tuning.
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="h-7 w-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">No Recorded Sessions Yet</h3>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            Start a monitoring session on the <strong>Live Telemetry</strong> tab and click <strong>Start Recording</strong> to collect high-density driver state telemetry.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Section A: Session Controls and Overview Cards */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label htmlFor="session-select" className="text-xs font-semibold uppercase text-slate-500">
                  Selected Session ({sessions.length} total)
                </label>
                <select
                  id="session-select"
                  value={activeSession?.id ?? ''}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none"
                >
                  {sessions.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      Session #{sessions.length - idx} — {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({formatDuration(s.durationMs)}, {s.samples.length} samples)
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-right text-xs text-slate-500">
                <span className="font-medium text-slate-700">Timestamp:</span> {activeSession ? new Date(activeSession.date).toLocaleString() : '—'}
              </div>
            </div>

            {/* Overview KPI Cards */}
            {stats && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Duration & Samples</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{formatDuration(activeSession!.durationMs)}</p>
                  <p className="text-[10px] text-slate-500">{stats.totalSamples} samples @ ~{stats.avgFps.toFixed(1)} Hz</p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Face Tracking</p>
                  <p className={`mt-0.5 text-lg font-bold ${stats.trackingPct >= 90 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {stats.trackingPct.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-slate-500">Lost: {(stats.missingDurationMs / 1000).toFixed(1)}s</p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Critical Alerts</p>
                  <p className={`mt-0.5 text-lg font-bold ${stats.criticalAlertsCount > 0 ? 'text-red-700' : 'text-slate-800'}`}>
                    {stats.criticalAlertsCount}
                  </p>
                  <p className="text-[10px] text-slate-500">Warnings: {stats.warningAlertsCount}</p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Avg PERCLOS</p>
                  <p className={`mt-0.5 text-lg font-bold ${stats.avgPerclos !== null && stats.avgPerclos >= 15 ? 'text-amber-700' : 'text-slate-900'}`}>
                    {stats.avgPerclos !== null ? `${stats.avgPerclos.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500">Peak: {stats.maxPerclos !== null ? `${stats.maxPerclos.toFixed(1)}%` : '—'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section B: Time-Series Geometric Telemetry Charts */}
          {activeSession && (
            activeSession.samples.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-800">Empty Recording Session</h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  This session was saved before any camera frames could be processed. Metric trajectories, alerts, and model evaluations require at least one recorded sample.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Geometric Drowsiness Metrics</h3>

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* 1. Eye Aspect Ratio (EAR) */}
                <TelemetrySvgChart
                  title="Eye Aspect Ratio (EAR)"
                  subtitle="Primary geometric eye-opening indicator. Dips below 0.20 indicate closed eyelids."
                  unit=""
                  yMin={0.0}
                  yMax={0.45}
                  data={activeSession.samples.map((s) => ({ x: s.elapsedTime, y: s.earAverage }))}
                  thresholds={[{ value: 0.20, label: 'Closed Eyelid Threshold', color: '#dc2626' }]}
                  color="#2563eb"
                />

                {/* 2. PERCLOS (%) */}
                <TelemetrySvgChart
                  title="PERCLOS Trend (%)"
                  subtitle="Proportion of time eye is >=80% closed over rolling 30s evaluation window."
                  unit="%"
                  yMin={0.0}
                  yMax={40.0}
                  data={activeSession.samples.map((s) => ({ x: s.elapsedTime, y: s.perclos }))}
                  thresholds={[{ value: 15.0, label: 'Elevated PERCLOS Alert (15%)', color: '#d97706' }]}
                  color="#d97706"
                />

                {/* 3. Mouth Aspect Ratio (MAR) */}
                <TelemetrySvgChart
                  title="Mouth Aspect Ratio (MAR)"
                  subtitle="Mouth opening ratio. Sustained spikes above 0.50 indicate yawning episodes."
                  unit=""
                  yMin={0.0}
                  yMax={0.9}
                  data={activeSession.samples.map((s) => ({ x: s.elapsedTime, y: s.mar }))}
                  thresholds={[{ value: 0.50, label: 'Yawn Threshold', color: '#9333ea' }]}
                  color="#9333ea"
                />

                {/* 4. Head Pose (Pitch in Degrees) */}
                <TelemetrySvgChart
                  title="Head Pose Pitch (Degrees)"
                  subtitle="Vertical head tilt angle from facial transform matrix. Negative pitch indicates head nods."
                  unit="°"
                  yMin={-35.0}
                  yMax={35.0}
                  data={activeSession.samples.map((s) => ({ x: s.elapsedTime, y: s.pitch }))}
                  thresholds={[{ value: 0.0, label: 'Neutral Axis', color: '#94a3b8' }]}
                  color="#0891b2"
                />
              </div>
            </div>

            {/* Section C: Alert Timeline Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Safety Alert Timeline</h3>
                  <p className="text-xs text-slate-500">
                    Timestamped record of rule-based critical microsleep and warning threshold triggers.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setAlertFilter('all')}
                    className={`rounded-md px-2.5 py-1 ${alertFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    All ({activeSession.alerts?.length ?? 0})
                  </button>
                  <button
                    onClick={() => setAlertFilter('critical')}
                    className={`rounded-md px-2.5 py-1 ${alertFilter === 'critical' ? 'bg-red-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Critical ({stats?.criticalAlertsCount ?? 0})
                  </button>
                  <button
                    onClick={() => setAlertFilter('warning')}
                    className={`rounded-md px-2.5 py-1 ${alertFilter === 'warning' ? 'bg-amber-500 text-slate-950' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Warning ({stats?.warningAlertsCount ?? 0})
                  </button>
                </div>
              </div>

              {filteredAlerts.length === 0 ? (
                <div className="flex items-center justify-center p-8 text-center text-xs text-slate-500">
                  <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    No {alertFilter !== 'all' ? alertFilter : ''} safety alerts occurred during this recorded session.
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Elapsed Time</th>
                        <th className="px-5 py-3">Severity</th>
                        <th className="px-5 py-3">Trigger Reason</th>
                        <th className="px-5 py-3">EAR at Trigger</th>
                        <th className="px-5 py-3">PERCLOS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAlerts.map((alt) => (
                        <tr key={alt.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-mono font-medium text-slate-700">
                            +{formatElapsed(alt.elapsedTimeMs)}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                alt.level === 'critical'
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {alt.level}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-800">{alt.reason}</td>
                          <td className="px-5 py-3 font-mono text-slate-600">
                            {alt.ear !== null && alt.ear !== undefined ? alt.ear.toFixed(3) : '—'}
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-600">
                            {alt.perclos !== null && alt.perclos !== undefined ? `${alt.perclos.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section D: MobileViT Experimental Analytics */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      MobileViT v2 Experimental Model Analytics (Module 2)
                    </h3>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
                      Appearance ML
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Temporal distribution and classification score trajectory from the deep learning pipeline.
                  </p>
                </div>
              </div>

              {/* Research Disclaimer */}
              <p className="text-[11px] leading-relaxed text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                <strong>Academic Model Note:</strong> MobileViT scores reflect vision-transformer feature activations on cropped face images. The percentages represent model output distribution on academic training weights, not clinical ground truth. Accuracy and confusion matrices are intentionally not computed without verified independent ground-truth labels.
              </p>

              {stats && stats.mobileViTTotal > 0 ? (
                <div className="flex flex-col gap-4">
                  {/* ML Performance Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Total Evaluations</p>
                      <p className="mt-0.5 font-mono text-lg font-bold text-slate-900">{stats.mobileViTTotal}</p>
                      <p className="text-[10px] text-slate-500">Avg Latency: {stats.avgLatencyMs ?? '—'} ms</p>
                    </div>

                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="text-[10px] font-semibold uppercase text-emerald-800">Non-Drowsy / Alert</p>
                      <p className="mt-0.5 font-mono text-lg font-bold text-emerald-800">{stats.mobileViTNonDrowsyCount}</p>
                      <p className="text-[10px] text-emerald-700">
                        {((stats.mobileViTNonDrowsyCount / stats.mobileViTTotal) * 100).toFixed(1)}% of evaluations
                      </p>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-[10px] font-semibold uppercase text-amber-800">Drowsy (Sustained)</p>
                      <p className="mt-0.5 font-mono text-lg font-bold text-amber-800">{stats.mobileViTDrowsyCount}</p>
                      <p className="text-[10px] text-amber-700">
                        {((stats.mobileViTDrowsyCount / stats.mobileViTTotal) * 100).toFixed(1)}% of evaluations
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-100/60 p-3">
                      <p className="text-[10px] font-semibold uppercase text-slate-600">Uncertain / Ambiguous</p>
                      <p className="mt-0.5 font-mono text-lg font-bold text-slate-700">{stats.mobileViTUncertainCount}</p>
                      <p className="text-[10px] text-slate-500">
                        {((stats.mobileViTUncertainCount / stats.mobileViTTotal) * 100).toFixed(1)}% of evaluations
                      </p>
                    </div>
                  </div>

                  {/* ML Score History Chart */}
                  <TelemetrySvgChart
                    title="MobileViT Drowsy Score Trajectory (%)"
                    subtitle="Model confidence probability over time. Evaluated at ~1.5s intervals on cropped face frames."
                    unit="%"
                    yMin={0.0}
                    yMax={100.0}
                    data={activeSession.samples
                      .filter((s) => s.mobileViTScore !== null && s.mobileViTScore !== undefined)
                      .map((s) => ({ x: s.elapsedTime, y: s.mobileViTScore ?? null }))}
                    thresholds={[
                      { value: 65.0, label: 'Elevated Threshold (>=65%)', color: '#ea580c' },
                      { value: 45.0, label: 'Alert Threshold (<=45%)', color: '#16a34a' },
                    ]}
                    color="#2563eb"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  No MobileViT evaluation samples were captured in this recording session (either camera was stopped or model was initializing).
                </div>
              )}
            </div>
          </>
        ))}
      </div>
    )}
  </div>
)
}
