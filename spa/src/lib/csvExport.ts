import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { CurveRow } from '../types'

// ── Export ────────────────────────────────────────────────────────────────────

export function exportCurveCSV(data: CurveRow[], label: string) {
  const rows = data.map((r) => ({
    time: r.time,
    AvgVolume: r.AvgVolume,
    Time_Exchange: r.Time_Exchange,
    Time_UTC: r.Time_UTC,
    'Pct Buckets': r.PctBuckets,
    Smoothed: r.Smoothed,
  }))

  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${label.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}_vwap_curve.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Import helpers ────────────────────────────────────────────────────────────

type RawRow = Record<string, string>

function mapRow(row: RawRow): CurveRow | null {
  const pct = row['Pct Buckets'] ?? row['PctBuckets'] ?? row['pct_buckets']
  const smoothed = row['Smoothed'] ?? row['smoothed']
  if (!row['time'] && !row['Time']) return null
  return {
    time: (row['time'] ?? row['Time']).trim(),
    AvgVolume: parseFloat(row['AvgVolume'] ?? row['avgvolume'] ?? '0') || 0,
    Time_Exchange: row['Time_Exchange'] ?? row['time_exchange'] ?? '',
    Time_UTC: row['Time_UTC'] ?? row['time_utc'] ?? '',
    PctBuckets: parseFloat(pct ?? '0') || 0,
    Smoothed: parseFloat(smoothed ?? '0') || 0,
  }
}

function validateRows(rows: (CurveRow | null)[]): CurveRow[] {
  const valid = rows.filter(Boolean) as CurveRow[]
  if (valid.length === 0) {
    throw new Error(
      'No valid rows found. Expected columns: time, Pct Buckets (or PctBuckets), Smoothed',
    )
  }
  return valid
}

export function parseCSV(file: File): Promise<CurveRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          resolve(validateRows(results.data.map(mapRow)))
        } catch (err) {
          reject(err)
        }
      },
      error: (err) => reject(new Error(String(err))),
    })
  })
}

export function parseXLSX(file: File): Promise<CurveRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '', raw: false })
        resolve(validateRows(raw.map(mapRow)))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsBinaryString(file)
  })
}
