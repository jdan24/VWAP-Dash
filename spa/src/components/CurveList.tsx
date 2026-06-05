import { useRef, useState } from 'react'
import { useVWAPStore } from '../store/useVWAPStore'
import { parseCSV, parseXLSX, exportCurveCSV } from '../lib/csvExport'
import type { VWAPCurve } from '../types'

export default function CurveList() {
  const { curves, removeCurve, toggleVisible, setColor, setLabel, addCurve, nextColor } =
    useVWAPStore((s) => ({
      curves: s.curves,
      removeCurve: s.removeCurve,
      toggleVisible: s.toggleVisible,
      setColor: s.setColor,
      setLabel: s.setLabel,
      addCurve: s.addCurve,
      nextColor: s.nextColor,
    }))

  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState('')

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    try {
      const data = file.name.toLowerCase().endsWith('.xlsx')
        ? await parseXLSX(file)
        : await parseCSV(file)
      const curve: VWAPCurve = {
        id: crypto.randomUUID(),
        label: file.name.replace(/\.(csv|xlsx)$/i, ''),
        color: nextColor(),
        visible: true,
        source: 'imported',
        data,
      }
      addCurve(curve)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Parse error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="panel-section">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-heading mb-0">Curves</h2>
        <span className="text-xs text-gray-400">{curves.length} / 4</span>
      </div>

      {curves.length === 0 && (
        <p className="text-xs text-gray-400 mb-3">
          No curves loaded. Generate one from Bloomberg or import a CSV / XLSX.
        </p>
      )}

      <div className="space-y-1.5 mb-3">
        {curves.map((curve) => (
          <CurveRow
            key={curve.id}
            curve={curve}
            onToggle={() => toggleVisible(curve.id)}
            onColorChange={(c) => setColor(curve.id, c)}
            onLabelChange={(l) => setLabel(curve.id, l)}
            onRemove={() => removeCurve(curve.id)}
            onExport={() => exportCurveCSV(curve.data, curve.label)}
          />
        ))}
      </div>

      {importError && (
        <p className="text-red-600 text-xs mb-2 bg-red-50 border border-red-200 rounded px-2 py-1">
          {importError}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={handleImport}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={curves.length >= 4}
        className="btn-secondary w-full text-xs"
      >
        Import CSV / XLSX
      </button>
    </div>
  )
}

function CurveRow({
  curve,
  onToggle,
  onColorChange,
  onLabelChange,
  onRemove,
  onExport,
}: {
  curve: VWAPCurve
  onToggle: () => void
  onColorChange: (c: string) => void
  onLabelChange: (l: string) => void
  onRemove: () => void
  onExport: () => void
}) {
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded bg-white border border-gray-200 shadow-sm ${
        !curve.visible ? 'opacity-40' : ''
      }`}
    >
      {/* Color swatch */}
      <div className="relative flex-shrink-0">
        <input
          type="color"
          value={curve.color}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer opacity-0 absolute inset-0"
          title="Change color"
        />
        <div
          className="w-5 h-5 rounded border border-gray-300 flex-shrink-0"
          style={{ backgroundColor: curve.color }}
        />
      </div>

      {/* Label */}
      <input
        className="flex-1 bg-transparent text-xs text-gray-800 focus:outline-none min-w-0 truncate"
        value={curve.label}
        onChange={(e) => onLabelChange(e.target.value)}
        title={curve.label}
      />

      {/* Source badge */}
      <span className="text-xs text-gray-400 flex-shrink-0 bg-gray-100 px-1 rounded">
        {curve.source === 'imported' ? 'CSV' : 'BBG'}
      </span>

      {/* Visibility toggle */}
      <button
        onClick={onToggle}
        title={curve.visible ? 'Hide curve' : 'Show curve'}
        className="text-gray-400 hover:text-gray-700 text-xs flex-shrink-0 transition-colors"
      >
        {curve.visible ? '●' : '○'}
      </button>

      {/* Export (Bloomberg curves only) */}
      {curve.source === 'bloomberg' && (
        <button
          onClick={onExport}
          title="Export to CSV"
          className="text-gray-400 hover:text-green-600 text-xs flex-shrink-0 transition-colors"
        >
          ↓
        </button>
      )}

      {/* Remove */}
      <button
        onClick={onRemove}
        title="Remove curve"
        className="text-gray-400 hover:text-red-500 text-xs flex-shrink-0 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
