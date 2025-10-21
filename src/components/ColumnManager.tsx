import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react'
import { TableColumn } from './SortableTable'

interface ColumnManagerProps<T> {
  columns: TableColumn<T>[]
  onColumnsChange: (columns: TableColumn<T>[]) => void
  onClose: () => void
  title?: string
  storageKey?: string
}

export default function ColumnManager<T>({
  columns,
  onColumnsChange,
  onClose,
  title = 'Customize Columns',
  storageKey
}: ColumnManagerProps<T>) {
  const [localColumns, setLocalColumns] = useState<TableColumn<T>[]>(columns)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Load saved preferences on mount
  useEffect(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`lenr-columns-${storageKey}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          // Merge saved preferences with current columns
          const merged = columns.map(col => {
            const savedCol = parsed.find((c: any) => c.key === col.key)
            return savedCol ? { ...col, ...savedCol } : col
          })
          setLocalColumns(merged)
        }
      } catch (error) {
        console.warn('Failed to load column preferences:', error)
      }
    }
  }, [columns, storageKey])

  const savePreferences = (cols: TableColumn<T>[]) => {
    if (storageKey) {
      try {
        localStorage.setItem(`lenr-columns-${storageKey}`, JSON.stringify(cols))
      } catch (error) {
        console.warn('Failed to save column preferences:', error)
      }
    }
  }

  const toggleVisibility = (index: number) => {
    const updated = [...localColumns]
    updated[index] = {
      ...updated[index],
      visible: !updated[index].visible
    }
    setLocalColumns(updated)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const updated = [...localColumns]
    const draggedItem = updated[draggedIndex]
    updated.splice(draggedIndex, 1)
    updated.splice(index, 0, draggedItem)
    
    // Update order property
    const reordered = updated.map((col, idx) => ({
      ...col,
      order: idx
    }))
    
    setLocalColumns(reordered)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const resetToDefaults = () => {
    const defaults = columns.map(col => ({
      ...col,
      visible: col.defaultVisible ?? true,
      order: col.order ?? columns.indexOf(col)
    }))
    setLocalColumns(defaults)
    
    if (storageKey) {
      localStorage.removeItem(`lenr-columns-${storageKey}`)
    }
  }

  const applyChanges = () => {
    onColumnsChange(localColumns)
    savePreferences(localColumns)
    onClose()
  }

  const visibleCount = localColumns.filter(col => col.visible !== false).length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{visibleCount} of {localColumns.length} columns visible</span>
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to defaults
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-96">
          <div className="p-4 space-y-2">
            {localColumns.map((column, index) => (
              <div
                key={column.key}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                  draggedIndex === index
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600/50'
                }`}
              >
                <GripVertical className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-grab flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {column.label}
                  </div>
                  {column.category && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {column.category}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => toggleVisibility(index)}
                  className={`p-1 rounded transition-colors ${
                    column.visible !== false
                      ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                  title={column.visible !== false ? 'Hide column' : 'Show column'}
                >
                  {column.visible !== false ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={applyChanges}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  )
}