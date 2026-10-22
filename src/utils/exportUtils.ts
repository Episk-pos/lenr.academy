/**
 * Export utilities for query results (JSON and PDF formats).
 * CSV export is already implemented inline in each query page.
 */

import i18n from 'i18next'
import type { jsPDF as JsPDF } from 'jspdf'
import type { CellDef, CellHookData, Color } from 'jspdf-autotable'
import type { NeutrinoType, QueryFilter, ReactionType } from '../types'
import { showTransientNotice } from './transientNotice'
import type { ShapedImage, TextShaper } from './pdfShaping'

interface ExportMetadata {
  queryType: ReactionType
  filter: QueryFilter
  executionTime: number
  rowCount: number
  totalCount: number
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

/**
 * Export query results as JSON with metadata
 */
export function exportToJSON(
  reactions: any[],
  metadata: ExportMetadata
) {
  if (reactions.length === 0) return

  const appVersion = (import.meta.env.VITE_APP_VERSION as string) || 'unknown'

  const output = {
    query: {
      type: metadata.queryType,
      parameters: metadata.filter,
      executedAt: new Date().toISOString(),
    },
    results: {
      reactions,
      statistics: {
        count: metadata.rowCount,
        totalMatching: metadata.totalCount,
        meanEnergy: reactions.length > 0
          ? reactions.reduce((sum, r) => sum + (r.MeV || 0), 0) / reactions.length
          : 0,
        minEnergy: reactions.length > 0
          ? reactions.reduce((min, r) => Math.min(min, r.MeV || 0), Infinity)
          : 0,
        maxEnergy: reactions.length > 0
          ? reactions.reduce((max, r) => Math.max(max, r.MeV || 0), -Infinity)
          : 0,
        executionTime: metadata.executionTime,
      },
    },
    metadata: {
      version: appVersion,
      exportedAt: new Date().toISOString(),
      source: 'LENR Academy',
    },
  }

  const json = JSON.stringify(output, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const date = new Date().toISOString().split('T')[0]
  downloadBlob(blob, `${metadata.queryType}_reactions_${date}.json`)
}

/** Translate with the app's i18n instance (plain module: no hooks). */
function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options) as string
}

/** Table layout: one (element, Z, A) column group per nuclide, then energy and neutrino. */
const NUCLIDE_GROUPS: Record<ReactionType, { labelKey: string; fields: [string, string, string] }[]> = {
  fusion: [
    { labelKey: 'reactions.input1', fields: ['E1', 'Z1', 'A1'] },
    { labelKey: 'reactions.input2', fields: ['E2', 'Z2', 'A2'] },
    { labelKey: 'reactions.output', fields: ['E', 'Z', 'A'] },
  ],
  fission: [
    { labelKey: 'reactions.input', fields: ['E', 'Z', 'A'] },
    { labelKey: 'reactions.output1', fields: ['E1', 'Z1', 'A1'] },
    { labelKey: 'reactions.output2', fields: ['E2', 'Z2', 'A2'] },
  ],
  twotwo: [
    { labelKey: 'reactions.input1', fields: ['E1', 'Z1', 'A1'] },
    { labelKey: 'reactions.input2', fields: ['E2', 'Z2', 'A2'] },
    { labelKey: 'reactions.output1', fields: ['E3', 'Z3', 'A3'] },
    { labelKey: 'reactions.output2', fields: ['E4', 'Z4', 'A4'] },
  ],
}

const NEUTRINO_VALUE_KEYS: Partial<Record<NeutrinoType, string>> = {
  none: 'reactions.none',
  left: 'reactions.left',
  right: 'reactions.right',
}

const NEUTRINO_FILTER_KEYS: Partial<Record<NeutrinoType, string>> = {
  none: 'reactions.noNeutrino',
  left: 'reactions.onlyLeftNeutrino',
  right: 'reactions.onlyRightNeutrino',
  'left-right': 'reactions.leftRightNeutrinos',
}

function neutrinoLabel(value: unknown): string {
  const key = NEUTRINO_VALUE_KEYS[value as NeutrinoType]
  if (key) return t(key)
  return value == null ? '' : String(value)
}

