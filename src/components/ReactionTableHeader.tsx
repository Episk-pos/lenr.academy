import type { ReactNode } from 'react'

export interface ReactionHeaderColumn {
  key: string
  label: ReactNode
  /** Extra classes (e.g. background tint) for this column's header cell(s) */
  className?: string
  /**
   * Sub-columns. When present the column renders a group label in the top row
   * spanning its sub-columns, with the sub-column labels in the second row.
   * When absent the column is a single cell spanning both header rows.
   */
  children?: Array<{ key: string; label: ReactNode }>
  /** Compact single cell (tighter padding, smaller type) for narrow columns */
  compact?: boolean
  /** Render label without the uppercase transform (e.g. units like "MeV") */
  normalCase?: boolean
}

interface ReactionTableHeaderProps {
  columns: ReactionHeaderColumn[]
  gridTemplateColumns: string
}

/**
 * Two-row results table header used by the Fusion/Fission/Two-to-Two query
 * pages. Grouped columns show a group label above their sub-columns; single
 * columns span both rows so no label is repeated.
 */
export default function ReactionTableHeader({ columns, gridTemplateColumns }: ReactionTableHeaderProps) {
  let col = 1
  const cells: ReactNode[] = []

  for (const column of columns) {
    const extra = column.className ?? ''
    if (column.children && column.children.length > 0) {
      const span = column.children.length
      cells.push(
        <div
          key={column.key}
          className={`px-3 py-2 flex items-center justify-center text-center text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 ${extra}`}
          style={{ gridColumn: `${col} / span ${span}`, gridRow: 1 }}
        >
          {column.label}
        </div>
      )
      column.children.forEach((child, i) => {
        cells.push(
          <div
            key={`${column.key}-${child.key}`}
            className={`px-3 py-2 flex items-center justify-center text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400 ${extra}`}
            style={{ gridColumn: col + i, gridRow: 2 }}
          >
            {child.label}
          </div>
        )
      })
      col += span
    } else {
      const padding = column.compact ? 'px-1 sm:px-2 text-xs' : 'px-1 sm:px-3 text-sm'
      const casing = column.normalCase ? 'normal-case' : 'uppercase tracking-wide'
      cells.push(
        <div
          key={column.key}
          className={`${padding} py-2 flex items-center justify-center text-center font-semibold ${casing} text-gray-600 dark:text-gray-300 ${extra}`}
          style={{ gridColumn: col, gridRow: '1 / span 2' }}
        >
          {column.label}
        </div>
      )
      col += 1
    }
  }

  return (
    <div
      className="grid border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
      style={{ gridTemplateColumns }}
      data-testid="reaction-table-header"
    >
      {cells}
    </div>
  )
}
