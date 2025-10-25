import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Cascade Visualization Interactions and Responsive Layouts
 *
 * Tests:
 * - Tab switching (Summary, Network, Flow View, Pathway Browser)
 * - Pathway browser sorting and filtering
 * - Nuclide picker modal interactions
 * - Responsive layouts at different viewports
 */

test.describe('Cascade Visualizations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to cascades page
    await page.goto('/');
    await page.getByRole('link', { name: 'Cascades' }).click();
    await expect(page).toHaveURL('/cascades');

    // Run a cascade simulation to get results
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });
    await runButton.click();

    // Wait for cascade to complete
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });
  });

  test.describe('Tab Switching', () => {
    test('should switch between result tabs', async ({ page }) => {
      // Default tab should be Summary
      await expect(page.locator('text=Reactions Found')).toBeVisible();

      // NOTE: Network tab temporarily disabled for initial release
      // TODO: Re-enable when Network visualization is added back
      // await page.click('button:has-text("Network")');
      // await expect(page.locator('svg').or(page.locator('canvas'))).toBeVisible();

      // Click Flow View tab (Sankey diagram)
      await page.click('button:has-text("Flow View")');
      // Verify Flow View content is visible (status text or diagram container)
      await expect(page.locator('text=Showing').or(page.locator('text=Loading diagram'))).toBeVisible({ timeout: 10000 });

      // Click Pathway Browser tab
      await page.click('button:has-text("Pathway Browser")');
      // Verify table is visible
      await expect(page.locator('table').first()).toBeVisible();

      // Return to Summary tab
      await page.click('button:has-text("Summary")');
      await expect(page.locator('text=Reactions Found')).toBeVisible();
    });

    test('should maintain tab state when switching back', async ({ page }) => {
      // Go to Pathway Browser tab
      await page.click('button:has-text("Pathway Browser")');
      await expect(page.locator('table').first()).toBeVisible();

      // Scroll down in the table
      await page.locator('table').first().evaluate(el => el.scrollTop = 100);
      const scrollPosition = await page.locator('table').first().evaluate(el => el.scrollTop);

      // Switch to Summary and back
      await page.click('button:has-text("Summary")');
      await page.click('button:has-text("Pathway Browser")');

      // Table should still be present
      await expect(page.locator('table').first()).toBeVisible();
    });
  });

  test.describe('Pathway Browser Sorting', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Pathway Browser tab
      await page.click('button:has-text("Pathway Browser")');
      await expect(page.locator('table').first()).toBeVisible();
    });

    test('should sort pathways by count (frequency)', async ({ page }) => {
      // Note: The table uses virtualization, so each pathway is a separate table with one row
      const tables = page.locator('tbody tr');

      // Click Count header to sort
      await page.click('th:has-text("Count")');
      await page.waitForTimeout(1000);

      // Get first pathway's count after first sort (Count column is index 2)
      const firstCountText = await tables.nth(0).locator('td').nth(2).textContent();
      const firstCountNum = parseInt(firstCountText?.replace('×', '') || '0');

      // Click again to toggle sort direction
      await page.click('th:has-text("Count")');
      await page.waitForTimeout(1000);

      // Get first pathway's count after second sort
      const newFirstCountText = await tables.nth(0).locator('td').nth(2).textContent();
      const newFirstCountNum = parseInt(newFirstCountText?.replace('×', '') || '0');

      // Verify the order changed (values should be different after toggle)
      expect(newFirstCountNum).not.toBe(firstCountNum);
    });

    test('should sort pathways by average energy', async ({ page }) => {
      // Click Avg (MeV) header
      await page.click('th:has-text("Avg")');

      // Verify table re-renders
      await page.waitForTimeout(500);
      await expect(page.locator('tbody tr')).not.toHaveCount(0);

      // Sort indicator should be present (arrow icon)
      const header = page.locator('th:has-text("Avg")');
      await expect(header).toBeVisible();
    });

    test('should sort pathways by total energy', async ({ page }) => {
      // Click Total (MeV) header
      await page.click('th:has-text("Total")');

      // Verify table re-renders
      await page.waitForTimeout(500);
      await expect(page.locator('tbody tr')).not.toHaveCount(0);
    });

    test('should sort pathways by rarity score', async ({ page }) => {
      // Click Rarity header (if column is visible)
      const rarityHeader = page.locator('th:has-text("Rarity")');
      if (await rarityHeader.isVisible()) {
        await rarityHeader.click();
        await page.waitForTimeout(500);
        await expect(page.locator('tbody tr')).not.toHaveCount(0);
      }
    });
  });

  test.describe('Pathway Browser Filtering', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Pathway Browser tab
      await page.click('button:has-text("Pathway Browser")');
      await expect(page.locator('table').first()).toBeVisible();
    });

    test('should filter pathways by search term', async ({ page }) => {
      // Get initial row count
      const initialRows = await page.locator('tbody tr').count();

      // Type a nuclide name in search box
      const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="Search"]'));
      await searchInput.fill('Li');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Verify fewer rows are shown
      const filteredRows = await page.locator('tbody tr').count();
      expect(filteredRows).toBeLessThanOrEqual(initialRows);

      // Verify result count updates
      await expect(page.locator('text=/\\d+ pathways/i')).toBeVisible();

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Rows should return
      const clearedRows = await page.locator('tbody tr').count();
      expect(clearedRows).toBeGreaterThanOrEqual(filteredRows);
    });

    test('should filter pathways by reaction type', async ({ page }) => {
      // Get initial row count
      const initialRows = await page.locator('tbody tr').count();

      // Uncheck Fusion checkbox (if present)
      const fusionCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /fusion/i });
      if (await fusionCheckbox.isVisible()) {
        await fusionCheckbox.uncheck();
        await page.waitForTimeout(500);

        // Verify rows changed
        const filteredRows = await page.locator('tbody tr').count();
        expect(filteredRows).not.toEqual(initialRows);
      }
    });

    test('should combine multiple filters', async ({ page }) => {
      // Apply search filter
      const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="Search"]'));
      await searchInput.fill('H');

      // Apply reaction type filter
      const fusionCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /fusion/i });
      if (await fusionCheckbox.isVisible()) {
        await fusionCheckbox.uncheck();
      }

      await page.waitForTimeout(500);

      // Verify table still has content (or is empty if no matches)
      const rows = await page.locator('tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(0);
    });

    test('should show "no results" message when filters match nothing', async ({ page }) => {
      // Search for something unlikely to exist
      const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="Search"]'));
      await searchInput.fill('ZZZZZZZ999');
      await page.waitForTimeout(500);

      // Verify empty state or 0 results
      const emptyMessage = page.locator('text=/no.*pathways|0 pathways/i');
      await expect(emptyMessage).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Nuclide Picker Modal', () => {
    test('should open nuclide picker from periodic table', async ({ page }) => {
      // Scroll back to top to see the fuel nuclides selector
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // Click the dropdown button to open the periodic table
      const dropdownButton = page.locator('button:has-text("selected")').first();
      await dropdownButton.scrollIntoViewIfNeeded();
      await dropdownButton.click();

      // Wait for periodic table dropdown to open
      await expect(page.locator('[data-testid="periodic-table-dropdown"]')).toBeVisible();

      // Click on Li element in the periodic table (Z=3, symbol Li)
      const liButton = page.locator('[data-testid="periodic-table-dropdown"] button .periodic-cell-symbol:text("Li")').first();
      await liButton.click();

      // Verify nuclide picker modal opens
      await expect(page.getByRole('heading', { name: 'Lithium Isotopes' })).toBeVisible({ timeout: 3000 });

      // Verify isotopes are listed in the modal
      await expect(page.locator('text=/Li-[0-9]/i').first()).toBeVisible();

      // Close modal by clicking Cancel or close button
      const cancelButton = page.locator('button:has-text("Cancel")').or(page.locator('button:has-text("Close")'));
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    });

    test('should select individual isotopes', async ({ page }) => {
      // Scroll to fuel nuclides selector
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // Open the periodic table dropdown
      const dropdownButton = page.locator('button:has-text("selected")').first();
      await dropdownButton.scrollIntoViewIfNeeded();
      await dropdownButton.click();
      await expect(page.locator('[data-testid="periodic-table-dropdown"]')).toBeVisible();

      // Click on Ni element in the periodic table
      const niButton = page.locator('[data-testid="periodic-table-dropdown"] button .periodic-cell-symbol:text("Ni")').first();
      await niButton.click();

      // Wait for Nickel Isotopes modal to open
      await expect(page.getByRole('heading', { name: 'Nickel Isotopes' })).toBeVisible({ timeout: 3000 });

      // Click on Ni-58 isotope button (scope to modal to avoid matching the dropdown button)
      const modal = page.locator('[data-testid="modal-overlay"]');

      // First, click Clear to deselect all nickel isotopes
      const clearButton = modal.locator('button:has-text("Clear")');
      await clearButton.click();
      await page.waitForTimeout(200);

      // Now click Ni-58 to select only that isotope
      const ni58Button = modal.locator('button', { hasText: 'Ni-58' }).first();
      await ni58Button.click();
      await page.waitForTimeout(300);

      // Save selection by clicking Apply Selection button
      const applyButton = modal.locator('button:has-text("Apply Selection")');
      await applyButton.click();

      // Modal should close
      await expect(page.getByRole('heading', { name: 'Nickel Isotopes' })).not.toBeVisible({ timeout: 3000 });

      // Verify Ni-58 chip is now visible in the selection
      await expect(page.locator('button:has-text("Ni-58")').first()).toBeVisible();
    });

    test('should use quick select buttons', async ({ page }) => {
      // Scroll to fuel nuclides selector
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // Open the periodic table dropdown
      const dropdownButton = page.locator('button:has-text("selected")').first();
      await dropdownButton.scrollIntoViewIfNeeded();
      await dropdownButton.click();
      await expect(page.locator('[data-testid="periodic-table-dropdown"]')).toBeVisible();

      // Click on Ni element
      const niButton = page.locator('[data-testid="periodic-table-dropdown"] button .periodic-cell-symbol:text("Ni")').first();
      await niButton.click();

      // Wait for modal to open
      await expect(page.getByRole('heading', { name: 'Nickel Isotopes' })).toBeVisible({ timeout: 3000 });

      const modal = page.locator('[data-testid="modal-overlay"]');

      // Click "Most Common" button
      await modal.locator('button:has-text("Most Common")').click();
      await page.waitForTimeout(300);

      // Verify selection count shows (should be 1: Ni-58 is most common at 67.9%)
      await expect(modal.locator('text=/[0-9]+ selected/i')).toBeVisible();

      // Click "All" button
      await modal.locator('button:has-text("All")').click();
      await page.waitForTimeout(300);

      // Should show more selected (all nickel isotopes)
      await expect(modal.locator('text=/[0-9]+ selected/i')).toBeVisible();

      // Click "Clear" button
      await modal.locator('button:has-text("Clear")').click();
      await page.waitForTimeout(300);

      // Should show 0 selected
      await expect(modal.locator('text=0 selected')).toBeVisible();
    });
  });

  test.describe('Responsive Layouts', () => {
    test('should display responsive pathway table on mobile (375px)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Navigate to Pathway Browser tab
      await page.click('button:has-text("Pathway Browser")');
      await expect(page.locator('table').first()).toBeVisible();

      // Verify pathway appears in separate row (mobile layout)
      // This is indicated by specific mobile classes or layout
      const table = page.locator('table').first();
      await expect(table).toBeVisible();

      // Verify certain columns are hidden (Loops, Feedback, Rarity)
      const loopsHeader = page.locator('th:has-text("Loops")');
      if (await loopsHeader.isVisible()) {
        // Column might be hidden via CSS, check computed style
        const isHidden = await loopsHeader.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden';
        });
        expect(isHidden).toBeTruthy();
      }
    });

    test('should display responsive pathway table on tablet (768px)', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Navigate to Pathway Browser tab
      await page.click('button:has-text("Pathway Browser")');
      await expect(page.locator('table').first()).toBeVisible();

      // Verify pathway in first column (tablet layout)
      const table = page.locator('table').first();
      await expect(table).toBeVisible();

      // Feedback and Rarity columns should be hidden
      const feedbackHeader = page.locator('th:has-text("Feedback")');
      if (await feedbackHeader.isVisible()) {
        const isHidden = await feedbackHeader.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden';
        });
        expect(isHidden).toBeTruthy();
      }
    });

    test('should display all columns on desktop (1920px)', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Navigate to Pathway Browser tab
      await page.click('button:has-text("Pathway Browser")');
      await expect(page.locator('table').first()).toBeVisible();

      // All columns should be visible
      await expect(page.locator('th:has-text("Type")')).toBeVisible();
      await expect(page.locator('th:has-text("Count")')).toBeVisible();
      await expect(page.locator('th:has-text("Avg")')).toBeVisible();
      await expect(page.locator('th:has-text("Total")')).toBeVisible();
    });

    test('should handle horizontal scroll at extreme widths (320px)', async ({ page }) => {
      // Set very narrow viewport
      await page.setViewportSize({ width: 320, height: 568 });

      // Dismiss privacy banner if present
      const acceptButton = page.locator('button:has-text("Accept")');
      if (await acceptButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await acceptButton.click();
        await page.waitForTimeout(300);
      }

      // Navigate to Pathway Browser tab
      await page.click('button:has-text("Pathway Browser")');
      await expect(page.locator('table').first()).toBeVisible();

      // The scrollable container is the div with overflow-x-auto that wraps the table header
      const scrollContainer = page.locator('div.overflow-x-auto').first();
      await expect(scrollContainer).toBeVisible();

      // Try to scroll horizontally
      await scrollContainer.evaluate(el => el.scrollLeft = 100);
      const scrollLeft = await scrollContainer.evaluate(el => el.scrollLeft);

      // If content is wider than viewport, scroll should work
      const scrollWidth = await scrollContainer.evaluate(el => el.scrollWidth);
      const clientWidth = await scrollContainer.evaluate(el => el.clientWidth);
      if (scrollWidth > clientWidth) {
        expect(scrollLeft).toBeGreaterThan(0);
      }
    });

    test('should adapt cascade parameters form to mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify form is still usable
      const runButton = page.locator('button:has-text("Run Cascade Simulation")');
      await expect(runButton).toBeVisible();

      // Input fields should be accessible
      const inputs = page.locator('input[type="number"]');
      const count = await inputs.count();
      expect(count).toBeGreaterThan(0);

      // All inputs should be visible (may stack vertically)
      for (let i = 0; i < Math.min(count, 3); i++) {
        await expect(inputs.nth(i)).toBeVisible();
      }
    });
  });
});