/**
 * Two header rows (nuclide groups with colSpan, then element/Z/A) and a row mapper.
 */
function getTableLayout(queryType: ReactionType): { head: CellDef[][]; mapRow: (r: any) => (string | number)[] } {
  const groups = NUCLIDE_GROUPS[queryType]
  const head: CellDef[][] = [
    [
      ...groups.map((g): CellDef => ({ content: t(g.labelKey), colSpan: 3, styles: { halign: 'center' } })),
      { content: `${t('reactions.energy')} (MeV)`, rowSpan: 2, styles: { valign: 'middle' } },
      { content: t('reactions.neutrino'), rowSpan: 2, styles: { valign: 'middle' } },
    ],
    groups.flatMap((): CellDef[] => [{ content: t('export.pdf.columnElement') }, { content: 'Z' }, { content: 'A' }]),
  ]
  const mapRow = (r: any) => [
    ...groups.flatMap((g) => g.fields.map((f) => r[f] ?? '')),
    r.MeV?.toFixed(4) ?? '',
    neutrinoLabel(r.neutrino),
  ]
  return { head, mapRow }
}

const TITLE_ELEMENT_MAX = 6

/** "H/D" style list for the title equation; "*" when unconstrained. */
function equationList(list: string[] | undefined): string {
  if (!list?.length) return '*'
  return list.length > TITLE_ELEMENT_MAX
    ? `${list.slice(0, TITLE_ELEMENT_MAX).join('/')}/…`
    : list.join('/')
}

/**
 * Title such as "Fusion Reactions: H + Li → *"
 */
function getReactionTitle(queryType: ReactionType, filter: QueryFilter): string {
  const l = equationList
  switch (queryType) {
    case 'fusion':
      return t('export.pdf.title', {
        type: t('reactions.fusionTitle'),
        equation: `${l(filter.element1List)} + ${l(filter.element2List)} → ${l(filter.outputElementList)}`,
      })
    case 'fission':
      return t('export.pdf.title', {
        type: t('reactions.fissionTitle'),
        equation: `${l(filter.elements?.length ? filter.elements : filter.element1List)} → ${l(filter.outputElement1List)} + ${l(filter.outputElement2List)}`,
      })
    case 'twotwo':
      return t('export.pdf.title', {
        type: t('reactions.twoToTwoTitle'),
        equation: `${l(filter.element1List)} + ${l(filter.element2List)} → ${l(filter.outputElement3List)} + ${l(filter.outputElement4List)}`,
      })
  }
}

/**
 * Format filter parameters for display
 */
function formatFilterSummary(filter: QueryFilter, queryType: ReactionType): string[] {
  const lines: string[] = []
  const item = (label: string, value: string | number) => lines.push(t('export.pdf.filterValue', { label, value }))
  const list = (xs: string[]) => xs.join(', ')

  // Fission input element (skip if specific element lists are present to avoid redundancy)
  if (filter.elements?.length && !filter.element1List?.length && !filter.element2List?.length) {
    item(t('export.pdf.inputElement'), list(filter.elements))
  }
  // Fusion/TwoToTwo input elements
  if (filter.element1List?.length) {
    const label = queryType === 'fission' ? t('export.pdf.inputElement') : t('export.pdf.inputElementN', { n: 1 })
    item(label, list(filter.element1List))
  }
  if (filter.element2List?.length) {
    item(t('export.pdf.inputElementN', { n: 2 }), list(filter.element2List))
  }
  // Fusion output element
  if (filter.outputElementList?.length) {
    item(t('export.pdf.outputElement'), list(filter.outputElementList))
  }
  // Fission output elements
  if (filter.outputElement1List?.length) {
    item(t('export.pdf.outputElementN', { n: 1 }), list(filter.outputElement1List))
  }
  if (filter.outputElement2List?.length) {
    item(t('export.pdf.outputElementN', { n: 2 }), list(filter.outputElement2List))
  }
  // TwoToTwo output elements (E3/E4 are shown as outputs 1 and 2, as in the UI)
  if (filter.outputElement3List?.length) {
    item(t('export.pdf.outputElementN', { n: 1 }), list(filter.outputElement3List))
  }
  if (filter.outputElement4List?.length) {
    item(t('export.pdf.outputElementN', { n: 2 }), list(filter.outputElement4List))
  }
  if (filter.minMeV !== undefined) {
    item(t('export.pdf.minEnergy'), `${filter.minMeV} MeV`)
  }
  if (filter.maxMeV !== undefined) {
    item(t('export.pdf.maxEnergy'), `${filter.maxMeV} MeV`)
  }
  if (filter.neutrinoType && filter.neutrinoType !== 'any') {
    const key = NEUTRINO_FILTER_KEYS[filter.neutrinoType]
    item(t('reactions.neutrino'), key ? t(key) : filter.neutrinoType)
  }
  if (filter.limit) {
    item(t('export.pdf.limit'), filter.limit)
  }

  return lines.length > 0 ? lines : [t('export.pdf.noFilters')]
}

