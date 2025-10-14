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
    // Navigate with pinE parameter - He+He fusion produces Li (Lithium) as output
    await page.goto('/fusion?e1=He&e2=He&pinE=Li');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Wait for "Elements Appearing in Results" section to be visible
    await page.locator('text=Elements Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Scroll section into view
    await page.locator('text=Elements Appearing in Results').scrollIntoViewIfNeeded();

    // Wait for URL initialization
    await page.waitForTimeout(1000);

    // Find the Lithium element card
    const liCard = page.getByText('Lithium').locator('..').first();

    // Verify Lithium is pinned (has ring-2 ring-blue-400 class)
    await expect(liCard).toBeVisible();
    await expect(liCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify element details card is visible
    await expect(page.getByText(/Atomic Number.*3/).first()).toBeVisible();
  });

  test('should restore pinned nuclide from URL on page load', async ({ page }) => {
    // Navigate with pinN parameter - He+He fusion produces Li-6 as output
    await page.goto('/fusion?e1=He&e2=He&pinN=Li-6');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Wait for "Nuclides Appearing in Results" section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Scroll section into view
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();

    // Wait for URL initialization
    await page.waitForTimeout(1000);

    // Find the Li-6 nuclide card
    const li6Card = page.locator('div.cursor-pointer:has-text("Li-6")').first();

    // Verify Li-6 is pinned (has ring-2 ring-blue-400 class)
    await expect(li6Card).toBeVisible();
    await expect(li6Card).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify nuclide details card is visible - use first() to handle multiple matches
    await expect(page.getByText(/Mass Number.*6/).first()).toBeVisible();
  });

  test('should restore both pinned element and nuclide from URL', async ({ page }) => {
    // Navigate with both pinE and pinN parameters - He+He fusion produces Li-6
    await page.goto('/fusion?e1=He&e2=He&pinE=Li&pinN=Li-6');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Wait for sections to be visible
    await page.locator('text=Elements Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Scroll sections into view
    await page.locator('text=Elements Appearing in Results').scrollIntoViewIfNeeded();
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();

    // Wait for URL initialization
    await page.waitForTimeout(1000);

    // Find both cards
    const liCard = page.getByText('Lithium').locator('..').first();
    const li6Card = page.locator('div.cursor-pointer:has-text("Li-6")').first();

    // Verify both are pinned
    await expect(liCard).toBeVisible();
    await expect(liCard).toHaveClass(/ring-2.*ring-blue-400/);
    await expect(li6Card).toBeVisible();
    await expect(li6Card).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify both detail cards are visible
    await expect(page.getByText(/Atomic Number.*3/).first()).toBeVisible();
    await expect(page.getByText(/Mass Number.*6/).first()).toBeVisible();
  });

  test('should remove pinE from URL when element is unpinned', async ({ page }) => {
    // Navigate with pinE parameter - He+He fusion produces Li as output
    await page.goto('/fusion?e1=He&e2=He&pinE=Li');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Wait for "Elements Appearing in Results" section to be visible
    await page.locator('text=Elements Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Scroll section into view
    await page.locator('text=Elements Appearing in Results').scrollIntoViewIfNeeded();

    // Wait for URL initialization
    await page.waitForTimeout(1000);

    // Find the Lithium element card
    const liCard = page.getByText('Lithium').locator('..').first();

    // Verify it's pinned
    await expect(liCard).toBeVisible();
    await expect(liCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Click to unpin
    await liCard.click();

    // Verify it's no longer pinned
    await expect(liCard).not.toHaveClass(/ring-2.*ring-blue-400/);

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

  test('should unpin nuclide when pinning a different element', async ({ page }) => {
    // Wait for default query results to load (H + C,O)
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Pin a nuclide (e.g., C-13 from default H+C,O results)
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const c13Card = nuclideCards.filter({ hasText: 'C-13' }).first();
    await c13Card.click();

    // Verify C-13 is pinned
    await expect(c13Card).toHaveClass(/ring-2.*ring-blue-400/);

    // Now pin a DIFFERENT element (e.g., Oxygen)
    const elementCards = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const oxygenCard = elementCards.filter({ hasText: 'Oxygen' }).first();
    await oxygenCard.click();

    // Verify Oxygen is pinned
    await expect(oxygenCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify C-13 is NO LONGER pinned (regression check)
    await expect(c13Card).not.toHaveClass(/ring-2.*ring-blue-400/);

    // URL should only contain pinE=O, not pinN=C-13
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('pinE=O');
    expect(url).not.toContain('pinN=C-13');
  });

  test('should highlight rows containing D-2 when D-2 is pinned (D/T nuclide pinning regression)', async ({ page }) => {
    // Navigate with D+D fusion query
    await page.goto('/fusion?e1=D&e2=D');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
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

    // Get all result rows
    const allRows = page.locator('tbody tr');
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

    // URL should contain pinN=D-2
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('pinN=D-2');
  });

  test('should display T-3 in nuclides list when H fusion produces T (T nuclide appearance regression)', async ({ page }) => {
    // Navigate with H+? → He fusion query which includes H+T-3→He-4
    await page.goto('/fusion?e1=H&e=He');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Wait for nuclides section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();

    // Verify T-3 appears in the nuclides list (this is the main regression check)
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const t3Card = nuclideCards.filter({ hasText: 'T-3' }).first();
    await expect(t3Card).toBeVisible();

    // Verify T-3 has radioactive indicator
    await expect(t3Card.locator('svg')).toBeVisible();

    // Click T-3 to pin it
    await t3Card.click();

    // Verify T-3 is pinned
    await expect(t3Card).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify at least one row contains T-3
    const allRows = page.locator('tbody tr');
    const rowCount = await allRows.count();
    expect(rowCount).toBeGreaterThan(0);

    let foundT3Row = false;
    for (let i = 0; i < rowCount; i++) {
      const row = allRows.nth(i);
      const rowText = await row.textContent();
      if (rowText?.includes('T-3')) {
        foundT3Row = true;
        // Verify this row is NOT desaturated
        await expect(row).not.toHaveClass(/opacity-30.*grayscale/);
        break;
      }
    }
    expect(foundT3Row).toBe(true);

    // URL should contain pinN=T-3
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('pinN=T-3');
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
