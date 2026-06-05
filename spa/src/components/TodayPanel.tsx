import { useState } from 'react'
import { useVWAPStore } from '../store/useVWAPStore'
import { fetchTodayBars } from '../lib/bridgeClient'
import type { TodayData, TodayBar } from '../types'

const TZ_OPTIONS = [
  { value: '', label: 'auto-detect from Bloomberg' },
  { value: 'America/New_York', label: 'America/New_York (Eastern)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific)' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Europe/Rome' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (HKT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TodayPanel() {
  const { bloombergConnected, curves, today, setToday, todayVisible, setTodayVisible } =
    useVWAPStore((s) => ({
      bloombergConnected: s.bloombergConnected,
      curves: s.curves,
      today: s.today,
      setToday: s.setToday,
      todayVisible: s.todayVisible,
      setTodayVisible: s.setTodayVisible,
    }))

  const firstParams = curves.find((c) => c.params)?.params
  const [security, setSecurity] = useState(firstParams?.security ?? 'ES1 Index')
  const [startDate, setStartDate] = useState(todayISO())
  const [sessionStart, setSessionStart] = useState(
    firstParams?.start?.slice(11, 16) ?? '09:30',
  )
  const [sessionEnd, setSessionEnd] = useState(
    firstParams?.end?.slice(11, 16) ?? '16:00',
  )
  const [tzOverride, setTzOverride] = useState(firstParams?.tzOverride ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRefresh() {
    if (!bloombergConnected) {
      setError('Bloomberg bridge is offline')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await fetchTodayBars({
        security: security.trim(),
        session_start: sessionStart,
        session_end: sessionEnd,
        tz_override: tzOverride.trim(),
        start_date: startDate,
      })

      const bars: TodayBar[] = result.bars
      const totalVolume = bars.reduce((s: number, b: TodayBar) => s + b.volume, 0)
      const profile = bars.map((b: TodayBar) => ({
        time: b.time,
        pct: totalVolume > 0 ? (b.volume / totalVolume) * 100 : 0,
      }))

      const data: TodayData = { date: result.date, bars, profile }
      setToday(data)
      setTodayVisible(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel-section">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-heading mb-0">Today's Volume</h2>
        {today && (
          <button
            onClick={() => setTodayVisible(!todayVisible)}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            {todayVisible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Ticker</label>
          <input
            className="input"
            value={security}
            onChange={(e) => setSecurity(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Session Start Date</label>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Session Start</label>
            <input
              type="time"
              className="input"
              value={sessionStart}
              onChange={(e) => setSessionStart(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Session End</label>
            <input
              type="time"
              className="input"
              value={sessionEnd}
              onChange={(e) => setSessionEnd(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">TZ Override</label>
          <select
            className="input"
            value={tzOverride}
            onChange={(e) => setTzOverride(e.target.value)}
          >
            {TZ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
            {error}
          </p>
        )}

        {today && (
          <p className="text-xs text-gray-400">
            {today.date} · {today.bars.length} bars loaded
          </p>
        )}

        <button
          onClick={handleRefresh}
          disabled={loading || !bloombergConnected}
          className="btn-secondary w-full"
        >
          {loading ? 'Loading…' : today ? 'Refresh Today' : 'Load Today'}
        </button>

        {!bloombergConnected && (
          <p className="text-xs text-gray-400">Bloomberg offline</p>
        )}
      </div>
    </div>
  )
}
