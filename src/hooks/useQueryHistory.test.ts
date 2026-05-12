import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQueryHistory } from './useQueryHistory'

// Mock crypto.randomUUID with incrementing values
let uuidCounter = 0
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: vi.fn(() => `test-uuid-${++uuidCounter}`),
})

describe('useQueryHistory', () => {
  beforeEach(() => {
    localStorage.clear()
    uuidCounter = 0
    vi.clearAllMocks()
  })

  it('initializes with empty history', () => {
    const { result } = renderHook(() => useQueryHistory())
    expect(result.current.history).toEqual([])
  })

  it('loads existing history from localStorage', () => {
    const existingHistory = [
      {
        id: 'existing-1',
        name: 'Fusion H',
        queryType: 'fusion',
        filter: { element1List: ['H'] },
        timestamp: Date.now(),
        isBookmarked: false,
      },
    ]
    localStorage.setItem('lenr-query-history', JSON.stringify(existingHistory))

    const { result } = renderHook(() => useQueryHistory())
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].id).toBe('existing-1')
  })

  describe('addToHistory', () => {
    it('adds a new query to history', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'], element2List: ['Li'] }, 10)
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0].queryType).toBe('fusion')
      expect(result.current.history[0].resultCount).toBe(10)
    })

    it('generates name with query type and elements', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'], element2List: ['Li'] })
      })

      expect(result.current.history[0].name).toBe('Fusion H + Li')
    })

    it('generates name for two-to-two queries as 2→2', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('twotwo', { element1List: ['D'], element2List: ['Ni'] })
      })

      expect(result.current.history[0].name).toBe('2→2 D + Ni')
    })

    it('generates name with "All elements" when no elements specified', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', {})
      })

      expect(result.current.history[0].name).toBe('Fusion All elements')
    })

    it('moves duplicate query to top of history', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] }, 5)
      })
      act(() => {
        result.current.addToHistory('fission', { elements: ['Pb'] }, 3)
      })

      expect(result.current.history[0].queryType).toBe('fission')

      // Re-add first query — should move to top
      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] }, 10)
      })

      expect(result.current.history[0].queryType).toBe('fusion')
      expect(result.current.history[0].resultCount).toBe(10)
      expect(result.current.history).toHaveLength(2)
    })

    it('persists to localStorage', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] })
      })

      const stored = JSON.parse(localStorage.getItem('lenr-query-history')!)
      expect(stored).toHaveLength(1)
      expect(stored[0].queryType).toBe('fusion')
    })

    it('trims to max size of 50 while keeping bookmarks', () => {
      const { result } = renderHook(() => useQueryHistory())

      // Add 51 queries
      for (let i = 0; i < 51; i++) {
        act(() => {
          result.current.addToHistory('fusion', { element1List: [`E${i}`] })
        })
      }

      expect(result.current.history.length).toBeLessThanOrEqual(50)
    })
  })

  describe('toggleBookmark', () => {
    it('bookmarks a query', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] })
      })

      const id = result.current.history[0].id

      act(() => {
        result.current.toggleBookmark(id)
      })

      expect(result.current.history[0].isBookmarked).toBe(true)
    })

    it('unbookmarks a previously bookmarked query', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] })
      })

      const id = result.current.history[0].id

      act(() => {
        result.current.toggleBookmark(id)
      })
      act(() => {
        result.current.toggleBookmark(id)
      })

      expect(result.current.history[0].isBookmarked).toBe(false)
    })
  })

  describe('removeFromHistory', () => {
    it('removes a query by id', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] })
      })
      act(() => {
        result.current.addToHistory('fission', { elements: ['Pb'] })
      })

      const id = result.current.history[1].id

      act(() => {
        result.current.removeFromHistory(id)
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0].queryType).toBe('fission')
    })
  })

  describe('clearHistory', () => {
    it('clears all non-bookmarked queries by default', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] })
      })
      act(() => {
        result.current.addToHistory('fission', { elements: ['Pb'] })
      })

      // Bookmark the first one
      act(() => {
        result.current.toggleBookmark(result.current.history[0].id)
      })

      act(() => {
        result.current.clearHistory()
      })

      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0].isBookmarked).toBe(true)
    })

    it('clears everything including bookmarks when preserveBookmarks is false', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] })
      })

      act(() => {
        result.current.toggleBookmark(result.current.history[0].id)
      })

      act(() => {
        result.current.clearHistory(false)
      })

      expect(result.current.history).toHaveLength(0)
    })
  })

  describe('getHistoryForType', () => {
    it('filters history by query type', () => {
      const { result } = renderHook(() => useQueryHistory())

      act(() => {
        result.current.addToHistory('fusion', { element1List: ['H'] })
      })
      act(() => {
        result.current.addToHistory('fission', { elements: ['Pb'] })
      })
      act(() => {
        result.current.addToHistory('fusion', { element1List: ['Li'] })
      })

      const fusionHistory = result.current.getHistoryForType('fusion')
      expect(fusionHistory).toHaveLength(2)
      expect(fusionHistory.every(q => q.queryType === 'fusion')).toBe(true)
    })

    it('returns empty array for type with no history', () => {
      const { result } = renderHook(() => useQueryHistory())
      expect(result.current.getHistoryForType('twotwo')).toEqual([])
    })
  })
})