type Rgb = [number, number, number]
type Align = 'left' | 'center' | 'right'

const PT_TO_MM = 25.4 / 72
/** Baseline-to-baseline distance for wrapped jsPDF text, in em. */
const TEXT_LINE_HEIGHT_EM = 1.25
/** Widest a Devanagari table cell asks its column to be before wrapping (mm). */
const MAX_SHAPED_CELL_WIDTH = 40
const SITE_URL = 'https://lenr.academy'

function cssColor(color: Color | undefined): string {
  if (Array.isArray(color)) return `rgb(${color[0]}, ${color[1]}, ${color[2]})`
  if (typeof color === 'number') return `rgb(${color}, ${color}, ${color})`
  if (typeof color === 'string') return color
  return 'rgb(0, 0, 0)'
}

function setTextColor(doc: JsPDF, color: Color | undefined) {
  if (Array.isArray(color)) doc.setTextColor(color[0], color[1], color[2])
  else if (typeof color === 'number') doc.setTextColor(color)
  else if (typeof color === 'string') doc.setTextColor(color)
  else doc.setTextColor(0)
}

/**
 * Text drawing that sends Devanagari runs through the canvas shaper (see
 * ./pdfShaping.ts) and everything else through doc.text(). If the shaper is
 * missing or throws, the run falls back to unshaped doc.text().
 * Exported for tests only.
 */
