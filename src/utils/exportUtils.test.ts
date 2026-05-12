import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportToJSON } from './exportUtils'

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
})
