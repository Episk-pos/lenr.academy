import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { jsPDF } from 'jspdf'
import {
  PT_TO_MM,
  SHAPING_FONTS,
  clearShapingFontCache,
  createCanvasShaper,
  needsCanvasShaping,
  shapingFontsFor,
} from './pdfShaping'

const SHAPING_FONT = SHAPING_FONTS.devanagari
const FONT_DIR = resolve(__dirname, '../../public/fonts/pdf')
const LOCALE_DIR = resolve(__dirname, '../i18n/locales')

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
    ['ফিউশন বিক্রিয়া', true],
    ['পৃষ্ঠা 1 / 2', true],
    ['ปฏิกิริยาฟิวชัน', true],
    ['หน้า 1 / 2', true],
    ['واکنش‌های همجوشی', false], // Persian stays on jsPDF's Arabic shaper
    ['فیوژن ردعمل', false], // Urdu too
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

describe('shapingFontsFor', () => {
  const files = (...texts: (string | null)[]) => shapingFontsFor(texts).map((f) => f.file)

  it('returns nothing for text that needs no canvas', () => {
    expect(files('H + Li → *', 'واکنش‌های همجوشی', null, '')).toEqual([])
  })

  it('picks the font for each script present, in a stable order', () => {
    expect(files('संलयन')).toEqual(['NotoSansDevanagari-Shaping.ttf'])
    expect(files('ফিউশন')).toEqual(['NotoSansBengali-Shaping.ttf'])
    expect(files('ฟิวชัน')).toEqual(['NotoSansThai-Shaping.ttf'])
    expect(files('ฟิวชัน', 'ফিউশন', 'संलयन')).toEqual([
      'NotoSansDevanagari-Shaping.ttf',
      'NotoSansBengali-Shaping.ttf',
      'NotoSansThai-Shaping.ttf',
    ])
  })

  it('does not load Devanagari for the dandas in Bengali text', () => {
    expect(files('ফিউশন বিক্রিয়া।', 'পৃষ্ঠা ॥')).toEqual(['NotoSansBengali-Shaping.ttf'])
    expect(files('।')).toEqual(['NotoSansDevanagari-Shaping.ttf'])
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
    await expect(createCanvasShaper([SHAPING_FONT], fetchMock)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null without fetching when no shaping font is needed', async () => {
    stubFontFace()
    stubCanvas()
    const fetchMock = okFetch()
    await expect(createCanvasShaper([], fetchMock)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when there is no 2D canvas context', async () => {
    stubFontFace()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(createCanvasShaper([SHAPING_FONT], okFetch())).resolves.toBeNull()
  })

  it('returns null (and does not throw) when the font fails to load', async () => {
    stubFontFace(() => Promise.reject(new Error('OTS parsing error')))
    stubCanvas()
    await expect(createCanvasShaper([SHAPING_FONT], okFetch())).resolves.toBeNull()
    await expect(createCanvasShaper([SHAPING_FONT], vi.fn().mockResolvedValue({ ok: false, status: 404 }))).resolves.toBeNull()
  })

  it('loads the shaping font as a FontFace from /fonts/pdf/', async () => {
    stubFontFace()
    stubCanvas()
    const fetchMock = okFetch()
    expect(await createCanvasShaper([SHAPING_FONT], fetchMock)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(`/fonts/pdf/${SHAPING_FONT.file}`)
    expect(document.fonts.add).toHaveBeenCalledTimes(1)
  })

  it('loads every requested font and lists them all in the canvas font', async () => {
    stubFontFace()
    const { ctx } = stubCanvas()
    const fetchMock = okFetch()
    const shaper = (await createCanvasShaper([SHAPING_FONTS.bengali, SHAPING_FONTS.thai], fetchMock))!
    expect(fetchMock).toHaveBeenCalledWith('/fonts/pdf/NotoSansBengali-Shaping.ttf')
    expect(fetchMock).toHaveBeenCalledWith('/fonts/pdf/NotoSansThai-Shaping.ttf')
    expect(document.fonts.add).toHaveBeenCalledTimes(2)
    shaper.measure('ফিউশন ฟิวชัน', 9)
    expect(ctx.font).toBe('36px "LenrPdfBengaliShaping", "LenrPdfThaiShaping", sans-serif')
  })

  it('breaks Thai runs without spaces at word boundaries when wrapping', async () => {
    stubFontFace()
    stubCanvas()
    const shaper = (await createCanvasShaper([SHAPING_FONTS.thai], okFetch()))!
    const text = 'ปฏิกิริยาฟิวชันนิวเคลียร์' // "nuclear fusion reaction", no spaces
    const lines = shaper.wrap(text, 9, shaper.measure('ปฏิกิริยาฟิวชัน', 9))
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe(text)
    // Space-separated words still rejoin with a single space
    expect(shaper.wrap('กข คง', 9, 1000)).toEqual(['กข คง'])
  })

  it('measures, wraps and renders in mm at 3x resolution, caching identical images', async () => {
    stubFontFace()
    const { ctx, toDataURL } = stubCanvas()
    const shaper = (await createCanvasShaper([SHAPING_FONT], okFetch()))!

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

describe.each([
  ['devanagari', 'hi'],
  ['bengali', 'bn'],
  ['thai', 'th'],
] as const)('shipped %s shaping font', (script, locale) => {
  const font = SHAPING_FONTS[script]
  const bytes = readFileSync(resolve(FONT_DIR, font.file))

  it('keeps the OpenType layout tables the browser needs for shaping', () => {
    const tags = sfntTables(bytes)
    for (const tag of ['GSUB', 'GPOS', 'GDEF', 'cmap', 'glyf']) expect(tags, tag).toContain(tag)
  })

  function cmap(): Record<number, number> {
    const doc = new jsPDF()
    doc.addFileToVFS(font.file, bytes.toString('base64'))
    doc.addFont(font.file, 'shaping', 'normal')
    doc.setFont('shaping', 'normal')
    return (doc.getFont() as unknown as { metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } })
      .metadata.cmap.unicode.codeMap
  }

  it(`covers every shaped character used in the ${locale} locale`, () => {
    const path = resolve(LOCALE_DIR, `${locale}.json`)
    expect(existsSync(path), path).toBe(true)
    const own = shapingFontsFor([readFileSync(path, 'utf-8')])
    expect(own).toEqual([font])
    const map = cmap()
    const chars = new Set(readFileSync(path, 'utf-8'))
    const missing = [...chars].filter((ch) => needsCanvasShaping(ch) && !map[ch.codePointAt(0)!])
    expect(missing.join('')).toBe('')
  })
})

describe('shipped shaping fonts cover sample text', () => {
  it.each([
    ['bengali', 'ফিউশন বিক্রিয়া ক্ষ জ্ঞ ১২৩ । ॥'],
    ['thai', 'ปฏิกิริยาฟิวชัน นี้ ที่ ป่า ฝั่ง ผู้ น้ำ ญู ฐุ ๑๒๓'],
  ] as const)('%s: %s', (script, sample) => {
    const bytes = readFileSync(resolve(FONT_DIR, SHAPING_FONTS[script].file))
    const doc = new jsPDF()
    doc.addFileToVFS('s.ttf', bytes.toString('base64'))
    doc.addFont('s.ttf', 's', 'normal')
    doc.setFont('s', 'normal')
    const map = (doc.getFont() as unknown as { metadata: { cmap: { unicode: { codeMap: Record<number, number> } } } })
      .metadata.cmap.unicode.codeMap
    expect([...sample].filter((ch) => ch.trim() && !map[ch.codePointAt(0)!]).join('')).toBe('')
  })
})
