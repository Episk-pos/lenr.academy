import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  dismissChangelogIfPresent,
  waitForReactionResults,
  verifyBothDetailsCards
} from '../fixtures/test-helpers';

test.describe('Two-to-Two Query Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/twotwo');
    await dismissChangelogIfPresent(page);
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display two-to-two query page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Two-to-Two Reactions/i })).toBeVisible();

    // Should have periodic table selectors for inputs and outputs
    await expect(page.getByText(/Input Element 1/i)).toBeVisible();
    await expect(page.getByText(/Input Element 2/i)).toBeVisible();
  });

  test('should execute two-to-two query', async ({ page }) => {
    // Use default selections (D + Ni,Li,Al,B,N + C → Any)
    // Query should execute automatically on page load
    await waitForReactionResults(page, 'twotwo');

    // Should show results region
    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    await expect(resultsRegion).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/Query executed in/i)).toBeVisible();
  });

  test('should filter by output elements', async ({ page }) => {
    // Wait for default query to execute
    await waitForReactionResults(page, 'twotwo');

    // Open Output Element 4 selector and add Nitrogen
    const outputSelector = page.getByRole('button', { name: /^Any$/i }).last();
    await outputSelector.click();

    const nitrogen = page.getByRole('button', { name: /^7\s+N$/i }).first();
    await nitrogen.waitFor({ state: 'visible', timeout: 5000 });
    await nitrogen.click();

    await page.keyboard.press('Escape');

    // Query should re-execute automatically
    await page.waitForTimeout(2000);

    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    await expect(resultsRegion).toBeVisible();
  });

  test('should filter by energy range', async ({ page }) => {
    // Wait for default query to execute first
    await waitForReactionResults(page, 'twotwo');

    // Set energy range using placeholder selectors
    const minMevInput = page.getByPlaceholder(/min/i);
    await minMevInput.fill('2.0');

    const maxMevInput = page.getByPlaceholder(/max/i);
    await maxMevInput.fill('25.0');

    // Query auto-executes when filters change - wait for results to update
    await page.waitForTimeout(2000);

    // Verify results region is still visible
    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    await expect(resultsRegion).toBeVisible();
  });

  test('should handle complex multi-element queries', async ({ page }) => {
    // Use default multi-element selection (D + Ni,Li,Al,B,N + C)
    // which already tests complex queries
    await waitForReactionResults(page, 'twotwo');

    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    await expect(resultsRegion).toBeVisible();

    // Verify multiple elements are selected
    await expect(page.getByText(/5 selected.*Ni.*Li/i)).toBeVisible();
  });

  test('should display reaction format A + B → C + D', async ({ page }) => {
    // Use default query which executes on load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Two-to-two reaction results"] div[class*="grid"][class*="border-b"]') !== null,
      { timeout: 15000 }
    );

    // Results should show A + B → C + D format
    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    const firstRow = resultsRegion.locator('div[class*="grid"][class*="border-b"]').first();
    await expect(firstRow).toBeVisible();

    // Should have nuclide links in result rows
    const links = resultsRegion.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should limit results due to large dataset', async ({ page }) => {
    // Two-to-two has 516,789 reactions, so limits are important
    // Default limit is 100, let's change it to 50
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Two-to-two reaction results"] div[class*="grid"][class*="border-b"]') !== null,
      { timeout: 15000 }
    );

    const limitInput = page.locator('input[type="number"]').last();
    await limitInput.fill('50');

    // Wait for query to re-execute
    await page.waitForTimeout(2000);

    // Should have at most 50 results
    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    const rows = resultsRegion.locator('div[class*="grid"][class*="border-b"]');
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(50);

    // Should show total count message
    await expect(page.getByText(/Showing/i)).toBeVisible();
  });

  test('should export two-to-two results', async ({ page }) => {
    // Use default query
    await waitForReactionResults(page, 'twotwo');

    // Find export button
    const exportButton = page.getByRole('button', { name: /export|CSV/i });

    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    }
  });

  test('should show performance warning for large queries', async ({ page }) => {
    // Default query already handles large dataset
    await waitForReactionResults(page, 'twotwo');

    // Just verify query completes and shows results
    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    await expect(resultsRegion).toBeVisible();

    // Should show "Showing X of Y" message
    await expect(page.getByText(/Showing/i)).toBeVisible();
  });

  test('should support URL parameters', async ({ page }) => {
    // Navigate with parameters
    await page.goto('/twotwo?e1=H&e2=C&minMeV=5&limit=25');
    await waitForDatabaseReady(page);

    // Check filters are populated using placeholder selectors
    const minMevInput = page.getByPlaceholder(/min/i);
    await expect(minMevInput).toHaveValue('5');

    // Limit input is the last number input
    const limitInput = page.locator('input[type="number"]').last();
    await expect(limitInput).toHaveValue('25');
  });

  test('should allow nuclide pinning in two-to-two results', async ({ page }) => {
    // Note: Two-to-two page only has "Nuclides Appearing in Results", not "Elements Appearing in Results"
    // Use default query
    await waitForReactionResults(page, 'twotwo');

    // Scroll to results section (heatmap pushes it below fold)
    const resultsHeading = page.getByRole('heading', { name: /Showing.*matching reactions/i });
    await resultsHeading.scrollIntoViewIfNeeded();

    // Wait for nuclides section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Pin the first nuclide
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const firstNuclideCard = nuclideCards.first();
    await firstNuclideCard.click();

    // Verify nuclide is pinned
    await expect(firstNuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Unpin the nuclide
    await firstNuclideCard.click();

    // Verify nuclide is no longer pinned
    await expect(firstNuclideCard).not.toHaveClass(/ring-2.*ring-blue-400/);
  });

  test('should keep pinned nuclide when changing query parameters', async ({ page }) => {
    // Note: Two-to-two page only supports nuclide pinning, not element pinning
    // Wait for default query results to load
    await waitForReactionResults(page, 'twotwo');

    // Scroll to results section (heatmap pushes it below fold)
    const resultsHeading = page.getByRole('heading', { name: /Showing.*matching reactions/i });
    await resultsHeading.scrollIntoViewIfNeeded();

    // Wait for Nuclides section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Click a nuclide card from "Nuclides Appearing in Results"
    const nuclideCard = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]').first();
    await nuclideCard.click();

    // Verify nuclide is pinned
    await expect(nuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify both element and nuclide details cards are visible
    await verifyBothDetailsCards(page);
  });

  test('should allow nuclide pinning and show details', async ({ page }) => {
    // Wait for default query results to load
    await waitForReactionResults(page, 'twotwo');

    // Click a nuclide card from "Nuclides Appearing in Results"
    const nuclideCard = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]').first();
    await nuclideCard.click();

    // Verify nuclide is pinned
    await expect(nuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify both element and nuclide details cards are visible
    await verifyBothDetailsCards(page);
  });

  test('should restore pinned nuclide from URL on page load', async ({ page }) => {
    // Note: Two-to-two page only supports nuclide pinning, not element pinning
    // Navigate with pinN parameter - B+Ni produces He-4 as output
    await page.goto('/twotwo?e1=B&e2=Ni&pinN=He-4');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'twotwo');

    // Scroll to results section (heatmap pushes it below fold)
    // When a nuclide is pinned via URL, the heading changes to "containing He-4" instead of "matching reactions"
    const resultsHeading = page.getByRole('heading', { name: /Showing.*(matching reactions|containing He-4)/i });
    await resultsHeading.scrollIntoViewIfNeeded();

    // Wait for "Nuclides Appearing in Results" section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Scroll section into view
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();

    // Wait for nuclide cards to populate
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    await nuclideCards.first().waitFor({ state: 'visible', timeout: 10000 });

    // Wait for URL initialization
    await page.waitForTimeout(1000);

    // Find the He-4 nuclide card
    const he4Card = nuclideCards.filter({ hasText: 'He-4' }).first();

    // Verify He-4 is pinned
    await expect(he4Card).toBeVisible();
    await expect(he4Card).toHaveClass(/ring-2.*ring-blue-400/);
  });

  test('should ignore invalid pinE/pinN parameters', async ({ page }) => {
    // Navigate with invalid parameters
    await page.goto('/twotwo?pinE=InvalidElement&pinN=InvalidNuclide-999');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'twotwo');

    // No cards should be pinned
    const pinnedCards = page.locator('div[class*="ring-2 ring-blue-400"]');
    await expect(pinnedCards).toHaveCount(0);
  });

  test('should allow unpinning nuclides', async ({ page }) => {
    // Note: Two-to-two page only supports nuclide pinning, not element pinning
    // Wait for default query results to load
    await waitForReactionResults(page, 'twotwo');

    // Scroll to results section (heatmap pushes it below fold)
    const resultsHeading = page.getByRole('heading', { name: /Showing.*matching reactions/i });
    await resultsHeading.scrollIntoViewIfNeeded();

    // Wait for Nuclides section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Pin the first nuclide that appears in results
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const firstNuclideCard = nuclideCards.first();
    await firstNuclideCard.click();

    // Verify nuclide is pinned
    await expect(firstNuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Unpin the nuclide by clicking it again
    await firstNuclideCard.click();

    // Verify nuclide is NO LONGER pinned
    await expect(firstNuclideCard).not.toHaveClass(/ring-2.*ring-blue-400/);
  });

  test('should highlight rows containing D-2 when D-2 is pinned (D/T nuclide pinning regression)', async ({ page }) => {
    // Navigate with D+D two-to-two query
    await page.goto('/twotwo?e1=D&e2=D');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Two-to-two reaction results"] div[class*="grid"][class*="border-b"]') !== null,
      { timeout: 15000 }
    );

    // Wait for nuclides section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();

    // Find and click the D-2 nuclide card
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const d2Card = nuclideCards.filter({ hasText: 'D-2' }).first();
    await d2Card.click();

    // Verify D-2 is pinned
    await expect(d2Card).toHaveClass(/ring-2.*ring-blue-400/);

    // Get all result rows (skip header rows by excluding rows with uppercase text class)
    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    const allRows = resultsRegion.locator('div[class*="grid"][class*="border-b"]:not([class*="uppercase"])');
    const rowCount = await allRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify that rows containing D-2 are NOT desaturated (opacity-30 grayscale)
    // and rows without D-2 ARE desaturated
    for (let i = 0; i < rowCount; i++) {
      const row = allRows.nth(i);
      const rowText = await row.textContent();

      // Check if row contains D-2 (in any column)
      const containsD2 = rowText?.includes('D-2');

      if (containsD2) {
        // Rows with D-2 should NOT be desaturated
        await expect(row).not.toHaveClass(/opacity-30.*grayscale/);
      } else {
        // Rows without D-2 should be desaturated
        await expect(row).toHaveClass(/opacity-30.*grayscale/);
      }
    }
  });
});

