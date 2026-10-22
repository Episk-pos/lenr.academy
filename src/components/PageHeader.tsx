import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  /** Lucide icon — use the matching entry from PAGE_ICONS so it agrees with the sidebar */
  icon: LucideIcon
  /** H1 text */
  title: ReactNode
  /** Optional description shown under the title */
  subtitle?: ReactNode
  /** Optional right-aligned controls (e.g. history panel, export menu) */
  actions?: ReactNode
  /** Extra classes for the outer wrapper (defaults to bottom margin) */
  className?: string
  /** Forwarded to the <h1> for E2E hooks */
  titleTestId?: string
}

/**
 * Shared page header: icon + H1 + optional subtitle and actions.
 * Keeps typography, spacing and icon treatment consistent across routed pages.
 */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className = 'mb-6',
  titleTestId,
}: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`} data-testid="page-header">
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <Icon
            className="w-8 h-8 flex-shrink-0 text-primary-600 dark:text-primary-400"
            aria-hidden="true"
          />
          <h1
            className="text-3xl font-bold text-gray-900 dark:text-white"
            data-testid={titleTestId}
          >
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  )
}
