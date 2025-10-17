import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

/**
 * PWA Update Prompt Component
 *
 * Shows a banner when a new service worker version is available.
 * Users can update immediately or dismiss to update later.
 */
export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('[PWA] Service worker registered:', registration)
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error)
    },
  })

  if (!needRefresh) return null

  const handleUpdate = () => {
    updateServiceWorker(true)
  }

  const handleDismiss = () => {
    setNeedRefresh(false)
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-lg"
      role="alert"
      data-testid="pwa-update-prompt"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <RefreshCw className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">New version available!</p>
            <p className="text-xs text-blue-100">
              Click update to get the latest features and improvements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
            data-testid="pwa-update-button"
          >
            Update Now
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            aria-label="Dismiss update notification"
            data-testid="pwa-update-dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
