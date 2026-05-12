import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useColumnVisibility } from './useColumnVisibility'
import type { TableColumn } from '../components/SortableTable'

// Simple test columns
const testColumns: TableColumn<{ name: string; age: number; email: string }>[] = [
  { key: 'name', label: 'Name', render: (row) => row.name },
  { key: 'age', label: 'Age', render: (row) => String(row.age) },
  { key: 'email', label: 'Email', render: (row) => row.email },
]

describe('useColumnVisibility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with all columns visible', () => {
    const { result } = renderHook(() =>
      useColumnVisibility(testColumns, 'test-table')
    )

    expect(result.current.visibleColumns).toHaveLength(3)
    expect(result.current.hasCustomization).toBe(false)
  })

  it('reports all columns as visible initially', () => {
    const { result } = renderHook(() =>
      useColumnVisibility(testColumns, 'test-table')
    )

    expect(result.current.isColumnVisible('name')).toBe(true)
    expect(result.current.isColumnVisible('age')).toBe(true)
    expect(result.current.isColumnVisible('email')).toBe(true)
  })

  describe('toggleColumn', () => {
    it('hides a column', () => {
      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      act(() => {
        result.current.toggleColumn('age')
      })

      expect(result.current.visibleColumns).toHaveLength(2)
      expect(result.current.isColumnVisible('age')).toBe(false)
      expect(result.current.hasCustomization).toBe(true)
    })

    it('shows a hidden column', () => {
      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      act(() => {
        result.current.toggleColumn('age')
      })
      act(() => {
        result.current.toggleColumn('age')
      })

      expect(result.current.visibleColumns).toHaveLength(3)
      expect(result.current.isColumnVisible('age')).toBe(true)
    })

    it('prevents hiding all columns (keeps at least one)', () => {
      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      // Hide 2 of 3
      act(() => {
        result.current.toggleColumn('age')
      })
      act(() => {
        result.current.toggleColumn('email')
      })

      // Try to hide the last one — should be prevented
      act(() => {
        result.current.toggleColumn('name')
      })

      expect(result.current.visibleColumns).toHaveLength(1)
      expect(result.current.isColumnVisible('name')).toBe(true)
    })

    it('persists hidden columns to localStorage', () => {
      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      act(() => {
        result.current.toggleColumn('email')
      })

      const stored = JSON.parse(localStorage.getItem('lenr-columns-test-table')!)
      expect(stored).toEqual(['email'])
    })
  })

  describe('resetColumns', () => {
    it('shows all columns again', () => {
      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      act(() => {
        result.current.toggleColumn('age')
        result.current.toggleColumn('email')
      })

      act(() => {
        result.current.resetColumns()
      })

      expect(result.current.visibleColumns).toHaveLength(3)
      expect(result.current.hasCustomization).toBe(false)
    })

    it('clears localStorage persistence', () => {
      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      act(() => {
        result.current.toggleColumn('age')
      })

      act(() => {
        result.current.resetColumns()
      })

      const stored = JSON.parse(localStorage.getItem('lenr-columns-test-table')!)
      expect(stored).toEqual([])
    })
  })

  describe('localStorage restoration', () => {
    it('restores hidden columns from localStorage', () => {
      localStorage.setItem('lenr-columns-test-table', JSON.stringify(['age', 'email']))

      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      expect(result.current.visibleColumns).toHaveLength(1)
      expect(result.current.isColumnVisible('name')).toBe(true)
      expect(result.current.isColumnVisible('age')).toBe(false)
    })

    it('ignores stale keys that no longer match columns', () => {
      localStorage.setItem('lenr-columns-test-table', JSON.stringify(['age', 'nonexistent']))

      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      // 'nonexistent' should be filtered out, only 'age' hidden
      expect(result.current.visibleColumns).toHaveLength(2)
      expect(result.current.isColumnVisible('age')).toBe(false)
    })

    it('handles invalid localStorage data gracefully', () => {
      localStorage.setItem('lenr-columns-test-table', 'not-json')

      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      expect(result.current.visibleColumns).toHaveLength(3)
    })

    it('handles non-array localStorage data gracefully', () => {
      localStorage.setItem('lenr-columns-test-table', JSON.stringify({ key: 'value' }))

      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      expect(result.current.visibleColumns).toHaveLength(3)
    })
  })

  describe('allColumns', () => {
    it('returns the full columns list regardless of visibility', () => {
      const { result } = renderHook(() =>
        useColumnVisibility(testColumns, 'test-table')
      )

      act(() => {
        result.current.toggleColumn('age')
      })

      expect(result.current.allColumns).toHaveLength(3)
      expect(result.current.visibleColumns).toHaveLength(2)
    })
  })
})
