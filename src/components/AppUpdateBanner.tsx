import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X, Sparkles, Loader2 } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { startVersionPolling, VersionCheckResult } from '../services/versionCheck'

interface AppUpdateBannerProps {
  className?: string
  onVisibilityChange?: (visible: boolean) => void
  onViewChangelog?: (version: string | null) => void
}

const CURRENT_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown'
const DISMISS_KEY_PREFIX = 'lenr-app-update-dismissed'
const SNOOZE_DURATION_MS = 6 * 60 * 60 * 1000 // 6 hours
const EXIT_ANIMATION_MS = 250

function getDismissKey(version: string): string {
  return `${DISMISS_KEY_PREFIX}-${version}`
}

function hasDismissedVersion(version: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const storedValue = window.sessionStorage.getItem(getDismissKey(version))
    if (!storedValue) return false

    const dismissedAt = Number(storedValue)
    if (!Number.isFinite(dismissedAt)) {
      window.sessionStorage.removeItem(getDismissKey(version))
      return false
    }

    if (Date.now() - dismissedAt < SNOOZE_DURATION_MS) {
      return true
    }

    window.sessionStorage.removeItem(getDismissKey(version))
    return false
  } catch {
    return false
  }
}

function markVersionDismissed(version: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(getDismissKey(version), String(Date.now()))
  } catch {
    // Ignore storage errors (e.g., quota exceeded, private mode)
  }
}

export default function AppUpdateBanner({ className = '', onVisibilityChange, onViewChangelog }: AppUpdateBannerProps) {
  const { t } = useTranslation()
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)
  const [buildTime, setBuildTime] = useState<string | null>(null)
  const [isRendered, setIsRendered] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResult = (result: VersionCheckResult) => {
      if (!result.version) return

      if (hasDismissedVersion(result.version)) {
        return
      }

      setAvailableVersion(result.version)
      setBuildTime(result.buildTime ?? null)
    }

    const pollingHandle = startVersionPolling(handleResult)

    return () => {
      pollingHandle.stop()
    }
  }, [])

  useEffect(() => {
    if (availableVersion) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      setIsRendered(true)
      // Defer to next frame so transition runs
      requestAnimationFrame(() => setIsActive(true))
    } else if (isRendered) {
      setIsActive(false)
      exitTimerRef.current = setTimeout(() => {
        setIsRendered(false)
        exitTimerRef.current = null
      }, EXIT_ANIMATION_MS)
    }
  }, [availableVersion, isRendered])

  useEffect(() => {
    onVisibilityChange?.(Boolean(availableVersion))
  }, [availableVersion, onVisibilityChange])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
  }, [])

  if (!isRendered || !availableVersion) {
    return null
  }

  const handleDismiss = () => {
    markVersionDismissed(availableVersion)
    setIsActive(false)
    exitTimerRef.current = setTimeout(() => {
      setAvailableVersion(null)
      setBuildTime(null)
      exitTimerRef.current = null
    }, EXIT_ANIMATION_MS)
  }

  const handleRefresh = () => {
    setIsUpdating(true)

    // Clear the fallback timer when the page is about to unload.
    // This handles the case where updateServiceWorker() successfully
    // triggers a reload — the timer is no longer needed.
    const clearFallback = () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
    window.addEventListener('beforeunload', clearFallback, { once: true })

    // Coordinate with the service worker: tell the waiting SW to
    // skip waiting, activate, and reload the page once ready.
    // This prevents the double-reload caused by calling reload()
    // immediately while the SW is still activating.
    updateServiceWorker(true)

    // Fallback: if no service worker is waiting or update doesn't
    // trigger a reload within 3 seconds, reload manually.
    fallbackTimerRef.current = setTimeout(() => {
      window.removeEventListener('beforeunload', clearFallback)
      window.location.reload()
    }, 3000)
  }

  const formattedBuildTime = buildTime && !Number.isNaN(Date.parse(buildTime))
    ? new Date(buildTime).toLocaleString()
    : null

  return (
    <div
      className={`bg-amber-500 text-white shadow-lg border border-white/20 transition-all duration-300 transform ${
        isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
      } ${className}`}
      data-testid="app-update-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start sm:items-center gap-3">
            <Sparkles className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">
                {t('updates.appUpdateAvailable', { current: CURRENT_VERSION, available: availableVersion })}
              </p>
              {formattedBuildTime && (
                <p className="text-xs text-amber-100 mt-1">
                  {t('updates.deployed', { time: formattedBuildTime })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onViewChangelog && (
              <button
                onClick={() => onViewChangelog(availableVersion)}
                className="px-4 py-2 bg-amber-400/20 text-white border border-white/20 rounded-md text-sm font-medium hover:bg-amber-400/30 transition-colors"
              >
                {t('updates.viewWhatsNew')}
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isUpdating}
              className={`px-4 py-2 bg-white text-amber-600 rounded-md text-sm font-medium transition-colors ${
                isUpdating ? 'opacity-75 cursor-not-allowed' : 'hover:bg-amber-50'
              }`}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 inline mr-1 animate-spin" aria-hidden="true" />
                  {t('updates.updating', 'Updating...')}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {t('updates.refreshNow')}
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-amber-100 transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
