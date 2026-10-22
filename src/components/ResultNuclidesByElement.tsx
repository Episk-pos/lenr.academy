import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Nuclide } from '../types'
import IsotopeCard from './IsotopeCard'

interface ElementGroup {
  E: string
  Z: number
  nuclides: Nuclide[]
}

export interface ResultNuclidesByElementProps {
  /** All nuclides appearing in the query results */
  nuclides: Nuclide[]
  /** Set of radioactive nuclide keys in `${Z}-${A}` form */
  radioactiveNuclides: Set<string>
  /** Element symbol currently pinned on the page (heatmap), or null */
  pinnedElement: string | null
  /** Currently highlighted nuclide id (`${E}-${A}`), hovered or pinned */
  highlightedNuclide: string | null
  /** Whether highlightedNuclide is pinned */
  pinnedNuclide: boolean
  /** Toggle pinning of an element — must be the same handler the heatmap uses */
  onElementSelect: (symbol: string) => void
  /** Hover a nuclide card (null on leave); only called while no nuclide is pinned */
  onNuclideHover: (nuclideId: string | null) => void
  /** Click a nuclide card (toggle pin) */
  onNuclideSelect: (nuclide: Nuclide) => void
}

/**
 * "Nuclides Appearing in Results" section for the reaction query pages:
 * a row of element chips (sorted by Z) linked to the page's pinned element,
 * and a grid of isotope cards for the displayed element.
 */
export default function ResultNuclidesByElement({
  nuclides,
  radioactiveNuclides,
  pinnedElement,
  highlightedNuclide,
  pinnedNuclide,
  onElementSelect,
  onNuclideHover,
  onNuclideSelect,
}: ResultNuclidesByElementProps) {
  const { t } = useTranslation()

  const groups = useMemo<ElementGroup[]>(() => {
    const byElement = new Map<string, ElementGroup>()
    for (const nuc of nuclides) {
      let group = byElement.get(nuc.E)
      if (!group) {
        group = { E: nuc.E, Z: nuc.Z, nuclides: [] }
        byElement.set(nuc.E, group)
      }
      group.nuclides.push(nuc)
    }
    const sorted = Array.from(byElement.values())
    for (const group of sorted) group.nuclides.sort((a, b) => a.A - b.A)
    // Sort by Z; hydrogen isotopes (H, D, T share Z=1) fall back to lightest A
    sorted.sort((a, b) => a.Z - b.Z || a.nuclides[0].A - b.nuclides[0].A)
    return sorted
  }, [nuclides])

  // Element of a pinned nuclide (e.g. pinned from the results table)
  const pinnedNuclideElement = useMemo(() => {
    if (!pinnedNuclide || !highlightedNuclide) return null
    const match = nuclides.find(nuc => `${nuc.E}-${nuc.A}` === highlightedNuclide)
    return match ? match.E : null
  }, [nuclides, pinnedNuclide, highlightedNuclide])

  const displayedGroup = useMemo(() => {
    const preferred = pinnedElement ?? pinnedNuclideElement
    return groups.find(g => g.E === preferred) ?? groups[0] ?? null
  }, [groups, pinnedElement, pinnedNuclideElement])

  const isDefaultDisplay = displayedGroup !== null && displayedGroup.E !== pinnedElement

  if (groups.length === 0) return null

  return (
    <div className="card p-4 sm:p-6" data-testid="result-nuclides-by-element">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        {t('reactions.nuclidesHeading')}{' '}
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400" data-testid="result-nuclides-count">
          ({t('reactions.nuclidesAcrossElements', {
            nuclides: t('reactions.nuclideCount', { count: nuclides.length }),
            elements: t('reactions.elementCount', { count: groups.length }),
          })})
        </span>
      </h3>

      <div
        role="group"
        aria-label={t('reactions.elementChipsLabel')}
        className="flex flex-wrap gap-1.5 mb-4"
      >
        {groups.map(group => {
          const isPinned = pinnedElement === group.E
          const isDisplayed = displayedGroup?.E === group.E
          return (
            <button
              key={group.E}
              type="button"
              data-testid="element-chip"
              data-element={group.E}
              aria-pressed={isPinned}
              title={t('reactions.elementChipTitle', {
                element: group.E,
                z: group.Z,
                nuclides: t('reactions.nuclideCount', { count: group.nuclides.length }),
              })}
              onClick={() => onElementSelect(group.E)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${
                isPinned
                  ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500'
                  : isDisplayed
                    ? 'bg-blue-50 border-blue-400 border-dashed text-blue-800 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-200'
                    : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100 hover:border-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="font-semibold">{group.E}</span>
              <span aria-hidden="true" className={isPinned ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}>·</span>
              <span className={isPinned ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}>{group.nuclides.length}</span>
            </button>
          )
        })}
      </div>

      {displayedGroup && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
            <h4
              className="text-sm font-semibold text-gray-800 dark:text-gray-200"
              data-testid="result-nuclides-element-heading"
            >
              {t('reactions.nuclidesOfElement', {
                element: displayedGroup.E,
                filtered: displayedGroup.nuclides.length,
                total: nuclides.length,
              })}
            </h4>
            {isDefaultDisplay && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('reactions.elementChipHint')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {displayedGroup.nuclides.map(nuc => {
              const nuclideId = `${nuc.E}-${nuc.A}`
              const isActive = highlightedNuclide === nuclideId
              return (
                <IsotopeCard
                  key={nuclideId}
                  E={nuc.E}
                  A={nuc.A}
                  Z={nuc.Z}
                  nBorF={nuc.nBorF}
                  stable={typeof nuc.logHalfLife === 'number' && nuc.logHalfLife > 9}
                  radioactive={radioactiveNuclides.has(`${nuc.Z}-${nuc.A}`)}
                  selected={pinnedNuclide && isActive}
                  highlighted={!pinnedNuclide && isActive}
                  dimmed={highlightedNuclide !== null && !isActive}
                  onClick={() => onNuclideSelect(nuc)}
                  onMouseEnter={() => { if (!pinnedNuclide) onNuclideHover(nuclideId) }}
                  onMouseLeave={() => { if (!pinnedNuclide) onNuclideHover(null) }}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
