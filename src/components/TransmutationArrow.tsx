import { useTheme } from '../contexts/ThemeContext'

interface TransmutationArrowProps {
  fromSymbol: string
  fromA?: number
  toSymbol: string
  toA?: number
  /** Optional small step count badge to display on the arrow */
  stepCount?: number
}

/**
 * Compact, presentation-only badge → arrow → badge component used to render a
 * single documented transmutation. This is intentionally simple for the first
 * cut; a full periodic-table chord visualization is out of scope until UX
 * design review.
 */
export default function TransmutationArrow({
  fromSymbol,
  fromA,
  toSymbol,
  toA,
  stepCount,
}: TransmutationArrowProps) {
  const { theme } = useTheme()

  const badgeBase =
    'inline-flex flex-col items-center justify-center min-w-[3rem] px-3 py-1 rounded-md font-mono text-sm border'
  const fromClass =
    theme === 'dark'
      ? `${badgeBase} bg-blue-900/40 border-blue-700 text-blue-200`
      : `${badgeBase} bg-blue-50 border-blue-300 text-blue-800`
  const toClass =
    theme === 'dark'
      ? `${badgeBase} bg-green-900/40 border-green-700 text-green-200`
      : `${badgeBase} bg-green-50 border-green-300 text-green-800`
  const arrowColor =
    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'

  const fromLabel = fromA !== undefined ? `${fromSymbol}-${fromA}` : fromSymbol
  const toLabel = toA !== undefined ? `${toSymbol}-${toA}` : toSymbol

  return (
    <div className="flex items-center gap-2" data-testid="transmutation-arrow">
      <span className={fromClass} data-testid="transmutation-from">
        <span className="font-bold">{fromLabel}</span>
      </span>
      <span className={`flex flex-col items-center ${arrowColor}`} aria-hidden="true">
        {stepCount !== undefined && (
          <span className="text-[10px] uppercase tracking-wide">
            {stepCount === 1 ? '1 step' : `${stepCount} steps`}
          </span>
        )}
        <svg
          width="40"
          height="14"
          viewBox="0 0 40 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 7 H32 M28 3 L34 7 L28 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={toClass} data-testid="transmutation-to">
        <span className="font-bold">{toLabel}</span>
      </span>
    </div>
  )
}
