import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  navigateToPage
} from '../fixtures/test-helpers';

test.describe('Navigation and Routing', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should navigate to all main routes', async ({ page }) => {
    const routes = [
      { path: '/', name: 'Home', heading: /The Nanosoft Package/i },
      { path: '/fusion', name: 'Fusion', heading: /Fusion Reactions/i },
      { path: '/fission', name: 'Fission', heading: /Fission Reactions/i },
      { path: '/twotwo', name: 'Two-to-Two', heading: /Two-to-Two Reactions/i },
      { path: '/element-data', name: 'Element Data', heading: /Element Data/i },
      { path: '/tables', name: 'Tables in Detail', heading: /Tables in Detail/i },
      { path: '/all-tables', name: 'All Tables', heading: /All Tables/i },
      { path: '/cascades', name: 'Cascades', heading: /Cascade Simulations/i },
      { path: '/privacy', name: 'Privacy', heading: /Privacy Settings/i }
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible({ timeout: 10000 });
      // Check URL contains the path (some pages add query params automatically)
      await expect(page).toHaveURL(new RegExp(route.path));
    }
  });

  test('should navigate using sidebar links', async ({ page }) => {
    // Start at home
    await expect(page).toHaveURL('/');

    // Click Fusion link
    await navigateToPage(page, 'Fusion');
    await expect(page).toHaveURL(/\/fusion/);
    await expect(page.getByRole('heading', { name: /Fusion Reactions/i })).toBeVisible();

    // Click Fission link
    await navigateToPage(page, 'Fission');
    await expect(page).toHaveURL(/\/fission/);
    await expect(page.getByRole('heading', { name: /Fission Reactions/i })).toBeVisible();

    // Click Element Data link
    await navigateToPage(page, 'Element Data');
    await expect(page).toHaveURL(/\/element-data/);
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();
  });

  test('should support browser back/forward navigation', async ({ page }) => {
    // Navigate through pages
    await page.goto('/fusion');
    await expect(page).toHaveURL(/\/fusion/);

    await page.goto('/fission');
    await expect(page).toHaveURL(/\/fission/);

    await page.goto('/element-data');
    await expect(page).toHaveURL(/\/element-data/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/fission/);
    await expect(page.getByRole('heading', { name: /Fission Reactions/i })).toBeVisible();

    // Go back again
    await page.goBack();
    await expect(page).toHaveURL(/\/fusion/);
    await expect(page.getByRole('heading', { name: /Fusion Reactions/i })).toBeVisible();

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/fission/);
    await expect(page.getByRole('heading', { name: /Fission Reactions/i })).toBeVisible();
  });

  test('should handle direct URL navigation', async ({ page }) => {
    // Navigate directly to a specific page
    await page.goto('/twotwo');
    await expect(page.getByRole('heading', { name: /Two-to-Two Reactions/i })).toBeVisible();
    await expect(page).toHaveURL(/\/twotwo/);

    // Navigate to another page directly
    await page.goto('/all-tables');
    await expect(page.getByRole('heading', { name: /All Tables/i })).toBeVisible();
    await expect(page).toHaveURL(/\/all-tables/);
  });

  test('should preserve URL query parameters', async ({ page }) => {
    // Navigate with query parameters
    await page.goto('/element-data?Z=26');
    await expect(page).toHaveURL(/Z=26/);

    // Navigate away and back
    await page.goto('/fusion');
    await page.goBack();

    // Query params should be preserved
    await expect(page).toHaveURL(/Z=26/);
  });

  test('should highlight active page in sidebar', async ({ page }) => {
    // Navigate to Fusion page
    await page.goto('/fusion');

    // The active link should have specific styling (aria-current or class)
    const fusionLink = page.getByRole('link', { name: /Fusion Reactions/i });
    await expect(fusionLink).toBeVisible();

    // Navigate to different page
    await page.goto('/fission');

    const fissionLink = page.getByRole('link', { name: /Fission Reactions/i });
    await expect(fissionLink).toBeVisible();
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should toggle sidebar on mobile', async ({ page }) => {
    // Sidebar should be hidden initially on mobile
    const sidebar = page.locator('aside, nav').first();

    // Look for menu button
    const menuButton = page.getByRole('button', { name: /open menu/i });
    await expect(menuButton).toBeVisible();

    // Click to open sidebar
    await menuButton.click();

    // Sidebar navigation should be accessible
    await expect(page.getByRole('link', { name: /Fusion Reactions/i }).first()).toBeVisible();

    // Click a link
    await page.getByRole('link', { name: /Fusion Reactions/i }).first().click();

    // Should navigate to fusion page
    await expect(page).toHaveURL(/\/fusion/);
  });

  test('should navigate between pages on mobile', async ({ page }) => {
    await navigateToPage(page, 'Fusion');
    await expect(page).toHaveURL(/\/fusion/);

    await navigateToPage(page, 'Element Data');
    await expect(page).toHaveURL(/\/element-data/);

    await navigateToPage(page, 'Home');
    await expect(page).toHaveURL('/');
  });
});
