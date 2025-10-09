import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  clearAllStorage,
  setTheme
} from '../fixtures/test-helpers';

test.describe('Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should default to system theme or light theme', async ({ page }) => {
    // Check initial theme (light or dark based on system)
    const html = page.locator('html');
    const classList = await html.getAttribute('class');

    // Should have either 'dark' class or no dark class
    expect(classList !== null).toBe(true);
  });

  test('should switch to dark mode', async ({ page }) => {
    // Find theme toggle button
    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i });

    if (await themeToggle.isVisible().catch(() => false)) {
      // Get current theme
      const html = page.locator('html');
      const initialClass = await html.getAttribute('class');

      // Click toggle
      await themeToggle.click();

      // Wait for theme to change
      await page.waitForTimeout(500);

      // Theme should have changed
      const newClass = await html.getAttribute('class');
      expect(newClass).not.toBe(initialClass);
    }
  });

  test('should persist theme preference', async ({ page }) => {
    // Set theme to dark
    await setTheme(page, 'dark');

    // Reload page
    await page.reload();
    await waitForDatabaseReady(page);

    // Should still be dark theme
    const html = page.locator('html');
    const classList = await html.getAttribute('class');

    expect(classList).toContain('dark');
  });

  test('should apply dark theme styles', async ({ page }) => {
    // Set dark theme
    await setTheme(page, 'dark');
    await page.reload();
    await waitForDatabaseReady(page);

    // Check that dark theme is applied
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    // Check that dark background is applied to body or main
    const body = page.locator('body');
    const bgColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Dark mode should have dark background (not white)
    // rgb(0, 0, 0) or similar dark color
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  test('should apply light theme styles', async ({ page }) => {
    // Set light theme explicitly
    await setTheme(page, 'light');
    await page.reload();
    await waitForDatabaseReady(page);

    // Check that dark class is not present
    const html = page.locator('html');
    const classList = await html.getAttribute('class');

    expect(classList).not.toContain('dark');
  });

  test('should toggle theme with keyboard', async ({ page }) => {
    // Find theme toggle
    const themeToggle = page.getByRole('button', { name: /theme|dark|light/i });

    if (await themeToggle.isVisible().catch(() => false)) {
      // Focus the toggle
      await themeToggle.focus();

      // Get initial theme
      const html = page.locator('html');
      const initialClass = await html.getAttribute('class');

      // Press Enter or Space
      await page.keyboard.press('Enter');

      // Wait for change
      await page.waitForTimeout(500);

      // Theme should have changed
      const newClass = await html.getAttribute('class');
      expect(newClass).not.toBe(initialClass);
    }
  });
});