export function createTextRenderer(
  doc: JsPDF,
  shaping: typeof import('./pdfShaping'),
  shaper: TextShaper | null,
  /** Draw the text invisibly under each image so the PDF stays searchable (needs a font covering it). */
  invisibleLayer: boolean,
) {
  let warned = false
  const warnOnce = (err: unknown) => {
    if (warned) return
    warned = true
    console.warn('PDF export: canvas shaping failed, using unshaped text.', err)
  }
  const shapedAdvance = (fontSize: number) => fontSize * PT_TO_MM * shaping.SHAPED_LINE_HEIGHT_EM
  const validated = new Set<string>()

  /**
   * Rasterise every line up front and make sure jsPDF can decode each image,
   * so nothing is drawn unless the whole run can be drawn (no half-shaped,
   * half-fallback duplicates). Throws if any line fails.
   */
  const renderLines = (lines: string[], fontSize: number, color: string): ShapedImage[] => {
    const images = lines.map((line) => shaper!.render(line, fontSize, color))
    for (const img of images) {
      if (validated.has(img.key)) continue
      doc.getImageProperties(img.dataUrl) // throws if jsPDF cannot decode it
      validated.add(img.key)
    }
    return images
  }

  /**
   * Place a rendered line with its baseline at y; x is the anchor for `align`.
   * `scale` shrinks the image (and the invisible text) to fit a cell.
   */
  const placeImage = (img: ShapedImage, line: string, x: number, y: number, align: Align, fontSize: number, scale = 1) => {
    const textWidth = img.textWidth * scale
    const left = align === 'right' ? x - textWidth : align === 'center' ? x - textWidth / 2 : x
    doc.addImage(img.dataUrl, 'PNG', left - img.padLeft * scale, y - img.ascent * scale, img.width * scale, img.height * scale, img.key)
    if (invisibleLayer) {
      doc.setFontSize(fontSize * scale)
      doc.text(line, left, y, { renderingMode: 'invisible' })
      doc.setFontSize(fontSize)
    }
  }

  /** Draw already-validated images; an unexpected failure here only warns (no fallback, so no duplicates). */
  const placeAll = (place: () => void) => {
    try {
      place()
    } catch (err) {
      warnOnce(err)
    }
  }

  /**
   * Draw `text` wrapped at maxWidth. With `anchor: 'top'` (default) y is the
   * first baseline; with `anchor: 'bottom'` y is the last baseline, so wrapped
   * text grows upward. Returns the extra height taken by wrapped lines (mm).
   */
  const drawText = (
    text: string,
    x: number,
    y: number,
    opts: { fontSize: number; color: Rgb; align?: Align; maxWidth?: number; anchor?: 'top' | 'bottom' },
  ): number => {
    const align = opts.align ?? 'left'
    doc.setFontSize(opts.fontSize)
    const firstBaseline = (lineCount: number, advance: number) =>
      opts.anchor === 'bottom' ? y - (lineCount - 1) * advance : y

    if (shaper && shaping.needsCanvasShaping(text)) {
      let layout: { lines: string[]; images: ShapedImage[] } | null = null
      try {
        const lines = opts.maxWidth ? shaper.wrap(text, opts.fontSize, opts.maxWidth) : [text]
        layout = { lines, images: renderLines(lines, opts.fontSize, cssColor(opts.color)) }
      } catch (err) {
        warnOnce(err)
      }
      if (layout) {
        const { lines, images } = layout
        const advance = shapedAdvance(opts.fontSize)
        const y0 = firstBaseline(lines.length, advance)
        placeAll(() => images.forEach((img, i) => placeImage(img, lines[i], x, y0 + i * advance, align, opts.fontSize)))
        return (lines.length - 1) * advance
      }
    }
    doc.setTextColor(...opts.color)
    const lines: string[] = opts.maxWidth ? doc.splitTextToSize(text, opts.maxWidth) : [text]
    const advance = opts.fontSize * PT_TO_MM * TEXT_LINE_HEIGHT_EM
    const y0 = firstBaseline(lines.length, advance)
    lines.forEach((line, i) => doc.text(line, x, y0 + i * advance, { align }))
    return (lines.length - 1) * advance
  }

  // autotable hooks: Devanagari cells are blanked during parsing (so jsPDF does
  // not draw unshaped glyphs), sized to fit the shaped text, then drawn as images.
  // The lines wrapped at parse time are the ones the reserved height was
  // computed for, and are reused when drawing.
  const shapedCells = new WeakMap<object, { text: string; lines: string[] }>()

  const didParseCell = (data: CellHookData) => {
    if (!shaper) return
    const text = data.cell.text.join(' ')
    if (!shaping.needsCanvasShaping(text)) return
    const { styles } = data.cell
    try {
      const lines = shaper.wrap(text, styles.fontSize, MAX_SHAPED_CELL_WIDTH)
      renderLines(lines, styles.fontSize, cssColor(styles.textColor)) // fail here, not mid-draw (cached)
      const width = Math.max(...lines.map((line) => shaper.measure(line, styles.fontSize)))
      // The min width makes the column at least as wide as the widest wrapped line,
      // so the same lines fit when drawn and the reserved height matches.
      styles.minCellWidth = Math.max(styles.minCellWidth || 0, width + data.cell.padding('horizontal'))
      styles.minCellHeight = Math.max(
        styles.minCellHeight || 0,
        lines.length * shapedAdvance(styles.fontSize) + data.cell.padding('vertical'),
      )
      shapedCells.set(data.cell, { text, lines })
      data.cell.text = ['']
    } catch (err) {
      warnOnce(err)
    }
  }

  const didDrawCell = (data: CellHookData) => {
    const shaped = shapedCells.get(data.cell)
    if (shaped === undefined || !shaper) return
    const { cell } = data
    const fontSize = cell.styles.fontSize
    const innerWidth = cell.width - cell.padding('horizontal')
    const innerTop = cell.y + cell.padding('top')
    const innerHeight = cell.height - cell.padding('vertical')
    const align: Align = cell.styles.halign === 'right' || cell.styles.halign === 'center' ? cell.styles.halign : 'left'
    const x = align === 'right'
      ? cell.x + cell.width - cell.padding('right')
      : align === 'center'
        ? cell.x + cell.padding('left') + innerWidth / 2
        : cell.x + cell.padding('left')
    doc.setFontSize(fontSize)

    let layout: { lines: string[]; images: ShapedImage[]; widest: number } | null = null
    try {
      const fits = (lines: string[]) => Math.max(...lines.map((l) => shaper.measure(l, fontSize))) <= innerWidth + 0.01
      // Column narrower than requested (e.g. a colSpan header or an overfull table): rewrap.
      const lines = fits(shaped.lines) ? shaped.lines : shaper.wrap(shaped.text, fontSize, innerWidth)
      const images = renderLines(lines, fontSize, cssColor(cell.styles.textColor))
      layout = { lines, images, widest: Math.max(...images.map((img) => img.textWidth)) }
    } catch (err) {
      warnOnce(err)
    }

    if (!layout) {
      setTextColor(doc, cell.styles.textColor)
      doc.text(shaped.text, x, innerTop + fontSize * PT_TO_MM, { align, maxWidth: innerWidth })
      return
    }

    const { lines, images, widest } = layout
    const advance = shapedAdvance(fontSize)
    // Never overflow the cell: shrink uniformly if the block is too tall or a word too wide
    const scale = Math.min(1, innerHeight / (lines.length * advance), widest > 0 ? innerWidth / widest : 1)
    const blockHeight = lines.length * advance * scale
    const top = cell.styles.valign === 'middle'
      ? innerTop + (innerHeight - blockHeight) / 2
      : cell.styles.valign === 'bottom'
        ? innerTop + innerHeight - blockHeight
        : innerTop
    const baseline = fontSize * PT_TO_MM * shaping.SHAPED_BASELINE_EM * scale
    placeAll(() =>
      images.forEach((img, i) => placeImage(img, lines[i], x, top + i * advance * scale + baseline, align, fontSize, scale)),
    )
  }

  return { drawText, didParseCell, didDrawCell }
}

