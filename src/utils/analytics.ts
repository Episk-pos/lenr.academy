/**
 * Utility functions for managing analytics script loading
 */

const UMAMI_SCRIPT_SRC = 'https://cloud.umami.is/script.js'
const UMAMI_WEBSITE_ID = '916d0566-989b-47e1-9882-b06de40a1c95'

/**
 * Dynamically loads the Umami analytics script.
 * This allows enabling analytics without a page reload.
 *
 * @returns Promise that resolves when the script is loaded, or immediately if already loaded
 */
export function loadUmamiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src="${UMAMI_SCRIPT_SRC}"]`)
    if (existingScript) {
      console.log('[Analytics] Umami script already loaded')
      resolve()
      return
    }

    console.log('[Analytics] Loading Umami script dynamically...')

    // Create and inject the script
    const script = document.createElement('script')
    script.defer = true
    script.src = UMAMI_SCRIPT_SRC
    script.setAttribute('data-website-id', UMAMI_WEBSITE_ID)

    script.onload = () => {
      console.log('[Analytics] Umami script loaded successfully')
      resolve()
    }

    script.onerror = (error) => {
      console.error('[Analytics] Failed to load Umami script:', error)
      reject(new Error('Failed to load analytics script'))
    }

    document.head.appendChild(script)
  })
}

/**
 * Check if Umami script is currently loaded
 */
export function isUmamiLoaded(): boolean {
  return !!document.querySelector(`script[src="${UMAMI_SCRIPT_SRC}"]`)
}
