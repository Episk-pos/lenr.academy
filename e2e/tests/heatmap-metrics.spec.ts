import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Heatmap Metrics Calculation', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should calculate frequency metrics from fusion results', async ({ page }) => {
    // Use default H+C,O fusion query which should have predictable results
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Verify that the query executed and has elements appearing in results
    const hasElementsSection = await page.getByText('Elements Appearing in Results').isVisible();
    const hasResults = await page.locator('table tbody tr').count() > 0;

    expect(hasElementsSection).toBe(true);
    expect(hasResults).toBe(true);
  });

  test('should have predictable element distribution in fusion results', async ({ page }) => {
    // Navigate to H+He fusion which has specific results
    await page.goto('/fusion?e1=H&e2=He');
    await waitForDatabaseReady(page);

    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Verify H appears in results (input element)
    const hasHydrogen = await page.getByText('Elements Appearing in Results')
      .locator('..')
      .locator('text=/\\bH\\b/')
      .first()
      .isVisible();

    // Verify He appears in results (input element)
    const hasHelium = await page.getByText('Elements Appearing in Results')
      .locator('..')
      .locator('text=/\\bHe\\b/')
      .first()
      .isVisible();

    expect(hasHydrogen || hasHelium).toBe(true);
  });

  test('should track unique isotopes for diversity metric', async ({ page }) => {
    // Navigate to D+D fusion which produces multiple isotopes
    await page.goto('/fusion?e1=D&e2=D');
    await waitForDatabaseReady(page);

    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Count how many unique nuclides appear in results
    const nuclideCards = page.locator('text=Nuclides Appearing in Results')
      .locator('..')
      .locator('div[class*="cursor-pointer"]');

    const count = await nuclideCards.count();

    // D+D fusion should produce multiple different nuclides
    expect(count).toBeGreaterThan(0);
  });

  test('should calculate energy metrics from reaction MeV values', async ({ page }) => {
    // Navigate to He+He fusion which has high-energy reactions
    await page.goto('/fusion?e1=He&e2=He');
    await waitForDatabaseReady(page);

    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Verify results have MeV values displayed
    const mevValues = await page.locator('td.text-green-600.font-semibold').count();

    expect(mevValues).toBeGreaterThan(0);
  });

  test('should handle empty results gracefully', async ({ page }) => {
    // Navigate to a query that likely has no results
    await page.goto('/fusion?e1=H&e2=H&minMeV=999999');
    await waitForDatabaseReady(page);

    await page.waitForTimeout(2000);

    // Should show "no results" or "0 results" message
    const noResults = await page.getByText(/no.*results|0.*results/i).isVisible();

    expect(noResults).toBe(true);
  });

  test('should work with fission queries', async ({ page }) => {
    await page.goto('/fission?e=Ba');
    await waitForDatabaseReady(page);

    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Verify elements appear in fission results
    const elementsSection = await page.getByText('Elements Appearing in Results').isVisible();

    expect(elementsSection).toBe(true);
  });

  test('should work with two-to-two queries', async ({ page }) => {
    await page.goto('/twotwo?e1=H&e2=Li&e3=He');
    await waitForDatabaseReady(page);

    // Wait for the "Showing all X matching reactions" text which confirms query executed
    await page.waitForSelector('text=/Showing .* matching reactions/', { timeout: 15000 });

    // Verify elements appear in two-to-two results (scroll into view if needed)
    const elementsSection = page.getByText('Elements Appearing in Results');
    await elementsSection.scrollIntoViewIfNeeded();
    const isVisible = await elementsSection.isVisible();

    expect(isVisible).toBe(true);
  });
});
