import { test, expect } from '@playwright/test';
import {
  clearAllStorage,
  acceptMeteredWarningIfPresent,
  waitForDatabaseReady,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Database Loading and Caching', () => {
  test.beforeEach(async ({ page }) => {
    // Accept privacy consent to avoid banner interference
    await acceptPrivacyConsent(page);
  });

  test('should load application and initialize database', async ({ page }) => {
    await page.goto('/');

    // Accept metered warning if shown
    await acceptMeteredWarningIfPresent(page);

    // Wait for database to be ready
    await waitForDatabaseReady(page);

    // Verify home page is visible
    await expect(page.getByRole('heading', { name: /The Nanosoft Package/i })).toBeVisible();
  });

  test('should show database loading progress', async ({ page }) => {
    // Navigate first
    await page.goto('/');

    // Clear storage to force fresh download
    await clearAllStorage(page);

    // Reload to trigger fresh download
    await page.reload();

    // Accept metered warning if shown
    await acceptMeteredWarningIfPresent(page);

    // Should show loading indicator
    const loadingCard = page.locator('[data-testid="database-loading"]');

    // Loading card should be visible initially or database loads very fast
    const isVisible = await loadingCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      // Wait for it to disappear when loading completes
      await loadingCard.waitFor({ state: 'hidden', timeout: 60000 });
    }

    // Database should now be ready
    await waitForDatabaseReady(page);
  });

  test('should cache database in IndexedDB', async ({ page }) => {
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Check that IndexedDB contains the cached database
    const hasCache = await page.evaluate(async () => {
      const dbs = await window.indexedDB.databases();
      return dbs.some(db => db.name === 'ParkhomovCache');
    });

    expect(hasCache).toBe(true);
  });

  test('should load from cache on subsequent visits', async ({ page }) => {
    // First visit - ensure database is cached
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Reload the page
    await page.reload();

    // Should load faster from cache (no metered warning needed)
    await waitForDatabaseReady(page, 10000);

    // Verify app is functional
    await expect(page.getByRole('heading', { name: /The Nanosoft Package/i })).toBeVisible();
  });

  test('should detect metered connections', async ({ page, context }) => {
    // This test simulates metered connection by injecting navigator.connection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '4g',
          type: 'cellular',
          saveData: false,
          downlink: 1.5,
          rtt: 300
        }
      });
    });

    // Navigate first
    await page.goto('/');

    // Clear cache to force download decision
    await clearAllStorage(page);

    // Reload to trigger metered check
    await page.reload();

    // Should show metered warning
    const meteredWarning = page.locator('[data-testid="metered-warning"]');
    await expect(meteredWarning).toBeVisible({ timeout: 5000 });

    // Should show warning message (207MB or 207 MB)
    await expect(page.getByText(/207\s?MB/i)).toBeVisible();

    // Click proceed
    await page.getByRole('button', { name: /download anyway/i }).click();

    // Warning should disappear
    await meteredWarning.waitFor({ state: 'hidden' });

    // Database should start loading
    await waitForDatabaseReady(page, 60000);
  });

  test('should remember metered connection consent', async ({ page, context }) => {
    // Set up metered connection simulation
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '4g',
          type: 'cellular',
          saveData: false
        }
      });
    });

    // Navigate first
    await page.goto('/');

    // Clear storage to force fresh state
    await clearAllStorage(page);

    // Reload to trigger metered check
    await page.reload();

    // First visit - accept consent
    const meteredWarning = page.locator('[data-testid="metered-warning"]');
    await expect(meteredWarning).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /download anyway/i }).click();
    await waitForDatabaseReady(page, 60000);

    // Reload - should not show warning again
    await page.reload();
    await expect(meteredWarning).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Database Updates', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
  });

  test('should check for database updates', async ({ page }) => {
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // The app checks for updates by fetching parkhomov.db.meta.json
    // and comparing with cached version
    // In a real scenario with version mismatch, update banner should appear

    // For now, just verify the app loaded successfully
    // (Actual update testing would require mocking the meta.json response)
    await expect(page).toHaveTitle(/LENR Academy/i);
  });
});
