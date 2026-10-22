import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { jsPDF } from 'jspdf'
import {
  PT_TO_MM,
  SHAPING_FONT,
  clearShapingFontCache,
  createCanvasShaper,
  needsCanvasShaping,
} from './pdfShaping'

const FONT_PATH = resolve(__dirname, '../../public/fonts/pdf', SHAPING_FONT.file)
const HI_LOCALE = resolve(__dirname, '../i18n/locales/hi.json')

/** Table tags from an sfnt (TrueType/OpenType) table directory. */
function sfntTables(bytes: Buffer): string[] {
  const numTables = bytes.readUInt16BE(4)
  const tags: string[] = []
  for (let i = 0; i < numTables; i++) {
    tags.push(bytes.toString('latin1', 12 + i * 16, 12 + i * 16 + 4))
  }
  return tags
}

describe('needsCanvasShaping', () => {
  it.each([
    ['संलयन अभिक्रियाएँ', true],
    ['पृष्ठ 1 / 2', true],
    ['H + Li → *', false],
    ['Fusionsreaktionen', false],
    ['تفاعلات الاندماج', false], // Arabic stays on jsPDF's shaper
    ['核融合', false],
    ['', false],
    [null, false],
  ])('%s -> %s', (text, expected) => {
    expect(needsCanvasShaping(text)).toBe(expected)
  })
})

describe('createCanvasShaper', () => {
  const okFetch = () => vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) })

  function stubFontFace(load = () => Promise.resolve()) {
    vi.stubGlobal('FontFace', class { load = load })
    Object.defineProperty(document, 'fonts', { value: { add: vi.fn() }, configurable: true })
  }

  function stubCanvas() {
    const ctx = {
      font: '',
      fillStyle: '',
      textBaseline: '',
      measureText: vi.fn((s: string) => ({ width: s.length * 10 })),
      fillText: vi.fn(),
      clearRect: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA==')
    return { ctx, toDataURL }
  }

  beforeEach(() => {
    clearShapingFontCache()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (document as { fonts?: unknown }).fonts
  })

  it('returns null without FontFace support (jsdom)', async () => {
    const fetchMock = okFetch()
    await expect(createCanvasShaper(fetchMock)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when there is no 2D canvas context', async () => {
    stubFontFace()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(createCanvasShaper(okFetch())).resolves.toBeNull()
  })

  it('returns null (and does not throw) when the font fails to load', async () => {
    stubFontFace(() => Promise.reject(new Error('OTS parsing error')))
    stubCanvas()
    await expect(createCanvasShaper(okFetch())).resolves.toBeNull()
    await expect(createCanvasShaper(vi.fn().mockResolvedValue({ ok: false, status: 404 }))).resolves.toBeNull()
  })

  it('loads the shaping font as a FontFace from /fonts/pdf/', async () => {
    stubFontFace()
    stubCanvas()
    const fetchMock = okFetch()
    expect(await createCanvasShaper(fetchMock)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(`/fonts/pdf/${SHAPING_FONT.file}`)
    expect(document.fonts.add).toHaveBeenCalledTimes(1)
  })

  it('measures, wraps and renders in mm at 3x resolution, caching identical images', async () => {
    stubFontFace()
    const { ctx, toDataURL } = stubCanvas()
    const shaper = (await createCanvasShaper(okFetch()))!

    // 10 px per character at 4 px/pt
    expect(shaper.measure('कखग', 9)).toBeCloseTo((30 / 4) * PT_TO_MM)
    expect(ctx.font).toContain(`"${SHAPING_FONT.family}"`)
    expect(ctx.font).toMatch(/^36px /) // 9pt * 4 px/pt

    const oneWord = shaper.measure('कखग', 9)
    expect(shaper.wrap('कखग कखग कखग', 9, oneWord * 2.5)).toEqual(['कखग कखग', 'कखग'])
    expect(shaper.wrap('कखगकखगकखग', 9, 1)).toEqual(['कखगकखगकखग'])

    const img = shaper.render('कखग', 9, 'rgb(0, 0, 0)')
    expect(ctx.fillText).toHaveBeenCalledWith('कखग', expect.any(Number), expect.any(Number))
    expect(img.textWidth).toBeCloseTo(oneWord)
    expect(img.width).toBeGreaterThan(img.textWidth)
    expect(img.ascent).toBeGreaterThan(0)
    expect(img.height).toBeGreaterThan(img.ascent)
    expect(shaper.render('कखग', 9, 'rgb(0, 0, 0)')).toBe(img)
    expect(toDataURL).toHaveBeenCalledTimes(1)
    expect(shaper.render('कखग', 9, 'rgb(255, 255, 255)').key).not.toBe(img.key)
  })
})

describe('shipped shaping font', () => {
  const bytes = readFileSync(FONT_PATH)

  it('keeps the OpenType layout tables the browser needs for shaping', () => {
    const tags = sfntTables(bytes)
    for (const tag of ['GSUB', 'GPOS', 'GDEF', 'cmap', 'glyf']) expect(tags, tag).toContain(tag)
  })

  it('covers every Devanagari character used in the Hindi locale', () => {
    const doc = new jsPDF()
    doc.addFileToVFS(SHAPING_FONT.file, bytes.toString('base64'))
    doc.addFont(SHAPING_FONT.file, 'shaping', 'normal')
    doc.setFont('shaping', 'normal')
    const cmap = (doc.getFont() as unknown as { metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } })
      .metadata.cmap.unicode.codeMap
    const chars = new Set(readFileSync(HI_LOCALE, 'utf-8'))
    const missing = [...chars].filter((ch) => needsCanvasShaping(ch) && !cmap[ch.codePointAt(0)!])
    expect(missing.join('')).toBe('')
  })
})
