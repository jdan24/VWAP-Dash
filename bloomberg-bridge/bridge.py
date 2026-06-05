"""
Bloomberg VWAP Bridge
====================
FastAPI service on port 8001 that provides VWAP curve data for the VWAP Dash SPA.

Endpoints:
  GET /health          → status check
  GET /vwap-curve      → multi-day intraday volume profile
  GET /today-bars      → today's intraday bars (volume + last price)

Run:  python bridge.py   (or via Start VWAP.bat)
"""

from __future__ import annotations

import re
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

import pytz
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ── blpapi (graceful degradation when SDK not installed) ──────────────────────
try:
    import blpapi
    BLPAPI_AVAILABLE = True
except ImportError:
    blpapi = None  # type: ignore[assignment]
    BLPAPI_AVAILABLE = False

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Bloomberg VWAP Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Yellow-key inference (same table as TCA bridge) ───────────────────────────
YELLOW_KEY: dict[str, str] = {
    "ES": "Index", "NQ": "Index", "RTY": "Index", "YM": "Index",
    "VX": "Index", "EMD": "Index", "NK": "Index", "Z": "Index",
    "FDAX": "Index", "FESX": "Index", "DX": "Index",
    "CL": "Comdty", "NG": "Comdty", "HO": "Comdty", "RB": "Comdty",
    "BZ": "Comdty", "XB": "Comdty", "QM": "Comdty",
    "GC": "Comdty", "SI": "Comdty", "HG": "Comdty", "PL": "Comdty",
    "PA": "Comdty",
    "ZW": "Comdty", "ZC": "Comdty", "ZS": "Comdty", "ZL": "Comdty",
    "ZM": "Comdty", "CT": "Comdty", "KC": "Comdty", "SB": "Comdty",
    "CC": "Comdty", "OJ": "Comdty",
    "ZN": "Comdty", "ZB": "Comdty", "ZF": "Comdty", "ZT": "Comdty",
    "UB": "Comdty", "TN": "Comdty", "SR3": "Comdty",
    "6E": "Crncy", "6J": "Crncy", "6B": "Crncy", "6C": "Crncy",
    "6A": "Crncy", "6S": "Crncy", "6N": "Crncy", "6M": "Crncy",
    "6R": "Crncy", "6Z": "Crncy",
}

_ROOT_RE = re.compile(r"^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$")

# Bloomberg timezone field names to try in order of preference
_TZ_FIELDS = ["EXCHANGE_TIME_ZONE", "TRADING_HOURS_TZ", "TIME_ZONE_FULL_NAME"]


def extract_root(symbol: str) -> str:
    m = _ROOT_RE.match(symbol.upper().strip())
    return m.group(1) if m else symbol.upper().strip()


def resolve_ticker(symbol: str) -> str:
    s = symbol.strip()
    if " " in s:
        return s.upper()
    root = extract_root(s)
    key = YELLOW_KEY.get(root, "Index")
    return f"{s.upper()} {key}"


# ── blpapi session helpers ─────────────────────────────────────────────────────

def _require_blpapi():
    if not BLPAPI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="blpapi SDK is not installed. Run: pip install blpapi",
        )


def _create_session():
    options = blpapi.SessionOptions()
    options.setServerHost("localhost")
    options.setServerPort(8194)
    session = blpapi.Session(options)
    if not session.start():
        raise HTTPException(status_code=503, detail="Failed to start Bloomberg session")
    if not session.openService("//blp/refdata"):
        session.stop()
        raise HTTPException(status_code=503, detail="Failed to open //blp/refdata service")
    return session


def _drain(session, timeout_ms: int = 20_000) -> list:
    messages = []
    deadline = time.monotonic() + timeout_ms / 1_000
    while time.monotonic() < deadline:
        remaining_ms = max(100, int((deadline - time.monotonic()) * 1_000))
        event = session.nextEvent(remaining_ms)
        event_type = event.eventType()
        if event_type in (blpapi.Event.PARTIAL_RESPONSE, blpapi.Event.RESPONSE):
            for msg in event:
                messages.append(msg)
            if event_type == blpapi.Event.RESPONSE:
                return messages
        elif event_type == blpapi.Event.REQUEST_STATUS:
            for msg in event:
                try:
                    reason = msg.getElement("reason")
                    desc = reason.getElement("description").getValueAsString()
                    raise HTTPException(status_code=502, detail=f"Bloomberg request failed: {desc}")
                except HTTPException:
                    raise
                except Exception:
                    pass
            raise HTTPException(status_code=502, detail="Bloomberg request failed (unknown reason)")
    raise HTTPException(status_code=504, detail="Bloomberg request timed out after 20 seconds")


# ── DateTime helpers ──────────────────────────────────────────────────────────

