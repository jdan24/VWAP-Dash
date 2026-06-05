const BRIDGE_BASE = 'http://localhost:8001'

export interface HealthResponse {
  status: string
  blpapi: boolean
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BRIDGE_BASE}/health`, {
    signal: AbortSignal.timeout(3_000),
  })
  if (!res.ok) throw new Error('Bridge unhealthy')
  return res.json()
}

export interface VWAPCurveParams {
  security: string
  start: string         // "YYYY-MM-DD HH:MM" exchange local
  end: string           // "YYYY-MM-DD HH:MM" exchange local
  smooth_window?: number
  tz_override?: string
}

export async function fetchVWAPCurve(params: VWAPCurveParams) {
  const url = new URL(`${BRIDGE_BASE}/vwap-curve`)
  url.searchParams.set('security', params.security)
  url.searchParams.set('start', params.start)
  url.searchParams.set('end', params.end)
  if (params.smooth_window != null) url.searchParams.set('smooth_window', String(params.smooth_window))
  if (params.tz_override) url.searchParams.set('tz_override', params.tz_override)

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail ?? `Bridge error ${res.status}`)
  }
  return res.json()
}

export interface TodayBarsParams {
  security: string
  session_start: string   // "HH:MM" exchange local
  session_end?: string    // "HH:MM" exchange local — required for overnight sessions
  tz_override?: string
  start_date?: string     // "YYYY-MM-DD" — overrides auto-detect of session date
}

export async function fetchTodayBars(params: TodayBarsParams) {
  const url = new URL(`${BRIDGE_BASE}/today-bars`)
  url.searchParams.set('security', params.security)
  url.searchParams.set('session_start', params.session_start)
  if (params.session_end) url.searchParams.set('session_end', params.session_end)
  if (params.tz_override) url.searchParams.set('tz_override', params.tz_override)
  if (params.start_date) url.searchParams.set('start_date', params.start_date)

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail ?? `Bridge error ${res.status}`)
  }
  return res.json()
}
