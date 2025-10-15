import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X, Sparkles } from 'lucide-react'
import { startVersionPolling, VersionCheckResult } from '../services/versionCheck'

interface AppUpdateBannerProps {
  className?: string
  onVisibilityChange?: (visible: boolean) => void
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

export default function AppUpdateBanner({ className = '', onVisibilityChange }: AppUpdateBannerProps) {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)
  const [buildTime, setBuildTime] = useState<string | null>(null)
  const [isRendered, setIsRendered] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    window.location.reload()
  }

  const formattedBuildTime = buildTime && !Number.isNaN(Date.parse(buildTime))
    ? new Date(buildTime).toLocaleString()
    : null

  return (
    <div
      className={`bg-yellow-600 text-white shadow-lg transition-all duration-300 transform ${
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
                App update available: {CURRENT_VERSION} → {availableVersion}
              </p>
              {formattedBuildTime && (
                <p className="text-xs text-yellow-100 mt-1">
                  Deployed {formattedBuildTime}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-white text-yellow-600 rounded-md text-sm font-medium hover:bg-yellow-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" aria-hidden="true" />
              Refresh Now
            </button>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-yellow-100 transition-colors"
              aria-label="Dismiss app update notification"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
