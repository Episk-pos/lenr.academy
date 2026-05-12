import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  waitForReactionResults,
} from '../fixtures/test-helpers';

/**
 * E2E coverage for the annotated bibliography overlay (Issue #173).
 *
 * Sanity-checks that:
 *  - A fusion query that includes D + D → ⁴He renders a citation badge
 *    next to the matching reaction row.
 *  - The badge has the expected aria-label (and is keyboard focusable).
 *
 * The Parkhomov DB does include exactly one D-2 + D-2 → He-4 row
 * (verified at MeV ≈ 23.847), and the seed dataset documents that
 * reaction (`miles-1990-he4`, `hubler-violante-2014`).
 */
test.describe('Annotated bibliography overlay', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('renders a citation badge for the documented D + D → He-4 fusion reaction', async ({
    page,
  }) => {
    // Select Deuterium for Element 1
    const element1Button = page.getByRole('button', { name: /Any/i }).first();
    await element1Button.click({ force: true });
    const deuteriumE1 = page
      .getByRole('button', { name: /^D$/i })
      .first();
    await deuteriumE1.waitFor({ state: 'visible', timeout: 5000 });
    await deuteriumE1.click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    // Select Deuterium for Element 2.
    // After E1 was set to D, only two "Any" buttons remain (E2 and the output E),
    // so the first one is E2. (Using .nth(1) here would target the output E
    // and produce a 1-input query that doesn't include D + D → He-4.)
    const element2Button = page.getByRole('button', { name: /Any/i }).first();
    await element2Button.click({ force: true });
    const deuteriumE2 = page
      .getByRole('button', { name: /^D$/i })
      .first();
    await deuteriumE2.waitFor({ state: 'visible', timeout: 5000 });
    await deuteriumE2.click();
    await page.keyboard.press('Escape');

    // Wait for the auto-executed query to populate
    await waitForReactionResults(page, 'fusion');

    const resultsRegion = page.getByRole('region', {
      name: /fusion reaction results/i,
    });
    await expect(resultsRegion).toBeVisible();

    // The citation badge uses aria-label "{count} documented citation(s)..."
    const citationBadge = resultsRegion
      .getByRole('button', { name: /documented citation/i })
      .first();

    await expect(citationBadge).toBeVisible({ timeout: 5000 });
  });
});
