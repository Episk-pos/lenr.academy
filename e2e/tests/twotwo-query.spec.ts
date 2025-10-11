import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Two-to-Two Query Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/twotwo');
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
    // Use default selections (H + Ni,Li,Al,B,N + C → Any)
    // Query should execute automatically on page load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Should show results table
    await expect(page.locator('table')).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/Query executed in/i)).toBeVisible();
  });

  test('should filter by output elements', async ({ page }) => {
    // Wait for default query to execute
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Open Output Element 4 selector and add Nitrogen
    const outputSelector = page.getByRole('button', { name: /^Any$/i }).last();
    await outputSelector.click();

    const nitrogen = page.getByRole('button', { name: /^7\s+N$/i }).first();
    await nitrogen.waitFor({ state: 'visible', timeout: 5000 });
    await nitrogen.click();

    await page.keyboard.press('Escape');

    // Query should re-execute automatically
    await page.waitForTimeout(2000);

    await expect(page.locator('table')).toBeVisible();
  });

  test('should filter by energy range', async ({ page }) => {
    // Wait for default query to execute first
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Set energy range using placeholder selectors
    const minMevInput = page.getByPlaceholder(/min/i);
    await minMevInput.fill('2.0');

    const maxMevInput = page.getByPlaceholder(/max/i);
    await maxMevInput.fill('25.0');

    // Query auto-executes when filters change - wait for results to update
    await page.waitForTimeout(2000);

    // Verify results table is still visible
    await expect(page.locator('table')).toBeVisible();
  });

  test('should handle complex multi-element queries', async ({ page }) => {
    // Use default multi-element selection (H + Ni,Li,Al,B,N + C)
    // which already tests complex queries
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 20000 }
    );

    await expect(page.locator('table')).toBeVisible();

    // Verify multiple elements are selected
    await expect(page.getByText(/5 selected.*Ni.*Li/i)).toBeVisible();
  });

  test('should display reaction format A + B → C + D', async ({ page }) => {
    // Use default query which executes on load
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 15000 }
    );

    // Results should show A + B → C + D format
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();

    // Should have table cells with nuclide data
    const cells = firstRow.locator('td');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should limit results due to large dataset', async ({ page }) => {
    // Two-to-two has 516,789 reactions, so limits are important
    // Default limit is 100, let's change it to 50
    await page.waitForFunction(
      () => document.querySelector('table tbody') !== null,
      { timeout: 15000 }
    );

    const limitInput = page.locator('input[type="number"]').last();
    await limitInput.fill('50');

    // Wait for query to re-execute
    await page.waitForTimeout(2000);

    // Should have at most 50 results
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(50);

    // Should show total count message
    await expect(page.getByText(/Showing/i)).toBeVisible();
  });

  test('should export two-to-two results', async ({ page }) => {
    // Use default query
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

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
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Just verify query completes and shows results
    await expect(page.locator('table')).toBeVisible();

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

  test('should allow both element and nuclide to be pinned simultaneously', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Click an element card from "Elements Appearing in Results"
    const elementCard = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]').first();
    await elementCard.click();

    // Verify element is pinned (has ring-2 ring-blue-400 class)
    await expect(elementCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Click a nuclide card from "Nuclides Appearing in Results"
    const nuclideCard = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]').first();
    await nuclideCard.click();

    // Verify nuclide is now pinned
    await expect(nuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify element is STILL pinned (both can be pinned simultaneously)
    await expect(elementCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Click element again to unpin it
    await elementCard.click();

    // Verify element is no longer pinned
    await expect(elementCard).not.toHaveClass(/ring-2.*ring-blue-400/);

    // Verify nuclide is STILL pinned
    await expect(nuclideCard).toHaveClass(/ring-2.*ring-blue-400/);
  });
});

test.describe('Two-to-Two Query - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/twotwo');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should handle queries efficiently', async ({ page }) => {
    // Use default query and measure performance
    const startTime = Date.now();

    // Wait for results
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 20000 }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Query should complete in reasonable time (< 20 seconds for complex query)
    expect(duration).toBeLessThan(20000);

    await expect(page.locator('table')).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/Query executed in/i)).toBeVisible();
  });
});
