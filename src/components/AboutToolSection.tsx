import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Info } from 'lucide-react'

interface AboutToolSectionProps {
  children: ReactNode
  /** Start expanded (defaults to collapsed) */
  defaultOpen?: boolean
  className?: string
  'data-testid'?: string
}

/**
 * Collapsible "About this tool" card shown near the top of tool pages.
 * Follows the project's collapsible card pattern (max-h transition + ChevronDown rotation).
 */
export default function AboutToolSection({
  children,
  defaultOpen = false,
  className = 'mb-6',
  'data-testid': testId = 'about-tool-section',
}: AboutToolSectionProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div
      className={`card bg-blue-50 dark:bg-blue-900/20 ${className}`}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left"
        data-testid={`${testId}-toggle`}
      >
        <span className="flex items-center gap-3 font-semibold text-gray-900 dark:text-white">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" aria-hidden="true" />
          {t('common.aboutThisTool')}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id={contentId}
        aria-hidden={!open}
        className={`transition-all duration-300 ease-in-out overflow-hidden ${open ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-6 pb-6 text-sm text-gray-700 dark:text-gray-300 space-y-4">
          {children}
        </div>
      </div>
    </div>
  )
}
