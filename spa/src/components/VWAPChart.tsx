import { useRef, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Bar,
  Brush,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts'
import { useVWAPStore } from '../store/useVWAPStore'
import { mergeCurveData, timeToMinutes, minutesToHHMM } from '../lib/curveUtils'
import { exportChart, type ExportFormat } from '../lib/chartExport'
import type { YAxisKey } from '../store/useVWAPStore'
import type { VWAPCurve } from '../types'

const TZ_SHORT: Record<string, string> = {
  'America/New_York':   'ET',
  'America/Chicago':    'CT',
  'America/Los_Angeles':'PT',
  'Europe/London':      'GMT/BST',
  'Europe/Berlin':      'CET',
  'Europe/Rome':        'CET',
  'Asia/Tokyo':         'JST',
  'Asia/Singapore':     'SGT',
  'Asia/Hong_Kong':     'HKT',
  'Australia/Sydney':   'AEST',
  'UTC':                'UTC',
}

function tzLabel(tzOverride: string): string {
  if (!tzOverride) return 'UTC'
  return TZ_SHORT[tzOverride] ?? tzOverride
}

function curveTzLabel(curves: VWAPCurve[]): string {
  const tz = curves.find((c) => c.visible && c.params)?.params?.tzOverride ?? ''
  return tzLabel(tz)
}

const Y_AXIS_LABELS: Record<YAxisKey, string> = {
  PctBuckets: 'Pct Buckets (raw)',
  Smoothed: 'Smoothed %',
  AvgVolume: 'Avg Volume (contracts)',
}

const CHART_STYLE = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#111827',
  },
  labelStyle: { color: '#374151' },
  itemStyle: { color: '#374151' },
}

// ── Per-panel export toolbar ──────────────────────────────────────────────────

