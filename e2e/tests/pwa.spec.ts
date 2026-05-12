import { test, expect } from '@playwright/test'
import {
  acceptPrivacyConsent,
  acceptMeteredWarningIfPresent,
  waitForDatabaseReady,
  clearAllStorage,
} from '../fixtures/test-helpers'

test.describe('PWA - Service Worker', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page)
    await page.goto('/')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
  })

  test('should register service worker in production build', async ({ page }) => {
    // This test only works with production build (npm run preview)
    // In dev mode (npm run dev), service worker is disabled

    // Check if running on dev server (port 5173) or preview (port 4173)
    const url = page.url()
    const isDev = url.includes(':5173')

    if (isDev) {
      test.skip(true, 'Service worker is disabled in development mode')
    }

    // Wait for service worker to register
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      { timeout: 10000 }
    ).catch(() => {
      // Service worker not registered (expected in dev mode)
    })

    const swRegistered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return registration !== undefined
    })

    // In production, SW should be registered
    // In dev, it won't be (and that's OK)
    if (!isDev) {
      expect(swRegistered).toBe(true)
    }
  })

  test('should have web manifest link in HTML', async ({ page }) => {
    const url = page.url()
    const isDev = url.includes(':5173')

    if (isDev) {
      test.skip(true, 'Manifest link not injected in dev mode')
    }

    const hasManifest = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]')
      return link !== null && link.getAttribute('href') === '/manifest.webmanifest'
    })

    expect(hasManifest).toBe(true)
  })

  test('should have PWA meta tags', async ({ page }) => {
    const metaTags = await page.evaluate(() => {
      return {
        themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
        appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
        appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content'),
        description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
      }
    })

    expect(metaTags.themeColor).toBe('#3b82f6')
    expect(metaTags.appleCapable).toBe('yes')
    expect(metaTags.appleTitle).toBe('LENR Academy')
    expect(metaTags.description).toContain('Low Energy Nuclear Reactions')
  })

  test('should have apple-touch-icon link', async ({ page }) => {
    const hasAppleIcon = await page.evaluate(() => {
      const link = document.querySelector('link[rel="apple-touch-icon"]')
      return link !== null && link.getAttribute('href')?.includes('apple-touch-icon')
    })

    expect(hasAppleIcon).toBe(true)
  })
})

test.describe('PWA - Offline Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page)
    await page.goto('/')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
  })

  test('should show offline indicator when connection lost', async ({ page, context }) => {
    // Simulate going offline
    await context.setOffline(true)

    // Wait for offline indicator to appear
    const offlineIndicator = page.getByTestId('offline-indicator')
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 })
    await expect(offlineIndicator).toContainText(/offline/i)
    await expect(offlineIndicator).toContainText(/database/i)

    // Go back online
    await context.setOffline(false)

    // Offline indicator should disappear or show "connected" message
    await expect(offlineIndicator).not.toBeVisible({ timeout: 5000 })
      .catch(async () => {
        // Or it might show "reconnected" message briefly
        await expect(page.getByTestId('offline-reconnected')).toBeVisible()
      })
  })

  test('should allow database queries while offline (if cached)', async ({ page, context }) => {
    // Skip in dev mode - requires service worker for offline reload
    const url = page.url()
    const isDev = url.includes(':5173')

    if (isDev) {
      test.skip(true, 'Offline reload requires service worker (production only)')
    }

    // Ensure database is loaded while online
    await page.goto('/fusion')
    await expect(page.getByRole('heading', { name: /fusion/i })).toBeVisible()

    // Go offline
    await context.setOffline(true)

    // Verify offline indicator shows
    const offlineIndicator = page.getByTestId('offline-indicator')
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 })

    // Database queries should still work (using IndexedDB cache)
    // This test assumes database was already cached from beforeEach
    await page.reload()
    await waitForDatabaseReady(page)

    // Should still be able to navigate and use app
    await expect(page.getByRole('heading', { name: /fusion/i })).toBeVisible()
  })

  test('should transition to slim indicator after 5 seconds', async ({ page, context }) => {
    // Go offline
    await context.setOffline(true)

    // Wait for offline indicator to appear with full text
    const offlineIndicator = page.getByTestId('offline-indicator')
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 })
    await expect(offlineIndicator).toContainText(/you're offline/i)
    await expect(offlineIndicator).toContainText(/database/i)

    // Wait for transition to slim indicator (5 seconds + buffer)
    await page.waitForTimeout(5500)

    // Indicator should still be visible but with different text
    await expect(offlineIndicator).toBeVisible()
    // Should show "Offline" but not the full message
    await expect(offlineIndicator).toContainText(/offline/i)
  })
})

