import { useState } from 'react'
import { useVWAPStore } from '../store/useVWAPStore'
import { fetchVWAPCurve } from '../lib/bridgeClient'
import type { VWAPCurve } from '../types'

function isoDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export default function CurveBuilder() {
  const { addCurve, generating, setGenerating, nextColor, curves, bloombergConnected } =
    useVWAPStore((s) => ({
      addCurve: s.addCurve,
      generating: s.generating,
      setGenerating: s.setGenerating,
      nextColor: s.nextColor,
      curves: s.curves,
      bloombergConnected: s.bloombergConnected,
    }))

  const [security, setSecurity] = useState('ES1 Index')
  const [startDate, setStartDate] = useState(isoDate(-31))
  const [startTime, setStartTime] = useState('09:30')
  const [endDate, setEndDate] = useState(isoDate(-1))
  const [endTime, setEndTime] = useState('16:00')
  const [tzOverride, setTzOverride] = useState('')
  const [smoothWindow, setSmoothWindow] = useState(6)
  const [error, setError] = useState('')

  const atLimit = curves.length >= 4
  const disabled = generating || atLimit || !bloombergConnected

  async function handleGenerate() {
    if (!security.trim()) {
      setError('Enter a Bloomberg ticker (e.g. ES1 Index)')
      return
    }
    setError('')
    setGenerating(true)
    try {
      const rows = await fetchVWAPCurve({
        security: security.trim(),
        start: `${startDate} ${startTime}`,
        end: `${endDate} ${endTime}`,
        smooth_window: smoothWindow,
        tz_override: tzOverride.trim(),
      })
      const curve: VWAPCurve = {
        id: crypto.randomUUID(),
        label: `${security.trim()} · ${startDate} – ${endDate}`,
        color: nextColor(),
        visible: true,
        source: 'bloomberg',
        data: rows,
        params: {
          security: security.trim(),
          start: `${startDate} ${startTime}`,
          end: `${endDate} ${endTime}`,
          smoothWindow,
          tzOverride: tzOverride.trim(),
        },
      }
      addCurve(curve)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error from bridge')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="panel-section">
      <h2 className="section-heading">Generate Curve</h2>

      <div className="space-y-2.5">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Bloomberg Ticker</label>
          <input
            className="input"
            value={security}
            onChange={(e) => setSecurity(e.target.value)}
            placeholder="ES1 Index"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Session Start</label>
            <input
              type="time"
              className="input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Session End</label>
            <input
              type="time"
              className="input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">
            TZ Override <span className="text-gray-600">(e.g. Europe/Rome)</span>
          </label>
          <input
            className="input"
            value={tzOverride}
            onChange={(e) => setTzOverride(e.target.value)}
            placeholder="auto-detect from Bloomberg"
          />
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Smooth Window</label>
            <input
              type="number"
              className="input w-20"
              value={smoothWindow}
              min={1}
              max={30}
              onChange={(e) => setSmoothWindow(Math.max(1, parseInt(e.target.value) || 6))}
            />
          </div>
          <p className="text-xs text-gray-600 mt-4">minutes (centered rolling avg)</p>
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded px-2 py-1.5">
            {error}
          </p>
        )}

        {atLimit && (
          <p className="text-yellow-500 text-xs">Max 4 curves. Remove one to generate another.</p>
        )}

        {!bloombergConnected && (
          <p className="text-gray-500 text-xs">Bloomberg bridge offline — cannot generate curves.</p>
        )}

        <button onClick={handleGenerate} disabled={disabled} className="btn-primary w-full">
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating…
            </span>
          ) : (
            'Generate Curve'
          )}
        </button>
      </div>
    </div>
  )
}
