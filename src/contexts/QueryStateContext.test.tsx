import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryStateProvider, useQueryState } from './QueryStateContext'

// Mock cascade results cache
vi.mock('../services/cascadeResultsCache', () => ({
  saveCascadeResults: vi.fn().mockResolvedValue(undefined),
  getCascadeResults: vi.fn().mockResolvedValue(null),
  deleteCascadeResults: vi.fn().mockResolvedValue(undefined),
  cleanupOldResults: vi.fn().mockResolvedValue(undefined),
}))

describe('QueryStateContext', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  function renderQueryStateHook() {
    return renderHook(() => useQueryState(), {
      wrapper: ({ children }) => (
        <QueryStateProvider>{children}</QueryStateProvider>
      ),
    })
  }

  describe('QueryStateProvider', () => {
    it('initializes with empty query states', () => {
      const { result } = renderQueryStateHook()

      expect(result.current.queryStates.fusion).toBeUndefined()
      expect(result.current.queryStates.fission).toBeUndefined()
      expect(result.current.queryStates.twotwo).toBeUndefined()
      expect(result.current.queryStates.cascade).toBeUndefined()
    })

    it('has version 1 in state', () => {
      const { result } = renderQueryStateHook()
      expect(result.current.queryStates.version).toBe(1)
    })
  })

  describe('updateFusionState', () => {
    it('sets fusion state with filter', () => {
      const { result } = renderQueryStateHook()

      act(() => {
        result.current.updateFusionState({
          filter: { element1List: ['H'], element2List: ['Li'] },
        })
      })

      const fusion = result.current.getFusionState()
      expect(fusion).toBeDefined()
      expect(fusion!.filter.element1List).toEqual(['H'])
      expect(fusion!.filter.element2List).toEqual(['Li'])
    })

    it('merges partial updates', () => {
      const { result } = renderQueryStateHook()

      act(() => {
        result.current.updateFusionState({
          filter: { element1List: ['H'] },
        })
      })

      act(() => {
        result.current.updateFusionState({
          filter: { element2List: ['Ni'] },
        })
      })

      const fusion = result.current.getFusionState()
      expect(fusion!.filter.element1List).toEqual(['H'])
      expect(fusion!.filter.element2List).toEqual(['Ni'])
    })

    it('sets lastUpdated timestamp', () => {
      const { result } = renderQueryStateHook()
      const before = Date.now()

      act(() => {
        result.current.updateFusionState({
          filter: { element1List: ['H'] },
        })
      })

      const fusion = result.current.getFusionState()
      expect(fusion!.lastUpdated).toBeGreaterThanOrEqual(before)
    })
  })

  describe('updateFissionState', () => {
    it('sets fission state', () => {
      const { result } = renderQueryStateHook()

      act(() => {
        result.current.updateFissionState({
          filter: { elements: ['Pb'] },
        })
      })

      const fission = result.current.getFissionState()
      expect(fission!.filter.elements).toEqual(['Pb'])
    })
  })

  describe('updateTwoToTwoState', () => {
    it('sets two-to-two state', () => {
      const { result } = renderQueryStateHook()

      act(() => {
        result.current.updateTwoToTwoState({
          filter: { element1List: ['D'], element2List: ['Ni'] },
        })
      })

      const twotwo = result.current.getTwoToTwoState()
      expect(twotwo!.filter.element1List).toEqual(['D'])
      expect(twotwo!.filter.element2List).toEqual(['Ni'])
    })
  })

  describe('clearAllStates', () => {
    it('clears all query states', () => {
      const { result } = renderQueryStateHook()

      act(() => {
        result.current.updateFusionState({
          filter: { element1List: ['H'] },
        })
        result.current.updateFissionState({
          filter: { elements: ['Pb'] },
        })
      })

      act(() => {
        result.current.clearAllStates()
      })

      expect(result.current.getFusionState()).toBeUndefined()
      expect(result.current.getFissionState()).toBeUndefined()
      expect(result.current.getTwoToTwoState()).toBeUndefined()
      expect(result.current.getCascadeState()).toBeUndefined()
    })
  })

  describe('clearPageState', () => {
    it('clears only the specified page state', () => {
      const { result } = renderQueryStateHook()

      act(() => {
        result.current.updateFusionState({
          filter: { element1List: ['H'] },
        })
        result.current.updateFissionState({
          filter: { elements: ['Pb'] },
        })
      })

      act(() => {
        result.current.clearPageState('fusion')
      })

      expect(result.current.getFusionState()).toBeUndefined()
      expect(result.current.getFissionState()).toBeDefined()
    })
  })

  describe('useQueryState', () => {
    it('throws when used outside QueryStateProvider', () => {
      expect(() => {
        renderHook(() => useQueryState())
      }).toThrow('useQueryState must be used within a QueryStateProvider')
    })
  })
})
