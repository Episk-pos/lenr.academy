import { test, expect } from '@playwright/test';
import {
  acceptPrivacyConsent,
  acceptMeteredWarningIfPresent,
  waitForDatabaseReady,
} from '../fixtures/test-helpers';

const MOCK_VERSION = 'v9.9.9-test';
const MOCK_BUILD_TIME = '2025-01-01T12:00:00.000Z';
const MOCK_RELEASE_RESPONSE = {
  name: 'v9.9.9-test Release',
  tag_name: MOCK_VERSION,
  body: '## Added\n- Amazing new feature',
  published_at: '2025-01-01T12:00:00.000Z',
  html_url: 'https://github.com/Episk-pos/lenr.academy/releases/tag/v9.9.9-test',
};

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

    await page.route('**/repos/Episk-pos/lenr.academy/releases/tags/**', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(MOCK_RELEASE_RESPONSE),
      });
    });

    await page.route('**/repos/Episk-pos/lenr.academy/releases?*', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([MOCK_RELEASE_RESPONSE]),
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

  test('can open changelog modal from the app update banner', async ({ page }) => {
    const banner = page.getByTestId('app-update-banner');
    await expect(banner).toBeVisible();

    const changelogButton = banner.getByRole('button', { name: /view what's new/i });
    await expect(changelogButton).toBeVisible();
    await changelogButton.click();

    const modal = page.getByTestId('changelog-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Amazing new feature');

    await modal.getByRole('button', { name: /close changelog/i }).click({ timeout: 5000 });
    await expect(modal).toBeHidden();
  });
});
