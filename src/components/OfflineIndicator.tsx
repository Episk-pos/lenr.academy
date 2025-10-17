import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

/**
 * Offline Indicator Component
 *
 * Shows a banner when the user loses internet connection.
 * - Full text for first 5 seconds
 * - Transitions to slim line indicator afterwards
 * - Fixed position at top, pushes content down with body padding
 * - Smooth animations for all transitions
 */
export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)
  const [showFullText, setShowFullText] = useState(true)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      console.log('[PWA] Connection restored')
      setIsOnline(true)

      // Show reconnected message briefly
      if (wasOffline) {
        setShowReconnected(true)
        setIsAnimatingOut(false)
        // Start fadeOut animation at 2.5s
        setTimeout(() => {
          setIsAnimatingOut(true)
        }, 2500)
        // Remove from DOM after animation completes (2.5s + 0.3s animation)
        setTimeout(() => {
          setShowReconnected(false)
          setWasOffline(false)
          setIsAnimatingOut(false)
        }, 2800)
      }
    }

    const handleOffline = () => {
      console.log('[PWA] Connection lost')
      setIsOnline(false)
      setWasOffline(true)
      setShowReconnected(false)
      setShowFullText(true) // Reset to full text when going offline
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  // Auto-minimize offline banner after 5 seconds
  useEffect(() => {
    if (!isOnline && showFullText) {
      const timer = setTimeout(() => {
        setShowFullText(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [isOnline, showFullText])

  // Set CSS variable for banner height (used by Layout and other components)
  useEffect(() => {
    let height = 0

    if (showReconnected && !isAnimatingOut) {
      height = 36 // Reconnected banner height (py-2)
    } else if (!isOnline) {
      height = showFullText ? 48 : 16 // Full text (0.375rem padding) vs slim mode (0rem padding)
    }

    // Set CSS variable for other components to use
    document.documentElement.style.setProperty('--offline-banner-height', `${height}px`)

    return () => {
      document.documentElement.style.setProperty('--offline-banner-height', '0px')
    }
  }, [isOnline, showReconnected, showFullText, isAnimatingOut])

  // Show reconnected message
  if (showReconnected) {
    return (
      <>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white shadow-lg transition-all duration-300"
          role="status"
          aria-live="polite"
          data-testid="offline-reconnected"
          style={{
            animation: isAnimatingOut ? 'fadeOut 0.3s ease-out forwards' : 'slideDown 0.3s ease-out'
          }}
        >
          <div className="w-full px-4 py-2 flex items-center justify-center gap-2">
            <Wifi className="w-4 h-4" />
            <p className="text-sm font-medium">Connection restored</p>
          </div>
        </div>
        <style>{`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeOut {
            from {
              opacity: 1;
              transform: translateY(0);
            }
            to {
              opacity: 0;
              transform: translateY(-100%);
            }
          }
        `}</style>
      </>
    )
  }

  // Show offline message
  if (!isOnline) {
    return (
      <>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-orange-600 text-white shadow-lg transition-all duration-300 ease-in-out overflow-hidden"
          role="alert"
          aria-live="assertive"
          data-testid="offline-indicator"
          style={{
            animation: 'slideDown 0.3s ease-out'
          }}
        >
          <div
            className="w-full px-4 transition-all duration-300 ease-in-out"
            style={{
              paddingTop: showFullText ? '0.375rem' : '0rem',
              paddingBottom: showFullText ? '0.375rem' : '0rem'
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <WifiOff
                className="transition-all duration-300 ease-in-out flex-shrink-0"
                style={{
                  width: showFullText ? '1rem' : '0.875rem',
                  height: showFullText ? '1rem' : '0.875rem'
                }}
              />
              {showFullText ? (
                <div className="text-center">
                  <p className="font-semibold text-sm">You're offline</p>
                  <p className="text-xs text-orange-100">
                    You can still query the database if it's cached locally
                  </p>
                </div>
              ) : (
                <span className="text-xs font-medium">
                  Offline
                </span>
              )}
            </div>
          </div>
        </div>
        <style>{`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </>
    )
  }

  return null
}
