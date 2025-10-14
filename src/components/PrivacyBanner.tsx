import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const ANALYTICS_CONSENT_KEY = 'lenr-analytics-consent'

export default function PrivacyBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(ANALYTICS_CONSENT_KEY)
    if (consent === null) {
      // No choice made yet, show banner
      setIsVisible(true)
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

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700 shadow-lg">
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
