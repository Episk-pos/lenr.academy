import { useTranslation } from 'react-i18next'

interface IncreaseLimitHintProps {
  /** Expands the (collapsed) section that contains the limit selector */
  onExpand: () => void
  /** DOM id of the limit selector control to scroll to and focus */
  targetId: string
}

/**
 * Actionable "Increase limit to see more results" hint shown next to the
 * query timing when results were truncated by the limit. Clicking it expands
 * the "Additional Filters" section and moves focus to the limit control.
 */
export default function IncreaseLimitHint({ onExpand, targetId }: IncreaseLimitHintProps) {
  const { t } = useTranslation()

  const handleClick = () => {
    onExpand()
    // Wait for the expanded section to render before scrolling/focusing
    window.setTimeout(() => {
      const target = document.getElementById(targetId)
      if (!target) return
      target.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      target.focus({ preventScroll: true })
    }, 50)
  }

  return (
    <>
      <span className="ms-2" aria-hidden="true">•</span>
      <button
        type="button"
        onClick={handleClick}
        className="ms-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
        data-testid="increase-limit-button"
      >
        {t('reactions.increaseLimit')}
      </button>
    </>
  )
}
