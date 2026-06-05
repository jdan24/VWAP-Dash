export interface CurveRow {
  time: string          // "HH:MM"
  AvgVolume: number
  Time_Exchange: string // "YYYY-MM-DD HH:MM:SS" (exchange local, placeholder date)
  Time_UTC: string      // "YYYY-MM-DD HH:MM:SS" (UTC equivalent)
  PctBuckets: number   // % of daily volume, sums to ~100
  Smoothed: number     // rolling-smoothed PctBuckets
}

export interface CurveParams {
  security: string
  start: string         // "YYYY-MM-DD HH:MM" exchange local
  end: string           // "YYYY-MM-DD HH:MM" exchange local
  smoothWindow: number
  tzOverride: string
}

export interface VWAPCurve {
  id: string
  label: string
  color: string
  visible: boolean
  source: 'bloomberg' | 'imported'
  data: CurveRow[]
  params?: CurveParams
}

export interface TodayBar {
  time: string    // "HH:MM"
  volume: number
  close: number
}

export interface TodayData {
  date: string            // "YYYY-MM-DD"
  bars: TodayBar[]
  profile: Array<{ time: string; pct: number }>  // running pct of today's volume
  tzOverride: string      // tz selected when fetching ("" = UTC was used)
}

export interface SimSchedule {
  time: string  // "HH:MM"
  qty: number   // whole contracts
}

export interface SimResult {
  curveId: string
  curveLabel: string
  color: string
  schedule: SimSchedule[]   // only minutes where qty > 0
  totalScheduled: number
}
