import { useState, useMemo, ReactNode, useRef, useEffect } from 'react'
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
  searchTerm?: string  // Optional: for backward compatibility, search is now handled by FilterPanel
  searchMetadata?: SearchMetadata  // Optional: metadata for enhanced searching (element names, daughter nuclides)
  className?: string
  emptyMessage?: string
  renderExpandedContent?: (row: T) => ReactNode  // Optional: render function for expandable row content
  getRowKey?: (row: T, index: number) => string | number  // Optional: custom key function for rows
  expandedRows?: Set<string | number>  // Optional: controlled expanded state
  onExpandedRowsChange?: (expandedRows: Set<string | number>) => void  // Optional: callback for expanded state changes
  title?: ReactNode  // Optional: table title to display above the table
  description?: ReactNode  // Optional: table description to display below title
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
  description
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [internalExpandedRows, setInternalExpandedRows] = useState<Set<string | number>>(new Set())
  const sizeResetRef = useRef<VirtualizedSizeReset | null>(null)

  // Use controlled state if provided, otherwise use internal state
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

    // Apply search filter if searchTerm provided (using utility function)
    if (searchTerm) {
      result = filterDataBySearch(result, columns, searchTerm, searchMetadata)
    }

    // Apply sorting (if search prioritization isn't active or as secondary sort)
    if (sortKey && !searchTerm) {
      result.sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1

        // Numeric comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        // String comparison
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        const comparison = aStr.localeCompare(bStr)
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [data, sortKey, sortDirection, searchTerm, searchMetadata, columns])

  const estimatedRowHeight = useMemo(
    () => (renderExpandedContent ? 160 : 72),
    [renderExpandedContent]
  )

  const listHeight = useMemo(() => {
    const rowCount = sortedAndFilteredData.length
    if (rowCount === 0) {
      return 200
    }
    const base = rowCount * estimatedRowHeight
    const min = Math.min(440, estimatedRowHeight * Math.min(rowCount, 6))
    const max = 640
    return Math.min(max, Math.max(min, base))
  }, [estimatedRowHeight, sortedAndFilteredData.length])

  const gridTemplateColumns = useMemo(() => {
    return `repeat(${columns.length}, minmax(0, 1fr))`
  }, [columns.length])

  const tableMinWidth = useMemo(() => Math.max(640, columns.length * 160), [columns.length])

  useEffect(() => {
    sizeResetRef.current?.()
  }, [sortedAndFilteredData.length, columns.length])

  useEffect(() => {
    sizeResetRef.current?.()
  }, [expandedRows])

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
              style={{ gridTemplateColumns: gridTemplateColumns }}
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
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {emptyMessage}
            </div>
          ) : (
            <VirtualizedList
              items={sortedAndFilteredData}
              estimatedRowHeight={estimatedRowHeight}
              height={listHeight}
              overscanRowCount={4}
              onRegisterSizeReset={(reset) => {
                sizeResetRef.current = reset
              }}
            >
              {(row, { index }) => {
                const rowKey = getRowKey ? getRowKey(row, index) : index
                const isExpanded = expandedRows.has(rowKey)

                const handleRowClick = () => {
                  if (renderExpandedContent) {
                    toggleRowExpansion(rowKey, index)
                  } else {
                    onRowClick?.(row)
                  }
                }

                return (
                  <div role="rowgroup">
                    <div
                      className={`grid items-center border-b border-gray-200 dark:border-gray-700 text-sm transition-colors duration-150 ${
                        renderExpandedContent || onRowClick ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer' : ''
                      }`}
                      style={{ gridTemplateColumns: gridTemplateColumns }}
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
                    {renderExpandedContent && isExpanded && (
                      <div className="bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                          {renderExpandedContent(row)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }}
            </VirtualizedList>
          )}
        </div>
      </div>
    </div>
  )
}
