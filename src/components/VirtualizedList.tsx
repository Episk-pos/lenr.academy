import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { AutoSizer, CellMeasurer, CellMeasurerCache, List, ListRowProps } from 'react-virtualized'

export interface VirtualizedListProps<T> {
  items: T[]
  /**
   * Approximate height of each row. Used as the default when measuring dynamic content.
   */
  estimatedRowHeight?: number
  /**
   * Fixed height for every row. When provided, CellMeasurer is skipped for performance.
   */
  fixedRowHeight?: number
  /**
   * Total height available for the list viewport.
   */
  height: number
  /**
   * Extra rows to render above and below the visible window for smoother scrolling.
   */
  overscanRowCount?: number
  /**
   * Function used to render a row's content.
   */
  children: (item: T, options: { index: number }) => ReactNode
  /**
   * Optional callback that receives the internal recompute function. Useful when rows change height (e.g., expand/collapse).
   */
  onRegisterSizeReset?: (reset: (index?: number) => void) => void
  /**
   * Optional class name passed to the scrollable list container.
   */
  className?: string
}

/**
 * Shared virtualization helper built on top of react-virtualized's List + CellMeasurer.
 *
 * Supports both fixed and dynamic row heights. Consumers supply the viewport height and a render function.
 */
export function VirtualizedList<T>({
  items,
  estimatedRowHeight = 72,
  fixedRowHeight,
  height,
  overscanRowCount = 4,
  children,
  onRegisterSizeReset,
  className,
}: VirtualizedListProps<T>) {
  const listRef = useRef<List>(null)

  const cache = useMemo(() => {
    if (fixedRowHeight != null) {
      return null
    }
    return new CellMeasurerCache({
      defaultHeight: estimatedRowHeight,
      fixedWidth: true,
    })
  }, [estimatedRowHeight, fixedRowHeight])

  useEffect(() => {
    if (cache) {
      cache.clearAll()
      listRef.current?.recomputeRowHeights()
    } else {
      listRef.current?.forceUpdateGrid?.()
    }
  }, [cache, items])

  useEffect(() => {
    if (!cache) return
    if (!onRegisterSizeReset) return

    const reset = (index?: number) => {
      if (index == null) {
        cache.clearAll()
        listRef.current?.recomputeRowHeights()
        return
      }
      cache.clear(index, 0)
      listRef.current?.recomputeRowHeights(index)
    }

    onRegisterSizeReset(reset)
  }, [cache, onRegisterSizeReset])

  const rowRenderer = ({ index, key, parent, style }: ListRowProps) => {
    const item = items[index]
    const content = (
      <div key={key} style={style}>
        {children(item, { index })}
      </div>
    )

    if (cache) {
      return (
        <CellMeasurer
          key={key}
          cache={cache}
          columnIndex={0}
          rowIndex={index}
          parent={parent}
        >
          {content}
        </CellMeasurer>
      )
    }

    return content
  }

  const containerClassName = className ? `virtualized-list ${className}` : 'virtualized-list'

  return (
    <div className={containerClassName} style={{ height }}>
      <AutoSizer disableHeight>
        {({ width }: { width: number }) => (
          <List
            ref={listRef}
            width={width}
            height={height}
            rowCount={items.length}
            rowHeight={cache ? cache.rowHeight : fixedRowHeight ?? estimatedRowHeight}
            deferredMeasurementCache={cache ?? undefined}
            overscanRowCount={overscanRowCount}
            rowRenderer={rowRenderer}
            containerRole="list"
            getRowHeight={undefined}
            tabIndex={-1}
          />
        )}
      </AutoSizer>
    </div>
  )
}

export type VirtualizedSizeReset = (index?: number) => void
