import { useTranslation } from 'react-i18next'
import type { NeutrinoType } from '../types'

interface NeutrinoBadgeProps {
  neutrino: NeutrinoType
}

/**
 * Compact badge for the `neutrino` column of the Parkhomov reaction tables.
 *
 * Column semantics (verified against FusionAll / FissionAll / TwoToTwoAll):
 * - `left`  — left-handed neutrino (ν) involved; total nuclear charge Z drops
 *             by 1 (β⁺ / electron-capture type).
 * - `right` — right-handed antineutrino (ν̄) involved; total nuclear charge Z
 *             rises by 1 (β⁻ type, equivalently neutrino absorption).
 * - `none`  — no neutrino involved; Z is conserved.
 */
export default function NeutrinoBadge({ neutrino }: NeutrinoBadgeProps) {
  const { t } = useTranslation()

  let label: string
  let title: string
  let colorClass: string
  if (neutrino === 'left') {
    label = t('reactions.neutrinoBadge.left')
    title = t('reactions.neutrinoBadge.leftTitle')
    colorClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  } else if (neutrino === 'right') {
    label = t('reactions.neutrinoBadge.right')
    title = t('reactions.neutrinoBadge.rightTitle')
    colorClass = 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
  } else {
    label = t('reactions.neutrinoBadge.none')
    title = t('reactions.neutrinoBadge.noneTitle')
    colorClass = 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  }

  return (
    <span
      className={`inline-block min-w-[2rem] px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium cursor-help ${colorClass}`}
      title={title}
      data-testid="neutrino-badge"
      data-neutrino={neutrino}
    >
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{title}</span>
    </span>
  )
}