function ExportBar({
  label,
  chartRef,
}: {
  label: string
  chartRef: React.RefObject<HTMLDivElement | null>
}) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  async function handle(fmt: ExportFormat) {
    if (!chartRef.current || exporting) return
    setExporting(fmt)
    try {
      await exportChart(chartRef.current, label, fmt)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <span className="text-xs text-gray-400 mr-1">Export:</span>
      {(['svg', 'png', 'jpg'] as ExportFormat[]).map((fmt) => (
        <button
          key={fmt}
          onClick={() => handle(fmt)}
          disabled={exporting !== null}
          className="text-xs text-gray-400 hover:text-blue-600 uppercase tracking-wide transition-colors disabled:opacity-40 px-1 font-medium"
          title={`Export as ${fmt.toUpperCase()}`}
        >
          {exporting === fmt ? '…' : fmt}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VWAPChart() {
  const { curves, yAxis, setYAxis, today, todayVisible, simulation } = useVWAPStore((s) => ({
    curves: s.curves,
    yAxis: s.yAxis,
    setYAxis: s.setYAxis,
    today: s.today,
    todayVisible: s.todayVisible,
    simulation: s.simulation,
  }))

  const profileRef = useRef<HTMLDivElement>(null)
  const priceRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<HTMLDivElement>(null)

  const todayProfile = todayVisible && today ? today.profile : undefined
  const mergedData = mergeCurveData(curves, yAxis, todayProfile)

  const showToday = !!(todayVisible && today && today.bars.length > 0)
  const showSim = simulation.length > 0
  const hasCurves = mergedData.length > 0

  const priceData = showToday ? today!.bars.map((b) => ({ time: b.time, close: b.close })) : []

  const simMins = showSim
    ? simulation.flatMap((s) => s.schedule.map((p) => timeToMinutes(p.time)))
    : []
  const simXMin = simMins.length ? Math.min(...simMins) : 0
  const simXMax = simMins.length ? Math.max(...simMins) : 1440

  const simHourTicks: number[] = []
  if (showSim) {
    for (let h = Math.ceil(simXMin / 60); h <= Math.floor(simXMax / 60); h++) {
      simHourTicks.push(h * 60)
    }
  }

  return (
    <div className="space-y-6">
      {/* Y-axis toggle */}
      <div className="flex gap-1.5 flex-wrap">
        {(['Smoothed', 'PctBuckets', 'AvgVolume'] as YAxisKey[]).map((v) => (
          <button
            key={v}
            onClick={() => setYAxis(v)}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              yAxis === v
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            {v === 'PctBuckets' ? 'Pct Buckets' : v}
          </button>
        ))}
      </div>

      {/* ── Main VWAP Profile Chart ── */}
      {!hasCurves ? (
        <div className="h-72 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg gap-2 bg-white">
          <p className="text-sm font-medium text-gray-500">No curves loaded</p>
          <p className="text-xs">Generate a Bloomberg curve or import a CSV to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-600">
              VWAP Volume Profile · {Y_AXIS_LABELS[yAxis]}
              <span className="ml-2 text-gray-400">· {curveTzLabel(curves)}</span>
              {today && todayVisible && (
                <span className="ml-2 text-gray-400">· bars = today ({today.date})</span>
              )}
            </p>
            <ExportBar label="vwap_profile" chartRef={profileRef} />
          </div>

          <div ref={profileRef} className="bg-white">
            <ResponsiveContainer width="100%" height={600}>
              <ComposedChart
                data={mergedData}
                syncId="vwap-chart"
                margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  interval={29}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickFormatter={(v: number) =>
                    yAxis === 'AvgVolume' ? v.toFixed(1) : v.toFixed(2)
                  }
                  width={52}
                />
                <Tooltip
                  {...CHART_STYLE}
                  formatter={(v: unknown) =>
                    typeof v === 'number'
                      ? [yAxis === 'AvgVolume' ? v.toFixed(2) : v.toFixed(4)]
                      : [String(v)]
                  }
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                {/* Today's volume as solid bars (behind the historical lines) */}
                {todayProfile && (
                  <Bar
                    dataKey="__today__"
                    name={`Today (${today!.date})`}
                    fill="#94a3b8"
                    opacity={0.5}
                    barSize={2}
                    isAnimationActive={false}
                  />
                )}

                {/* Historical curves */}
                {curves.filter((c) => c.visible).map((c) => (
                  <Line
                    key={c.id}
                    dataKey={c.id}
                    name={c.label}
                    stroke={c.color}
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}

                <Brush
                  dataKey="time"
                  height={24}
                  stroke="#d1d5db"
                  fill="#f9fafb"
                  travellerWidth={6}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Today's Price Chart ── */}
      {showToday && priceData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-600">
              Today's Last Price · {today!.date}
              <span className="ml-2 text-gray-400">· {tzLabel(today!.tzOverride)}</span>
            </p>
            <ExportBar label={`price_${today!.date}`} chartRef={priceRef} />
          </div>

          <div ref={priceRef} className="bg-white">
            <ResponsiveContainer width="100%" height={360}>
              <LineChart
                data={priceData}
                syncId="vwap-chart"
                margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  interval={29}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  width={52}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  {...CHART_STYLE}
                  formatter={(v: unknown) =>
                    typeof v === 'number' ? [v.toFixed(2)] : [String(v)]
                  }
                />
                <Line
                  dataKey="close"
                  name="Last Price"
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls={false}
                  isAnimationActive={false}
                />

                <Brush
                  dataKey="time"
                  height={24}
                  stroke="#d1d5db"
                  fill="#f9fafb"
                  travellerWidth={6}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Simulation Dot Plot ── */}
      {showSim && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-600">
              Order Simulation · Child Orders (contracts per minute)
            </p>
            <ExportBar label="simulation" chartRef={simRef} />
          </div>

          <div ref={simRef} className="bg-white">
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Time"
                  domain={[simXMin, simXMax]}
                  ticks={simHourTicks}
                  tickFormatter={(v: number) => minutesToHHMM(v)}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Qty"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  width={52}
                  allowDecimals={false}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#d1d5db' }}
                  {...CHART_STYLE}
                  formatter={(v: unknown, name: unknown) => [
                    `${v} contracts`,
                    String(name ?? ''),
                  ]}
                  labelFormatter={(label: unknown) =>
                    typeof label === 'number' ? minutesToHHMM(label) : String(label ?? '')
                  }
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {simulation.map((sim) => (
                  <Scatter
                    key={sim.curveId}
                    name={`${sim.curveLabel} (${sim.totalScheduled} total)`}
                    data={sim.schedule.map((s) => ({
                      x: timeToMinutes(s.time),
                      y: s.qty,
                    }))}
                    fill={sim.color}
                    isAnimationActive={false}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
            {simulation.map((sim) => (
              <div key={sim.curveId} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sim.color }}
                />
                <span className="text-gray-500 truncate min-w-0">{sim.curveLabel}</span>
                <span className="text-gray-700 flex-shrink-0 ml-auto">
                  {sim.totalScheduled} contracts · {sim.schedule.length} child orders
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
