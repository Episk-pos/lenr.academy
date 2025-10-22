import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export interface LimitSelectorProps {
  value: number | null | undefined
  onChange: (value: number | undefined) => void
}

const limitOptions = [
  { value: 100, label: '100' },
  { value: 500, label: '500' },
  { value: 1000, label: '1000' },
  { value: 5000, label: '5000' },
  { value: null, label: 'All' },
  { value: -1, label: 'Custom' }
]

export default function LimitSelector({ value, onChange }: LimitSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowCustomInput(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOptionSelect = (optionValue: number | null) => {
    if (optionValue === -1) {
      setShowCustomInput(true)
      setIsOpen(false)
      return
    }
    
    onChange(optionValue === null ? undefined : optionValue)
    setIsOpen(false)
    setShowCustomInput(false)
  }

  const handleCustomSubmit = () => {
    const numValue = parseInt(customValue)
    if (!isNaN(numValue) && numValue >= 0) {
      onChange(numValue === 0 ? undefined : numValue)
      setShowCustomInput(false)
      setCustomValue('')
    }
  }

  const handleCustomCancel = () => {
    setShowCustomInput(false)
    setCustomValue('')
  }

  const getDisplayValue = () => {
    if (value === null || value === undefined) return 'All'
    const option = limitOptions.find(opt => opt.value === value)
    return option ? option.label : value.toString()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Result Limit
      </label>
      
      {showCustomInput ? (
        <div className="flex gap-2">
          <input
            type="number"
            className="input flex-1"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Enter custom limit"
            min={0}
            max={10000}
            autoFocus
          />
          <button
            onClick={handleCustomSubmit}
            className="px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm"
          >
            OK
          </button>
          <button
            onClick={handleCustomCancel}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="input flex items-center justify-between w-full text-left"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="limit-selector-button"
          >
            <span>{getDisplayValue()}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isOpen && (
            <div className="absolute left-0 right-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-[120px] overflow-visible">
              {limitOptions.map((option) => (
                <button
                  key={option.value ?? 'null'}
                  type="button"
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    value === option.value ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : ''
                  }`}
                  onClick={() => handleOptionSelect(option.value)}
                  data-testid={`limit-option-${option.label.toLowerCase()}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum 5000 rows</p>
    </div>
  )
}