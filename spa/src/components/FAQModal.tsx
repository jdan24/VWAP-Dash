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
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowFAQ(false)
      }}
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-xl max-w-3xl w-full p-8 my-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Help &amp; Methodology</h2>
          <button
            onClick={() => setShowFAQ(false)}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-7 text-sm leading-relaxed">

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

          <Section title="How the Curve is Built">
            <ol className="list-decimal pl-4 space-y-2 text-gray-700">
              <li>
                <strong>Date range selection:</strong> You specify a start and end datetime in
                exchange local time (e.g. 2026-03-30 09:30 → 2026-04-27 16:00). The time portion
                defines the session window applied to every day in the range.
              </li>
              <li>
                <strong>Bloomberg data pull:</strong> For each calendar day in the range, the bridge
                requests 1-minute TRADE bars via <code className="bg-gray-100 px-1 rounded text-xs">IntradayBarRequest</code>.
                Non-trading days (weekends, holidays) return no data and are silently skipped.
              </li>
              <li>
                <strong>Zero-filled mean:</strong> Within each trading day, minutes with no trades
                contribute 0 volume (they are not omitted). The average is taken over all trading
                days found.
              </li>
              <li>
                <strong>Normalization:</strong>{' '}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  Pct Buckets[m] = AvgVolume[m] / Σ AvgVolume × 100
                </code>
              </li>
              <li>
                <strong>Smoothing:</strong> A centered rolling mean with a configurable window
                (default: 6 minutes) reduces noise to produce the <strong>Smoothed</strong> series.
              </li>
            </ol>
          </Section>

          <Section title="Bloomberg API Calls Used">
            <table className="w-full text-xs border-collapse mt-1">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="text-left pb-2 pr-4">Request type</th>
                  <th className="text-left pb-2 pr-4">Fields / params</th>
                  <th className="text-left pb-2">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 pr-4 align-top font-mono text-gray-700">ReferenceDataRequest</td>
                  <td className="py-1.5 pr-4 align-top font-mono text-gray-600">EXCHANGE_TIME_ZONE<br />TRADING_HOURS_TZ<br />TIME_ZONE_FULL_NAME</td>
                  <td className="py-1.5 align-top text-gray-600">Auto-detect the exchange's IANA timezone so session datetimes entered in local time convert correctly to UTC for Bloomberg queries.</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 align-top font-mono text-gray-700">IntradayBarRequest</td>
                  <td className="py-1.5 pr-4 align-top font-mono text-gray-600">eventType=TRADE<br />interval=1 min</td>
                  <td className="py-1.5 align-top text-gray-600">1-minute OHLCV bars per trading day. Used for curve generation and today's volume/price overlay.</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-gray-500">
              All requests route through the local bridge at{' '}
              <code className="bg-gray-100 px-1 rounded text-xs text-blue-600">http://localhost:8001</code>.
              The bridge must be running (via <code className="bg-gray-100 px-1 rounded text-xs">Start VWAP.bat</code>) and a Bloomberg Terminal session must be active.
            </p>
          </Section>

          <Section title="Today's Volume Comparison">
            <p className="text-gray-700">
              The <strong>Today's Volume</strong> panel pulls today's 1-minute bars from Bloomberg
              from the session start time you specify up to the current moment. The volume profile is
              computed as a percentage of the volume traded <em>so far today</em> — it re-normalizes
              as the session progresses.
            </p>
            <p className="mt-2 text-gray-700">
              Today's profile appears as solid grey bars on the main VWAP chart (behind the
              historical curve lines). A separate sub-chart shows today's last-traded price per
              minute. Both charts share the same time axis and synchronize on hover.
            </p>
            <p className="mt-2 text-gray-500">
              Bar timestamps are always returned in exchange local time so they align correctly with
              imported curves regardless of your machine's local timezone.
            </p>
          </Section>

          <Section title="VWAP Algo Order Simulation">
            <p className="text-gray-700">
              The simulation shows how a VWAP execution algorithm would slice a parent order into
              1-minute child orders based on the loaded volume profiles.
            </p>
            <p className="mt-3 font-medium text-gray-800">Algorithm (per curve):</p>
            <ol className="list-decimal pl-4 mt-1 space-y-1 text-gray-700">
              <li>Filter the curve to the execution window; re-normalize Pct Buckets to sum to 100% within that window.</li>
              <li>Compute a float target per minute: <code className="bg-gray-100 px-1 rounded text-xs">target[m] = Q × pct[m] / 100</code>.</li>
              <li>Apply carry-forward rounding: accumulate the float until it reaches ≥ 1 contract, then schedule whole contracts. Remainder carries to the next minute.</li>
              <li>Residual carry after the last minute is added to the last non-zero bucket. Total is always guaranteed to equal Q.</li>
            </ol>
            <p className="mt-3 text-gray-500">
              <strong>Why whole numbers?</strong> Futures contracts are indivisible — a 0.7-contract
              order is impossible. Fractions accumulate until ≥ 1 can be executed.
            </p>
          </Section>

          <Section title="UI Quick Reference">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600">
              <div><span className="font-medium text-gray-800">Generate Curve</span> — enter ticker, date range, session hours → click Generate. Requires Bloomberg bridge.</div>
              <div><span className="font-medium text-gray-800">Import CSV / XLSX</span> — import any file with columns: time, Pct Buckets, Smoothed. Counts toward the 4-curve limit.</div>
              <div><span className="font-medium text-gray-800">Export CSV ↓</span> — click the ↓ icon on any Bloomberg-generated curve row to download in standard format.</div>
              <div><span className="font-medium text-gray-800">Color picker</span> — click the colored square on a curve row to change its chart color.</div>
              <div><span className="font-medium text-gray-800">Visibility ● / ○</span> — hide/show individual curves without removing them.</div>
              <div><span className="font-medium text-gray-800">Y-axis toggle</span> — switch between Smoothed %, raw Pct Buckets, and AvgVolume across all visible curves.</div>
              <div><span className="font-medium text-gray-800">Chart export</span> — SVG / PNG / JPG buttons appear below each chart panel. SVG preserves vector quality; PNG/JPG are raster at 2× resolution.</div>
              <div><span className="font-medium text-gray-800">Simulation</span> — runs client-side instantly. No Bloomberg connection required once curves are loaded.</div>
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
      <h3 className="font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-200">{title}</h3>
      <div>{children}</div>
    </section>
  )
}
