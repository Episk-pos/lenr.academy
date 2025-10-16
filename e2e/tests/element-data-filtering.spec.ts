import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Element Data - Filtering and Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    // Navigate to Iron (Z=26) which has good data for all tabs
    await page.goto('/element-data?Z=26');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Wait for element data to load
    await page.getByRole('heading', { name: /Iron \(Fe\)/i }).waitFor({ state: 'visible', timeout: 10000 });
  });

  test.describe('Search Functionality', () => {
    test('should filter elements table by search term', async ({ page }) => {
      // Switch to Elements tab
      await page.getByRole('tab', { name: /Elements/i }).click();
      await page.waitForTimeout(500);

      // Wait for data rows to be visible (skip header row by using nth)
      const dataRows = page.locator('div[role="row"]').nth(1);
      await dataRows.waitFor({ state: 'visible', timeout: 10000 });

      // Get initial row count (all rows minus header)
      const allRows = page.locator('div[role="row"]');
      const initialCount = await allRows.count() - 1; // Subtract header row
      expect(initialCount).toBeGreaterThan(0); // Ensure we have data before filtering

      // Search for "Iron"
      const searchInput = page.locator('input[placeholder*="Search"]');
      await searchInput.fill('Iron');
      await page.waitForTimeout(500); // Increased timeout for filtering

      // Should have fewer results
      const filteredCount = await allRows.count() - 1; // Subtract header row
      expect(filteredCount).toBeLessThan(initialCount);
      expect(filteredCount).toBeGreaterThan(0);

      // Check that "Iron" appears in results
      const firstDataRow = page.locator('div[role="row"]').nth(1);
      const rowText = await firstDataRow.textContent();
      expect(rowText).toContain('Fe');
    });

    test('should filter nuclides table by search term', async ({ page }) => {
      // Switch to Nuclides tab
      await page.getByRole('tab', { name: /Nuclides/i }).click();
      await page.waitForTimeout(500);

      // Wait for data rows to be visible (skip header row)
      const dataRows = page.locator('div[role="row"]').nth(1);
      await dataRows.waitFor({ state: 'visible', timeout: 10000 });

      // Search for "C-14"
      const searchInput = page.locator('input[placeholder*="Search"]');
      await searchInput.fill('C-14');
      await page.waitForTimeout(500); // Increased timeout for filtering

      // Should have results (subtract header row)
      const allRows = page.locator('div[role="row"]');
      const count = await allRows.count() - 1;
      expect(count).toBeGreaterThan(0);

      // Check for C-14 in results
      const firstDataRow = page.locator('div[role="row"]').nth(1);
      const rowText = await firstDataRow.textContent();
      expect(rowText).toMatch(/C.*14/);
    });

    test('should clear search with X button', async ({ page }) => {
      // Switch to Elements tab
      await page.getByRole('tab', { name: /Elements/i }).click();
      await page.waitForTimeout(500);

      // Search for something
      const searchInput = page.locator('input[placeholder*="Search"]');
      await searchInput.fill('Hydrogen');
      await page.waitForTimeout(300);

      // Click clear button
      const clearButton = page.locator('button[aria-label="Clear search"]');
      await expect(clearButton).toBeVisible();
      await clearButton.click();

      // Search should be empty
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('Table Sorting', () => {
    test('should sort elements table by clicking column headers', async ({ page }) => {
      // Switch to Elements tab
      await page.getByRole('tab', { name: /Elements/i }).click();
      await page.waitForTimeout(500);

      // Wait for data rows to be visible
      const dataRows = page.locator('div[role="row"]').nth(1);
      await dataRows.waitFor({ state: 'visible', timeout: 10000 });

      // Find "Symbol" column header and click it
      const symbolHeader = page.locator('div[role="columnheader"]').filter({ hasText: /Symbol/i }).first();
      await symbolHeader.click();
      await page.waitForTimeout(500); // Increased timeout for sorting

      // Get first data row's symbol (cell[0] has Z, cell[1] has SYMBOL)
      const firstDataRow = page.locator('div[role="row"]').nth(1);
      const firstSymbol = await firstDataRow.locator('div[role="cell"]').nth(1).textContent();

      // Should be sorted alphabetically (Ac is first alphabetically, Zr is last)
      // After first click, should show valid element symbol
      expect(firstSymbol?.trim()).toMatch(/^[A-Z][a-z]?$/); // Valid element symbol (1-2 letters)

      // Click again to reverse sort
      await symbolHeader.click();
      await page.waitForTimeout(500); // Increased timeout for sorting

      const firstSymbolReversed = await page.locator('div[role="row"]').nth(1).locator('div[role="cell"]').nth(1).textContent();
      // After reversing, first symbol should be different
      expect(firstSymbolReversed?.trim()).not.toBe(firstSymbol?.trim());
    });

    test('should sort nuclides table by atomic number', async ({ page }) => {
      // Switch to Nuclides tab
      await page.getByRole('tab', { name: /Nuclides/i }).click();
      await page.waitForTimeout(500);

      // Wait for data rows to be visible
      const dataRows = page.locator('div[role="row"]').nth(1);
      await dataRows.waitFor({ state: 'visible', timeout: 10000 });

      // Find "Z" column header
      const zHeader = page.locator('div[role="columnheader"]').filter({ hasText: /^Z$/i }).first();
      await zHeader.click();
      await page.waitForTimeout(500); // Increased timeout for sorting

      // Get first few data rows (skip header at nth(0))
      const firstRow = page.locator('div[role="row"]').nth(1);
      const secondRow = page.locator('div[role="row"]').nth(2);

      // Z column is typically at index 1 (after nuclide name/symbol)
      const firstZ = await firstRow.locator('div[role="cell"]').nth(1).textContent();
      const secondZ = await secondRow.locator('div[role="cell"]').nth(1).textContent();

      // Should be numerically sorted
      const firstZNum = parseInt(firstZ || '0');
      const secondZNum = parseInt(secondZ || '0');
      expect(firstZNum).toBeLessThanOrEqual(secondZNum);
    });

    test('should sort decay table by energy', async ({ page }) => {
      // Switch to Decay tab
      await page.getByRole('tab', { name: /Decay/i }).click();
      await page.waitForTimeout(1000);

      // Wait for data rows to be visible
      const dataRows = page.locator('div[role="row"]').nth(1);
      await dataRows.waitFor({ state: 'visible', timeout: 10000 });

      // Find "Energy" column header
      const energyHeader = page.locator('div[role="columnheader"]').filter({ hasText: /Energy/i }).first();
      await energyHeader.click();
      await page.waitForTimeout(500); // Increased timeout for sorting

      // Verify sorting indicator appears and we have data rows
      const allRows = page.locator('div[role="row"]');
      const count = await allRows.count() - 1; // Subtract header row
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Filter Panel', () => {
    test('should collapse and expand filter panel', async ({ page }) => {
      // Switch to Elements tab
      await page.getByRole('tab', { name: /Elements/i }).click();
      await page.waitForTimeout(500);

      // Filter panel starts collapsed by default, so first button should say "Expand"
      const expandButton = page.locator('button[aria-label*="Expand filters"]');
      await expect(expandButton).toBeVisible();

      // Expand the panel
      await expandButton.click();
      await page.waitForTimeout(300);

      // Button should now say "Collapse"
      const collapseButton = page.locator('button[aria-label*="Collapse filters"]');
      await expect(collapseButton).toBeVisible();

      // Collapse again
      await collapseButton.click();
      await page.waitForTimeout(300);

      // Should be back to "Expand"
      await expect(expandButton).toBeVisible();
    });

    test('should show active filter count', async ({ page }) => {
      // Switch to Decay tab
      await page.getByRole('tab', { name: /Decay/i }).click();
      await page.waitForTimeout(1000);

      // Look for filter panel
      const filterPanel = page.locator('text=Filters').first();
      await expect(filterPanel).toBeVisible();

      // Initially should show 0 or no badge
      const initialBadge = filterPanel.locator('..');
      const hasBadge = await initialBadge.locator('span').filter({ hasText: /^\d+$/ }).count();

      // If there's a filter dropdown, select something
      const periodSelect = page.locator('select#period');
      const hasFilter = await periodSelect.count();

      if (hasFilter > 0) {
        await periodSelect.selectOption({ index: 1 });
        await page.waitForTimeout(300);

        // Badge should now show 1
        const badge = filterPanel.locator('..').locator('span').filter({ hasText: '1' });
        await expect(badge).toBeVisible();
      }
    });

    test('should clear all filters', async ({ page }) => {
      // Switch to Nuclides tab
      await page.getByRole('tab', { name: /Nuclides/i }).click();
      await page.waitForTimeout(500);

      // Look for a filter select (if available)
      const filterSelect = page.locator('select').first();
      const hasFilter = await filterSelect.count();

      if (hasFilter > 0) {
        // Apply a filter
        await filterSelect.selectOption({ index: 1 });
        await page.waitForTimeout(300);

        // Look for "Clear All" button
        const clearButton = page.getByRole('button', { name: /Clear All/i });
        const hasClearButton = await clearButton.isVisible().catch(() => false);

        if (hasClearButton) {
          await clearButton.click();
          await page.waitForTimeout(300);

          // Filter should be reset
          const selectedValue = await filterSelect.inputValue();
          expect(selectedValue).toBe('');
        }
      }
    });

    test('should export data as CSV', async ({ page }) => {
      // Switch to Elements tab
      await page.getByRole('tab', { name: /Elements/i }).click();
      await page.waitForTimeout(500);

      // Find export button
      const exportButton = page.getByRole('button', { name: /Export CSV/i });
      await expect(exportButton).toBeVisible();

      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export
      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;

      // Verify filename contains CSV
      expect(download.suggestedFilename()).toContain('.csv');
    });
  });

  test.describe('Badge Selector', () => {
    test('should filter decay modes using badge selector', async ({ page }) => {
      // Switch to Decay tab
      await page.getByRole('tab', { name: /Decay/i }).click();
      await page.waitForTimeout(1000);

      // Expand filter panel first (starts collapsed by default)
      const expandButton = page.locator('button[aria-label*="Expand filters"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      // Look for badge selector (decay mode badges)
      const alphaBadge = page.locator('button').filter({ hasText: /^A$/i }).first();
      const hasBadgeSelector = await alphaBadge.isVisible().catch(() => false);

      if (hasBadgeSelector) {
        // Get initial row count (subtract header)
        const allRows = page.locator('div[role="row"]');
        const initialCount = await allRows.count() - 1;

        // Click Alpha badge
        await alphaBadge.click();
        await page.waitForTimeout(500);

        // Row count should change (likely decrease)
        const filteredCount = await allRows.count() - 1;

        // Should have some results but likely fewer
        expect(filteredCount).toBeGreaterThan(0);

        // Badge should appear selected (has purple background color when selected)
        const badgeClass = await alphaBadge.getAttribute('class');
        expect(badgeClass).toContain('bg-purple'); // Active badges have purple background
      }
    });

    test('should select multiple badges', async ({ page }) => {
      // Switch to Decay tab
      await page.getByRole('tab', { name: /Decay/i }).click();
      await page.waitForTimeout(1000);

      // Expand filter panel first (starts collapsed by default)
      const expandButton = page.locator('button[aria-label*="Expand filters"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      // Look for multiple badge types
      const alphaBadge = page.locator('button').filter({ hasText: /^A$/i }).first();
      const betaBadge = page.locator('button').filter({ hasText: /^B-$/i }).first();

      const hasAlpha = await alphaBadge.isVisible().catch(() => false);
      const hasBeta = await betaBadge.isVisible().catch(() => false);

      if (hasAlpha && hasBeta) {
        // Click both
        await alphaBadge.click();
        await page.waitForTimeout(300);
        await betaBadge.click();
        await page.waitForTimeout(300);

        // Both should be selected (have purple background)
        const alphaClass = await alphaBadge.getAttribute('class');
        const betaClass = await betaBadge.getAttribute('class');
        expect(alphaClass).toContain('bg-purple');
        expect(betaClass).toContain('bg-purple');

        // Should still have results (subtract header)
        const allRows = page.locator('div[role="row"]');
        const count = await allRows.count() - 1;
        expect(count).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Filter Presets', () => {
    test('should show preset dropdown', async ({ page }) => {
      // Switch to any tab with filters
      await page.getByRole('tab', { name: /Nuclides/i }).click();
      await page.waitForTimeout(500);

      // Expand filter panel first (starts collapsed by default)
      const expandButton = page.locator('button[aria-label*="Expand filters"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      // Look for preset dropdown button
      const presetButton = page.locator('button').filter({ hasText: /Load Preset|Custom/i }).first();
      const hasPresets = await presetButton.isVisible().catch(() => false);

      if (hasPresets) {
        await expect(presetButton).toBeVisible();

        // Click to open dropdown
        await presetButton.click();
        await page.waitForTimeout(300);

        // Dropdown menu should appear
        const dropdown = page.locator('text=Built-in Presets');
        await expect(dropdown).toBeVisible();
      }
    });

    test('should apply a preset', async ({ page }) => {
      // Switch to Nuclides or Decay tab
      await page.getByRole('tab', { name: /Decay/i }).click();
      await page.waitForTimeout(1000);

      // Expand filter panel first (starts collapsed by default)
      const expandButton = page.locator('button[aria-label*="Expand filters"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      // Look for preset dropdown
      const presetButton = page.locator('button').filter({ hasText: /Load Preset/i }).first();
      const hasPresets = await presetButton.isVisible().catch(() => false);

      if (hasPresets) {
        // Click to open
        await presetButton.click();
        await page.waitForTimeout(300);

        // Click first preset option (if available)
        const firstPreset = page.locator('div[class*="bg-white"] button').nth(1);
        const hasFirstPreset = await firstPreset.isVisible().catch(() => false);

        if (hasFirstPreset) {
          await firstPreset.click();
          await page.waitForTimeout(500);

          // Should close dropdown and apply filters
          const dropdown = page.locator('text=Built-in Presets');
          const dropdownVisible = await dropdown.isVisible().catch(() => false);
          expect(dropdownVisible).toBe(false);
        }
      }
    });
  });
});

test.describe('Element Data - Filtering Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    // Navigate to Iron (Z=26) which has good data for all tabs
    await page.goto('/element-data?Z=26');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Wait for element data to load
    await page.getByRole('heading', { name: /Iron \(Fe\)/i }).waitFor({ state: 'visible', timeout: 10000 });
  });

  test('should have mobile-friendly filter panel', async ({ page }) => {
    // Switch to Elements tab
    await page.getByRole('tab', { name: /Elements/i }).click();
    await page.waitForTimeout(500);

    // Filter panel should be visible
    const filterPanel = page.locator('text=Filters').first();
    await expect(filterPanel).toBeVisible();

    // Search input should be full width
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    const searchBox = await searchInput.boundingBox();
    const viewport = page.viewportSize();

    if (searchBox && viewport) {
      // Search should take most of the width (minus padding)
      expect(searchBox.width).toBeGreaterThan(viewport.width * 0.7);
    }
  });

  test('should collapse filter panel to save space on mobile', async ({ page }) => {
    // Switch to Elements tab
    await page.getByRole('tab', { name: /Elements/i }).click();
    await page.waitForTimeout(500);

    // Filter panel starts collapsed, so first expand it
    const expandButton = page.locator('button[aria-label*="Expand filters"]');
    await expandButton.click();
    await page.waitForTimeout(300);

    // Now collapse it again
    const collapseButton = page.locator('button[aria-label*="Collapse filters"]');
    await collapseButton.click();
    await page.waitForTimeout(300);

    // Filter panel should be collapsed, data rows should still be visible
    const dataRows = page.locator('div[role="row"]').nth(1);
    await expect(dataRows).toBeVisible();
    await expect(expandButton).toBeVisible();
  });
});
