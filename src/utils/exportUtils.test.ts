import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { exportToJSON, exportToPDF } from './exportUtils'
import { clearPdfFontCache } from './pdfFonts'
import { clearShapingFontCache } from './pdfShaping'
import i18n from '../i18n/config'

// Under Vitest, jspdf resolves to its Node build, whose save() writes to disk.
// Capture saves instead, and record every text/image call (autotable draws
// cells through doc.text, so this sees table content too).
const savedFiles = vi.hoisted(() => [] as string[])
const pdfCalls = vi.hoisted(() => ({
  text: [] as { text: string; invisible: boolean }[],
  images: [] as { alias: string | undefined }[],
}))
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>()
  class TestJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args)
      this.save = ((filename: string) => {
        savedFiles.push(filename)
        return this
      }) as unknown as typeof this.save
      type Passthrough = (...args: unknown[]) => unknown
      const text = this.text.bind(this) as unknown as Passthrough
      this.text = ((value: string | string[], ...rest: unknown[]) => {
        const options = rest.find((r) => r && typeof r === 'object' && !Array.isArray(r)) as
          | { renderingMode?: string }
          | undefined
        for (const line of [value].flat()) {
          pdfCalls.text.push({ text: line, invisible: options?.renderingMode === 'invisible' })
        }
        return text(value, ...rest)
      }) as unknown as typeof this.text
      const addImage = this.addImage.bind(this) as unknown as Passthrough
      this.addImage = ((...args: unknown[]) => {
        pdfCalls.images.push({ alias: args[6] as string | undefined })
        return addImage(...args)
      }) as unknown as typeof this.addImage
    }
  }
  return { ...actual, jsPDF: TestJsPDF, default: TestJsPDF }
})

