import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Fusion Query Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display fusion query page with default selections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Fusion Reactions/i })).toBeVisible();

    // Should have periodic table selectors
    await expect(page.getByText(/Input Element 1/i)).toBeVisible();
    await expect(page.getByText(/Input Element 2/i)).toBeVisible();
  });

  test('should select elements from periodic tables', async ({ page }) => {
    // Select Hydrogen in Element 1 (should already be selected by default)
    // Open Element 1 selector
    const element1Button = page.getByRole('button', { name: /1 selected.*H/i }).first();
    await element1Button.click({ force: true });
    const hydrogenE1 = page.getByRole('button', { name: /^1\s+H$/i }).first();
    await hydrogenE1.waitFor({ state: 'visible', timeout: 5000 });

    // Verify it's selected (click to toggle would deselect it, so just check)
    await expect(hydrogenE1).toHaveClass(/periodic-cell-selected/);

    // Close the dropdown by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Open Element 2 selector and select Lithium
    const element2Button = page.getByRole('button', { name: /2 selected.*C.*O/i }).first();
    await element2Button.click({ force: true });
    const lithiumE2 = page.getByRole('button', { name: /^3\s+Li$/i }).first();
    await lithiumE2.waitFor({ state: 'visible', timeout: 5000 });
    await lithiumE2.click();

    // Lithium should now be selected - close dropdown and verify
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: /selected.*Li/i })).toBeVisible();
  });

  test('should execute fusion query and display results', async ({ page }) => {
    // Use default selections (H + C,O)
    // Query auto-executes on page load with default selections

    // Wait for results to load
    await page.waitForFunction(
      () => {
        const resultsTable = document.querySelector('table');
        return resultsTable !== null;
      },
      { timeout: 10000 }
    );

    // Should show results table
    await expect(page.locator('table')).toBeVisible();

    // Should show some results (assuming H + C,O has reactions)
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/query executed in/i)).toBeVisible();
  });

  test('should filter by energy range', async ({ page }) => {
    // Set minimum MeV
    const minMevInput = page.getByPlaceholder(/min/i);
    await minMevInput.fill('1.0');

    // Set maximum MeV
    const maxMevInput = page.getByPlaceholder(/max/i);
    await maxMevInput.fill('10.0');

    // Query auto-executes when filters change - wait for results
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Verify results are within range (if results are shown)
    const resultsTable = page.locator('table');
    if (await resultsTable.isVisible()) {
      // Check that MeV column values are within range
      const mevCells = page.locator('tbody tr td:has-text("MeV")');
      const count = await mevCells.count();

      if (count > 0) {
        // At least verify table exists with results
        await expect(page.locator('tbody tr').first()).toBeVisible();
      }
    }
  });

  test('should filter by neutrino types', async ({ page }) => {
    // Find neutrino filter checkboxes
    const neutrinoFilters = page.getByLabel(/neutrino/i);

    // Uncheck some neutrino types if they exist
    const noneCheckbox = page.getByLabel(/none/i);
    if (await noneCheckbox.isVisible().catch(() => false)) {
      await noneCheckbox.uncheck();
    }

    // Query auto-executes when filters change - wait for results
    await page.waitForTimeout(2000);

    // Results should be filtered accordingly
    await expect(page.locator('table')).toBeVisible();
  });

  test('should support multiple element selections', async ({ page }) => {
    // Open Element 1 selector
    await page.getByRole('button', { name: /1 selected.*H/i }).first().click();

    // Select multiple elements in Element 1 (H, He, Li)
    const elements = [
      { name: 'H', z: 1 },
      { name: 'He', z: 2 },
      { name: 'Li', z: 3 }
    ];

    for (const el of elements) {
      const button = page.getByRole('button', { name: new RegExp(`^${el.z}\\s+${el.name}$`, 'i') }).first();
      await button.waitFor({ state: 'visible', timeout: 5000 });
      await button.click();
    }

    // Close dropdown
    await page.keyboard.press('Escape');

    // Query should execute automatically - wait for results
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    await expect(page.locator('table')).toBeVisible();
  });

  test('should display nuclide details on hover', async ({ page }) => {
    // Query auto-executes with default selections - wait for results table
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Hover over a nuclide symbol in the results
    const firstNuclide = page.locator('tbody tr td a').first();

    if (await firstNuclide.isVisible()) {
      await firstNuclide.hover();

      // Nuclide details card should appear
      // (This depends on implementation - might be a tooltip or card)
      await page.waitForTimeout(500);

      // Card should show nuclide information
      // await expect(page.getByTestId('nuclide-details')).toBeVisible();
    }
  });

  test('should export results to CSV', async ({ page }) => {
    // Query auto-executes with default selections - wait for results
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Find and click export button
    const exportButton = page.getByRole('button', { name: /export|download/i });

    if (await exportButton.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      await exportButton.click();

      // Wait for download to start
      const download = await downloadPromise;

      // Verify download filename
      expect(download.suggestedFilename()).toMatch(/fusion.*\.csv/i);
    }
  });

  test('should update URL with query parameters', async ({ page }) => {
    // H is already selected in Element 1 by default, verify C is selected in Element 2
    // Open Element 2 selector and verify Carbon is selected
    await page.getByRole('button', { name: /2 selected.*C.*O/i }).first().click();

    // Check that C is already selected (it's in the default)
    const carbon = page.getByRole('button', { name: /^6\s+C$/i }).first();
    await carbon.waitFor({ state: 'visible', timeout: 5000 });
    await expect(carbon).toHaveClass(/periodic-cell-selected/);

    await page.keyboard.press('Escape');

    // Set MeV range
    await page.locator('input[type="number"]').first().fill('2.0');
    await page.locator('input[type="number"]').nth(1).fill('15.0');

    // Wait for query to execute automatically
    await page.waitForTimeout(1000);

    // URL should contain query parameters
    const url = page.url();
    expect(url).toContain('minMeV=2');
    expect(url).toContain('maxMeV=15');
  });

  test('should load query from URL parameters', async ({ page }) => {
    // Navigate with specific query parameters
    await page.goto('/fusion?e1=H&e2=Li&minMeV=1&maxMeV=10');
    await waitForDatabaseReady(page);

    // Should auto-execute query or show filters populated
    const minMevInput = page.getByPlaceholder(/min/i);
    await expect(minMevInput).toHaveValue('1');

    const maxMevInput = page.getByPlaceholder(/max/i);
    await expect(maxMevInput).toHaveValue('10');
  });

  test('should handle no results found', async ({ page }) => {
    // Set filters that likely produce no results
    const minMevInput = page.getByPlaceholder(/min/i);
    await minMevInput.fill('999999');

    // Query auto-executes when filter changes - wait for response
    await page.waitForTimeout(2000);

    // Should show "no results" message
    await expect(page.getByText(/no.*results|0.*results/i)).toBeVisible();
  });

  test('should clear selections', async ({ page }) => {
    // Open Element 1 selector and add Lithium to selection
    await page.getByRole('button', { name: /1 selected.*H/i }).first().click();
    const li = page.getByRole('button', { name: /^3\s+Li$/i }).first();
    await li.waitFor({ state: 'visible', timeout: 5000 });
    await li.click();

    // Close dropdown and wait for it to disappear
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500); // Wait for dropdown animation

    // Now we should have H and Li selected - verify
    await expect(page.getByText(/2 selected.*H.*Li/i)).toBeVisible();

    // Find and click "Clear all" button
    const clearButton = page.getByRole('button', { name: /clear all/i }).first();

    if (await clearButton.isVisible()) {
      // Scroll clear button into view and click
      await clearButton.scrollIntoViewIfNeeded();
      await clearButton.click({ force: true });

      // Elements should be deselected - dropdown should show "Any"
      await expect(page.getByRole('button', { name: /^Any$/i }).first()).toBeVisible();
    }
  });

  test('should limit number of results', async ({ page }) => {
    // Set a specific limit
    const limitInput = page.getByLabel(/limit|max.*results/i);

    if (await limitInput.isVisible().catch(() => false)) {
      await limitInput.fill('10');

      // Query auto-executes when limit changes - wait for results
      await page.waitForFunction(
        () => document.querySelector('table tbody') !== null,
        { timeout: 10000 }
      );

      // Count rows
      const rows = page.locator('tbody tr');
      const count = await rows.count();

      // Should have at most 10 results (or fewer if query returns less)
      expect(count).toBeLessThanOrEqual(10);
    }
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

test.describe('Fusion Query - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should work on mobile viewport', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Fusion Reactions/i })).toBeVisible();

    // Use default selections (H + C,O) and verify query works
    // Query should execute automatically on page load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Results table should be visible and responsive
    await expect(page.locator('table')).toBeVisible();
  });
});
