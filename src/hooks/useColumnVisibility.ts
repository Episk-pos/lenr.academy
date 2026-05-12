import { useState, useCallback, useMemo } from 'react'
import type { TableColumn } from '../components/SortableTable'

const STORAGE_PREFIX = 'lenr-columns-'

/**
 * Hook for managing column visibility with localStorage persistence.
 *
 * @param columns - Full list of available columns
 * @param storageKey - Unique key for localStorage persistence
 * @returns Column visibility state and control functions
 */
export function useColumnVisibility<T>(
  columns: TableColumn<T>[],
  storageKey: string
) {
  const allKeys = useMemo(() => columns.map(c => c.key), [columns])

  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          // Filter out stale keys that no longer match any column definition
          const validKeys = new Set(columns.map(c => c.key))
          const filtered = parsed.filter((k: string) => validKeys.has(k))
          return new Set(filtered)
        }
      }
    } catch {
      // Ignore invalid stored data
    }
    return new Set()
  })

  const persist = useCallback(
    (hidden: Set<string>) => {
      try {
        localStorage.setItem(
          STORAGE_PREFIX + storageKey,
          JSON.stringify(Array.from(hidden))
        )
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey]
  )

  const toggleColumn = useCallback(
    (key: string) => {
      setHiddenKeys(prev => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
        } else {
          // Don't allow hiding all columns
          if (allKeys.length - next.size <= 1) return prev
          next.add(key)
        }
        persist(next)
        return next
      })
    },
    [allKeys.length, persist]
  )

  const resetColumns = useCallback(() => {
    setHiddenKeys(new Set())
    persist(new Set())
  }, [persist])

  const visibleColumns = useMemo(
    () => columns.filter(c => !hiddenKeys.has(c.key)),
    [columns, hiddenKeys]
  )

  const isColumnVisible = useCallback(
    (key: string) => !hiddenKeys.has(key),
    [hiddenKeys]
  )

  const hasCustomization = hiddenKeys.size > 0

  return {
    visibleColumns,
    hiddenKeys,
    toggleColumn,
    resetColumns,
    isColumnVisible,
    hasCustomization,
    allColumns: columns,
  }
}
