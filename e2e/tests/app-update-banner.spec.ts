import { test, expect } from '@playwright/test';
import {
  acceptPrivacyConsent,
  acceptMeteredWarningIfPresent,
  waitForDatabaseReady,
} from '../fixtures/test-helpers';

const MOCK_VERSION = 'v9.9.9-test';
const MOCK_BUILD_TIME = '2025-01-01T12:00:00.000Z';

test.describe('App Update Banner', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);

    await page.route('**/version.json', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          version: MOCK_VERSION,
          buildTime: MOCK_BUILD_TIME,
        }),
      });
    });

    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('shows banner when a new version is available and refresh button triggers reload', async ({ page }) => {
    const banner = page.getByTestId('app-update-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('App update available');
    await expect(banner).toContainText(MOCK_VERSION);
    await expect(banner).toContainText('Deployed');
    await expect(page.getByTestId('database-update-banner')).toHaveCount(0);

    await Promise.all([
      page.waitForNavigation(),
      banner.getByRole('button', { name: /refresh now/i }).click(),
    ]);

    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
    await expect(page.getByTestId('app-update-banner')).toBeVisible();
    await expect(page.getByTestId('database-update-banner')).toHaveCount(0);
  });

  test('allows dismissing the banner and keeps it hidden for the session', async ({ page }) => {
    const banner = page.getByTestId('app-update-banner');
    await expect(banner).toBeVisible();

    await banner.getByRole('button', { name: /dismiss app update notification/i }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.getByTestId('database-update-banner')).toHaveCount(0);

    await page.reload();
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByTestId('app-update-banner')).toHaveCount(0);
  });
});
