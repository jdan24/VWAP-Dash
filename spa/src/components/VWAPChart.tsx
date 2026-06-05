import {
  ResponsiveContainer,
  LineChart,
  Line,
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
import type { YAxisKey } from '../store/useVWAPStore'

const Y_AXIS_LABELS: Record<YAxisKey, string> = {
  PctBuckets: 'Pct Buckets (raw)',
  Smoothed: 'Smoothed %',
  AvgVolume: 'Avg Volume (contracts)',
}

// Tooltip formatter — show 4 decimal places for pct, 2 for volume
function fmtValue(v: number, key: YAxisKey) {
  if (key === 'AvgVolume') return v.toFixed(2)
  return v.toFixed(4)
}

const CHART_STYLE = {
  contentStyle: {
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '6px',
    fontSize: '11px',
  },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#d1d5db' },
}

export default function VWAPChart() {
  const { curves, yAxis, setYAxis, today, todayVisible, simulation } = useVWAPStore((s) => ({
    curves: s.curves,
    yAxis: s.yAxis,
    setYAxis: s.setYAxis,
    today: s.today,
    todayVisible: s.todayVisible,
    simulation: s.simulation,
  }))

  const todayProfile = todayVisible && today ? today.profile : undefined
  const mergedData = mergeCurveData(curves, yAxis, todayProfile)
  const showToday = todayVisible && today && today.bars.length > 0
  const showSim = simulation.length > 0
  const hasCurves = mergedData.length > 0

  // Price chart data — uses today's bar close prices
  const priceData = showToday
    ? today!.bars.map((b) => ({ time: b.time, close: b.close }))
    : []

  // Scatter chart: numeric x (minutes since midnight) for all sim results
  const simXMin = showSim
    ? Math.min(...simulation.flatMap((s) => s.schedule.map((p) => timeToMinutes(p.time))))
    : 0
  const simXMax = showSim
    ? Math.max(...simulation.flatMap((s) => s.schedule.map((p) => timeToMinutes(p.time))))
    : 1440

  // Build hour-boundary ticks for scatter x-axis
  const simHourTicks: number[] = []
  if (showSim) {
    const startHour = Math.ceil(simXMin / 60)
    const endHour = Math.floor(simXMax / 60)
    for (let h = startHour; h <= endHour; h++) simHourTicks.push(h * 60)
  }

  return (
    <div className="space-y-6">
      {/* Y-axis toggle */}
      <div className="flex gap-1.5 flex-wrap">
        {(['Smoothed', 'PctBuckets', 'AvgVolume'] as YAxisKey[]).map((v) => (
          <button
            key={v}
            onClick={() => setYAxis(v)}
            className={`text-xs px-3 py-1 rounded transition-colors ${
              yAxis === v
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {v === 'PctBuckets' ? 'Pct Buckets' : v}
          </button>
        ))}
      </div>

      {/* ── Main VWAP Profile Chart ── */}
      {!hasCurves ? (
        <div className="h-72 flex flex-col items-center justify-center text-gray-600 border border-gray-800 rounded-lg gap-2">
          <p className="text-sm">No curves loaded</p>
          <p className="text-xs">Generate a Bloomberg curve or import a CSV to get started.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            VWAP Volume Profile · {Y_AXIS_LABELS[yAxis]}
            {today && todayVisible && (
              <span className="ml-2 text-gray-600">· dashed = today ({today.date})</span>
            )}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={mergedData}
              syncId="vwap-chart"
              margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                interval={29}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickFormatter={(v: number) =>
                  yAxis === 'AvgVolume' ? v.toFixed(1) : v.toFixed(2)
                }
                width={52}
              />
              <Tooltip
                {...CHART_STYLE}
                formatter={(v: unknown) =>
                  typeof v === 'number' ? fmtValue(v, yAxis) : String(v)
                }
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '11px', paddingTop: '8px' }} />

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

              {todayProfile && (
                <Line
                  dataKey="__today__"
                  name={`Today (${today!.date})`}
                  stroke="#e5e7eb"
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Today's Price Chart ── */}
      {showToday && priceData.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Today's Last Price · {today!.date}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={priceData}
              syncId="vwap-chart"
              margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                interval={29}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10 }}
                width={52}
                domain={['auto', 'auto']}
              />
              <Tooltip
                {...CHART_STYLE}
                formatter={(v: unknown) =>
                  typeof v === 'number' ? v.toFixed(2) : String(v)
                }
              />
              <Line
                dataKey="close"
                name="Last Price"
                stroke="#93c5fd"
                dot={false}
                strokeWidth={1.5}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Simulation Dot Plot ── */}
      {showSim && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Order Simulation · Child Orders (contracts per minute)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                type="number"
                dataKey="x"
                name="Time"
                domain={[simXMin, simXMax]}
                ticks={simHourTicks}
                tickFormatter={(v: number) => minutesToHHMM(v)}
                tick={{ fill: '#6b7280', fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Qty"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                width={52}
                allowDecimals={false}
              />
              <ZAxis range={[40, 40]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: '#374151' }}
                {...CHART_STYLE}
                formatter={(v: unknown, name: unknown) => [`${v} contracts`, String(name ?? '')]}
                labelFormatter={(label: unknown) =>
                  typeof label === 'number' ? minutesToHHMM(label) : String(label ?? '')
                }
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '11px', paddingTop: '8px' }} />
              {simulation.map((sim) => (
                <Scatter
                  key={sim.curveId}
                  name={`${sim.curveLabel} (${sim.totalScheduled} total)`}
                  data={sim.schedule.map((s) => ({ x: timeToMinutes(s.time), y: s.qty }))}
                  fill={sim.color}
                  isAnimationActive={false}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>

          {/* Summary rows */}
          <div className="mt-2 space-y-1">
            {simulation.map((sim) => (
              <div key={sim.curveId} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sim.color }}
                />
                <span className="text-gray-400 truncate min-w-0">{sim.curveLabel}</span>
                <span className="text-gray-300 flex-shrink-0 ml-auto">
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
