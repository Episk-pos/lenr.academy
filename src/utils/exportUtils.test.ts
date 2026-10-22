import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { exportToJSON, exportToPDF } from './exportUtils'
import { clearPdfFontCache } from './pdfFonts'
import i18n from '../i18n/config'

// Under Vitest, jspdf resolves to its Node build, whose save() writes to disk.
// Capture saves instead.
const savedFiles = vi.hoisted(() => [] as string[])
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>()
  class TestJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args)
      this.save = ((filename: string) => {
        savedFiles.push(filename)
        return this
      }) as unknown as typeof this.save
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
      clearPdfFontCache()
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      document.body.innerHTML = ''
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
      expect(result).toEqual({ font: 'NotoSansPdf', fallback: false })
      expect(savedFiles).toEqual([expect.stringMatching(/^fusion_reactions_\d{4}-\d{2}-\d{2}\.pdf$/)])
      expect(document.body.querySelector('[role="status"]')).toBeNull()
    })

    it('falls back to Helvetica with a non-blocking notice when the font fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      const result = await exportToPDF(reactions, metadata)

      expect(result).toEqual({ font: 'helvetica', fallback: true })
      expect(savedFiles).toHaveLength(1)
      const notice = document.body.querySelector('[role="status"]')
      expect(notice).not.toBeNull()
      expect(notice!.textContent).toBe(i18n.t('reactions.pdfFontFallback'))
      expect(notice!.textContent).not.toBe('reactions.pdfFontFallback')
    })
  })
})
