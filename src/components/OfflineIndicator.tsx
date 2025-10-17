import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

/**
 * Offline Indicator Component
 *
 * Shows a banner when the user loses internet connection.
 * Informs users they can still query the database offline (if cached).
 */
export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      console.log('[PWA] Connection restored')
      setIsOnline(true)

      // Show reconnected message briefly
      if (wasOffline) {
        setShowReconnected(true)
        setTimeout(() => {
          setShowReconnected(false)
          setWasOffline(false)
        }, 3000)
      }
    }

    const handleOffline = () => {
      console.log('[PWA] Connection lost')
      setIsOnline(false)
      setWasOffline(true)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  // Show reconnected message
  if (showReconnected) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white shadow-lg"
        role="status"
        aria-live="polite"
        data-testid="offline-reconnected"
      >
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4" />
          <p className="text-sm font-medium">Connection restored</p>
        </div>
      </div>
    )
  }

  // Show offline message
  if (!isOnline) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-orange-600 text-white shadow-lg"
        role="alert"
        aria-live="assertive"
        data-testid="offline-indicator"
      >
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="w-5 h-5" />
            <div className="text-center">
              <p className="font-semibold text-sm">You're offline</p>
              <p className="text-xs text-orange-100">
                You can still query the database if it's cached locally
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
