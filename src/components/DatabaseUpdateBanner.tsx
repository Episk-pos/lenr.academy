import { useEffect, useRef, useState } from 'react'
import { Download, X, RefreshCw, CheckCircle } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'

interface DatabaseUpdateBannerProps {
  className?: string
}

export default function DatabaseUpdateBanner({ className = '' }: DatabaseUpdateBannerProps) {
  const {
    isUpdateAvailable,
    isDownloadingUpdate,
    updateReady,
    downloadProgress,
    currentVersion,
    availableVersion,
    startBackgroundUpdate,
    reloadWithNewVersion,
  } = useDatabase()

  const [dismissed, setDismissed] = useState(false)
  const [isRendered, setIsRendered] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shouldShow = !dismissed && (updateReady || isDownloadingUpdate || isUpdateAvailable)

  useEffect(() => {
    if (shouldShow) {
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
      }, 250)
    }
  }, [shouldShow, isRendered])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [])

  // Don't show if dismissed or no update scenario
  if (!isRendered) {
    return null
  }

  const formatBytes = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(1)
  }

  // Update ready - prompt to reload
  if (updateReady) {
    return (
      <div
        className={`bg-green-600 text-white shadow-lg transition-all duration-300 transform ${
          isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        } ${className}`}
        data-testid="database-update-banner"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex items-center flex-1">
              <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
              <p className="text-sm font-medium">
                Database update ready (v{availableVersion}) - Refresh to use the new data
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <button
                onClick={reloadWithNewVersion}
                className="px-4 py-2 bg-white text-green-600 rounded-md text-sm font-medium hover:bg-green-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Refresh Now
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="text-white hover:text-green-100 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Downloading update
  if (isDownloadingUpdate) {
    const percentage = downloadProgress?.percentage || 0
    const downloaded = downloadProgress?.downloadedBytes || 0
    const total = downloadProgress?.totalBytes || 1

    return (
      <div
        className={`bg-blue-600 text-white shadow-lg transition-all duration-300 transform ${
          isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        } ${className}`}
        data-testid="database-update-banner"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center mb-2">
                <Download className="w-5 h-5 mr-3 flex-shrink-0 animate-bounce" />
                <p className="text-sm font-medium">
                  Downloading database update in background...
                </p>
              </div>

              {/* Progress Bar */}
              {downloadProgress && downloadProgress.totalBytes > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-blue-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>
                  <span className="text-xs whitespace-nowrap">
                    {formatBytes(downloaded)} / {formatBytes(total)} MB ({percentage.toFixed(0)}%)
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="ml-4 text-white hover:text-blue-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Update available - prompt to download
  if (isUpdateAvailable) {
    return (
      <div
        className={`bg-yellow-600 text-white shadow-lg transition-all duration-300 transform ${
          isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        } ${className}`}
        data-testid="database-update-banner"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex items-center flex-1">
              <Download className="w-5 h-5 mr-3 flex-shrink-0" />
              <p className="text-sm font-medium">
                Database update available: v{currentVersion} → v{availableVersion}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <button
                onClick={startBackgroundUpdate}
                className="px-4 py-2 bg-white text-yellow-600 rounded-md text-sm font-medium hover:bg-yellow-50 transition-colors"
              >
                <Download className="w-4 h-4 inline mr-1" />
                Download Update
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="text-white hover:text-yellow-100 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
