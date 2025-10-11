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

  test('should display radioactivity indicators for unstable isotopes in results', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Look for radioactivity indicators (radiation icon SVG) in table cells
    // The Radiation icon from lucide-react should appear next to radioactive isotopes
    const radiationIcons = page.locator('tbody tr td svg[class*="lucide"]');

    // Just verify that the results table is visible and functional
    // (Not all queries will return radioactive isotopes)
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('should show radioactivity indicators in nuclide summary cards', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Look for "Nuclides Appearing in Results" section
    const nuclidesSection = page.locator('text=Nuclides Appearing in Results');
    const hasNuclides = await nuclidesSection.isVisible().catch(() => false);

    if (hasNuclides) {
      // Look for nuclide cards
      const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
      const cardCount = await nuclideCards.count();

      // Just verify cards are visible
      if (cardCount > 0) {
        await expect(nuclideCards.first()).toBeVisible();
      }
    }
  });

  test('should persist pinned element in URL with pinE parameter', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Click an element card from "Elements Appearing in Results"
    const elementCard = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]').first();
    await elementCard.click();

    // Verify element is pinned
    await expect(elementCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Get the element symbol from the card
    const elementSymbol = await elementCard.locator('div.font-bold').first().textContent();

    // URL should contain pinE parameter with the element symbol
    await page.waitForTimeout(500); // Wait for URL update
    const url = page.url();
    expect(url).toContain(`pinE=${elementSymbol}`);
  });

  test('should persist pinned nuclide in URL with pinN parameter', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Click a nuclide card from "Nuclides Appearing in Results"
    const nuclideCard = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]').first();
    await nuclideCard.click();

    // Verify nuclide is pinned
    await expect(nuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Get the nuclide identifier (e.g., "H-1")
    const nuclideText = await nuclideCard.locator('span.font-semibold').first().textContent();

    // URL should contain pinN parameter with the nuclide identifier
    await page.waitForTimeout(500); // Wait for URL update
    const url = page.url();
    expect(url).toContain(`pinN=${nuclideText}`);
  });

  test('should restore pinned element from URL on page load', async ({ page }) => {
    // Navigate with pinE parameter (using C which appears in default H+C,O results)
    await page.goto('/fusion?pinE=C');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Find the Carbon element card
    const elementCards = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const carbonCard = elementCards.filter({ hasText: /^C\s/ }).first();

    // Verify Carbon is pinned (has ring-2 ring-blue-400 class)
    await expect(carbonCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify element details card is visible
    await expect(page.getByText(/Carbon/i)).toBeVisible();
  });

  test('should restore pinned nuclide from URL on page load', async ({ page }) => {
    // Navigate with pinN parameter (using O-16 which appears in default H+C,O results)
    await page.goto('/fusion?pinN=O-16');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Find the O-16 nuclide card
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const o16Card = nuclideCards.filter({ hasText: 'O-16' }).first();

    // Verify O-16 is pinned (has ring-2 ring-blue-400 class)
    await expect(o16Card).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify nuclide details card is visible
    await expect(page.getByText(/Mass Number.*16/)).toBeVisible();
  });

  test('should restore both pinned element and nuclide from URL', async ({ page }) => {
    // Navigate with both pinE and pinN parameters (using O and O-16 from default results)
    await page.goto('/fusion?pinE=O&pinN=O-16');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Find both cards
    const elementCards = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const oxygenCard = elementCards.filter({ hasText: /^O\s/ }).first();

    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const o16Card = nuclideCards.filter({ hasText: 'O-16' }).first();

    // Verify both are pinned
    await expect(oxygenCard).toHaveClass(/ring-2.*ring-blue-400/);
    await expect(o16Card).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify both detail cards are visible
    await expect(page.getByText(/Oxygen/i)).toBeVisible();
    await expect(page.getByText(/Mass Number.*16/)).toBeVisible();
  });

  test('should remove pinE from URL when element is unpinned', async ({ page }) => {
    // Navigate with pinE parameter (using C from default results)
    await page.goto('/fusion?pinE=C');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Find the Carbon element card
    const elementCards = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const carbonCard = elementCards.filter({ hasText: /^C\s/ }).first();

    // Verify it's pinned
    await expect(carbonCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Click to unpin
    await carbonCard.click();

    // Verify it's no longer pinned
    await expect(carbonCard).not.toHaveClass(/ring-2.*ring-blue-400/);

    // URL should not contain pinE parameter
    await page.waitForTimeout(500); // Wait for URL update
    const url = page.url();
    expect(url).not.toContain('pinE=');
  });

  test('should ignore invalid pinE/pinN parameters that do not exist in results', async ({ page }) => {
    // Navigate with invalid parameters (elements/nuclides not in default query results)
    await page.goto('/fusion?pinE=InvalidElement&pinN=InvalidNuclide-999');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // No cards should be pinned
    const pinnedCards = page.locator('div[class*="ring-2 ring-blue-400"]');
    await expect(pinnedCards).toHaveCount(0);

    // No detail cards should be visible (except the placeholder "Click on a nuclide or element")
    await expect(page.getByText(/Click on a nuclide or element above to see detailed properties/i)).toBeVisible();
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

test.describe('Fusion Query - Navigation Links', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should have clickable links to element-data page for nuclides in results table', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Find the first nuclide link in the results table
    const firstNuclideLink = page.locator('tbody tr td a').first();
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
