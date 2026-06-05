import type { VWAPCurve, SimResult, CurveRow } from '../types'
import type { YAxisKey } from '../store/useVWAPStore'

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Simulate a VWAP order-slicing schedule for a single curve.
 *
 * Rules:
 *   - Each minute bucket receives target_float = Q × normalized_pct
 *   - Fractions accumulate via carry-forward until ≥ 1 contract can be scheduled
 *   - Residual carry after the last minute is added to the last non-zero bucket
 *   - Total scheduled always equals quantity (integer arithmetic correction applied)
 */
export function simulateVWAP(
  curve: VWAPCurve,
  quantity: number,
  startTime: string,
  endTime: string,
): SimResult {
  const rows = curve.data.filter((r) => r.time >= startTime && r.time < endTime)

  const empty: SimResult = {
    curveId: curve.id,
    curveLabel: curve.label,
    color: curve.color,
    schedule: [],
    totalScheduled: 0,
  }

  if (rows.length === 0 || quantity <= 0) return empty

  const windowTotal = rows.reduce((s, r) => s + r.PctBuckets, 0)
  if (windowTotal === 0) return empty

  const targets = rows.map((r) => quantity * (r.PctBuckets / windowTotal))
  const scheduled = new Array<number>(rows.length).fill(0)
  let carry = 0

  for (let i = 0; i < targets.length; i++) {
    const toSchedule = targets[i] + carry
    if (toSchedule >= 1) {
      scheduled[i] = Math.floor(toSchedule)
      carry = toSchedule - scheduled[i]
    } else {
      carry = toSchedule
    }
  }

  // Distribute any remaining carry to the last non-zero bucket (or last bucket)
  const residual = Math.round(carry)
  if (residual > 0) {
    let placed = false
    for (let i = scheduled.length - 1; i >= 0; i--) {
      if (scheduled[i] > 0) {
        scheduled[i] += residual
        placed = true
        break
      }
    }
    if (!placed) {
      scheduled[scheduled.length - 1] += residual
    }
  }

  // Floating-point correction — ensure sum == quantity
  const total = scheduled.reduce((s, v) => s + v, 0)
  const diff = quantity - total
  if (diff !== 0) {
    for (let i = scheduled.length - 1; i >= 0; i--) {
      if (scheduled[i] > 0 || diff > 0) {
        scheduled[i] += diff
        break
      }
    }
  }

  const schedule = rows
    .map((r, i) => ({ time: r.time, qty: scheduled[i] }))
    .filter((s) => s.qty > 0)

  return {
    curveId: curve.id,
    curveLabel: curve.label,
    color: curve.color,
    schedule,
    totalScheduled: scheduled.reduce((s, v) => s + v, 0),
  }
}

/**
 * Merge multiple curve data arrays onto a unified time axis for Recharts.
 * Each row: { time, [curveId]: value, __today__: value }
 */
export function mergeCurveData(
  curves: VWAPCurve[],
  yAxis: YAxisKey,
  todayProfile?: Array<{ time: string; pct: number }>,
): Record<string, unknown>[] {
  const timeSet = new Set<string>()
  for (const c of curves) {
    if (c.visible) c.data.forEach((r) => timeSet.add(r.time))
  }
  if (todayProfile) todayProfile.forEach((r) => timeSet.add(r.time))

  const times = [...timeSet].sort()

  // Build lookup maps for O(1) access
  const curveMaps = new Map<string, Map<string, number>>()
  for (const c of curves) {
    if (!c.visible) continue
    const map = new Map<string, number>()
    c.data.forEach((r: CurveRow) => map.set(r.time, r[yAxis] as number))
    curveMaps.set(c.id, map)
  }
  const todayMap = new Map<string, number>()
  todayProfile?.forEach((r) => todayMap.set(r.time, r.pct))

  return times.map((t) => {
    const row: Record<string, unknown> = { time: t }
    for (const c of curves) {
      if (!c.visible) continue
      const v = curveMaps.get(c.id)?.get(t)
      row[c.id] = v !== undefined ? v : null
    }
    if (todayProfile) {
      const v = todayMap.get(t)
      row['__today__'] = v !== undefined ? v : null
    }
    return row
  })
}
