import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react'
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
 * role="menuitem". Enter/Space/ArrowDown on the trigger open the menu and focus
 * the first item (ArrowUp focuses the last); ArrowUp/ArrowDown/Home/End move
 * focus; Escape closes and returns focus to the trigger. Clicking outside or
 * moving focus out of the component closes the menu.
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
    if (isOpen) {
      // Already open: the [isOpen] effect will not re-run, so focus directly
      itemRefs.current[index]?.focus()
      return
    }
    pendingFocusIndex.current = index
    setIsOpen(true)
  }

  // Close when focus leaves the whole component (e.g. tabbing away)
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (!next || !containerRef.current?.contains(next)) {
      setIsOpen(false)
    }
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
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      // Enter/Space/ArrowDown open the menu and focus the first item
      // (WAI-ARIA menu button pattern). preventDefault suppresses the native
      // click so the menu is not toggled closed again.
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
    <div className="relative inline-block" ref={containerRef} onBlur={handleBlur}>
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
        <Download className="w-4 h-4 me-2" aria-hidden="true" />
        {label ?? t('reactions.export')}
        <ChevronDown
          className={`w-4 h-4 ms-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={label ?? t('reactions.export')}
          className="absolute end-0 z-20 mt-1 min-w-[11rem] py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg"
          onKeyDown={handleMenuKeyDown}
          // Keep focus where it is on pointer interaction so browsers that do
          // not focus buttons on click (Safari) don't trigger a focus-out close
          onMouseDown={(event) => event.preventDefault()}
          data-testid="export-menu"
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => { itemRefs.current[index] = el }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="w-full flex items-center px-4 py-2 text-sm text-start text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              onClick={() => handleSelect(item)}
              data-testid={`export-option-${item.key}`}
            >
              {item.icon && <span className="me-2 inline-flex" aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
