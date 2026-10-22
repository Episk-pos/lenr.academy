import { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, RefreshCw, Bug } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import { loadUmamiScript } from '../utils/analytics'
import PageHeader from '../components/PageHeader'
import { PAGE_ICONS } from '../constants/pageIcons'

const ANALYTICS_CONSENT_KEY = 'lenr-analytics-consent'
const ERROR_REPORTING_CONSENT_KEY = 'lenr-error-reporting-consent'

export default function PrivacyPreferences() {
  const { t } = useTranslation()
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

  const handleConsentChange = async (newConsent: 'accepted' | 'declined') => {
    const oldConsent = consent
    localStorage.setItem(ANALYTICS_CONSENT_KEY, newConsent)
    setConsent(newConsent)
    setHasChanged(true)

    // Load analytics script dynamically if enabling (no reload needed)
    if (newConsent === 'accepted' && oldConsent !== 'accepted') {
      try {
        await loadUmamiScript()
      } catch (error) {
        console.error('Failed to load analytics:', error)
      }
    }

    // No reload needed for analytics changes anymore
    // Keep reload message state for error reporting only
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
      <PageHeader
        icon={PAGE_ICONS.privacy}
        title={t('privacyPage.title')}
        subtitle={t('privacyPage.subtitle')}
      />

      {/* Reload Message - shown when error reporting changes require reload */}
      {showReloadMessage && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
            {t('privacyPage.reloadToApply')}
          </p>
          <button
            onClick={handleReload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            {t('privacyPage.reloadNow')}
          </button>
        </div>
      )}

      {/* Error Reporting Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Bug className="w-6 h-6 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('privacyPage.errorReporting.title')}
          </h2>
        </div>

        {/* Current Status */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            {errorReportingDisabled ? (
              <>
                <XCircle className="w-6 h-6 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('privacyPage.errorReporting.disabledStatus')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.errorReporting.disabledStatusDescription')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {t('privacyPage.errorReporting.enabledStatus')} {!errorReportingEnabled && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{t('privacyPage.default')}</span>}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.errorReporting.enabledStatusDescription')}
                  </p>
                </div>
              </>
            )}
          </div>

          {errorReportingChanged && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">
                {t('privacyPage.errorReporting.saved')}
              </p>
            </div>
          )}
        </div>

        {/* Why Error Reporting Matters */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
            {t('privacyPage.errorReporting.whyTitle')}
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
            {t('privacyPage.errorReporting.whyIntro')}
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
            <li>{t('privacyPage.errorReporting.why1')}</li>
            <li>{t('privacyPage.errorReporting.why2')}</li>
            <li>{t('privacyPage.errorReporting.why3')}</li>
            <li>{t('privacyPage.errorReporting.why4')}</li>
          </ul>
          <p className="text-sm text-blue-800 dark:text-blue-300 mt-3">
            <Trans i18nKey="privacyPage.errorReporting.helpMessage" components={{ strong: <strong /> }} />
          </p>
        </div>

        {/* Error Reporting Preferences */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            {t('privacyPage.errorReporting.manage')}
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
                    {t('privacyPage.errorReporting.enable')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.errorReporting.enableDescription')}
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
                    {t('privacyPage.errorReporting.disable')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.errorReporting.disableDescription')}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* What Gets Reported */}
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('privacyPage.errorReporting.whatReported')}</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>{t('privacyPage.errorReporting.reported1')}</li>
            <li>{t('privacyPage.errorReporting.reported2')}</li>
            <li>{t('privacyPage.errorReporting.reported3')}</li>
            <li>{t('privacyPage.errorReporting.reported4')}</li>
          </ul>
          <h3 className="font-semibold text-gray-900 dark:text-white mt-4 mb-2">{t('privacyPage.errorReporting.whatNotReported')}</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>{t('privacyPage.errorReporting.notReported1')}</li>
            <li>{t('privacyPage.searchQueriesOrInputs')}</li>
            <li>{t('privacyPage.errorReporting.notReported3')}</li>
            <li>{t('privacyPage.errorReporting.notReported4')}</li>
          </ul>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            <Trans i18nKey="privacyPage.errorReporting.sentryNotice" components={{ strong: <strong /> }} />
          </p>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('privacyPage.analytics.title')}
        </h2>

        {/* Current Status */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            {isEnabled ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('privacyPage.analytics.enabledStatus')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.analytics.enabledStatusDescription')}
                  </p>
                </div>
              </>
            ) : isDisabled ? (
              <>
                <XCircle className="w-6 h-6 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('privacyPage.analytics.disabledStatus')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.analytics.disabledStatusDescription')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Shield className="w-6 h-6 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('privacyPage.analytics.noPreference')}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.analytics.noPreferenceDescription')}
                  </p>
                </div>
              </>
            )}
          </div>

          {hasChanged && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">
                {t('privacyPage.analytics.saved')}
              </p>
            </div>
          )}
        </div>

        {/* Analytics Preferences */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            {t('privacyPage.analytics.manage')}
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
                    {t('privacyPage.analytics.enable')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.analytics.enableDescription')}
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
                    {t('privacyPage.analytics.disable')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('privacyPage.analytics.disableDescription')}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* About Analytics */}
        <div className="space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            <Trans i18nKey="privacyPage.analytics.umamiIntro" components={{ strong: <strong /> }} />
          </p>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('privacyPage.analytics.whatTracked')}</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>{t('privacyPage.analytics.tracked1')}</li>
              <li>{t('privacyPage.analytics.tracked2')}</li>
              <li>{t('privacyPage.analytics.tracked3')}</li>
              <li>{t('privacyPage.analytics.tracked4')}</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t('privacyPage.analytics.whatNotTracked')}</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>{t('privacyPage.analytics.notTracked1')}</li>
              <li>{t('privacyPage.analytics.notTracked2')}</li>
              <li>{t('privacyPage.analytics.notTracked3')}</li>
              <li>{t('privacyPage.analytics.notTracked4')}</li>
              <li>{t('privacyPage.searchQueriesOrInputs')}</li>
            </ul>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              {t('privacyPage.analytics.transparencyTitle')}
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
              {t('privacyPage.analytics.transparencyDescription')}
            </p>
            <a
              href="https://cloud.umami.is/share/JGkYeKU60K9D1t4U"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-semibold"
            >
              {t('privacyPage.analytics.viewDashboard')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {t('privacyPage.analytics.umamiCompliance')}
            </p>
            <a
              href="https://umami.is/docs/about"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {t('privacyPage.analytics.learnMoreUmami')}
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
