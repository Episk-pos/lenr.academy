/**
 * Lazy, on-demand Unicode font support for PDF export.
 *
 * jsPDF's standard 14 fonts (Helvetica etc.) only cover Latin-1 / WinAnsi, so
 * Cyrillic, Greek, CJK, Hangul, Devanagari, Arabic and symbols such as "→"
 * come out as garbage. This module:
 *
 *   1. detects which scripts the PDF text actually contains (`detectScripts`),
 *   2. picks the smallest suitable Noto Sans subset (`selectPdfFont`), using
 *      the UI language only to disambiguate Han characters (ja vs zh),
 *   3. fetches it from /fonts/pdf/ (static assets, never in the JS bundle),
 *      caches the base64 data for the session (`loadPdfFont`), and
 *   4. registers it with the jsPDF document (`applyPdfFont`), falling back to
 *      Helvetica if the fetch fails.
 *
 * The font files are built by scripts/fetch-pdf-fonts.sh. Each one is a
 * Regular-weight subset merged with a common Latin/Greek/Cyrillic/symbol base,
 * because jsPDF cannot fall back to another font per glyph: one font must cover
 * everything in the document.
 *
 * COMPLEX SCRIPT LIMITATIONS (jsPDF 4.x has no OpenType shaping engine; it
 * maps code points straight to glyphs via the cmap and ignores GSUB/GPOS):
 *
 * - Arabic: jsPDF ships its own shaper. A `preProcessText` hook
 *   (`processArabic`) rewrites Arabic letters to their contextual Presentation
 *   Forms-B code points (initial/medial/final/isolated, plus lam-alef
 *   ligatures), and a `postProcessText` bidi engine reorders runs for display.
 *   Both run automatically on doc.text() and in autotable cells, so connected,
 *   correctly-ordered Arabic renders as long as the font maps the presentation
 *   form code points, which ours does (U+FB50-FDFF and U+FE70-FEFF are kept on
 *   purpose). Do NOT call doc.setR2L(true): it naively reverses every string,
 *   which double-reverses after the bidi engine and mangles digits and Latin.
 *   Remaining gaps: no mark positioning (harakat sit at default offsets) and
 *   no right-aligned/mirrored layout, so the page layout stays LTR.
 * - Devanagari (hi): there is no shaper at all. Glyphs render in logical
 *   order without reordering or conjunct formation, so the short-i matra
 *   (ि) appears after its consonant instead of before it, and conjuncts show
 *   as consonant + visible virama (क्ष renders as क् + ष). The text is still
 *   legible to Hindi readers, so it beats boxes or Helvetica garbage. A proper
 *   fix needs a shaping engine (e.g. harfbuzzjs) or rasterising the text via
 *   canvas, which the browser shapes correctly.
 * - Only one font is active per document. Mixing two complex scripts (e.g.
 *   Arabic + CJK) renders the lower-priority one as missing glyphs.
 */

export type PdfScript =
  | 'latin1'      // U+0000-00FF: Helvetica can render it
  | 'extended'    // anything else not listed below (Latin Ext, Greek, Cyrillic, arrows, super/subscripts...)
  | 'cyrillic'
  | 'greek'
  | 'kana'
  | 'han'
  | 'hangul'
  | 'devanagari'
  | 'arabic'

export type PdfFontId = 'latin' | 'jp' | 'sc' | 'kr' | 'devanagari' | 'arabic'

export interface PdfFontSpec {
  id: PdfFontId
  /** File name under public/fonts/pdf/ */
  file: string
  /** Name registered with jsPDF (doc.setFont / autotable styles.font) */
  family: string
  /** How jsPDF handles the script's shaping, see module comment. */
  shaping: 'none-needed' | 'jspdf-arabic' | 'unshaped'
}

