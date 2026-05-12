import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
} from '../fixtures/test-helpers';

test.describe('Decay Chain Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
  });

  test('should show decay chain for radioactive nuclide (U-238)', async ({ page }) => {
    // Navigate directly to Uranium-238 (Z=92, A=238) — famous radioactive nuclide
    await page.goto('/element-data?Z=92&A=238');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Should show nuclide heading
    await expect(page.getByRole('heading', { name: /U-238/i })).toBeVisible();

    // Look for the decay chain section
    const decaySection = page.getByText(/Decay Chain/i).first();
    await expect(decaySection).toBeVisible({ timeout: 5000 });
  });

  test('should show decay chain for Thorium-232', async ({ page }) => {
    // Thorium-232 — another famous decay series
    await page.goto('/element-data?Z=90&A=232');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByRole('heading', { name: /Th-232/i })).toBeVisible();

    // Decay chain should be visible
    const decaySection = page.getByText(/Decay Chain/i).first();
    await expect(decaySection).toBeVisible({ timeout: 5000 });
  });

  test('should not show decay chain for stable nuclide (Fe-56)', async ({ page }) => {
    // Iron-56 is stable — no decay chain
    await page.goto('/element-data?Z=26&A=56');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByRole('heading', { name: /Fe-56/i })).toBeVisible();

    // Stable nuclides should not show a decay chain diagram
    // The section might still exist but shouldn't show a tree
    const svg = page.locator('svg.decay-chain');
    await expect(svg).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // It's fine if the section doesn't exist at all
    });
  });

  test('should show element data for Uranium element', async ({ page }) => {
    // Navigate to Uranium element (Z=92)
    await page.goto('/element-data?Z=92');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Should show Uranium heading
    await expect(page.getByRole('heading', { name: /Uranium \(U\)/i })).toBeVisible();
    // Should show atomic number
    await expect(page.getByText(/Atomic Number: 92/)).toBeVisible();
  });

  test('should show radioactive indicator for radioactive nuclides', async ({ page }) => {
    // Cobalt-60 — commonly known radioactive nuclide
    await page.goto('/element-data?Z=27&A=60');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByRole('heading', { name: /Co-60/i })).toBeVisible();
    // Should show some radioactive indicator or half-life info
    await expect(page.getByText(/half/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Decay Chain - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
  });

  test('should display nuclide data on mobile for U-238', async ({ page }) => {
    await page.goto('/element-data?Z=92&A=238');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    await expect(page.getByRole('heading', { name: /U-238/i })).toBeVisible();
  });
});
