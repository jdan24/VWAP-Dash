import { useState } from 'react'
import { useVWAPStore } from '../store/useVWAPStore'
import { simulateVWAP } from '../lib/curveUtils'

export default function SimulationPanel() {
  const { curves, setSimulation, simulation } = useVWAPStore((s) => ({
    curves: s.curves,
    setSimulation: s.setSimulation,
    simulation: s.simulation,
  }))

  const [quantity, setQuantity] = useState(100)
  const [startTime, setStartTime] = useState('09:30')
  const [endTime, setEndTime] = useState('16:00')
  const [error, setError] = useState('')

  function handleSimulate() {
    const visibleCurves = curves.filter((c) => c.visible && c.data.length > 0)
    if (visibleCurves.length === 0) {
      setError('No visible curves to simulate against')
      return
    }
    if (!quantity || quantity <= 0) {
      setError('Quantity must be a positive integer')
      return
    }
    if (startTime >= endTime) {
      setError('Start time must be before end time')
      return
    }
    setError('')
    setSimulation(visibleCurves.map((c) => simulateVWAP(c, quantity, startTime, endTime)))
  }

  return (
    <div className="panel-section">
      <h2 className="section-heading">Order Simulation</h2>

      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Order Quantity (contracts)</label>
          <input
            type="number"
            className="input"
            value={quantity}
            min={1}
            step={1}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Start Time</label>
            <input
              type="time"
              className="input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">End Time</label>
            <input
              type="time"
              className="input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={handleSimulate} className="btn-primary flex-1">
            Simulate
          </button>
          {simulation.length > 0 && (
            <button onClick={() => setSimulation([])} className="btn-secondary px-3">
              Clear
            </button>
          )}
        </div>

        {simulation.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-gray-100 mt-1">
            {simulation.map((sim) => (
              <div key={sim.curveId} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sim.color }}
                />
                <span className="text-gray-500 truncate">{sim.curveLabel}:</span>
                <span className="text-gray-800 flex-shrink-0">
                  {sim.totalScheduled} contracts · {sim.schedule.length} orders
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
