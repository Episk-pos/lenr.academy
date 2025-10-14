import { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, RefreshCw, Bug } from 'lucide-react'

const ANALYTICS_CONSENT_KEY = 'lenr-analytics-consent'
const ERROR_REPORTING_CONSENT_KEY = 'lenr-error-reporting-consent'

export default function PrivacyPreferences() {
  const [consent, setConsent] = useState<string | null>(null)
  const [errorReportingConsent, setErrorReportingConsent] = useState<string | null>(null)
  const [hasChanged, setHasChanged] = useState(false)
  const [errorReportingChanged, setErrorReportingChanged] = useState(false)
  const [showReloadMessage, setShowReloadMessage] = useState(false)

  useEffect(() => {
    // Load current consent states
    const current = localStorage.getItem(ANALYTICS_CONSENT_KEY)
    const errorCurrent = localStorage.getItem(ERROR_REPORTING_CONSENT_KEY)
    setConsent(current)
    setErrorReportingConsent(errorCurrent)
  }, [])

  const handleConsentChange = (newConsent: 'accepted' | 'declined') => {
    const oldConsent = consent
    localStorage.setItem(ANALYTICS_CONSENT_KEY, newConsent)
    setConsent(newConsent)
    setHasChanged(true)

    // Show reload message if we're changing to 'accepted' (analytics needs page reload to load)
    if (newConsent === 'accepted' && oldConsent !== 'accepted') {
      setShowReloadMessage(true)
    } else {
      setShowReloadMessage(false)
    }
  }

  const handleErrorReportingChange = (newConsent: 'accepted' | 'declined') => {
    localStorage.setItem(ERROR_REPORTING_CONSENT_KEY, newConsent)
    setErrorReportingConsent(newConsent)
    setErrorReportingChanged(true)
    // Error reporting changes require page reload
    setShowReloadMessage(true)
  }

  const handleReload = () => {
    window.location.reload()
  }

  const isEnabled = consent === 'accepted'
  const isDisabled = consent === 'declined'
  const errorReportingEnabled = errorReportingConsent === 'accepted'
  const errorReportingDisabled = errorReportingConsent === 'declined'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Privacy Settings
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your analytics and error reporting preferences and learn about how we protect your privacy
        </p>
      </div>

      {/* Reload Message - shown when any changes require reload */}
      {showReloadMessage && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
            To apply your changes, please reload the page.
          </p>
          <button
            onClick={handleReload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page Now
          </button>
        </div>
      )}

      {/* Error Reporting Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Bug className="w-6 h-6 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Error Reporting
          </h2>
        </div>

        {/* Current Status */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            {errorReportingDisabled ? (
              <>
                <XCircle className="w-6 h-6 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Error Reporting Disabled</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Errors won't be reported to our development team
                  </p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Error Reporting Enabled {!errorReportingEnabled && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(default)</span>}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Helping us catch and fix bugs automatically
                  </p>
                </div>
              </>
            )}
          </div>

          {errorReportingChanged && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">
                ✓ Your error reporting preference has been saved
              </p>
            </div>
          )}
        </div>

        {/* Why Error Reporting Matters */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
            Why Error Reporting is Critical
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
            Error reporting helps us identify and fix bugs that affect your experience. When errors occur, we receive anonymized technical details that help us:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
            <li>Fix bugs faster and improve stability</li>
            <li>Understand which features need improvement</li>
            <li>Prioritize development based on real issues</li>
            <li>Ensure the app works correctly for all users</li>
          </ul>
          <p className="text-sm text-blue-800 dark:text-blue-300 mt-3">
            <strong>Your help makes this project better for everyone!</strong> Enabling error reporting is one of the most impactful ways you can contribute to LENR Academy's success.
          </p>
        </div>

        {/* Error Reporting Preferences */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Manage Error Reporting
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleErrorReportingChange('accepted')}
              className={`p-4 border-2 rounded-lg transition-all ${
                errorReportingEnabled
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
              aria-pressed={errorReportingEnabled}
            >
              <div className="flex items-start gap-3">
                <CheckCircle className={`w-5 h-5 mt-0.5 ${errorReportingEnabled ? 'text-primary-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`font-medium mb-1 ${errorReportingEnabled ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                    Enable Error Reporting
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Automatically report errors to help us fix bugs
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleErrorReportingChange('declined')}
              className={`p-4 border-2 rounded-lg transition-all ${
                errorReportingDisabled
                  ? 'border-gray-600 bg-gray-50 dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
              aria-pressed={errorReportingDisabled}
            >
              <div className="flex items-start gap-3">
                <XCircle className={`w-5 h-5 mt-0.5 ${errorReportingDisabled ? 'text-gray-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`font-medium mb-1 ${errorReportingDisabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                    Disable Error Reporting
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Don't send error reports (app may be less stable)
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* What Gets Reported */}
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">What Gets Reported:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>Error messages and stack traces</li>
            <li>Browser type and version</li>
            <li>Page URL (query parameters scrubbed)</li>
            <li>App version and release info</li>
          </ul>
          <h3 className="font-semibold text-gray-900 dark:text-white mt-4 mb-2">What's NOT Reported:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>Personal information or IP addresses</li>
            <li>Search queries or form inputs</li>
            <li>Session recordings or screenshots</li>
            <li>Any identifiable user data</li>
          </ul>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            We use <strong>Sentry</strong> with EU hosting for GDPR compliance. All data is anonymized and used solely for debugging purposes.
          </p>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Analytics
        </h2>

        {/* Current Status */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            {isEnabled ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Analytics Enabled</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Helping us improve the site with privacy-friendly analytics
                  </p>
                </div>
              </>
            ) : isDisabled ? (
              <>
                <XCircle className="w-6 h-6 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Analytics Disabled</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    We're not collecting any usage data from your visits
                  </p>
                </div>
              </>
            ) : (
              <>
                <Shield className="w-6 h-6 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">No Preference Set</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You haven't made a choice yet
                  </p>
                </div>
              </>
            )}
          </div>

          {hasChanged && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">
                ✓ Your analytics preference has been saved
              </p>
            </div>
          )}
        </div>

        {/* Analytics Preferences */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Manage Analytics
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleConsentChange('accepted')}
              className={`p-4 border-2 rounded-lg transition-all ${
                isEnabled
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
              aria-pressed={isEnabled}
            >
              <div className="flex items-start gap-3">
                <CheckCircle className={`w-5 h-5 mt-0.5 ${isEnabled ? 'text-primary-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`font-medium mb-1 ${isEnabled ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                    Enable Analytics
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Help us understand how visitors use the site
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleConsentChange('declined')}
              className={`p-4 border-2 rounded-lg transition-all ${
                isDisabled
                  ? 'border-gray-600 bg-gray-50 dark:bg-gray-800'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
              aria-pressed={isDisabled}
            >
              <div className="flex items-start gap-3">
                <XCircle className={`w-5 h-5 mt-0.5 ${isDisabled ? 'text-gray-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <p className={`font-medium mb-1 ${isDisabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                    Disable Analytics
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Don't collect usage data from your visits
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* About Analytics */}
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            We use <strong>Umami Analytics</strong>, a privacy-friendly, open-source analytics platform that respects your privacy.
          </p>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">What We Track:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Page views and navigation patterns</li>
              <li>Referring websites (where visitors come from)</li>
              <li>Browser and device type (anonymized)</li>
              <li>Country/region (based on IP, not stored)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">What We DON'T Track:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Personal information or identifiable data</li>
              <li>Individual users across sessions</li>
              <li>Cookies (we don't use any tracking cookies)</li>
              <li>IP addresses (not stored)</li>
              <li>Search queries or form inputs</li>
            </ul>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Full Transparency
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
              We believe in complete transparency. You can view our public analytics dashboard to see exactly what data we collect and how it's displayed. No secrets, no hidden tracking.
            </p>
            <a
              href="https://cloud.umami.is/share/JGkYeKU60K9D1t4U"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-semibold"
            >
              View Public Analytics Dashboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Umami is fully GDPR, CCPA, and PECR compliant. It's designed to give website owners insights without invading visitor privacy.
            </p>
            <a
              href="https://umami.is/docs/about"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Learn more about Umami
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
