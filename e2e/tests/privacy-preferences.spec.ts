import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  clearAllStorage
} from '../fixtures/test-helpers';

test.describe('Privacy Preferences Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
  });

  test('should navigate to privacy preferences from sidebar', async ({ page }) => {
    await page.reload();
   await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Dismiss analytics banner if visible to prevent overlay on sidebar links
    const analyticsBanner = page.locator('[data-testid="analytics-banner"]');
    if (await analyticsBanner.isVisible({ timeout: 1000 }).catch(() => false)) {
      await analyticsBanner.getByRole('button', { name: /opt out/i }).click();
      await analyticsBanner.waitFor({ state: 'hidden' });
    }

    // Click privacy settings link in sidebar - use first() to avoid strict mode issues
    const privacyLink = page.getByRole('link', { name: /privacy settings/i }).first();
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();

    // Should be on privacy page
    await expect(page).toHaveURL('/privacy');
    await expect(page.getByRole('heading', { name: /privacy settings/i })).toBeVisible();
  });

  test('should be accessible via direct URL', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByRole('heading', { name: /privacy settings/i })).toBeVisible();
  });

  test('should show "No Preference Set" when no choice made', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByText(/no preference set/i)).toBeVisible();
  });

  test('should show "Analytics Enabled" when consent is accepted', async ({ page }) => {
    // Set consent to accepted
    await page.evaluate(() => {
      localStorage.setItem('lenr-analytics-consent', 'accepted');
    });

    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByText(/analytics enabled/i)).toBeVisible();
  });

  test('should show "Analytics Disabled" when consent is declined', async ({ page }) => {
    // Set consent to declined
    await page.evaluate(() => {
      localStorage.setItem('lenr-analytics-consent', 'declined');
    });

    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByText(/analytics disabled/i)).toBeVisible();
  });

  test('should allow enabling analytics', async ({ page }) => {
    // Start with declined
    await page.evaluate(() => {
      localStorage.setItem('lenr-analytics-consent', 'declined');
    });

    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Click enable button
    const enableButton = page.getByRole('button', { name: /enable analytics/i });
    await enableButton.click();

    // Should show confirmation
    await expect(page.getByText(/your.*preference has been saved/i)).toBeVisible();

    // Should NOT show reload message (analytics loads dynamically now)
    await expect(page.getByText(/to apply your error reporting changes.*reload/i)).not.toBeVisible();

    // Check localStorage was updated
    const consent = await page.evaluate(() => {
      return localStorage.getItem('lenr-analytics-consent');
    });
    expect(consent).toBe('accepted');
  });

  test('should allow disabling analytics', async ({ page }) => {
    // Start with accepted
    await page.evaluate(() => {
      localStorage.setItem('lenr-analytics-consent', 'accepted');
    });

    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Click disable button
    const disableButton = page.getByRole('button', { name: /disable analytics/i });
    await disableButton.click();

    // Should show confirmation
    await expect(page.getByText(/your.*preference has been saved/i)).toBeVisible();

    // Check localStorage was updated
    const consent = await page.evaluate(() => {
      return localStorage.getItem('lenr-analytics-consent');
    });
    expect(consent).toBe('declined');
  });

  test('should reload page when clicking reload button (error reporting only)', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Enable error reporting to trigger reload message
    const enableErrorReportingButton = page.getByRole('button', { name: /enable error reporting/i });
    await enableErrorReportingButton.click();

    // Click reload button
    const reloadButton = page.getByRole('button', { name: /reload page now/i });
    await expect(reloadButton).toBeVisible();

    // Listen for navigation
    const navigationPromise = page.waitForNavigation();
    await reloadButton.click();
    await navigationPromise;

    // Should be back on privacy page
    await expect(page).toHaveURL('/privacy');
  });

  test('should persist preference across page reloads', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Enable analytics
    await page.getByRole('button', { name: /enable analytics/i }).click();

    // Reload page
    await page.reload();
    await waitForDatabaseReady(page);

    // Should still show enabled
    await expect(page.getByText(/analytics enabled/i)).toBeVisible();
  });

  test('should load Umami script dynamically after enabling analytics (no reload needed)', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Skip test if running on dev server (analytics disabled in development)
    const url = page.url()
    const isDev = url.includes(':5173')
    if (isDev) {
      test.skip(true, 'Analytics loading is disabled in development mode')
    }

    // Verify Umami script is NOT loaded yet
    let hasUmamiScript = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script => script.src.includes('umami'));
    });
    expect(hasUmamiScript).toBe(false);

    // Enable analytics
    await page.getByRole('button', { name: /enable analytics/i }).click();

    // Wait a moment for script loading
    await page.waitForTimeout(1000);

    // Check if Umami script is loaded dynamically (no reload needed!)
    hasUmamiScript = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script => script.src.includes('umami'));
    });

    expect(hasUmamiScript).toBe(true);
  });

  test('should NOT load Umami script when analytics disabled', async ({ page }) => {
    // Set to declined
    await page.evaluate(() => {
      localStorage.setItem('lenr-analytics-consent', 'declined');
    });

    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Check that Umami script is NOT loaded
    const hasUmamiScript = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script => script.src.includes('umami'));
    });

    expect(hasUmamiScript).toBe(false);
  });

  test('should have proper button states (aria-pressed)', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    const enableButton = page.getByRole('button', { name: /enable analytics/i });
    const disableButton = page.getByRole('button', { name: /disable analytics/i });

    // Initially neither should be pressed
    await expect(enableButton).toHaveAttribute('aria-pressed', 'false');
    await expect(disableButton).toHaveAttribute('aria-pressed', 'false');

    // Click enable
    await enableButton.click();

    // Enable should be pressed, disable should not
    await expect(enableButton).toHaveAttribute('aria-pressed', 'true');
    await expect(disableButton).toHaveAttribute('aria-pressed', 'false');

    // Click disable
    await disableButton.click();

    // Disable should be pressed, enable should not
    await expect(enableButton).toHaveAttribute('aria-pressed', 'false');
    await expect(disableButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('should be keyboard accessible', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Get enable button and focus it
    const enableButton = page.getByRole('button', { name: /enable analytics/i });
    await enableButton.focus();

    // Press Enter or Space to activate
    await page.keyboard.press('Enter');

    // Should show confirmation
    await expect(page.getByText(/your.*preference has been saved/i)).toBeVisible();
  });

  test('should display information about Umami analytics', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Should mention Umami
    await expect(page.getByText(/umami analytics/i)).toBeVisible();

    // Should have link to Umami docs
    const umamiLink = page.getByRole('link', { name: /learn more about umami/i });
    await expect(umamiLink).toBeVisible();
    await expect(umamiLink).toHaveAttribute('href', 'https://umami.is/docs/about');
    await expect(umamiLink).toHaveAttribute('target', '_blank');
  });
});

