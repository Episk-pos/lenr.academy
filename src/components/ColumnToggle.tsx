import { useState, useRef, useEffect } from 'react'
import { Columns, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TableColumn } from './SortableTable'

interface ColumnToggleProps<T> {
  allColumns: TableColumn<T>[]
  isColumnVisible: (key: string) => boolean
  toggleColumn: (key: string) => void
  resetColumns: () => void
  hasCustomization: boolean
}

export default function ColumnToggle<T>({
  allColumns,
  isColumnVisible,
  toggleColumn,
  resetColumns,
  hasCustomization,
}: ColumnToggleProps<T>) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
          hasCustomization
            ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        title={t('columnToggle.title')}
      >
        <Columns className="w-3.5 h-3.5" />
        {t('columnToggle.columns')}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('columnToggle.showHide')}
            </span>
            {hasCustomization && (
              <button
                onClick={resetColumns}
                className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
                title={t('columnToggle.resetToDefault')}
              >
                <RotateCcw className="w-3 h-3" />
                {t('columnToggle.reset')}
              </button>
            )}
          </div>
          {allColumns.map(col => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isColumnVisible(col.key)}
                onChange={() => toggleColumn(col.key)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
