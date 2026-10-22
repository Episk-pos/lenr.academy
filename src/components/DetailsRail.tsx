import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelRight, X } from 'lucide-react'
import type { AtomicRadiiData, Element, Nuclide } from '../types'
import ElementDetailsCard from './ElementDetailsCard'
import NuclideDetailsCard from './NuclideDetailsCard'
import { useMediaQuery } from '../hooks/useMediaQuery'

/** Tailwind `xl` breakpoint: at or above this width the details are a sticky rail. */
export const DETAILS_RAIL_MEDIA_QUERY = '(min-width: 1280px)'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface PinnedDetailsProps {
  /** Details of the pinned nuclide, if a nuclide is pinned */
  nuclide: Nuclide | null
  /** Details of the pinned element (or the pinned nuclide's parent element) */
  element: Element | null
  atomicRadii: AtomicRadiiData | null
  /** Close handler for the cards shown while a nuclide is pinned */
  onCloseNuclide: () => void
  /** Close handler for the element card shown while an element is pinned */
  onCloseElement: () => void
}

/**
 * Details content shared by the three reaction query pages: the pinned
 * nuclide (with its parent element), the pinned element, or an empty-state hint.
 */
export function PinnedDetails({ nuclide, element, atomicRadii, onCloseNuclide, onCloseElement }: PinnedDetailsProps) {
  const { t } = useTranslation()

  if (nuclide) {
    return (
      <>
        {element && (
          <ElementDetailsCard element={element} atomicRadii={atomicRadii} onClose={onCloseNuclide} compact />
        )}
        <NuclideDetailsCard nuclide={nuclide} onClose={onCloseNuclide} compact />
      </>
    )
  }

  if (element) {
    return <ElementDetailsCard element={element} atomicRadii={atomicRadii} onClose={onCloseElement} compact />
  }

  return (
    <div className="card p-6" data-testid="details-empty-state">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('reactions.details')}
      </h3>
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">{t('reactions.clickForDetails')}</p>
      </div>
    </div>
  )
}

export interface DetailsRailProps {
  /**
   * Identity of what is currently pinned (e.g. `nuclide:Fe-56`), or null.
   * A change to a new non-null key auto-opens the drawer on narrow screens;
   * a change to null closes it.
   */
  pinKey: string | null
  /** Details content, normally <PinnedDetails /> */
  children: ReactNode
}

/**
 * Hosts the query-page details panel.
 *
 * - ≥1280px: a sticky right-hand rail that scrolls independently.
 * - <1280px: a slide-in modal drawer from the right, opened automatically on
 *   pin or via a floating "Details" button. Closing the drawer never unpins.
 *
 * The page lays this out as the second child of a `xl:flex` row; in drawer
 * mode the component renders nothing in flow.
 */
export default function DetailsRail({ pinKey, children }: DetailsRailProps) {
  const { t } = useTranslation()
  const isWide = useMediaQuery(DETAILS_RAIL_MEDIA_QUERY)
  const [open, setOpen] = useState(false)
  const headingId = useId()

  const railRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const prevPinKeyRef = useRef<string | null>(null)
  const wasOpenRef = useRef(false)

  const drawerOpen = open && !isWide

  const openDrawer = useCallback(() => {
    const active = document.activeElement
    returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null
    setOpen(true)
  }, [])

  const closeDrawer = useCallback(() => setOpen(false), [])

  // React to pin changes: auto-open the drawer on a new pin, close it on unpin,
  // and bring the rail back to the top so the new card is in view.
  useEffect(() => {
    if (pinKey === prevPinKeyRef.current) return
    prevPinKeyRef.current = pinKey
    if (pinKey === null) {
      setOpen(false)
      return
    }
    if (railRef.current) railRef.current.scrollTop = 0
    if (!isWide) openDrawer()
  }, [pinKey, isWide, openDrawer])

  // Growing into rail mode dismisses the drawer
  useEffect(() => {
    if (isWide) setOpen(false)
  }, [isWide])

  // Focus management: focus the close button on open, restore focus on close
  useEffect(() => {
    if (drawerOpen) {
      wasOpenRef.current = true
      closeButtonRef.current?.focus()
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    const target = returnFocusRef.current
    returnFocusRef.current = null
    if (target && target.isConnected) {
      target.focus()
    } else {
      triggerRef.current?.focus()
    }
  }, [drawerOpen])

  // Escape to close + focus trap + background scroll lock while the drawer is open
  useEffect(() => {
    if (!drawerOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && panelRef.current.contains(active)
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [drawerOpen, closeDrawer])

  if (isWide) {
    return (
      <aside
        ref={railRef}
        aria-label={t('reactions.details')}
        data-testid="details-rail"
        className="w-80 2xl:w-[420px] shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain space-y-4"
      >
        {children}
      </aside>
    )
  }

  return (
    <>
      {pinKey !== null && !drawerOpen && (
        <button
          ref={triggerRef}
          type="button"
          onClick={openDrawer}
          aria-haspopup="dialog"
          title={t('reactions.showDetails')}
          data-testid="details-drawer-trigger"
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-offset-gray-900"
        >
          <PanelRight className="w-4 h-4" aria-hidden="true" />
          {t('reactions.details')}
        </button>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50" data-testid="details-drawer-container">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 motion-safe:animate-backdrop-in"
            onClick={closeDrawer}
            aria-hidden="true"
            data-testid="details-drawer-backdrop"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            data-testid="details-drawer"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl motion-safe:animate-slide-in-right"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
              <h2 id={headingId} className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('reactions.details')}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDrawer}
                aria-label={t('reactions.closeDetails')}
                title={t('reactions.closeDetails')}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-4">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
