import { test, expect, type Page } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
} from '../fixtures/test-helpers';

// Ra-224 and its daughters (Rn-220 ... Tl-208) only exist in the RadioNuclides
// table (no NuclidesPlus row), so /element-data renders the limited-data card.

async function ensureLimitedDataEnabled(page: Page) {
  const toggle = page.getByRole('switch', { name: /Include limited-data nuclides/i });
  if (await toggle.isVisible() && await toggle.isEnabled() && (await toggle.getAttribute('aria-checked')) !== 'true') {
    await toggle.click();
  }
}

test.describe('Decay Chain - limited-data nuclides', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
  });

  test('shows the decay chain for Ra-224 and navigates to an out-of-table daughter', async ({ page }) => {
    await page.goto('/element-data?Z=88&A=224');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
    await ensureLimitedDataEnabled(page);

    await expect(page.getByRole('heading', { name: /Ra-224/i })).toBeVisible();
    await expect(page.getByText(/Limited Data Available/i)).toBeVisible();

    const section = page.getByTestId('decay-chain-section').filter({ visible: true });
    await expect(section).toBeVisible();
    await expect(section.getByText('Decay Chain Visualization')).toBeVisible();

    await section.getByRole('button', { name: /Expand decay chain/i }).click();
    // Default controls (depth 5): Ra-224 -> ... -> Bi-212 -> Po-212 | Tl-208
    await expect(section.getByText('Bi-212', { exact: true })).toBeVisible();
    await expect(section.getByText('Tl-208', { exact: true })).toBeVisible();

    // Pb-212 is also limited-data: clicking its node opens its limited-data card
    await section.getByText('Pb-212', { exact: true }).click();
    await expect(page).toHaveURL(/Z=82&A=212/);
    await expect(page.getByRole('heading', { name: /Pb-212/i })).toBeVisible();
    await expect(page.getByText(/Limited Data Available/i)).toBeVisible();
    await expect(page.getByTestId('decay-chain-section').filter({ visible: true })).toBeVisible();
  });
});