describe('exportUtils', () => {
  let clickSpy: ReturnType<typeof vi.fn>
  const originalCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    vi.clearAllMocks()
    clickSpy = vi.fn()

    // Mock createElement — use the saved original for non-'a' tags to avoid recursion
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickSpy, style: {} } as any
      }
      return originalCreateElement(tag) as any
    })

    // Mock URL APIs
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('exportToJSON', () => {
    it('does nothing when reactions array is empty', () => {
      exportToJSON([], {
        queryType: 'fusion',
        filter: {},
        executionTime: 10,
        rowCount: 0,
        totalCount: 0,
      })

      expect(clickSpy).not.toHaveBeenCalled()
    })

    it('creates a downloadable JSON file', () => {
      const reactions = [
        { E1: 'H', Z1: 1, A1: 1, E2: 'Li', Z2: 3, A2: 7, E: 'Be', Z: 4, A: 8, MeV: 17.25 },
      ]

      exportToJSON(reactions, {
        queryType: 'fusion',
        filter: { element1List: ['H'], element2List: ['Li'] },
        executionTime: 42,
        rowCount: 1,
        totalCount: 1,
      })

      expect(clickSpy).toHaveBeenCalled()
      expect(URL.createObjectURL).toHaveBeenCalled()
    })

    it('creates valid JSON output with correct structure', () => {
      let capturedBlob: Blob | null = null

      vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
        capturedBlob = blob as Blob
        return 'blob:mock-url'
      })

      const reactions = [
        { MeV: 10 },
        { MeV: 20 },
        { MeV: 30 },
      ]

      exportToJSON(reactions, {
        queryType: 'fusion',
        filter: { element1List: ['H'] },
        executionTime: 100,
        rowCount: 3,
        totalCount: 10,
      })

      expect(capturedBlob).toBeInstanceOf(Blob)
      expect(capturedBlob!.type).toBe('application/json')
      expect(capturedBlob!.size).toBeGreaterThan(0)
    })

    it('creates a Blob with JSON content type for non-empty reactions', () => {
      let capturedBlob: Blob | null = null

      vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
        capturedBlob = blob as Blob
        return 'blob:mock-url'
      })

      const reactions = [{ MeV: 5, E1: 'H', E2: 'Li' }]

      exportToJSON(reactions, {
        queryType: 'fission',
        filter: {},
        executionTime: 10,
        rowCount: 1,
        totalCount: 1,
      })

      expect(capturedBlob).toBeInstanceOf(Blob)
      expect(capturedBlob!.type).toBe('application/json')
      // Verify Blob has non-zero size (contains serialized data)
      expect(capturedBlob!.size).toBeGreaterThan(0)
      // Verify the download was triggered
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('exportToPDF', () => {
    const reactions = [
      { E1: 'D', Z1: 1, A1: 2, E2: 'Ni', Z2: 28, A2: 58, E: 'Cu', Z: 29, A: 60, MeV: 6.1234, neutrino: 'none' },
    ]
    const metadata = { queryType: 'fusion' as const, filter: { element1List: ['D'] }, executionTime: 5, rowCount: 1, totalCount: 1 }
    const fontBytes = readFileSync(resolve(__dirname, '../../public/fonts/pdf/NotoSans-Regular.ttf'))

    beforeEach(() => {
      savedFiles.length = 0
      pdfCalls.text.length = 0
      pdfCalls.images.length = 0
      clearPdfFontCache()
      clearShapingFontCache()
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(async () => {
      vi.unstubAllGlobals()
      document.body.innerHTML = ''
      await i18n.changeLanguage('en')
    })

    it('does nothing when reactions array is empty', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await expect(exportToPDF([], metadata)).resolves.toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('lazy-loads the Unicode font for non-Latin-1 text (the → in the title)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await exportToPDF(reactions, metadata)

      expect(fetchMock).toHaveBeenCalledWith('/fonts/pdf/NotoSans-Regular.ttf')
      expect(result).toEqual({ font: 'NotoSansPdf', fallback: false, shaped: false })
      expect(savedFiles).toEqual([expect.stringMatching(/^fusion_reactions_\d{4}-\d{2}-\d{2}\.pdf$/)])
      expect(document.body.querySelector('[role="status"]')).toBeNull()
    })

    it('falls back to Helvetica with a non-blocking notice when the font fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      const result = await exportToPDF(reactions, metadata)

      expect(result).toEqual({ font: 'helvetica', fallback: true, shaped: false })
      expect(savedFiles).toHaveLength(1)
      const notice = document.body.querySelector('[role="status"]')
      expect(notice).not.toBeNull()
      expect(notice!.textContent).toBe(i18n.t('reactions.pdfFontFallback'))
      expect(notice!.textContent).not.toBe('reactions.pdfFontFallback')
    })

    describe('localisation and Devanagari shaping', () => {
      const FONT_DIR = resolve(__dirname, '../../public/fonts/pdf')
      // Serve the real font files by name
      const fontFetch = () =>
        vi.fn(async (url: string) => {
          const bytes = readFileSync(`${FONT_DIR}/${url.split('/').pop()}`)
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          }
        })
      const DEVANAGARI = /[ऀ-ॿ]/
      const meta = {
        queryType: 'fusion' as const,
        filter: { element1List: ['D'], element2List: ['Ni'], minMeV: 1, neutrinoType: 'none' as const },
        executionTime: 5,
        rowCount: 1,
        totalCount: 5,
      }
      const visibleText = () => pdfCalls.text.filter((c) => !c.invisible).map((c) => c.text)
      // 1x1 transparent PNG
      const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

      /** Fake FontFace + 2D canvas so the canvas shaping path can run under jsdom. */
      function mockCanvas(opts: { toDataURL?: () => string; fontLoad?: () => Promise<unknown> } = {}) {
        const fillText = vi.fn()
        class FakeFontFace {
          constructor(public family: string, public source: unknown) {}
          load() {
            return opts.fontLoad ? opts.fontLoad() : Promise.resolve(this)
          }
        }
        vi.stubGlobal('FontFace', FakeFontFace)
        Object.defineProperty(document, 'fonts', { value: { add: vi.fn() }, configurable: true })
        const ctx = {
          font: '',
          fillStyle: '',
          textBaseline: '',
          measureText: (s: string) => ({ width: s.length * 6 }),
          fillText,
          clearRect: vi.fn(),
        }
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(opts.toDataURL ?? (() => PNG))
        return { fillText }
      }

      afterEach(() => {
        delete (document as { fonts?: unknown }).fonts
      })

      it.each(['de', 'hi', 'ar'])('takes every PDF string from t() in %s', async (lang) => {
        await i18n.changeLanguage(lang)
        vi.stubGlobal('fetch', fontFetch())

        await exportToPDF(reactions, meta)

        const text = visibleText().join('\n')
        const expected = [
          i18n.t('export.pdf.title', { type: i18n.t('reactions.fusionTitle'), equation: 'D + Ni → *' }),
          i18n.t('export.pdf.reactionCount', { count: 5, shown: 1 }),
          i18n.t('export.pdf.filterValue', { label: i18n.t('export.pdf.inputElementN', { n: 1 }), value: 'D' }),
          i18n.t('export.pdf.filterValue', { label: i18n.t('export.pdf.minEnergy'), value: '1 MeV' }),
          i18n.t('reactions.noNeutrino'),
          i18n.t('reactions.input1'),
          i18n.t('reactions.output'),
          i18n.t('export.pdf.columnElement'),
          `${i18n.t('reactions.energy')} (MeV)`,
          i18n.t('reactions.neutrino'),
          i18n.t('reactions.none'), // translated neutrino cell value
          i18n.t('export.pdf.footer', { brand: 'LENR Academy', url: 'https://lenr.academy' }),
          i18n.t('export.pdf.pageNumber', { page: 1, total: 1 }),
        ]
        for (const s of expected) {
          // Long lines may be wrapped: compare word by word
          for (const word of s.split(/\s+/)) expect(text, `${lang}: ${s}`).toContain(word)
        }
        // Generated date line is localised
        expect(text).toContain(i18n.t('export.pdf.generated', { date: '' }).trim())
        for (const english of ['Fusion Reactions', 'Query parameters', 'Page 1 of 1', 'Based on work by', 'Input element']) {
          expect(text).not.toContain(english)
        }
        // jsdom has no FontFace: Devanagari falls back to unshaped text
        if (lang === 'hi') expect(text).toMatch(DEVANAGARI)
      })

      it('uses CLDR plural forms for the reaction count', async () => {
        await i18n.changeLanguage('ru')
        expect(i18n.t('export.pdf.reactionCount', { count: 1, shown: 1 })).toBe('1 из 1 реакции')
        expect(i18n.t('export.pdf.reactionCount', { count: 5, shown: 2 })).toBe('2 из 5 реакций')
        await i18n.changeLanguage('ar')
        expect(i18n.t('export.pdf.reactionCount', { count: 2, shown: 1 })).toContain('تفاعلين')
        expect(i18n.t('export.pdf.reactionCount', { count: 3, shown: 1 })).toContain('تفاعلات')
      })

      it('routes Devanagari runs and cells to the canvas and leaves Latin as text', async () => {
        await i18n.changeLanguage('hi')
        vi.stubGlobal('fetch', fontFetch())
        const { fillText } = mockCanvas()

        const result = await exportToPDF(reactions, meta)

        expect(result).toEqual({ font: 'NotoSansDevanagariPdf', fallback: false, shaped: true })
        const visible = visibleText()
        expect(visible.filter((s) => DEVANAGARI.test(s))).toEqual([])
        // Latin-only runs and cells stay as vector text
        for (const s of ['LENR Academy', 'Z', 'A', 'D', 'Ni', 'Cu', '6.1234']) expect(visible).toContain(s)

        const rasterised = fillText.mock.calls.map(([s]) => s as string)
        expect(rasterised).toContain(i18n.t('reactions.none')) // body cell
        expect(rasterised).toContain(i18n.t('export.pdf.columnElement')) // header cell
        expect(rasterised).toContain(i18n.t('export.pdf.pageNumber', { page: 1, total: 1 }))
        expect(rasterised.some((s) => s.startsWith(i18n.t('reactions.fusionTitle')))).toBe(true) // mixed run, whole
        expect(rasterised.every((s) => DEVANAGARI.test(s))).toBe(true)
        expect(pdfCalls.images.length).toBeGreaterThan(0)
        expect(pdfCalls.images.every((c) => c.alias?.startsWith('shaped:'))).toBe(true)

        // Invisible text layer keeps the PDF searchable
        const invisible = pdfCalls.text.filter((c) => c.invisible).map((c) => c.text)
        expect(invisible).toContain(i18n.t('reactions.none'))
        expect(savedFiles).toHaveLength(1)
      })

      it('falls back to unshaped text when the shaping font fails to load', async () => {
        await i18n.changeLanguage('hi')
        vi.stubGlobal('fetch', fontFetch())
        mockCanvas({ fontLoad: () => Promise.reject(new Error('bad font')) })

        const result = await exportToPDF(reactions, meta)

        expect(result).toMatchObject({ fallback: false, shaped: false })
        expect(pdfCalls.images).toEqual([])
        expect(visibleText()).toContain(i18n.t('reactions.none'))
        expect(savedFiles).toHaveLength(1)
      })

      it('falls back to unshaped text when rasterising throws', async () => {
        await i18n.changeLanguage('hi')
        vi.stubGlobal('fetch', fontFetch())
        mockCanvas({ toDataURL: () => { throw new DOMException('tainted', 'SecurityError') } })

        await expect(exportToPDF(reactions, meta)).resolves.toMatchObject({ shaped: true })

        expect(pdfCalls.images).toEqual([])
        const visible = visibleText()
        expect(visible).toContain(i18n.t('reactions.none'))
        expect(visible.some((s) => s.startsWith(i18n.t('reactions.fusionTitle')))).toBe(true)
        expect(savedFiles).toHaveLength(1)
      })
    })
  })
})
