import { useEffect } from 'react'
import { useVWAPStore } from '../store/useVWAPStore'

export default function FAQModal() {
  const { showFAQ, setShowFAQ } = useVWAPStore((s) => ({
    showFAQ: s.showFAQ,
    setShowFAQ: s.setShowFAQ,
  }))

  useEffect(() => {
    if (!showFAQ) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowFAQ(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showFAQ, setShowFAQ])

  if (!showFAQ) return null

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-start justify-center p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowFAQ(false)
      }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-3xl w-full p-8 text-gray-200 my-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Help &amp; Methodology</h2>
          <button
            onClick={() => setShowFAQ(false)}
            className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-7 text-sm leading-relaxed">

          {/* ── What is a VWAP Curve ── */}
          <Section title="What is a VWAP Curve?">
            <p>
              A VWAP curve is a normalized intraday volume profile — a representation of how trading
              volume is typically distributed across the minutes of a trading session. Instead of
              showing an absolute volume number, each minute is expressed as a percentage of the day's
              total volume (<strong>Pct Buckets</strong>). Summed across the session, Pct Buckets
              totals ≈ 100%.
            </p>
            <p className="mt-2">
              Traders and execution algorithms use VWAP curves to schedule order participation in
              line with historical market activity — front-loading into high-volume periods and
              pulling back during thin stretches.
            </p>
          </Section>

          {/* ── How the curve is built ── */}
          <Section title="How the Curve is Built">
            <ol className="list-decimal pl-4 space-y-2">
              <li>
                <strong>Date range selection:</strong> You specify a start and end datetime in
                exchange local time (e.g. 2026-03-30 09:30 → 2026-04-27 16:00). The time portion
                defines the session window applied to every day in the range.
              </li>
              <li>
                <strong>Bloomberg data pull:</strong> For each calendar day in the range, the bridge
                requests 1-minute TRADE bars via <code>IntradayBarRequest</code>. Non-trading days
                (weekends, holidays) return no data and are silently skipped.
              </li>
              <li>
                <strong>Zero-filled mean:</strong> Within each trading day, minutes with no trades
                contribute 0 volume (they are not omitted). The average is taken over all trading
                days found, so a quiet minute contributes a low average rather than inflating the
                busy ones.
              </li>
              <li>
                <strong>Normalization:</strong>{' '}
                <code>Pct Buckets[m] = AvgVolume[m] / Σ AvgVolume × 100</code>
              </li>
              <li>
                <strong>Smoothing:</strong> A centered rolling mean with a configurable window
                (default: 6 minutes) reduces noise in the raw percentages to produce the{' '}
                <strong>Smoothed</strong> series.
              </li>
            </ol>
          </Section>

          {/* ── Bloomberg API calls ── */}
          <Section title="Bloomberg API Calls Used">
            <table className="w-full text-xs border-collapse mt-1">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left pb-2 pr-4">Request type</th>
                  <th className="text-left pb-2 pr-4">Fields / params</th>
                  <th className="text-left pb-2">Purpose</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                <tr className="border-b border-gray-800">
                  <td className="py-1.5 pr-4 align-top font-mono text-gray-300">ReferenceDataRequest</td>
                  <td className="py-1.5 pr-4 align-top font-mono">EXCHANGE_TIME_ZONE,<br />TRADING_HOURS_TZ,<br />TIME_ZONE_FULL_NAME</td>
                  <td className="py-1.5 align-top">Auto-detect the exchange's IANA timezone so that session start/end datetimes entered in local time are correctly converted to UTC for Bloomberg queries.</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 align-top font-mono text-gray-300">IntradayBarRequest</td>
                  <td className="py-1.5 pr-4 align-top font-mono">eventType=TRADE<br />interval=1 min</td>
                  <td className="py-1.5 align-top">1-minute OHLCV bars per trading day. Used for both curve generation and today's volume/price overlay.</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-gray-400">
              All requests route through the local bridge at{' '}
              <code className="text-blue-400">http://localhost:8001</code>. The bridge must be running
              (via <code>Start VWAP.bat</code>) and a Bloomberg Terminal session must be active on the
              same machine.
            </p>
          </Section>

          {/* ── Today's Comparison ── */}
          <Section title="Today's Volume Comparison">
            <p>
              The <strong>Today's Volume</strong> panel pulls today's 1-minute bars from Bloomberg
              from the session start time you specify up to the current moment. The resulting volume
              profile is computed as a percentage of the volume traded <em>so far today</em> — not
              the full day — so it will re-normalize as the session progresses.
            </p>
            <p className="mt-2">
              Today's profile is overlaid on the main VWAP chart as a dashed grey line. It does not
              count toward the 4-curve limit. A separate sub-chart shows today's last-traded price
              (close of each 1-minute bar) on the same time axis.
            </p>
            <p className="mt-2 text-gray-400">
              Use this to spot whether today's volume distribution is running ahead or behind the
              historical curve — a significant deviation early in the session can signal unusual
              activity.
            </p>
          </Section>

          {/* ── Order Simulation ── */}
          <Section title="VWAP Algo Order Simulation">
            <p>
              The simulation shows how a VWAP execution algorithm would slice a parent order into
              1-minute child orders based on the volume profile of each loaded curve.
            </p>
            <p className="mt-2 font-medium text-gray-300">Inputs:</p>
            <ul className="list-disc pl-4 mt-1 space-y-1 text-gray-300">
              <li>Order quantity (whole contracts)</li>
              <li>Execution window: start and end time in exchange local time</li>
            </ul>
            <p className="mt-3 font-medium text-gray-300">Algorithm (per curve):</p>
            <ol className="list-decimal pl-4 mt-1 space-y-1">
              <li>Filter the curve to the execution window and re-normalize Pct Buckets to sum to 100% within that window.</li>
              <li>Compute a float target for each minute: <code>target[m] = Q × pct[m] / 100</code>.</li>
              <li>Apply carry-forward rounding: accumulate the float target until it reaches ≥ 1 contract, then schedule that many whole contracts. The fractional remainder carries to the next minute.</li>
              <li>Any remaining carry after the last minute is added to the last bucket with a scheduled order (or the final minute if none).</li>
              <li>A final integer correction ensures <code>Σ child_orders = Q</code>.</li>
            </ol>
            <p className="mt-3 text-gray-400">
              <strong>Why whole numbers?</strong> Futures contracts are indivisible. A 0.7-contract
              order is not possible; the 0.7 accumulates until combined with subsequent minutes it
              reaches ≥ 1.
            </p>
            <p className="mt-2 text-gray-400">
              Results appear as a dot plot below the price chart. Each curve's dots are colored to
              match the curve. Hover over a dot to see the exact minute and contract count.
            </p>
          </Section>

          {/* ── UI Quick Reference ── */}
          <Section title="UI Quick Reference">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div><span className="text-gray-300 font-medium">Generate Curve</span> — fill in the Bloomberg ticker, date range, and session hours, then click <em>Generate</em>. Requires Bloomberg bridge.</div>
              <div><span className="text-gray-300 font-medium">Import CSV / XLSX</span> — import any file matching the curve format (columns: time, Pct Buckets, Smoothed). Imported curves count toward the 4-curve limit.</div>
              <div><span className="text-gray-300 font-medium">Export CSV</span> — click the ↓ icon on any Bloomberg-generated curve to download it in standard format.</div>
              <div><span className="text-gray-300 font-medium">Color picker</span> — click the colored square on any curve row to change its chart color.</div>
              <div><span className="text-gray-300 font-medium">Visibility toggle ● / ○</span> — hide/show individual curves on the chart without removing them.</div>
              <div><span className="text-gray-300 font-medium">Y-axis toggle</span> — switch between Smoothed %, raw Pct Buckets, and AvgVolume across all visible curves.</div>
              <div><span className="text-gray-300 font-medium">Today panel</span> — load today's live volume/price from Bloomberg. Click <em>Refresh</em> at any time to update.</div>
              <div><span className="text-gray-300 font-medium">Simulation</span> — runs instantly in the browser using the curve data already loaded. No Bloomberg connection required.</div>
            </div>
          </Section>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-white mb-2 pb-1 border-b border-gray-800">{title}</h3>
      <div className="text-gray-300">{children}</div>
    </section>
  )
}