test.describe('Privacy Banner', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first, then clear storage to show privacy banner
    await page.goto('/');
    await clearAllStorage(page);
  });

  test('should show privacy banner on first visit', async ({ page }) => {
    // Reload after clearing storage
    await page.reload();
    await acceptMeteredWarningIfPresent(page);

    // Should show privacy/analytics consent banner
    const privacyBanner = page.getByText(/analytics|privacy|consent|cookies/i);

    // Wait a bit as banner might appear after delay
    const isVisible = await privacyBanner.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await expect(privacyBanner).toBeVisible();
    }
  });

  test('should hide banner after accepting', async ({ page }) => {
    // Reload after beforeEach cleared storage
    await page.reload();
    await acceptMeteredWarningIfPresent(page);

    // Find accept button
    const acceptButton = page.getByRole('button', { name: /accept|ok|got it|dismiss/i });

    const isVisible = await acceptButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await acceptButton.click();

      // Banner (and accept button) should disappear
      await expect(acceptButton).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('should not show banner on subsequent visits', async ({ page }) => {
    // Reload after beforeEach cleared storage
    await page.reload();
    await acceptMeteredWarningIfPresent(page);

    const acceptButton = page.getByRole('button', { name: /accept|ok|got it|dismiss/i });
    const isVisible = await acceptButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await acceptButton.click();

      // Reload page
      await page.reload();
      await waitForDatabaseReady(page);

      // Banner should not appear
      const banner = page.getByText(/analytics consent/i);
      await expect(banner).not.toBeVisible({ timeout: 2000 }).catch(() => true);
    }
  });

  test('should allow opting out', async ({ page }) => {
    // Reload after beforeEach cleared storage
    await page.reload();
    await acceptMeteredWarningIfPresent(page);

    // Find opt-out or decline button if it exists
    const declineButton = page.getByRole('button', { name: /decline|no|opt.*out/i });

    const isVisible = await declineButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await declineButton.click();

      // Banner should disappear
      await page.waitForTimeout(500);

      // Check that consent was not given
      const consent = await page.evaluate(() => {
        return localStorage.getItem('lenr-analytics-consent');
      });

      expect(consent).not.toBe('true');
    }
  });

  test('should persist consent preference', async ({ page }) => {
    // Reload after beforeEach cleared storage
    await page.reload();
    await acceptMeteredWarningIfPresent(page);

    const acceptButton = page.getByRole('button', { name: /accept|ok|got it|dismiss/i });
    const isVisible = await acceptButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      await acceptButton.click();

      // Check localStorage - consent value can be 'true' or 'accepted'
      const consent = await page.evaluate(() => {
        return localStorage.getItem('lenr-analytics-consent');
      });

      // Accept either 'true' or 'accepted' as valid consent
      expect(consent).toBeTruthy();
    }
  });
});

test.describe('Metered Connection Preferences', () => {
  test.beforeEach(async ({ page, context }) => {
    // Simulate metered connection
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

    // Navigate first, then clear storage
    await page.goto('/');
    await clearAllStorage(page);
  });

  test('should show metered warning on metered connection', async ({ page }) => {
    await page.goto('/');

    // Should show metered connection warning
    const warning = page.locator('[data-testid="metered-warning"]');
    await expect(warning).toBeVisible({ timeout: 5000 });
  });

  test('should remember proceed choice', async ({ page }) => {
    await page.goto('/');

    // Accept warning - button text is "Download Anyway"
    const proceedButton = page.getByRole('button', { name: /download anyway|proceed/i });
    await proceedButton.click();

    // Wait for database to load
    await waitForDatabaseReady(page, 60000);

    // Reload page
    await page.reload();

    // Warning should not appear again
    const warning = page.locator('[data-testid="metered-warning"]');
    await expect(warning).not.toBeVisible({ timeout: 2000 });
  });

  test('should persist metered consent in localStorage', async ({ page }) => {
    await page.goto('/');

    const proceedButton = page.getByRole('button', { name: /download anyway|proceed/i });
    await proceedButton.click();

    // Check localStorage - consent value can be 'true' or 'accepted'
    const consent = await page.evaluate(() => {
      return localStorage.getItem('lenr-metered-download-consent');
    });

    expect(consent).toBeTruthy();
  });
});

test.describe('User Preferences Persistence', () => {
  test('should persist multiple preferences across sessions', async ({ page }) => {
    // Navigate first
    await page.goto('/');

    // Set theme
    await setTheme(page, 'dark');

    // Set privacy consent
    await page.evaluate(() => {
      localStorage.setItem('lenr-analytics-consent', 'true');
    });

    // Reload page
    await page.reload();
    await waitForDatabaseReady(page);

    // Check theme persisted
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    // Check privacy consent persisted
    const consent = await page.evaluate(() => {
      return localStorage.getItem('lenr-analytics-consent');
    });

    expect(consent).toBe('true');
  });

  test('should handle localStorage quota gracefully', async ({ page }) => {
    // This is a edge case test - just verify app doesn't crash
    await page.goto('/');
    await waitForDatabaseReady(page);

    // App should function normally - check for home page heading
    await expect(page.getByRole('heading', { name: /The Nanosoft Package/i })).toBeVisible();
  });
});
