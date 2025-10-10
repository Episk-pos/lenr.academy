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

    // Should show reload message
    await expect(page.getByText(/to apply your changes.*reload/i)).toBeVisible();

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

  test('should reload page when clicking reload button', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Enable analytics
    const enableButton = page.getByRole('button', { name: /enable analytics/i });
    await enableButton.click();

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

  test('should load Umami script after enabling analytics with reload', async ({ page }) => {
    await page.goto('/privacy');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Enable analytics
    await page.getByRole('button', { name: /enable analytics/i }).click();

    // Reload to trigger script loading
    await page.reload();
    await waitForDatabaseReady(page);

    // Check if Umami script is loaded
    const hasUmamiScript = await page.evaluate(() => {
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