def to_blp_dt(dt: datetime) -> datetime:
    """Return UTC-aware datetime for blpapi."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc)
    return dt.replace(tzinfo=timezone.utc)


def blp_dt_to_iso(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    try:
        return datetime(
            value.year, value.month, value.day,
            value.hour, value.minute, value.second,
        ).isoformat()
    except Exception:
        return str(value)


# ── Bloomberg data helpers ────────────────────────────────────────────────────

def _get_reference_fields(ticker: str, fields: list[str]) -> dict[str, Any]:
    session = _create_session()
    try:
        svc = session.getService("//blp/refdata")
        req = svc.createRequest("ReferenceDataRequest")
        req.append("securities", ticker)
        for f in fields:
            req.append("fields", f)
        session.sendRequest(req)
        result: dict[str, Any] = {}
        for msg in _drain(session):
            if not msg.hasElement("securityData"):
                continue
            sec_arr = msg.getElement("securityData")
            for i in range(sec_arr.numValues()):
                sec = sec_arr.getValueAsElement(i)
                if sec.hasElement("securityError"):
                    continue
                if sec.hasElement("fieldData"):
                    fld = sec.getElement("fieldData")
                    for j in range(fld.numElements()):
                        el = fld.getElement(j)
                        try:
                            result[str(el.name())] = el.getValue()
                        except Exception:
                            pass
        return result
    finally:
        session.stop()


def _get_intraday_bars_raw(
    ticker: str,
    start_utc: datetime,
    end_utc: datetime,
    interval: int = 1,
) -> list[dict[str, Any]]:
    """
    Pull 1-min TRADE bars from Bloomberg.

    Returns bars with exchange-local timestamps as naive ISO strings — exactly
    as Bloomberg sends them, without UTC normalization.  The VWAP aggregator
    needs exchange-local HH:MM to correctly align minutes across DST boundaries.
    """
    session = _create_session()
    try:
        svc = session.getService("//blp/refdata")
        req = svc.createRequest("IntradayBarRequest")
        req.set("security", ticker)
        req.set("eventType", "TRADE")
        req.set("startDateTime", to_blp_dt(start_utc))
        req.set("endDateTime", to_blp_dt(end_utc))
        req.set("interval", interval)
        session.sendRequest(req)
        bars = []
        for msg in _drain(session):
            if not msg.hasElement("barData"):
                continue
            bar_tick_data = msg.getElement("barData").getElement("barTickData")
            for i in range(bar_tick_data.numValues()):
                bar = bar_tick_data.getValueAsElement(i)
                try:
                    bars.append({
                        "time": blp_dt_to_iso(bar.getElement("time").getValue()),
                        "close": float(bar.getElement("close").getValue()),
                        "volume": int(bar.getElement("volume").getValue()),
                    })
                except Exception:
                    pass
        return bars
    finally:
        session.stop()


# ── Timezone resolution ───────────────────────────────────────────────────────

def _resolve_timezone(ticker: str, tz_override: str) -> Any:
    """Return a pytz timezone for the exchange hosting `ticker`."""
    if tz_override.strip():
        try:
            return pytz.timezone(tz_override.strip())
        except pytz.UnknownTimeZoneError:
            raise HTTPException(422, f"Unknown timezone: {tz_override!r}. Use an IANA name, e.g. 'America/Chicago'.")

    try:
        ref = _get_reference_fields(ticker, _TZ_FIELDS)
        for field in _TZ_FIELDS:
            tz_name = str(ref.get(field, "")).strip()
            if tz_name:
                try:
                    return pytz.timezone(tz_name)
                except pytz.UnknownTimeZoneError:
                    continue
    except HTTPException:
        raise
    except Exception:
        pass

    raise HTTPException(
        422,
        "Could not determine the exchange timezone from Bloomberg. "
        "Please provide tz_override (e.g., 'America/Chicago', 'Europe/Rome', 'Asia/Tokyo').",
    )


# ── VWAP helpers ──────────────────────────────────────────────────────────────

def _build_canonical_minutes(start_hhmm: str, end_hhmm: str) -> list[str]:
    """Build ["HH:MM", ...] list from session_start to session_end (exclusive)."""
    base = date.today()
    t = datetime.strptime(f"{base} {start_hhmm}", "%Y-%m-%d %H:%M")
    stop = datetime.strptime(f"{base} {end_hhmm}", "%Y-%m-%d %H:%M")
    minutes = []
    while t < stop:
        minutes.append(t.strftime("%H:%M"))
        t += timedelta(minutes=1)
    return minutes


def _rolling_smooth(values: list[float], window: int) -> list[float]:
    """Centered rolling mean, no min_periods requirement."""
    n = len(values)
    half = window // 2
    result = []
    for i in range(n):
        lo = max(0, i - half)
        hi = min(n, i + half + 1)
        chunk = values[lo:hi]
        result.append(sum(chunk) / len(chunk) if chunk else 0.0)
    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "blpapi": BLPAPI_AVAILABLE}


@app.get("/vwap-curve")
def vwap_curve(
    security: str,
    start: str,
    end: str,
    smooth_window: int = 6,
    tz_override: str = "",
):
    """
    Generate a multi-day VWAP intraday volume profile.

    start / end must be in exchange local time: "YYYY-MM-DD HH:MM"
    The session window (e.g. 09:30–16:00) is derived from the time portions.
    Each calendar day in [start_date, end_date] is queried; non-trading days
    (weekends / holidays) that return no data are silently skipped.
    Within each trading day, minutes with no trades contribute 0 volume
    (zero-filled mean across days).

    Returns a list of CurveRow objects matching the CSV export format.
    """
    _require_blpapi()
    ticker = resolve_ticker(security)
    tz = _resolve_timezone(ticker, tz_override)

    try:
        start_local = datetime.strptime(start.strip(), "%Y-%m-%d %H:%M")
        end_local = datetime.strptime(end.strip(), "%Y-%m-%d %H:%M")
    except ValueError as exc:
        raise HTTPException(422, f"Invalid datetime format (use YYYY-MM-DD HH:MM): {exc}")

    if end_local <= start_local:
        raise HTTPException(422, "end must be after start")

    session_start = start_local.strftime("%H:%M")
    session_end = end_local.strftime("%H:%M")
    canonical = _build_canonical_minutes(session_start, session_end)
    if not canonical:
        raise HTTPException(422, "Session window is empty — start time must be before end time")

    vol_sums: dict[str, float] = {m: 0.0 for m in canonical}
    trading_days = 0

    current = start_local.date()
    last_date = end_local.date()

    while current <= last_date:
        try:
            day_start = tz.localize(datetime.combine(current, start_local.time()))
            day_end = tz.localize(datetime.combine(current, end_local.time()))
            bars = _get_intraday_bars_raw(
                ticker,
                day_start.astimezone(timezone.utc),
                day_end.astimezone(timezone.utc),
            )

            if not bars:
                current += timedelta(days=1)
                continue  # weekend / holiday

            bar_vol: dict[str, int] = {}
            for bar in bars:
                hhmm = bar["time"][11:16]  # exchange-local "HH:MM" from naive ISO string
                bar_vol[hhmm] = bar_vol.get(hhmm, 0) + bar["volume"]

            for m in canonical:
                vol_sums[m] += bar_vol.get(m, 0)  # zero-fill absent minutes

            trading_days += 1

        except HTTPException:
            raise
        except Exception:
            pass  # silently skip days with transient API errors

        current += timedelta(days=1)

    if trading_days == 0:
        raise HTTPException(
            404,
            "No trading data found for the specified range. "
            "Verify the ticker and that the date range covers active trading sessions.",
        )

    avg_volumes = [vol_sums[m] / trading_days for m in canonical]
    total_avg = sum(avg_volumes)

    if total_avg == 0:
        raise HTTPException(404, "All volume sums are zero — no trades found in the session window.")

    pct_buckets = [v / total_avg * 100 for v in avg_volumes]
    smoothed = _rolling_smooth(pct_buckets, smooth_window)

    placeholder_date = start_local.date().isoformat()
    result = []
    for i, m in enumerate(canonical):
        time_exchange = f"{placeholder_date} {m}:00"
        try:
            local_dt = tz.localize(datetime.strptime(f"{placeholder_date} {m}", "%Y-%m-%d %H:%M"))
            time_utc = local_dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            time_utc = time_exchange

        result.append({
            "time": m,
            "AvgVolume": round(avg_volumes[i], 6),
            "Time_Exchange": time_exchange,
            "Time_UTC": time_utc,
            "PctBuckets": round(pct_buckets[i], 6),
            "Smoothed": round(smoothed[i], 6),
        })

    return result


@app.get("/today-bars")
def today_bars(
    security: str,
    session_start: str = "09:30",
    tz_override: str = "",
):
    """
    Pull today's 1-min bars from Bloomberg from session_start to now.

    session_start is in HH:MM exchange local time.
    Returns {date, bars: [{time, volume, close}]} where time is "HH:MM".
    """
    _require_blpapi()
    ticker = resolve_ticker(security)
    tz = _resolve_timezone(ticker, tz_override)

    try:
        start_time = datetime.strptime(session_start.strip(), "%H:%M").time()
    except ValueError:
        raise HTTPException(422, "Invalid session_start format — use HH:MM")

    now_local = datetime.now(tz)
    today = now_local.date()

    day_start_utc = tz.localize(datetime.combine(today, start_time)).astimezone(timezone.utc)
    day_end_utc = now_local.astimezone(timezone.utc)

    if day_end_utc <= day_start_utc:
        return {"date": today.isoformat(), "bars": []}

    bars = _get_intraday_bars_raw(ticker, day_start_utc, day_end_utc, 1)

    formatted = [
        {"time": bar["time"][11:16], "volume": bar["volume"], "close": bar["close"]}
        for bar in bars
    ]

    return {"date": today.isoformat(), "bars": formatted}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
