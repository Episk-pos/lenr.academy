import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

// Extend Window interface for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_SNOOZED_KEY = 'lenr-pwa-install-snoozed-until'
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

/**
 * PWA Install Prompt Component
 *
 * Shows a banner prompting users to install the app on their device.
 * - Chrome/Edge: Uses beforeinstallprompt API
 * - iOS Safari: Shows manual installation instructions
 * - Dismissal snoozes for 7 days
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isSnoozed, setIsSnoozed] = useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)

  useEffect(() => {
    // Check if snoozed
    const snoozedUntil = localStorage.getItem(INSTALL_SNOOZED_KEY)
    if (snoozedUntil) {
      const snoozedUntilDate = new Date(snoozedUntil)
      if (new Date() < snoozedUntilDate) {
        setIsSnoozed(true)
        return
      } else {
        // Snooze period expired, clear the flag
        localStorage.removeItem(INSTALL_SNOOZED_KEY)
      }
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone ||
                      document.referrer.includes('android-app://')
    setIsStandalone(standalone)

    // Listen for beforeinstallprompt event (Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      console.log('[PWA] beforeinstallprompt event fired')
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice

      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt')
      } else {
        console.log('[PWA] User dismissed the install prompt')
      }

      setDeferredPrompt(null)
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error)
    }
  }

  const handleDismiss = () => {
    setIsAnimatingOut(true)

    // Wait for animation to complete before updating state
    setTimeout(() => {
      const snoozeUntil = new Date(Date.now() + SNOOZE_DURATION_MS)
      localStorage.setItem(INSTALL_SNOOZED_KEY, snoozeUntil.toISOString())
      setIsSnoozed(true)
      setIsAnimatingOut(false)
    }, 300) // Match animation duration
  }

  // Don't show if:
  // - Already installed
  // - User snoozed
  // - No install prompt available (iOS without manual prompt, or not supported)
  if (isStandalone || isSnoozed || (!deferredPrompt && !isIOS)) {
    return null
  }

  return (
    <>
      <div
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
        role="dialog"
        aria-label="Install app prompt"
        data-testid="pwa-install-prompt"
        style={{
          animation: isAnimatingOut ? 'slideDown 0.3s ease-out forwards' : 'slideUp 0.3s ease-out'
        }}
      >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
            {isIOS ? (
              <Smartphone className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            ) : (
              <Download className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Install LENR Academy
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Install the app for quick access and offline functionality
            </p>

            {isIOS ? (
              // iOS installation instructions
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-900/50 p-3 rounded">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  To install on iOS:
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Tap the Share button in Safari</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" in the top right</li>
                </ol>
              </div>
            ) : (
              // Chrome/Edge install button
              <button
                onClick={handleInstall}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                data-testid="pwa-install-button"
              >
                Install Now
              </button>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Dismiss install prompt"
            data-testid="pwa-install-dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(100%);
          }
        }
      `}</style>
    </>
  )
}
