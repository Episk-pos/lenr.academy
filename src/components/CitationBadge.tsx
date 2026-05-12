import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import Tooltip from './Tooltip'
import { resolveCitationIds } from '../services/citationsService'
import type { Citation } from '../types/citations'

interface CitationBadgeProps {
  /** IDs into the curated citations dataset (src/data/citations.ts). */
  citationIds: string[]
  /**
   * `inline` (default) — small superscript-style indicator next to text.
   * `corner` — bigger badge suitable for placement at the corner of a card.
   */
  placement?: 'inline' | 'corner'
}

/**
 * Footnote-style indicator that renders a small icon and reveals the
 * matching citations on hover/click via the shared Tooltip component.
 *
 * Renders nothing when `citationIds` resolves to zero entries — callers
 * can therefore include the badge unconditionally.
 */
export default function CitationBadge({
  citationIds,
  placement = 'inline',
}: CitationBadgeProps) {
  const { t } = useTranslation()
  const citations = resolveCitationIds(citationIds)

  if (citations.length === 0) return null

  const triggerClass =
    placement === 'corner'
      ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-400'
      : 'inline-flex items-center justify-center align-middle w-4 h-4 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 focus:outline-none focus:ring-2 focus:ring-amber-400'

  const iconSize = placement === 'corner' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'

  const ariaLabel = t('citations.ariaLabel', {
    defaultValue:
      '{{count}} documented citation(s) — open to view bibliography',
    count: citations.length,
  })

  const tooltipContent = (
    <div className="text-left max-w-xs sm:max-w-sm">
      <div className="font-semibold mb-1.5 text-amber-200">
        {t('citations.tooltipTitle', {
          defaultValue: 'Documented in literature',
        })}
      </div>
      <ul className="space-y-2">
        {citations.map((c) => (
          <li key={c.id} className="text-[11px] leading-snug">
            <CitationEntry citation={c} />
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-400">
        {t('citations.tooltipDisclaimer', {
          defaultValue:
            'Excerpts paraphrased from secondary sources — verify before publication.',
        })}
      </div>
    </div>
  )

  return (
    <Tooltip content={tooltipContent}>
      <span
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={triggerClass}
      >
        <BookOpen className={iconSize} aria-hidden="true" />
      </span>
    </Tooltip>
  )
}

/** Single citation row inside the popover. */
function CitationEntry({ citation }: { citation: Citation }) {
  const titleLine = [citation.authors, `(${citation.year})`].join(' ')
  const venue =
    citation.journal ?? citation.institution ?? citation.title ?? undefined

  return (
    <div>
      <div className="font-medium text-white">{titleLine}</div>
      {venue && <div className="italic text-gray-300">{venue}</div>}
      <div className="text-gray-200 mt-0.5">{citation.excerpt}</div>
      {citation.url && (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-1 text-blue-300 hover:text-blue-200 underline"
          onClick={(e) => e.stopPropagation()}
        >
          {citation.url}
        </a>
      )}
    </div>
  )
}
