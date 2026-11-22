/**
 * Canvas rasterisation of Devanagari, Bengali and Thai text for PDF export.
 *
 * jsPDF has no OpenType shaping engine, so Devanagari and Bengali drawn with
 * doc.text() come out in logical order without matra reordering or conjuncts,
 * and Thai vowel and tone marks collide with each other and with tall
 * consonants (see ./pdfFonts.ts). The browser does shape them correctly, so
 * every text run that contains one of these scripts is drawn on an offscreen
 * <canvas> with FontFaces built from the matching *-Shaping.ttf files (subsets
 * that keep GSUB/GPOS/GDEF, unlike the jsPDF fonts) and placed in the PDF as a
 * PNG via doc.addImage.
 *
 * `createCanvasShaper` returns null when FontFace / canvas are unavailable or
 * the font fails to load; callers then keep the unshaped doc.text() path.
 *
 * Units: sizes in, sizes out are in points (font size) and millimetres
 * (widths/heights), matching the `unit: 'mm'` jsPDF document.
 */

import { pdfFontUrl } from './pdfFonts'

export type ShapingScript = 'devanagari' | 'bengali' | 'thai'

export interface ShapingFont {
  /** File name under public/fonts/pdf/ */
  file: string
  /** CSS font-family the FontFace is registered under */
  family: string
}

export const SHAPING_FONTS: Record<ShapingScript, ShapingFont> = {
  devanagari: { file: 'NotoSansDevanagari-Shaping.ttf', family: 'LenrPdfDevanagariShaping' },
  bengali: { file: 'NotoSansBengali-Shaping.ttf', family: 'LenrPdfBengaliShaping' },
  thai: { file: 'NotoSansThai-Shaping.ttf', family: 'LenrPdfThaiShaping' },
}

/** The script of a UTF-16 code unit that must be shaped on a canvas, if any. */
function shapingScriptOf(c: number): ShapingScript | null {
  if ((c >= 0x0900 && c <= 0x097f) || (c >= 0xa8e0 && c <= 0xa8ff) || (c >= 0x1cd0 && c <= 0x1cff)) return 'devanagari'
  if (c >= 0x0980 && c <= 0x09ff) return 'bengali'
  if (c >= 0x0e00 && c <= 0x0e7f) return 'thai'
  return null
}

/** True if the text contains Devanagari (incl. Extended / Vedic), Bengali or Thai and must be shaped on a canvas. */
export function needsCanvasShaping(text: string | null | undefined): boolean {
  if (!text) return false
  for (let i = 0; i < text.length; i++) {
    if (shapingScriptOf(text.charCodeAt(i))) return true
  }
  return false
}

/**
 * The shaping fonts needed for `texts`, in a stable order. The Devanagari
 * dandas (। ॥) are also used in Bengali text, and the Bengali font covers
 * them, so they alone do not pull in the Devanagari font next to Bengali.
 */
export function shapingFontsFor(texts: Iterable<string | null | undefined>): ShapingFont[] {
  const scripts = new Set<ShapingScript>()
  let dandaOnly = true
  for (const text of texts) {
    if (!text) continue
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      const script = shapingScriptOf(c)
      if (!script) continue
      scripts.add(script)
      if (script === 'devanagari' && c !== 0x0964 && c !== 0x0965) dandaOnly = false
    }
  }
  if (dandaOnly && scripts.has('bengali')) scripts.delete('devanagari')
  return (Object.keys(SHAPING_FONTS) as ShapingScript[]).filter((s) => scripts.has(s)).map((s) => SHAPING_FONTS[s])
}

interface WordSegmenter {
  segment(text: string): Iterable<{ segment: string }>
}

let wordSegmenter: WordSegmenter | null | undefined

/**
 * Split a run without spaces (Thai has none between words) at word
 * boundaries using Intl.Segmenter, where available. Returns [word] otherwise.
 */
function segmentWord(word: string): string[] {
  if (wordSegmenter === undefined) {
    const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, opts?: { granularity: 'word' }) => WordSegmenter }).Segmenter
    wordSegmenter = Segmenter ? new Segmenter(undefined, { granularity: 'word' }) : null
  }
  return wordSegmenter ? Array.from(wordSegmenter.segment(word), (s) => s.segment) : [word]
}

export const PT_TO_MM = 25.4 / 72
/** Canvas pixels per point: 3x the CSS 96 dpi resolution, so images stay crisp when zoomed/printed. */
const PX_PER_PT = 3 * (96 / 72)
/**
 * Glyph extents in em, from the tallest shaping font: Noto Sans Devanagari
 * (head.yMax 1347, yMin -530 per 1000 upm). Bengali (917/-408) and Thai
 * (1009/-433) fit inside.
 */
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

function loadShapingFont(font: ShapingFont, fetchImpl: typeof fetch): Promise<void> {
  const cached = fontFaceCache.get(font.file)
  if (cached) return cached
  const promise = (async () => {
    const res = await fetchImpl(pdfFontUrl(font.file))
    if (!res.ok) throw new Error(`Failed to fetch shaping font ${font.file}: HTTP ${res.status}`)
    const face = new FontFace(font.family, await res.arrayBuffer())
    await face.load()
    document.fonts.add(face)
  })()
  fontFaceCache.set(font.file, promise)
  promise.catch(() => fontFaceCache.delete(font.file))
  return promise
}

/**
 * Build a canvas-backed shaper for `fonts` (see shapingFontsFor), or return
 * null (never throws) if the browser lacks FontFace/canvas support or a
 * shaping font cannot be loaded.
 */
export async function createCanvasShaper(
  fonts: readonly ShapingFont[],
  fetchImpl: typeof fetch = fetch,
): Promise<TextShaper | null> {
  try {
    if (fonts.length === 0) return null
    if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    await Promise.all(fonts.map((font) => loadShapingFont(font, fetchImpl)))

    // Each family only covers its own script, so the canvas picks per glyph
    const families = fonts.map((font) => `"${font.family}"`).join(', ')
    const fontCss = (sizePt: number) => `${sizePt * PX_PER_PT}px ${families}, sans-serif`
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
        // A word too wide for a line (typically Thai, written without spaces)
        // is broken at word boundaries; its pieces join without a space.
        const pieces: { text: string; sep: string }[] = []
        for (const word of words) {
          const parts = measure(word, sizePt) > maxWidth ? segmentWord(word) : [word]
          parts.forEach((part, i) => pieces.push({ text: part, sep: i === 0 ? ' ' : '' }))
        }
        const lines: string[] = []
        let line = pieces[0].text
        for (const piece of pieces.slice(1)) {
          const candidate = `${line}${piece.sep}${piece.text}`
          if (measure(candidate, sizePt) <= maxWidth) {
            line = candidate
          } else {
            lines.push(line)
            line = piece.text
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
    console.warn('PDF export: canvas shaping unavailable, Devanagari/Bengali/Thai will be unshaped.', err)
    return null
  }
}
