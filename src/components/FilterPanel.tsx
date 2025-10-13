import { useState, useEffect, useRef } from 'react'
import { X, Filter, ChevronDown, ChevronUp, Search, Download, Save, Trash2 } from 'lucide-react'
import PeriodicTableSelector from './PeriodicTableSelector'
import BadgeSelector from './BadgeSelector'
import type { Element } from '../types'

export interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'range' | 'toggle' | 'multi-select' | 'element-selector' | 'badge-selector'
  options?: { value: string | number; label: string }[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
  availableElements?: Element[]  // For element-selector type
  colorScheme?: 'purple' | 'blue' | 'amber' | 'green'  // For badge-selector type
  tooltipInfo?: Record<string, { name: string; description: string; url?: string }>  // For badge-selector type
}

export interface FilterPreset {
  id: string
  label: string
  filters: Record<string, any>
  isCustom?: boolean  // Flag to identify user-created presets
}

interface FilterPanelProps {
  // Collapse state
  collapsed: boolean
  onToggleCollapsed: () => void

  // Search
  searchTerm: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string

  // Export
  onExport: () => void
  exportDisabled: boolean
  dataCount?: number
  totalCount?: number

  // Filters
  filters: Record<string, any>
  filterConfigs: FilterConfig[]
  presets?: FilterPreset[]
  onFilterChange: (key: string, value: any) => void
  onApplyPreset?: (filters: Record<string, any>) => void  // Optional: for atomic preset application
  onClearAll: () => void

  // Custom preset management
  onSavePreset?: (name: string, filters: Record<string, any>) => void
  onDeletePreset?: (presetId: string) => void

  className?: string
}

