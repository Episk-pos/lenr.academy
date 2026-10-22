import type { MouseEventHandler } from 'react'
import { useTranslation } from 'react-i18next'
import { Radiation } from 'lucide-react'
import type { BosonFermionType } from '../types'
import Tooltip from './Tooltip'

export interface IsotopeCardLimitedData {
  /** Primary decay mode (e.g. "B-", "EC", "A") */
  decayMode?: string | null
  /** Pre-formatted half-life string (e.g. "12.3y") */
  halfLife?: string | null
}

export interface IsotopeCardProps {
  /** Element symbol */
  E: string
  /** Mass number */
  A: number
  /** Atomic number */
  Z: number
  /** Nuclear boson/fermion flag (full-data nuclides) */
  nBorF?: BosonFermionType
  /** Whether the nuclide is considered stable (LHL > 9) */
  stable?: boolean
  /**
   * When provided, the card renders in the "limited data" (RadioNuclides-only)
   * variant: amber styling with decay-mode and half-life pills.
   */
  limitedData?: IsotopeCardLimitedData
  /** Show a radioactive badge (full-data variant only) */
  radioactive?: boolean
  /** Pre-formatted half-life pill (full-data variant only, e.g. "12.33Y") */
  halfLife?: string | null
  /** Selected / pinned state (filled blue) */
  selected?: boolean
  /** Highlighted (e.g. hovered elsewhere on the page) */
  highlighted?: boolean
  /** De-emphasised because another nuclide is highlighted */
  dimmed?: boolean
  onClick?: () => void
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>
}

/**
 * Isotope selection card, shared by Show Element Data and the query pages'
 * "Nuclides Appearing in Results" section.
 */
export default function IsotopeCard({
  E,
  A,
  Z,
  nBorF,
  stable = false,
  limitedData,
  radioactive = false,
  halfLife = null,
  selected = false,
  highlighted = false,
  dimmed = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: IsotopeCardProps) {
  const { t } = useTranslation()
  const isFull = !limitedData

  const stateClasses = selected
    ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-400 shadow-md'
    : highlighted
      ? 'bg-blue-50 dark:bg-blue-900/30 text-gray-900 dark:text-gray-100 border-blue-400 dark:border-blue-500'
      : isFull
        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400'
        : 'bg-amber-50 dark:bg-amber-900/10 text-gray-900 dark:text-gray-100 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/20 hover:border-amber-400'

  return (
    <Tooltip content={!isFull ? t('elements.limitedDataTooltip') : undefined}>
      <button
        type="button"
        data-testid="isotope-card"
        data-nuclide={`${E}-${A}`}
        aria-pressed={selected}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`
          p-3 rounded-lg border-2 transition-all duration-150 w-full h-full min-h-[100px]
          ${stateClasses}
          ${dimmed && !selected && !highlighted ? 'opacity-50' : ''}
        `}
      >
        <div className="text-center">
          <div className="text-lg font-bold">{E}-{A}</div>
          <div className="text-xs opacity-75">Z={Z}</div>
          <div className="mt-1 flex flex-wrap gap-1 justify-center">
            {isFull ? (
              <>
                {nBorF && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    nBorF === 'b'
                      ? selected ? 'bg-blue-600 text-blue-100' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      : selected ? 'bg-orange-600 text-orange-100' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                  }`}>
                    {nBorF === 'b' ? 'B' : 'F'}
                  </span>
                )}
                {stable && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    selected ? 'bg-green-600 text-green-100' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                  }`}>
                    {t('elements.stableNuclide')}
                  </span>
                )}
                {radioactive && (
                  <span
                    data-testid="isotope-card-radioactive"
                    title={t('reactions.radioactive')}
                    aria-label={t('reactions.radioactive')}
                    className={`px-1.5 py-0.5 rounded-full text-xs flex items-center ${
                      selected ? 'bg-amber-600 text-amber-100' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <Radiation className="w-3 h-3" />
                  </span>
                )}
                {halfLife && (
                  <span
                    data-testid="isotope-card-half-life"
                    title={t('elements.halfLife')}
                    className={`px-1.5 py-0.5 rounded-full text-xs ${
                      selected ? 'bg-gray-600 text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {halfLife}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className={`px-1.5 py-0.5 rounded-full text-xs flex items-center gap-0.5 ${
                  selected ? 'bg-amber-600 text-amber-100' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                }`}>
                  <Radiation className="w-2.5 h-2.5" />
                  {limitedData.decayMode}
                </span>
                {limitedData.halfLife && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    selected ? 'bg-gray-600 text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {limitedData.halfLife}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </button>
    </Tooltip>
  )
}