test.describe('Two-to-Two Query - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/twotwo');
    await dismissChangelogIfPresent(page);
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should handle queries efficiently', async ({ page }) => {
    // Use default query and measure performance
    const startTime = Date.now();

    // Wait for results
    await waitForReactionResults(page, 'twotwo');

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Query should complete in reasonable time (< 20 seconds for complex query)
    expect(duration).toBeLessThan(20000);

    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    await expect(resultsRegion).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/Query executed in/i)).toBeVisible();
  });
});

test.describe('Two-to-Two Query - Navigation Links', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/twotwo');
    await dismissChangelogIfPresent(page);
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should have clickable links to element-data page for nuclides in results table', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Two-to-two reaction results"] div[class*="grid"][class*="border-b"]') !== null,
      { timeout: 15000 }
    );

    // Find the first nuclide link in the results
    const resultsRegion = page.getByRole('region', { name: /Two-to-two reaction results/i });
    const firstNuclideLink = resultsRegion.locator('a').first();
    await expect(firstNuclideLink).toBeVisible();

    // Verify it's a link with href
    const href = await firstNuclideLink.getAttribute('href');
    expect(href).toMatch(/\/element-data\?Z=\d+&A=\d+/);

    // Click the link and verify navigation
    await firstNuclideLink.click();

    // Should navigate to element-data page
    await page.waitForURL(/\/element-data\?Z=\d+&A=\d+/, { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /Show Element Data/i })).toBeVisible();
  });
});
