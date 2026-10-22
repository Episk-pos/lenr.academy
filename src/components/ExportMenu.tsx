import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Download } from 'lucide-react'

export interface ExportMenuItem {
  /** Stable key; also used for the item's data-testid (`export-option-<key>`) */
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
}

interface ExportMenuProps {
  items: ExportMenuItem[]
  disabled?: boolean
  /** Optional override for the trigger label (defaults to "Export") */
  label?: string
}

/**
 * Single "Export ▾" dropdown that replaces separate CSV/JSON/PDF buttons.
 *
 * Accessibility: menu-button pattern (aria-haspopup/aria-expanded), items use
 * role="menuitem", ArrowUp/ArrowDown/Home/End move focus, Escape closes and
 * returns focus to the trigger, Tab closes. Clicking outside closes the menu.
 */
export default function ExportMenu({ items, disabled = false, label }: ExportMenuProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingFocusIndex = useRef<number | null>(null)
  const menuId = useId()

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  const openAndFocus = (index: number) => {
    pendingFocusIndex.current = index
    setIsOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  // Move focus into the menu after it opens via keyboard
  useEffect(() => {
    if (isOpen && pendingFocusIndex.current !== null) {
      itemRefs.current[pendingFocusIndex.current]?.focus()
      pendingFocusIndex.current = null
    }
  }, [isOpen])

  // Close if the trigger becomes disabled while open
  useEffect(() => {
    if (disabled) setIsOpen(false)
  }, [disabled])

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openAndFocus(0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAndFocus(items.length - 1)
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      close(true)
    }
  }

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = itemRefs.current.findIndex((el) => el === document.activeElement)
    const last = items.length - 1
    let nextIndex: number | null = null
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = currentIndex < 0 || currentIndex >= last ? 0 : currentIndex + 1
        break
      case 'ArrowUp':
        nextIndex = currentIndex <= 0 ? last : currentIndex - 1
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = last
        break
      case 'Escape':
        event.preventDefault()
        close(true)
        return
      case 'Tab':
        setIsOpen(false)
        return
      default:
        return
    }
    event.preventDefault()
    itemRefs.current[nextIndex]?.focus()
  }

  const handleSelect = (item: ExportMenuItem) => {
    close(true)
    item.onSelect()
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-secondary px-4 py-2 text-sm inline-flex items-center"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        data-testid="export-menu-button"
      >
        <Download className="w-4 h-4 mr-2" aria-hidden="true" />
        {label ?? t('reactions.export')}
        <ChevronDown
          className={`w-4 h-4 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={label ?? t('reactions.export')}
          className="absolute right-0 z-20 mt-1 min-w-[11rem] py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg"
          onKeyDown={handleMenuKeyDown}
          data-testid="export-menu"
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => { itemRefs.current[index] = el }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="w-full flex items-center px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              onClick={() => handleSelect(item)}
              data-testid={`export-option-${item.key}`}
            >
              {item.icon && <span className="mr-2 inline-flex" aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