export const PDF_FONTS: Record<PdfFontId, PdfFontSpec> = {
  latin: { id: 'latin', file: 'NotoSans-Regular.ttf', family: 'NotoSansPdf', shaping: 'none-needed' },
  jp: { id: 'jp', file: 'NotoSansJP-Regular.ttf', family: 'NotoSansJPPdf', shaping: 'none-needed' },
  sc: { id: 'sc', file: 'NotoSansSC-Regular.ttf', family: 'NotoSansSCPdf', shaping: 'none-needed' },
  kr: { id: 'kr', file: 'NotoSansKR-Regular.ttf', family: 'NotoSansKRPdf', shaping: 'none-needed' },
  devanagari: { id: 'devanagari', file: 'NotoSansDevanagari-Regular.ttf', family: 'NotoSansDevanagariPdf', shaping: 'unshaped' },
  arabic: { id: 'arabic', file: 'NotoSansArabic-Regular.ttf', family: 'NotoSansArabicPdf', shaping: 'jspdf-arabic' },
}

/** Classify a single code point. */
function classify(cp: number): PdfScript {
  if (cp <= 0xff) return 'latin1'
  if (cp >= 0x0370 && cp <= 0x03ff) return 'greek'
  if (cp >= 0x0400 && cp <= 0x052f) return 'cyrillic'
  if ((cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f) ||
      (cp >= 0x08a0 && cp <= 0x08ff) || (cp >= 0xfb50 && cp <= 0xfdff) ||
      (cp >= 0xfe70 && cp <= 0xfeff)) return 'arabic'
  if ((cp >= 0x0900 && cp <= 0x097f) || (cp >= 0xa8e0 && cp <= 0xa8ff)) return 'devanagari'
  if ((cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f) ||
      (cp >= 0xac00 && cp <= 0xd7af)) return 'hangul'
  if ((cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x31f0 && cp <= 0x31ff) ||
      (cp >= 0xff66 && cp <= 0xff9f)) return 'kana'
  if ((cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x20000 && cp <= 0x2ffff)) return 'han'
  return 'extended'
}

/**
 * Prepare a string for jsPDF: compose to NFC (so "e" + U+0301 uses the
 * precomposed glyph, since jsPDF cannot position combining marks) and drop
 * emoji variation selectors (U+FE00-FE0F), which have no glyph and would
 * otherwise render as a .notdef box.
 */
export function normalizePdfText(text: string): string {
  return text.normalize('NFC').replace(/[︀-️]/g, '')
}

/** Scan strings and return every script they use. */
export function detectScripts(texts: Iterable<string | null | undefined>): Set<PdfScript> {
  const scripts = new Set<PdfScript>()
  for (const text of texts) {
    if (!text) continue
    for (const ch of text) {
      scripts.add(classify(ch.codePointAt(0)!))
    }
  }
  return scripts
}

/**
 * Choose the font for a document, or null if Helvetica suffices (pure Latin-1).
 *
 * Priority when scripts mix: Arabic > Devanagari > Hangul > Kana > Han > other.
 * Han without kana/hangul is ambiguous (Japanese kanji vs Chinese hanzi have
 * different glyph shapes and coverage), so the UI language decides.
 */
export function selectPdfFont(scripts: Set<PdfScript>, language: string | undefined): PdfFontSpec | null {
  const lang = (language ?? '').toLowerCase().split(/[-_]/)[0]
  if (scripts.has('arabic')) return PDF_FONTS.arabic
  if (scripts.has('devanagari')) return PDF_FONTS.devanagari
  if (scripts.has('hangul')) return PDF_FONTS.kr
  if (scripts.has('kana')) return PDF_FONTS.jp
  if (scripts.has('han')) {
    if (lang === 'ja') return PDF_FONTS.jp
    if (lang === 'ko') return PDF_FONTS.kr
    return PDF_FONTS.sc
  }
  if (scripts.has('extended') || scripts.has('greek') || scripts.has('cyrillic')) return PDF_FONTS.latin
  return null
}

// ---------------------------------------------------------------------------
// Loader with session cache
// ---------------------------------------------------------------------------

const fontCache = new Map<string, Promise<string>>()

