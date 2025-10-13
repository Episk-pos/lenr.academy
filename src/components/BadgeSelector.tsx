import { useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import Tooltip from './Tooltip'

export interface BadgeOption {
  value: string
  label: string
  description?: string
}

interface BadgeSelectorProps {
  label: string
  options: BadgeOption[]
  selectedValues: string[]
  onSelectionChange: (selected: string[]) => void
  colorScheme?: 'purple' | 'blue' | 'amber' | 'green'
  tooltipInfo?: Record<string, { name: string; description: string; url?: string }>
  collapsible?: boolean
  defaultCollapsed?: boolean
}

const colorSchemes = {
  purple: {
    unselected: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30',
    selected: 'bg-purple-600 dark:bg-purple-600 border-purple-600 dark:border-purple-600 text-white hover:bg-purple-700 dark:hover:bg-purple-700',
  },
  blue: {
    unselected: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30',
    selected: 'bg-blue-600 dark:bg-blue-600 border-blue-600 dark:border-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700',
  },
  amber: {
    unselected: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30',
    selected: 'bg-amber-600 dark:bg-amber-600 border-amber-600 dark:border-amber-600 text-white hover:bg-amber-700 dark:hover:bg-amber-700',
  },
  green: {
    unselected: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30',
    selected: 'bg-green-600 dark:bg-green-600 border-green-600 dark:border-green-600 text-white hover:bg-green-700 dark:hover:bg-green-700',
  },
}

export default function BadgeSelector({
  label,
  options,
  selectedValues,
  onSelectionChange,
  colorScheme = 'blue',
  tooltipInfo,
  collapsible = false,
  defaultCollapsed = false
}: BadgeSelectorProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const colors = colorSchemes[colorScheme]
  const allSelected = options.length > 0 && selectedValues.length === options.length
  const noneSelected = selectedValues.length === 0

  const handleToggle = (value: string) => {
    const isSelected = selectedValues.includes(value)
    if (isSelected) {
      onSelectionChange(selectedValues.filter(v => v !== value))
    } else {
      onSelectionChange([...selectedValues, value])
    }
  }

  const handleSelectAll = () => {
    onSelectionChange(options.map(opt => opt.value))
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  const getTooltipContent = (option: BadgeOption): string => {
    if (!tooltipInfo || !tooltipInfo[option.value]) {
      return option.description || option.label
    }

    const info = tooltipInfo[option.value]
    return `${info.name}: ${info.description}`
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          {label}
          {selectedValues.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
              {selectedValues.length}
            </span>
          )}
        </label>
        <div className="flex items-center gap-2">
          {!noneSelected && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              type="button"
            >
              Clear
            </button>
          )}
          {!allSelected && (
            <button
              onClick={handleSelectAll}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              type="button"
            >
              Select All
            </button>
          )}
          {collapsible && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={collapsed ? 'Expand' : 'Collapse'}
              type="button"
            >
              {collapsed ? (
                <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {(!collapsible || !collapsed) && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value)
            const badgeContent = (
              <button
                key={option.value}
                onClick={() => handleToggle(option.value)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  flex items-center gap-1.5
                  ${isSelected ? colors.selected : colors.unselected}
                  hover:scale-105 active:scale-95
                `}
                type="button"
                aria-pressed={isSelected}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span>{option.label}</span>
              </button>
            )

            // Wrap in tooltip if we have description or tooltip info
            if (tooltipInfo?.[option.value] || option.description) {
              return (
                <Tooltip key={option.value} content={getTooltipContent(option)}>
                  {badgeContent}
                </Tooltip>
              )
            }

            return badgeContent
          })}
        </div>
      )}

      {collapsible && collapsed && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {noneSelected ? 'All types shown' : `${selectedValues.length} type${selectedValues.length !== 1 ? 's' : ''} selected`}
        </div>
      )}
    </div>
  )
}