export default function FilterPanel({
  collapsed,
  onToggleCollapsed,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onExport,
  exportDisabled,
  dataCount,
  totalCount,
  filters,
  filterConfigs,
  presets = [],
  onFilterChange,
  onApplyPreset,
  onClearAll,
  onSavePreset,
  onDeletePreset,
  className = ''
}: FilterPanelProps) {
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeFilterCount = Object.values(filters).filter(val => {
    if (Array.isArray(val)) return val.length > 0
    if (typeof val === 'boolean') return val
    return val != null && val !== ''
  }).length

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPresetDropdownOpen(false)
      }
    }

    if (isPresetDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPresetDropdownOpen])

  // Check if current filters match a preset exactly
  const filtersMatchPreset = (presetFilters: Record<string, any>): boolean => {
    const currentKeys = Object.keys(filters)
    const presetKeys = Object.keys(presetFilters)

    // Must have same number of keys
    if (currentKeys.length !== presetKeys.length) return false

    // All keys and values must match
    return presetKeys.every(key => {
      const currentVal = filters[key]
      const presetVal = presetFilters[key]

      // Handle array comparison
      if (Array.isArray(currentVal) && Array.isArray(presetVal)) {
        return currentVal.length === presetVal.length &&
               currentVal.every((v, i) => v === presetVal[i])
      }

      // Handle object comparison (for range filters)
      if (typeof currentVal === 'object' && currentVal !== null &&
          typeof presetVal === 'object' && presetVal !== null) {
        return JSON.stringify(currentVal) === JSON.stringify(presetVal)
      }

      // Simple value comparison
      return currentVal === presetVal
    })
  }

  // Determine active preset or "Custom"
  const activePresetId = presets.find(preset => filtersMatchPreset(preset.filters))?.id || null

  // Generate active filter summary for collapsed state
  const getActiveFilterSummary = (): string => {
    if (activeFilterCount === 0) return 'No filters active'

    const summaryParts: string[] = []
    filterConfigs.forEach(config => {
      const value = filters[config.key]
      if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
        // Format based on filter type
        if (config.type === 'range' && (value.min != null || value.max != null)) {
          const min = value.min != null ? value.min : '?'
          const max = value.max != null ? value.max : '?'
          summaryParts.push(`${config.label}: ${min}-${max}`)
        } else if (Array.isArray(value)) {
          summaryParts.push(`${config.label}: ${value.length} selected`)
        } else if (typeof value === 'boolean') {
          summaryParts.push(config.label)
        } else {
          // For select options, try to find the label
          const option = config.options?.find(opt => opt.value === value)
          summaryParts.push(`${config.label}: ${option?.label || value}`)
        }
      }
    })

    const summary = summaryParts.join(', ')
    return summary.length > 60 ? summary.substring(0, 57) + '...' : summary
  }

  const handlePresetSelect = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId)
    if (preset) {
      // If onApplyPreset is provided, use it for atomic update
      if (onApplyPreset) {
        onApplyPreset(preset.filters)
      } else {
        // Fallback to the old method (clear + individual updates)
        onClearAll()
        Object.entries(preset.filters).forEach(([key, value]) => {
          onFilterChange(key, value)
        })
      }
    }
  }

  const handleSavePreset = () => {
    const trimmedName = presetName.trim()

    // Validation
    if (!trimmedName) {
      setSaveError('Please enter a preset name')
      return
    }

    if (trimmedName.length < 3) {
      setSaveError('Preset name must be at least 3 characters')
      return
    }

    if (trimmedName.length > 50) {
      setSaveError('Preset name must be less than 50 characters')
      return
    }

    // Check for duplicate names
    const duplicate = presets.find(p => p.label.toLowerCase() === trimmedName.toLowerCase())
    if (duplicate) {
      setSaveError('A preset with this name already exists')
      return
    }

    // Save the preset
    if (onSavePreset) {
      onSavePreset(trimmedName, filters)
    }

    // Reset modal
    setShowSaveModal(false)
    setPresetName('')
    setSaveError('')
  }

  const handleDeletePreset = (presetId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent dropdown from closing

    if (window.confirm('Are you sure you want to delete this preset?')) {
      if (onDeletePreset) {
        onDeletePreset(presetId)
      }
    }
  }

  const renderFilter = (config: FilterConfig) => {
    const value = filters[config.key]

    switch (config.type) {
      case 'select':
        return (
          <div key={config.key} className="flex flex-col gap-1">
            <label htmlFor={config.key} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {config.label}
            </label>
            <select
              id={config.key}
              value={value || ''}
              onChange={(e) => onFilterChange(config.key, e.target.value || null)}
              className="input text-sm"
            >
              <option value="">{config.placeholder || 'All'}</option>
              {config.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'multi-select':
        return (
          <div key={config.key} className="flex flex-col gap-1">
            <label htmlFor={config.key} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {config.label}
            </label>
            <select
              id={config.key}
              multiple
              value={Array.isArray(value) ? value : []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value)
                onFilterChange(config.key, selected)
              }}
              className="input text-sm min-h-[80px]"
            >
              {config.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Hold Ctrl/Cmd to select multiple
            </span>
          </div>
        )

      case 'range':
        return (
          <div key={config.key} className="flex flex-col gap-1">
            <label htmlFor={`${config.key}-min`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {config.label}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                id={`${config.key}-min`}
                type="number"
                placeholder="Min"
                value={value?.min ?? ''}
                onChange={(e) =>
                  onFilterChange(config.key, {
                    ...value,
                    min: e.target.value ? parseFloat(e.target.value) : undefined
                  })
                }
                min={config.min}
                max={config.max}
                step={config.step}
                className="input text-sm"
              />
              <input
                id={`${config.key}-max`}
                type="number"
                placeholder="Max"
                value={value?.max ?? ''}
                onChange={(e) =>
                  onFilterChange(config.key, {
                    ...value,
                    max: e.target.value ? parseFloat(e.target.value) : undefined
                  })
                }
                min={config.min}
                max={config.max}
                step={config.step}
                className="input text-sm"
              />
            </div>
          </div>
        )

      case 'toggle':
        return (
          <div key={config.key} className="flex items-center gap-2">
            <input
              id={config.key}
              type="checkbox"
              checked={value || false}
              onChange={(e) => onFilterChange(config.key, e.target.checked)}
              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor={config.key} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {config.label}
            </label>
          </div>
        )

      case 'element-selector':
        return (
          <div key={config.key} className="col-span-full">
            <PeriodicTableSelector
              label={config.label}
              availableElements={config.availableElements || []}
              selectedElements={Array.isArray(value) ? value : []}
              onSelectionChange={(selected) => onFilterChange(config.key, selected)}
            />
          </div>
        )

      case 'badge-selector':
        return (
          <div key={config.key} className="col-span-full">
            <BadgeSelector
              label={config.label}
              options={config.options?.map(opt => ({
                value: String(opt.value),
                label: String(opt.label)
              })) || []}
              selectedValues={Array.isArray(value) ? value : []}
              onSelectionChange={(selected) => onFilterChange(config.key, selected)}
              colorScheme={config.colorScheme}
              tooltipInfo={config.tooltipInfo}
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={`card p-4 ${className}`}>
      {/* Header with collapse button */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Filter className="w-5 h-5 shrink-0 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {activeFilterCount}
              </span>
            )}
          </h3>
          {collapsed && (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
              • {getActiveFilterSummary()}
            </span>
          )}
        </div>

        <button
          onClick={onToggleCollapsed}
          className="btn btn-secondary px-2 py-2 shrink-0"
          aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
          title={collapsed ? 'Expand filters' : 'Collapse filters'}
        >
          {collapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Search and Export (always visible) */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input pl-10 pr-10 w-full"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={onExport}
          className="btn btn-secondary px-4 py-2 text-sm flex items-center gap-2 justify-center whitespace-nowrap shrink-0"
          disabled={exportDisabled}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Data count */}
      {dataCount != null && totalCount != null && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Showing {dataCount.toLocaleString()} of {totalCount.toLocaleString()} records
        </div>
      )}

      {/* Collapsible filter section */}
      <div
        className={`transition-all duration-200 ease-in-out ${
          collapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'
        }`}
      >
        {/* Preset controls */}
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          {presets.length > 0 && (
            <div className="relative min-w-[200px]" ref={dropdownRef}>
              {/* Custom dropdown button */}
              <button
                onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                className="w-full px-3 py-2 text-sm text-left flex items-center justify-between gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600 transition-colors"
              >
                <span className="truncate text-gray-900 dark:text-gray-100">
                  {activePresetId
                    ? presets.find(p => p.id === activePresetId)?.label
                    : activeFilterCount > 0
                    ? '✓ Custom'
                    : 'Load Preset...'}
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${isPresetDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Custom dropdown menu */}
              {isPresetDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-full w-max max-w-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {/* Built-in presets */}
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0">
                    Built-in Presets
                  </div>
                  {presets.filter(p => !p.isCustom).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        handlePresetSelect(preset.id)
                        setIsPresetDropdownOpen(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        activePresetId === preset.id
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}

                  {/* Custom presets */}
                  {presets.some(p => p.isCustom) && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-t border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0">
                        My Presets
                      </div>
                      {presets.filter(p => p.isCustom).map((preset) => (
                        <div
                          key={preset.id}
                          className={`flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                            activePresetId === preset.id
                              ? 'bg-primary-50 dark:bg-primary-900/20'
                              : ''
                          }`}
                        >
                          <button
                            onClick={() => {
                              handlePresetSelect(preset.id)
                              setIsPresetDropdownOpen(false)
                            }}
                            className={`flex-1 text-left text-sm px-3 py-2 ${
                              activePresetId === preset.id
                                ? 'text-primary-700 dark:text-primary-300'
                                : 'text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {preset.label}
                          </button>
                          {onDeletePreset && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeletePreset(preset.id, e)
                                setIsPresetDropdownOpen(false)
                              }}
                              className="p-1.5 mr-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors shrink-0"
                              title="Delete this preset"
                              aria-label="Delete preset"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {onSavePreset && activeFilterCount > 0 && !activePresetId && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="btn btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Save current filters as a preset"
            >
              <Save className="w-4 h-4" />
              Save Preset...
            </button>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={onClearAll}
              className="btn btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <X className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        {/* Filter grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filterConfigs.map(renderFilter)}
        </div>
      </div>

      {/* Save Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Modal backdrop */}
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70"
            onClick={() => {
              setShowSaveModal(false)
              setPresetName('')
              setSaveError('')
            }}
          />

          {/* Modal content */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Save Filter Preset
            </h3>

            <div className="mb-4">
              <label htmlFor="preset-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preset Name
              </label>
              <input
                id="preset-name"
                type="text"
                value={presetName}
                onChange={(e) => {
                  setPresetName(e.target.value)
                  setSaveError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSavePreset()
                  } else if (e.key === 'Escape') {
                    setShowSaveModal(false)
                    setPresetName('')
                    setSaveError('')
                  }
                }}
                className="input w-full"
                placeholder="e.g., My Custom Filter"
                autoFocus
              />
              {saveError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {saveError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveModal(false)
                  setPresetName('')
                  setSaveError('')
                }}
                className="btn btn-secondary px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                className="btn btn-primary px-4 py-2"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
