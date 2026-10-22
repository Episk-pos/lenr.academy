import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { loadUmamiScript } from '../utils/analytics'

const ANALYTICS_CONSENT_KEY = 'lenr-analytics-consent'
const EXIT_ANIMATION_MS = 250

interface PrivacyBannerProps {
  className?: string
  /**
   * When true, the banner stays hidden (e.g. while the first-visit language
   * modal is open). The stored consent is checked once this becomes false.
   */
  deferred?: boolean
}

export default function PrivacyBanner({ className = '', deferred = false }: PrivacyBannerProps) {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [isRendered, setIsRendered] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (deferred) {
      setIsVisible(false)
      return
    }
    // Check if user has already made a choice
    const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY)
    if (consent === null) {
      // No choice made yet, show banner
      setIsVisible(true)
    }
  }, [deferred])

  useEffect(() => {
    if (isVisible) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      setIsRendered(true)
      requestAnimationFrame(() => setIsActive(true))
    } else if (isRendered) {
      setIsActive(false)
      exitTimerRef.current = setTimeout(() => {
        setIsRendered(false)
        exitTimerRef.current = null
      }, EXIT_ANIMATION_MS)
    }
  }, [isVisible, isRendered])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [])

  const handleAccept = async () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'accepted')
    setIsVisible(false)
    // Load analytics script dynamically (no page reload needed)
    try {
      await loadUmamiScript()
    } catch (error) {
      console.error('Failed to load analytics:', error)
    }
  }

  const handleOptOut = () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'declined')
    setIsVisible(false)
  }

  const handleClose = () => {
    // Treat close as decline
    handleOptOut()
  }

  if (!isRendered) return null

  return (
    <div
      className={`p-4 bg-white dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300 transform ${
        isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
      } ${className}`}
      data-testid="analytics-banner"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            {t('privacy.banner')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('privacy.bannerMessage')}{' '}
            <a
              href="https://cloud.umami.is/share/JGkYeKU60K9D1t4U"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
            >
              {t('privacy.viewDashboard')}
            </a>
            {' '}{t('privacy.dashboardSuffix')}{' '}
            <span className="font-medium">{t('privacy.changeInSettings')}</span>
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={handleOptOut}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {t('privacy.optOut')}
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('privacy.accept')}
          </button>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
