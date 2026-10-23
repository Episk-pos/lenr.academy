import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { AtomicRadiiData, Element, Nuclide } from '../types'
import ElementDetailsCard from './ElementDetailsCard'
import NuclideDetailsCard from './NuclideDetailsCard'
import { useScrollIntoViewOnPin } from '../hooks/useScrollIntoViewOnPin'

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
  /**
   * Identity of what the user has pinned (e.g. `|Fe-56`), or null. A change to
   * a new non-null key scrolls the details into view.
   */
  pinKey?: string | null
  /**
   * Whether pin changes should scroll. Pages pass false until pins from URL
   * state have been restored, so the initial restore doesn't scroll.
   */
  scrollOnPin?: boolean
}

/**
 * Details content shared by the three reaction query pages: the pinned
 * nuclide (with its parent element), the pinned element, or an empty-state hint.
 * Rendered inline, full width, below the results.
 */
export default function PinnedDetails({
  nuclide,
  element,
  atomicRadii,
  onCloseNuclide,
  onCloseElement,
  pinKey = null,
  scrollOnPin = true,
}: PinnedDetailsProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  useScrollIntoViewOnPin(containerRef, pinKey, scrollOnPin)

  let content
  if (nuclide) {
    content = (
      <>
        {element && <ElementDetailsCard element={element} atomicRadii={atomicRadii} onClose={onCloseNuclide} />}
        <NuclideDetailsCard nuclide={nuclide} onClose={onCloseNuclide} />
      </>
    )
  } else if (element) {
    content = <ElementDetailsCard element={element} atomicRadii={atomicRadii} onClose={onCloseElement} />
  } else {
    content = (
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

  return (
    <div ref={containerRef} className="space-y-6 scroll-mt-4" data-testid="pinned-details">
      {content}
    </div>
  )
}
