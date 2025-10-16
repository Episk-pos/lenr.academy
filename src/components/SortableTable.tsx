import { useState, useMemo, ReactNode, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight } from 'lucide-react'
import { filterDataBySearch, SearchMetadata } from '../utils/searchUtils'
import { VirtualizedList, VirtualizedSizeReset } from './VirtualizedList'

export interface TableColumn<T> {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, row: T) => ReactNode
  className?: string
}

interface SortableTableProps<T> {
  data: T[]
  columns: TableColumn<T>[]
  onRowClick?: (row: T) => void
  searchTerm?: string
  searchMetadata?: SearchMetadata
  className?: string
  emptyMessage?: string
  renderExpandedContent?: (row: T) => ReactNode
  getRowKey?: (row: T, index: number) => string | number
  expandedRows?: Set<string | number>
  onExpandedRowsChange?: (expandedRows: Set<string | number>) => void
  title?: ReactNode
  description?: ReactNode
  autoFillHeight?: boolean
  autoFillHeightOffset?: number
  minVisibleRows?: number
  virtualizationThreshold?: number
  expandedContentNoPadding?: boolean  // Skip padding/border wrapper for expanded content
}

export default function SortableTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  searchTerm,
  searchMetadata,
  className = '',
  emptyMessage = 'No data available',
  renderExpandedContent,
  getRowKey,
  expandedRows: controlledExpandedRows,
  onExpandedRowsChange,
  title,
  description,
  autoFillHeight = false,
  autoFillHeightOffset = 160,
  minVisibleRows = 0,
  virtualizationThreshold = 0,
  expandedContentNoPadding = false
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [internalExpandedRows, setInternalExpandedRows] = useState<Set<string | number>>(new Set())
  const sizeResetRef = useRef<VirtualizedSizeReset | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [autoHeight, setAutoHeight] = useState<number | null>(null)

  const expandedRows = controlledExpandedRows ?? internalExpandedRows
  const setExpandedRows = onExpandedRowsChange ?? setInternalExpandedRows

  const hasExpandedRows = expandedRows.size > 0

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const toggleRowExpansion = (rowKey: string | number, rowIndex?: number) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(rowKey)) {
      newSet.delete(rowKey)
    } else {
      newSet.add(rowKey)
    }
    setExpandedRows(newSet)
    if (rowIndex != null) {
      sizeResetRef.current?.(rowIndex)
    } else {
      sizeResetRef.current?.()
    }
  }

  const collapseAll = () => {
    setExpandedRows(new Set())
    sizeResetRef.current?.()
  }

  const sortedAndFilteredData = useMemo(() => {
    let result = [...data]

    if (searchTerm) {
      result = filterDataBySearch(result, columns, searchTerm, searchMetadata)
    }

    if (sortKey && !searchTerm) {
      result.sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]

        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        const comparison = aStr.localeCompare(bStr)
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [data, sortKey, sortDirection, searchTerm, searchMetadata, columns])

  const baseRowHeight = 40
  const estimatedRowHeight = useMemo(
    () => (renderExpandedContent ? 160 : baseRowHeight),
    [renderExpandedContent, baseRowHeight]
  )

  const gridTemplateColumns = useMemo(() => {
    return `repeat(${columns.length}, minmax(0, 1fr))`
  }, [columns.length])

  const tableMinWidth = useMemo(() => Math.max(640, columns.length * 160), [columns.length])

  const shouldVirtualize = useMemo(() => {
    if (virtualizationThreshold <= 0) {
      return true
    }
    return sortedAndFilteredData.length >= virtualizationThreshold
  }, [sortedAndFilteredData.length, virtualizationThreshold])

  const updateAutoHeight = useCallback(() => {
    if (!autoFillHeight || !viewportRef.current) {
      return
    }

    const rect = viewportRef.current.getBoundingClientRect()
    const available = window.innerHeight - rect.top - autoFillHeightOffset
    const sanitized = Number.isFinite(available) ? available : 0
    const nextHeight = Math.max(0, Math.floor(sanitized))

    setAutoHeight((prev) => (prev === nextHeight ? prev : nextHeight))
  }, [autoFillHeight, autoFillHeightOffset])

  useLayoutEffect(() => {
    if (!autoFillHeight) {
      return
    }
    updateAutoHeight()
  })

  useEffect(() => {
    if (!autoFillHeight) {
      setAutoHeight(null)
      return
    }

    const handleResize = () => updateAutoHeight()
    const handleTransitionEnd = () => {
      // Catch any CSS transitions (like FilterPanel expand/collapse)
      updateAutoHeight()
    }

    window.addEventListener('resize', handleResize)
    document.addEventListener('transitionend', handleTransitionEnd)

    return () => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('transitionend', handleTransitionEnd)
    }
  }, [autoFillHeight, updateAutoHeight])

  useEffect(() => {
    if (!shouldVirtualize) {
      sizeResetRef.current = null
    }
  }, [shouldVirtualize])

  useEffect(() => {
    sizeResetRef.current?.()
  }, [sortedAndFilteredData.length, columns.length])

  useEffect(() => {
    sizeResetRef.current?.()
  }, [expandedRows])

  const listHeight = useMemo(() => {
    const rowCount = sortedAndFilteredData.length

    const minHeight = (() => {
      if (minVisibleRows > 0) {
        return minVisibleRows * baseRowHeight
      }
      if (rowCount === 0) {
        return 200
      }
      return Math.min(440, estimatedRowHeight * Math.min(rowCount, 6))
    })()

    const naturalHeight = rowCount === 0
      ? minHeight
      : Math.max(minHeight, rowCount * estimatedRowHeight)

    const constrainedHeight = autoHeight != null
      ? Math.max(minHeight, autoHeight)
      : Math.min(640, naturalHeight)

    return Math.max(minHeight, Math.round(constrainedHeight))
  }, [autoHeight, estimatedRowHeight, minVisibleRows, sortedAndFilteredData.length, baseRowHeight])

  const renderRow = (row: T, index: number, includeKey = false) => {
    const rowKey = getRowKey ? getRowKey(row, index) : index
    const isExpanded = expandedRows.has(rowKey)

    const handleRowClick = () => {
      if (renderExpandedContent) {
        toggleRowExpansion(rowKey, index)
      } else {
        onRowClick?.(row)
      }
    }

    const rowCells = (
      <div
        className={`grid items-center border-b border-gray-200 dark:border-gray-700 text-sm transition-colors duration-150 ${
          renderExpandedContent || onRowClick ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer' : ''
        }`}
        style={{ gridTemplateColumns }}
        onClick={handleRowClick}
        role="row"
      >
        {columns.map((col, colIdx) => (
          <div key={col.key} className={`px-3 py-2 ${col.className || ''}`} role="cell">
            <div className="flex items-center gap-2">
              {renderExpandedContent && colIdx === 0 && (
                <ChevronRight
                  className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
              )}
              <span className="flex-1">
                {col.render
                  ? col.render(row[col.key], row)
                  : row[col.key] == null
                  ? <span className="text-gray-400 dark:text-gray-500 italic">-</span>
                  : typeof row[col.key] === 'number'
                  ? row[col.key].toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: row[col.key] % 1 === 0 ? 0 : 3,
                    })
                  : String(row[col.key])}
              </span>
            </div>
          </div>
        ))}
      </div>
    )

    const expandedSection = renderExpandedContent && isExpanded ? (
      expandedContentNoPadding ? (
        <div className="border-b border-gray-200 dark:border-gray-700">
          {renderExpandedContent(row)}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
            {renderExpandedContent(row)}
          </div>
        </div>
      )
    ) : null

    if (includeKey) {
      return (
        <div key={rowKey} role="rowgroup">
          {rowCells}
          {expandedSection}
        </div>
      )
    }

    return (
      <div role="rowgroup">
        {rowCells}
        {expandedSection}
      </div>
    )
  }

  return (
    <div className={className}>
      {(title || description || (renderExpandedContent && hasExpandedRows)) && (
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center justify-between gap-4">
              {title && (
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
              {renderExpandedContent && hasExpandedRows && (
                <button
                  onClick={collapseAll}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors whitespace-nowrap flex-shrink-0"
                >
                  Collapse All
                </button>
              )}
            </div>
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="table-container" role="table">
        <div className="min-w-full" style={{ minWidth: tableMinWidth }}>
          <div className="sticky top-0 z-10" role="rowgroup">
            <div
              className="grid bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300"
              style={{ gridTemplateColumns }}
              role="row"
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  role="columnheader"
                  className={`px-3 py-2 flex items-center gap-2 ${col.sortable !== false ? 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700' : ''} ${col.className || ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span>{col.label}</span>
                  {col.sortable !== false && (
                    <span className="text-gray-400">
                      {sortKey === col.key ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {sortedAndFilteredData.length === 0 ? (
            <div
              ref={viewportRef}
              className="p-6 text-center text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center"
              style={{ minHeight: listHeight }}
            >
              {emptyMessage}
            </div>
          ) : (
            <div ref={viewportRef} style={{ minHeight: listHeight }}>
              {shouldVirtualize ? (
                <VirtualizedList
                  items={sortedAndFilteredData}
                  estimatedRowHeight={estimatedRowHeight}
                  height={listHeight}
                  overscanRowCount={4}
                  onRegisterSizeReset={(reset) => {
                    sizeResetRef.current = reset
                  }}
                >
                  {(row, { index }) => renderRow(row, index)}
                </VirtualizedList>
              ) : (
                <div className="non-virtualized-list">
                  {sortedAndFilteredData.map((row, index) => renderRow(row, index, true))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