/** Reset the session cache (tests). */
export function clearPdfFontCache(): void {
  fontCache.clear()
}

function fontUrl(file: string): string {
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/'
  return `${base.endsWith('/') ? base : `${base}/`}fonts/pdf/${file}`
}

/** ArrayBuffer -> base64 without blowing the call stack on multi-MB fonts. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(binary)
}

/**
 * Fetch a font file and return it base64-encoded. Results are cached for the
 * session; a failed fetch is evicted so a later export can retry.
 */
export function loadPdfFont(spec: PdfFontSpec, fetchImpl: typeof fetch = fetch): Promise<string> {
  const cached = fontCache.get(spec.file)
  if (cached) return cached
  const promise = (async () => {
    const res = await fetchImpl(fontUrl(spec.file))
    if (!res.ok) throw new Error(`Failed to fetch PDF font ${spec.file}: HTTP ${res.status}`)
    return arrayBufferToBase64(await res.arrayBuffer())
  })()
  fontCache.set(spec.file, promise)
  promise.catch(() => fontCache.delete(spec.file))
  return promise
}

// ---------------------------------------------------------------------------
// jsPDF integration
// ---------------------------------------------------------------------------

/** Minimal slice of the jsPDF API we use (keeps jspdf out of this module's imports). */
export interface PdfFontTarget {
  addFileToVFS(filename: string, data: string): unknown
  addFont(postScriptName: string, id: string, fontStyle: string): unknown
  setFont(fontName: string, fontStyle?: string): unknown
  getFontList(): Record<string, string[]>
}

export interface AppliedPdfFont {
  /** Font name to use for doc.setFont and autotable styles.font */
  font: string
  /** The Unicode font we wanted, if any */
  spec: PdfFontSpec | null
  /** True if a Unicode font was needed but could not be loaded */
  fallback: boolean
}

/**
 * Pick, load and register the font needed for `texts`, and make it the
 * document's current font. Never throws: on failure it stays on Helvetica and
 * reports `fallback: true` so the caller can warn the user.
 */
export async function applyPdfFont(
  doc: PdfFontTarget,
  texts: Iterable<string | null | undefined>,
  language: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<AppliedPdfFont> {
  const spec = selectPdfFont(detectScripts(texts), language)
  if (!spec) return { font: 'helvetica', spec: null, fallback: false }

  try {
    const base64 = await loadPdfFont(spec, fetchImpl)
    if (!doc.getFontList()[spec.family]) {
      doc.addFileToVFS(spec.file, base64)
      // Only a Regular weight is shipped (keeps CJK files ~half the size).
      // Register it for every style autotable may request (e.g. bold headers)
      // so jsPDF does not silently fall back to Times.
      for (const style of ['normal', 'bold', 'italic', 'bolditalic']) {
        doc.addFont(spec.file, spec.family, style)
      }
    }
    doc.setFont(spec.family, 'normal')
    return { font: spec.family, spec, fallback: false }
  } catch (err) {
    console.warn('PDF export: Unicode font unavailable, falling back to Helvetica.', err)
    doc.setFont('helvetica', 'normal')
    return { font: 'helvetica', spec, fallback: true }
  }
}

const LATIN1_REPLACEMENTS: Record<string, string> = {
  '→': '->', '←': '<-', '↔': '<->', '⇌': '<=>', '−': '-', '–': '-', '—': '-',
  '≤': '<=', '≥': '>=', '≈': '~', '…': '...', '‘': "'", '’': "'", '“': '"', '”': '"',
  'ν': 'nu', 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'μ': 'mu', '⁻': '-', '⁺': '+',
  '⁰': '0', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
}

/**
 * Best-effort ASCII substitutes for common symbols, used only when the Unicode
 * font failed to load so that English PDFs stay readable offline.
 * Latin-1 characters (¹ ² ³ ×) render fine in Helvetica and are left alone.
 */
export function toLatin1Fallback(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    out += cp <= 0xff ? ch : (LATIN1_REPLACEMENTS[ch] ?? ch)
  }
  return out
}
