/**
 * Canvas rasterisation of Devanagari text for PDF export.
 *
 * jsPDF has no OpenType shaping engine, so Devanagari drawn with doc.text()
 * comes out in logical order without matra reordering or conjuncts (see
 * ./pdfFonts.ts). The browser does shape it correctly, so every text run that
 * contains Devanagari is drawn on an offscreen <canvas> with a FontFace built
 * from NotoSansDevanagari-Shaping.ttf (a subset that keeps GSUB/GPOS/GDEF,
 * unlike the jsPDF fonts) and placed in the PDF as a PNG via doc.addImage.
 *
 * `createCanvasShaper` returns null when FontFace / canvas are unavailable or
 * the font fails to load; callers then keep the unshaped doc.text() path.
 *
 * Units: sizes in, sizes out are in points (font size) and millimetres
 * (widths/heights), matching the `unit: 'mm'` jsPDF document.
 */

import { pdfFontUrl } from './pdfFonts'

export const SHAPING_FONT = {
  file: 'NotoSansDevanagari-Shaping.ttf',
  family: 'LenrPdfDevanagariShaping',
} as const

/** True if the text contains Devanagari (incl. Extended / Vedic) and must be shaped on a canvas. */
export function needsCanvasShaping(text: string | null | undefined): boolean {
  if (!text) return false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if ((c >= 0x0900 && c <= 0x097f) || (c >= 0xa8e0 && c <= 0xa8ff) || (c >= 0x1cd0 && c <= 0x1cff)) return true
  }
  return false
}

export const PT_TO_MM = 25.4 / 72
/** Canvas pixels per point: 3x the CSS 96 dpi resolution, so images stay crisp when zoomed/printed. */
const PX_PER_PT = 3 * (96 / 72)
/** Glyph extents of Noto Sans Devanagari in em (head.yMax 1347, yMin -530 per 1000 upm). */
const ASCENT_EM = 1.35
const DESCENT_EM = 0.55
/** Horizontal padding so overhanging marks are not clipped at the image edge. */
const PAD_EM = 0.15
/** Baseline-to-baseline distance for wrapped shaped lines. */
export const SHAPED_LINE_HEIGHT_EM = 1.45
/** Where the baseline sits inside a shaped line box (matras above need room). */
export const SHAPED_BASELINE_EM = 1.05

export interface ShapedImage {
  /** PNG data URL */
  dataUrl: string
  /** Stable alias so jsPDF embeds identical images once */
  key: string
  /** Advance width of the text itself (mm), excluding padding */
  textWidth: number
  /** Image box (mm), including padding */
  width: number
  height: number
  /** Distance from the image's top edge to the text baseline (mm) */
  ascent: number
  /** Padding on the left edge of the image (mm) */
  padLeft: number
}

export interface TextShaper {
  /** Advance width of `text` in mm at `fontSizePt`. */
  measure(text: string, fontSizePt: number): number
  /** Greedy word wrap to `maxWidth` mm. A word wider than maxWidth keeps its own line. */
  wrap(text: string, fontSizePt: number, maxWidth: number): string[]
  /** Rasterise one line of text. `color` is any CSS colour. */
  render(text: string, fontSizePt: number, color: string): ShapedImage
}

const fontFaceCache = new Map<string, Promise<void>>()

/** Reset the session cache (tests). */
export function clearShapingFontCache(): void {
  fontFaceCache.clear()
}

function loadShapingFont(fetchImpl: typeof fetch): Promise<void> {
  const cached = fontFaceCache.get(SHAPING_FONT.file)
  if (cached) return cached
  const promise = (async () => {
    const res = await fetchImpl(pdfFontUrl(SHAPING_FONT.file))
    if (!res.ok) throw new Error(`Failed to fetch shaping font ${SHAPING_FONT.file}: HTTP ${res.status}`)
    const face = new FontFace(SHAPING_FONT.family, await res.arrayBuffer())
    await face.load()
    document.fonts.add(face)
  })()
  fontFaceCache.set(SHAPING_FONT.file, promise)
  promise.catch(() => fontFaceCache.delete(SHAPING_FONT.file))
  return promise
}

/**
 * Build a canvas-backed shaper, or return null (never throws) if the browser
 * lacks FontFace/canvas support or the shaping font cannot be loaded.
 */
export async function createCanvasShaper(fetchImpl: typeof fetch = fetch): Promise<TextShaper | null> {
  try {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    await loadShapingFont(fetchImpl)

    const fontCss = (sizePt: number) => `${sizePt * PX_PER_PT}px "${SHAPING_FONT.family}", sans-serif`
    const measurePx = (text: string, sizePt: number) => {
      ctx.font = fontCss(sizePt)
      return ctx.measureText(text).width
    }
    const measure = (text: string, sizePt: number) => (measurePx(text, sizePt) / PX_PER_PT) * PT_TO_MM

    const images = new Map<string, ShapedImage>()

    return {
      measure,
      wrap(text, sizePt, maxWidth) {
        const words = text.split(/\s+/).filter(Boolean)
        if (words.length === 0) return ['']
        const lines: string[] = []
        let line = words[0]
        for (const word of words.slice(1)) {
          const candidate = `${line} ${word}`
          if (measure(candidate, sizePt) <= maxWidth) {
            line = candidate
          } else {
            lines.push(line)
            line = word
          }
        }
        lines.push(line)
        return lines
      },
      render(text, sizePt, color) {
        const key = `shaped:${sizePt}:${color}:${text}`
        const cached = images.get(key)
        if (cached) return cached
        const fontPx = sizePt * PX_PER_PT
        const textPx = measurePx(text, sizePt)
        const padPx = Math.ceil(PAD_EM * fontPx)
        // Resizing resets the context state, so set the font etc. afterwards
        canvas.width = Math.max(1, Math.ceil(textPx + 2 * padPx))
        canvas.height = Math.max(1, Math.ceil((ASCENT_EM + DESCENT_EM) * fontPx))
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.font = fontCss(sizePt)
        ctx.fillStyle = color
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(text, padPx, ASCENT_EM * fontPx)
        const pxToMm = PT_TO_MM / PX_PER_PT
        const image: ShapedImage = {
          dataUrl: canvas.toDataURL('image/png'),
          key,
          textWidth: textPx * pxToMm,
          width: canvas.width * pxToMm,
          height: canvas.height * pxToMm,
          ascent: ASCENT_EM * fontPx * pxToMm,
          padLeft: padPx * pxToMm,
        }
        images.set(key, image)
        return image
      },
    }
  } catch (err) {
    console.warn('PDF export: canvas shaping unavailable, Devanagari will be unshaped.', err)
    return null
  }
}
