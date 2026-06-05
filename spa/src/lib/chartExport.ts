import { toPng, toJpeg } from 'html-to-image'

export type ExportFormat = 'svg' | 'png' | 'jpg'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'chart'
}

export async function exportChart(
  el: HTMLElement,
  label: string,
  format: ExportFormat,
): Promise<void> {
  const filename = sanitizeFilename(label)

  if (format === 'svg') {
    // Pull the Recharts SVG element directly and serialize it
    const svg = el.querySelector<SVGSVGElement>('svg')
    if (!svg) return
    // Clone to avoid mutating live DOM; ensure xmlns is present
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(clone)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    downloadBlob(blob, `${filename}.svg`)
    return
  }

  const opts = {
    backgroundColor: '#ffffff',   // white — matches the light theme
    pixelRatio: 2,                 // 2× for crispness
  }

  if (format === 'png') {
    const dataUrl = await toPng(el, opts)
    downloadDataUrl(dataUrl, `${filename}.png`)
  } else {
    const dataUrl = await toJpeg(el, { ...opts, quality: 0.95 })
    downloadDataUrl(dataUrl, `${filename}.jpg`)
  }
}
