import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const ANALYTICS_CONSENT_KEY = 'lenr-analytics-consent'
const EXIT_ANIMATION_MS = 250

interface PrivacyBannerProps {
  className?: string
}

export default function PrivacyBanner({ className = '' }: PrivacyBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isRendered, setIsRendered] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY)
    if (consent === null) {
      // No choice made yet, show banner
      setIsVisible(true)
    }
  }, [])

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

  const handleAccept = () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'accepted')
    setIsVisible(false)
    // Reload to enable analytics
    window.location.reload()
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
            Privacy-Friendly Analytics
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            We use privacy-friendly analytics (Umami) to understand how visitors use this site.
            No cookies, no personal data collection, fully GDPR compliant.{' '}
            <a
              href="https://cloud.umami.is/share/JGkYeKU60K9D1t4U"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
            >
              View public dashboard
            </a>
            {' '}to see what we collect.{' '}
            <span className="font-medium">You can change this later in Privacy Settings.</span>
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={handleOptOut}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Opt Out
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