/**
 * Export query results as PDF with table.
 *
 * Every string comes from i18n. Text outside Latin-1 (e.g. "→", Cyrillic,
 * CJK) needs an embedded Unicode font, and Devanagari is shaped on a canvas;
 * see ./pdfFonts.ts and ./pdfShaping.ts.
 */
export async function exportToPDF(
  reactions: any[],
  metadata: ExportMetadata
) {
  if (reactions.length === 0) return

  // Dynamic import to avoid loading jsPDF (and the font helpers) until needed (~100KB)
  const [{ default: jsPDF }, { default: autoTable }, pdfFonts, shaping] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('./pdfFonts'),
    import('./pdfShaping'),
  ])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const language = i18n.language

  // Collect every string up front so the font can be chosen from the actual content
  const { head: headRows, mapRow } = getTableLayout(metadata.queryType)
  const filterLines = formatFilterSummary(metadata.filter, metadata.queryType)
  const generatedAt = new Date().toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' })
  let strings = {
    brand: t('brand.appName'),
    title: getReactionTitle(metadata.queryType, metadata.filter),
    filterText: t('export.pdf.queryParameters', { params: filterLines.join(' | ') }),
    summary: `${t('export.pdf.reactionCount', { count: metadata.totalCount, shown: metadata.rowCount })} | ${t('export.pdf.generated', { date: generatedAt })}`,
    footer: t('export.pdf.footer', { brand: t('brand.appName'), url: SITE_URL }),
  }
  let head: CellDef[][] = headRows
  let body = reactions.map(mapRow)
  // Apply a string fix-up to every piece of text that goes into the PDF. Page
  // labels are only known after the table is laid out, so fixes are replayed.
  const fixes: ((s: string) => string)[] = []
  const fix = (s: string) => fixes.reduce((acc, f) => f(acc), s)
  const pageLabel = (page: number, total: number) => fix(t('export.pdf.pageNumber', { page, total }))
  const transform = (f: (s: string) => string) => {
    fixes.push(f)
    strings = Object.fromEntries(Object.entries(strings).map(([k, v]) => [k, f(v)])) as typeof strings
    head = head.map((row) => row.map((cell) => (typeof cell.content === 'string' ? { ...cell, content: f(cell.content) } : cell)))
    body = body.map((row) => row.map((cell) => (typeof cell === 'string' ? f(cell) : cell)))
  }
  transform(pdfFonts.normalizePdfText)

  const allText = [
    ...Object.values(strings),
    pageLabel(1, 1),
    ...head.flat().map((cell) => (cell.content == null ? '' : String(cell.content))),
    ...body.flatMap((row) => row.map((cell) => (cell == null ? '' : String(cell)))),
  ]
  const needsShaping = allText.some((s) => shaping.needsCanvasShaping(s))
  const [applied, shaper] = await Promise.all([
    pdfFonts.applyPdfFont(doc, allText, language),
    needsShaping ? shaping.createCanvasShaper() : Promise.resolve(null),
  ])

  if (applied.fallback) {
    // Keep the export usable: swap symbols for ASCII where possible and tell the user
    transform(pdfFonts.toLatin1Fallback)
    showTransientNotice(t('reactions.pdfFontFallback'))
  }

  const renderer = createTextRenderer(
    doc,
    shaping,
    shaper,
    !applied.fallback && applied.spec?.id === 'devanagari',
  )
  const maxTextWidth = pageWidth - 28 // 14mm margin each side

  // Header
  let y = 15
  y += renderer.drawText(strings.brand, 14, y, { fontSize: 18, color: [30, 64, 175] }) // primary blue
  y += 9
  y += renderer.drawText(strings.title, 14, y, { fontSize: 14, color: [0, 0, 0], maxWidth: maxTextWidth })
  y += 7
  y += renderer.drawText(strings.filterText, 14, y, { fontSize: 9, color: [100, 100, 100], maxWidth: maxTextWidth })
  y += 5
  y += renderer.drawText(strings.summary, 14, y, { fontSize: 9, color: [100, 100, 100], maxWidth: maxTextWidth })

  // Divider line
  const dividerY = y + 3
  doc.setDrawColor(200, 200, 200)
  doc.line(14, dividerY, pageWidth - 14, dividerY)

  // Results table
  autoTable(doc, {
    head,
    body,
    startY: dividerY + 3,
    margin: { left: 14, right: 14 },
    styles: {
      font: applied.font,
      fontSize: 7,
      cellPadding: 1.5,
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    // Shaped (Devanagari) rows can be taller than autotable's estimate; never split a row
    rowPageBreak: 'avoid',
    didParseCell: renderer.didParseCell,
    didDrawCell: renderer.didDrawCell,
  })

  // Footer and "Page X of Y" on every page, once the page count is known
  const pageCount = doc.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont(applied.font, 'normal')
    // Bottom-anchored: a wrapped footer grows upward instead of off the page
    renderer.drawText(strings.footer, 14, pageHeight - 8, { fontSize: 7, color: [150, 150, 150], maxWidth: maxTextWidth - 40, anchor: 'bottom' })
    renderer.drawText(pageLabel(page, pageCount), pageWidth - 14, pageHeight - 8, { fontSize: 7, color: [150, 150, 150], align: 'right', anchor: 'bottom' })
  }

  const date = new Date().toISOString().split('T')[0]
  doc.save(`${metadata.queryType}_reactions_${date}.pdf`)
  return { font: applied.font, fallback: applied.fallback, shaped: shaper !== null }
}