test.describe('Privacy Preferences - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
  });

  test('should be accessible from mobile sidebar', async ({ page }) => {
    await page.reload();
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Dismiss privacy banner first to avoid click interception
    const privacyBannerDismiss = page.getByRole('button', { name: /accept|dismiss/i });
    if (await privacyBannerDismiss.isVisible({ timeout: 1000 }).catch(() => false)) {
      await privacyBannerDismiss.click();
    }

    // Open mobile menu
    const menuButton = page.getByRole('button', { name: /open menu/i });
    await menuButton.click();

    // Privacy Settings link is at the bottom of the sidebar, scroll to it
    const privacyLink = page.getByRole('link', { name: /privacy settings/i }).first();
    await privacyLink.scrollIntoViewIfNeeded();
    await expect(privacyLink).toBeVisible();
    await privacyLink.click();

    // Should be on privacy page
    await expect(page).toHaveURL('/privacy');
    await expect(page.getByRole('heading', { name: /privacy settings/i })).toBeVisible();
  });

  test('should work on mobile viewport', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Should be responsive
    await expect(page.getByRole('heading', { name: /privacy settings/i })).toBeVisible();

    // Should be able to toggle preference
    const enableButton = page.getByRole('button', { name: /enable analytics/i });
    await enableButton.click();

    await expect(page.getByText(/your.*preference has been saved/i)).toBeVisible();
  });
});

test.describe('Privacy Preferences - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
  });

  test('privacy page should not have accessibility violations', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Check for heading structure
    const h1 = page.getByRole('heading', { level: 1, name: /privacy settings/i });
    await expect(h1).toBeVisible();

    // Check for h2 headings
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(2); // Error Reporting, Analytics

    // Links should have visible text
    const umamiLink = page.getByRole('link', { name: /learn more about umami/i });
    await expect(umamiLink).toBeVisible();
  });

  test('buttons should have accessible names', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Enable/disable buttons should have clear names
    await expect(page.getByRole('button', { name: /enable analytics/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /disable analytics/i })).toBeVisible();
  });
});

test.describe('Privacy Banner - Dynamic Script Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
  });

  test('should load Umami script dynamically when accepting via banner (no reload)', async ({ page }) => {
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Skip test if running on dev server (analytics disabled in development)
    const url = page.url()
    const isDev = url.includes(':5173')
    if (isDev) {
      test.skip(true, 'Analytics loading is disabled in development mode')
    }

    // Banner should be visible
    const banner = page.locator('[data-testid="analytics-banner"]');
    await expect(banner).toBeVisible();

    // Verify Umami script is NOT loaded yet
    let hasUmamiScript = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script => script.src.includes('umami'));
    });
    expect(hasUmamiScript).toBe(false);

    // Accept analytics via banner
    const acceptButton = banner.getByRole('button', { name: /accept/i });
    await acceptButton.click();

    // Banner should disappear
    await expect(banner).not.toBeVisible();

    // Wait a moment for script loading
    await page.waitForTimeout(1000);

    // Check if Umami script is loaded dynamically (no reload!)
    hasUmamiScript = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.some(script => script.src.includes('umami'));
    });

    expect(hasUmamiScript).toBe(true);

    // Verify localStorage was updated
    const consent = await page.evaluate(() => {
      return localStorage.getItem('lenr-analytics-consent');
    });
    expect(consent).toBe('accepted');
  });

  test('should not reload page when accepting analytics via banner', async ({ page }) => {
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Get the current navigation entry count to detect page reload
    const initialTimestamp = await page.evaluate(() => performance.now());

    // Accept analytics via banner
    const banner = page.locator('[data-testid="analytics-banner"]');
    const acceptButton = banner.getByRole('button', { name: /accept/i });
    await acceptButton.click();

    // Wait a moment
    await page.waitForTimeout(500);

    // Check that page didn't reload (timestamp should be continuous)
    const currentTimestamp = await page.evaluate(() => performance.now());

    // If page reloaded, performance.now() would reset to near 0
    // If it didn't reload, it should be at least initialTimestamp + 500ms
    expect(currentTimestamp).toBeGreaterThan(initialTimestamp + 400);
  });
});
