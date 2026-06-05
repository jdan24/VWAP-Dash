import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

interface ZoomState {
  selStart: string | null
  selEnd: string | null
  zoomStart: number | null
  zoomEnd: number | null
}

const INITIAL: ZoomState = { selStart: null, selEnd: null, zoomStart: null, zoomEnd: null }

/**
 * Click-drag box zoom for a recharts chart with a categorical "time" x-axis.
 *
 * Usage:
 *   const zoom = useBoxZoom(mergedData)
 *   <ComposedChart
 *     data={zoom.visibleData}
 *     onMouseDown={zoom.onMouseDown}
 *     onMouseMove={zoom.onMouseMove}
 *     onDoubleClick={zoom.reset}
 *   >
 *     {zoom.selStart && zoom.selEnd && (
 *       <ReferenceArea x1={zoom.selStart} x2={zoom.selEnd} ... />
 *     )}
 *   </ComposedChart>
 */
export function useBoxZoom<T extends { time: string }>(data: T[]) {
  const [state, setState] = useState<ZoomState>(INITIAL)
  const isDragging = useRef(false)
  const dragRef = useRef<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  })

  // Reset zoom when the underlying dataset length changes (new curve loaded, etc.)
  const prevLen = useRef(data.length)
  useEffect(() => {
    if (data.length !== prevLen.current) {
      prevLen.current = data.length
      isDragging.current = false
      dragRef.current = { start: null, end: null }
      setState(INITIAL)
    }
  }, [data.length])

  // Apply zoom on mouseup — uses window listener so releasing outside the SVG still works
  useEffect(() => {
    function onWindowMouseUp() {
      if (!isDragging.current) return
      isDragging.current = false
      const { start, end } = dragRef.current
      dragRef.current = { start: null, end: null }

      if (!start || !end || start === end) {
        setState((prev) => ({ ...prev, selStart: null, selEnd: null }))
        return
      }
      const i1 = data.findIndex((d) => d.time === start)
      const i2 = data.findIndex((d) => d.time === end)
      if (i1 === -1 || i2 === -1 || Math.abs(i1 - i2) < 2) {
        setState((prev) => ({ ...prev, selStart: null, selEnd: null }))
        return
      }
      setState({
        selStart: null,
        selEnd: null,
        zoomStart: Math.min(i1, i2),
        zoomEnd: Math.max(i1, i2),
      })
    }
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => window.removeEventListener('mouseup', onWindowMouseUp)
  }, [data])

  const onMouseDown = useCallback((e: { activeLabel?: string | number }) => {
    const label = e?.activeLabel != null ? String(e.activeLabel) : null
    if (!label) return
    isDragging.current = true
    dragRef.current.start = label
    dragRef.current.end = label
    setState((prev) => ({ ...prev, selStart: label, selEnd: label }))
  }, [])

  const onMouseMove = useCallback((e: { activeLabel?: string | number }) => {
    if (!isDragging.current) return
    const label = e?.activeLabel != null ? String(e.activeLabel) : null
    if (!label) return
    dragRef.current.end = label
    setState((prev) => ({ ...prev, selEnd: label }))
  }, [])

  const reset = useCallback(() => {
    isDragging.current = false
    dragRef.current = { start: null, end: null }
    setState(INITIAL)
  }, [])

  const visibleData = useMemo(() => {
    if (state.zoomStart === null || state.zoomEnd === null) return data
    return data.slice(state.zoomStart, state.zoomEnd + 1)
  }, [data, state.zoomStart, state.zoomEnd])

  return {
    visibleData,
    selStart: state.selStart,
    selEnd: state.selEnd,
    isZoomed: state.zoomStart !== null,
    onMouseDown,
    onMouseMove,
    reset,
  }
}