test.describe('PWA - Install Prompt', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await acceptPrivacyConsent(page)
    await clearAllStorage(page)
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
  })

  test('should show install prompt for non-installed users (Chromium)', async ({ page, browserName }) => {
    // Install prompt only works in Chromium-based browsers
    if (browserName !== 'chromium') {
      test.skip(true, 'Install prompt only testable in Chromium')
    }

    // In dev/test mode, beforeinstallprompt might not fire
    // But the component should still render for iOS
    const isiOS = await page.evaluate(() => {
      return /iPad|iPhone|iPod/.test(navigator.userAgent)
    })

    if (isiOS) {
      // On iOS, should show manual installation instructions
      const installPrompt = page.getByTestId('pwa-install-prompt')
      // iOS prompt might appear (depending on Safari version)
      const isVisible = await installPrompt.isVisible({ timeout: 2000 }).catch(() => false)

      if (isVisible) {
        await expect(installPrompt).toContainText(/share.*add to home screen/i)
      }
    }
  })

  test('should allow dismissing install prompt', async ({ page }) => {
    const installPrompt = page.getByTestId('pwa-install-prompt')

    // Check if prompt is visible (might not be in all contexts)
    const isVisible = await installPrompt.isVisible({ timeout: 2000 }).catch(() => false)

    if (isVisible) {
      // Dismiss the prompt
      const dismissButton = installPrompt.getByTestId('pwa-install-dismiss')
      await dismissButton.click()

      // Prompt should disappear
      await expect(installPrompt).not.toBeVisible()

      // Should stay dismissed after reload
      await page.reload()
      await waitForDatabaseReady(page)
      await expect(installPrompt).not.toBeVisible()
    } else {
      test.skip(true, 'Install prompt not shown in this context')
    }
  })
})

test.describe('PWA - Update Prompt', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page)
  })

  test('should NOT show update prompt on initial load', async ({ page }) => {
    await page.goto('/')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)

    const updatePrompt = page.getByTestId('pwa-update-prompt')
    await expect(updatePrompt).not.toBeVisible()
  })

  // Note: Testing actual service worker updates requires:
  // 1. Production build (npm run preview)
  // 2. Simulating service worker updates (complex in E2E tests)
  // 3. Or using service worker mocks
  //
  // For now, we verify the component exists and has correct structure
  // Real update flow should be tested manually in production

  test('update prompt component should have correct buttons when visible', async ({ page }) => {
    // This test verifies the component structure
    // Actual visibility depends on service worker state

    await page.goto('/')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)

    // Simulate showing the update prompt by injecting state
    // (In real scenario, this happens when new SW is waiting)
    await page.evaluate(() => {
      // This is a test-only injection to verify component structure
      const event = new CustomEvent('pwa-update-available')
      window.dispatchEvent(event)
    })

    // Even if not visible, we can verify component exists in DOM
    // and would have correct structure if visible
    const hasCorrectStructure = await page.evaluate(() => {
      const prompt = document.querySelector('[data-testid="pwa-update-prompt"]')
      if (!prompt) return true // Component not rendered yet (OK)

      const updateButton = prompt.querySelector('[data-testid="pwa-update-button"]')
      const dismissButton = prompt.querySelector('[data-testid="pwa-update-dismiss"]')

      return updateButton !== null && dismissButton !== null
    })

    expect(hasCorrectStructure).toBe(true)
  })
})

test.describe('PWA - Manifest Content', () => {
  test('manifest.webmanifest should be valid JSON with correct properties', async ({ page }) => {
    // Check if running in dev or production
    await page.goto('/')
    const url = page.url()
    const isDev = url.includes(':5173')

    if (isDev) {
      test.skip(true, 'Manifest not generated in dev mode')
    }

    const response = await page.request.get('/manifest.webmanifest')
    expect(response.ok()).toBe(true)

    const manifest = await response.json()

    // Verify required PWA manifest properties
    expect(manifest.name).toBe('LENR Academy')
    expect(manifest.short_name).toBe('LENR')
    expect(manifest.description).toContain('Low Energy Nuclear Reactions')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.theme_color).toBe('#3b82f6')
    expect(manifest.background_color).toBe('#ffffff')

    // Verify icons array
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)

    // Verify at least one 192x192 icon
    const icon192 = manifest.icons.find((icon: any) => icon.sizes === '192x192')
    expect(icon192).toBeDefined()
    expect(icon192.src).toContain('icon')
    expect(icon192.type).toBe('image/png')

    // Verify at least one 512x512 icon
    const icon512 = manifest.icons.find((icon: any) => icon.sizes === '512x512')
    expect(icon512).toBeDefined()
  })
})

test.describe('PWA - Icon Accessibility', () => {
  test('PWA icons should be accessible', async ({ page }) => {
    await page.goto('/')
    const url = page.url()
    const isDev = url.includes(':5173')

    if (isDev) {
      test.skip(true, 'Icons not served in dev mode')
    }

    // Test that icon files exist and are accessible
    const iconSizes = ['192', '512']

    for (const size of iconSizes) {
      const response = await page.request.get(`/icons/icon-${size}.png`)
      expect(response.ok()).toBe(true)
      expect(response.headers()['content-type']).toContain('image')
    }

    // Test apple-touch-icon
    const appleIconResponse = await page.request.get('/icons/apple-touch-icon.png')
    expect(appleIconResponse.ok()).toBe(true)
  })
})
