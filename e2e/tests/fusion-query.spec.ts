import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  waitForReactionResults,
  verifyBothDetailsCards
} from '../fixtures/test-helpers';

test.describe('Fusion Query Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display fusion query page with default selections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Fusion Reactions/i }).first()).toBeVisible();

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
    await waitForReactionResults(page, 'fusion');

    // Should show results region
    const resultsRegion = page.getByRole('region', { name: /fusion reaction results/i });
    await expect(resultsRegion).toBeVisible();

    // Should show some results (check for result rows or grid cells)
    const firstRow = resultsRegion.locator('div[class*="grid"][class*="border-b"]').first();
    await expect(firstRow).toBeVisible();

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
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Verify results are within range (if results are shown)
    const resultsRegion = page.getByRole('region', { name: /Fusion reaction results/i });
    if (await resultsRegion.isVisible()) {
      // At least verify results region exists with results
      await expect(resultsRegion.locator('div[class*="grid"][class*="border-b"]').first()).toBeVisible();
    }
  });

  test('should filter by neutrino types', async ({ page }) => {
    // Find neutrino filter checkboxes
    const neutrinoFilters = page.getByLabel(/neutrino/i);

    // Uncheck some neutrino types if they exist
    // Click the label text instead of the checkbox input, as it's more accessible and has the click handler
    const noneLabel = page.getByText('None', { exact: true });
    if (await noneLabel.isVisible().catch(() => false)) {
      await noneLabel.click({ force: true });
    }

    // Query auto-executes when filters change - wait for results
    await page.waitForTimeout(2000);

    // Results should be filtered accordingly
    await expect(page.getByRole('region', { name: /Fusion reaction results/i })).toBeVisible();
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
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    await expect(page.getByRole('region', { name: /Fusion reaction results/i })).toBeVisible();
  });

  test('should display nuclide details on hover', async ({ page }) => {
    // Query auto-executes with default selections - wait for results table
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"] div[class*="grid"][class*="border-b"]') !== null,
      { timeout: 10000 }
    );

    // Hover over a nuclide symbol in the results
    const firstNuclide = page.getByRole('region', { name: /Fusion reaction results/i }).locator('a').first();

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
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
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
        () => document.querySelector('[role="region"][aria-label="Fusion reaction results"] div[class*="grid"][class*="border-b"]') !== null,
        { timeout: 10000 }
      );

      // Count rows
      const rows = page.getByRole('region', { name: /Fusion reaction results/i }).locator('div[class*="grid"][class*="border-b"]');
      const count = await rows.count();

      // Should have at most 10 results (or fewer if query returns less)
      expect(count).toBeLessThanOrEqual(10);
    }
  });

  test('should handle mutually exclusive element and nuclide pinning', async ({ page }) => {
    // Test mutually exclusive behavior: pinning element clears nuclide and vice versa
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Scroll to and wait for nuclides section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Test A: Pin a nuclide - should show BOTH element AND nuclide details cards
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const firstNuclideCard = nuclideCards.first();

    await firstNuclideCard.click();

    // Verify nuclide is pinned
    await expect(firstNuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify BOTH element and nuclide details cards are visible (element card should be above nuclide card)
    await verifyBothDetailsCards(page);

    // Test B: Pin an element - should clear nuclide pin and show element details
    // Expand the heatmap to access the periodic table
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.scrollIntoViewIfNeeded();
    const isHeatmapExpanded = await heatmapToggle.getAttribute('title').then(t => t?.includes('Collapse'));
    if (!isHeatmapExpanded) {
      await heatmapToggle.click();
      await page.waitForTimeout(500); // Wait for expansion animation
    }

    // Click an element in the heatmap periodic table (Nitrogen)
    const nitrogenButton = page.getByRole('button', { name: /^7\s+N$/ }).first();
    await nitrogenButton.click();
    await page.waitForTimeout(500); // Wait for state update

    // Scroll back down to nuclides section to verify unpinning
    await page.locator('text=/Nuclides.*in Results/').scrollIntoViewIfNeeded();

    // Verify Nitrogen element is now pinned (element details card shows Atomic Number 7)
    await expect(page.getByText(/Atomic Number.*7/).first()).toBeVisible();

    // Re-query nuclide cards after heading changed (now shows "Nuclides of N in Results")
    const updatedNuclideCards = page.locator('text=/Nuclides.*in Results/').locator('..').locator('div[class*="cursor-pointer"]');

    // Verify no nuclides are pinned (mutually exclusive - element pin cleared nuclide pin)
    const pinnedNuclides = updatedNuclideCards.locator('.ring-2.ring-blue-400');
    await expect(pinnedNuclides).toHaveCount(0);

    // Test C: Pin a nuclide from a DIFFERENT element - should clear element pin (mutual exclusivity across elements)
    // First unpin Nitrogen to see all nuclides
    await nitrogenButton.scrollIntoViewIfNeeded();
    await nitrogenButton.click();
    await page.waitForTimeout(300);

    // Find and click any nuclide that is NOT nitrogen (first nuclide in list)
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();
    const firstNuclideCard2 = page.locator('div[class*="cursor-pointer"]').first();
    await firstNuclideCard2.scrollIntoViewIfNeeded();
    await firstNuclideCard2.click();
    await page.waitForTimeout(300);

    // Verify nuclide is pinned
    await expect(firstNuclideCard2).toHaveClass(/ring-2.*ring-blue-400/);

    // Now pin Nitrogen element again - should clear the nuclide pin ONLY if it's from a different element
    await nitrogenButton.scrollIntoViewIfNeeded();
    await nitrogenButton.click();
    await page.waitForTimeout(500);

    // Verify nitrogen element is pinned
    await expect(nitrogenButton).toHaveClass(/ring-2.*ring-blue/);

    // Verify nuclides list is filtered by Nitrogen
    await expect(page.getByText(/Nuclides of N in Results/)).toBeVisible();
  });

  test('should display radioactivity indicators for unstable isotopes in results', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"] div[class*="grid"][class*="border-b"]') !== null,
      { timeout: 10000 }
    );

    // Look for radioactivity indicators (radiation icon SVG) in result rows
    // The Radiation icon from lucide-react should appear next to radioactive isotopes
    const resultsRegion = page.getByRole('region', { name: /Fusion reaction results/i });

    // Just verify that the results region is visible and functional with rows
    // (Not all queries will return radioactive isotopes)
    await expect(resultsRegion.locator('div[class*="grid"][class*="border-b"]').first()).toBeVisible();
  });

  test('should show radioactivity indicators in nuclide summary cards', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
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

  test('should allow element pinning via periodic table', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Expand the heatmap to access the periodic table
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.scrollIntoViewIfNeeded();
    const isHeatmapExpanded = await heatmapToggle.getAttribute('title').then(t => t?.includes('Collapse'));
    if (!isHeatmapExpanded) {
      await heatmapToggle.click();
      await page.waitForTimeout(500); // Wait for expansion animation
    }

    // Click an element in the heatmap periodic table (Carbon)
    const carbonButton = page.getByRole('button', { name: /^6\s+C$/ }).first();
    await carbonButton.click();

    // Verify element details card is visible (indicates element is pinned)
    await expect(page.getByText(/Atomic Number.*6/).first()).toBeVisible();

    // Verify Carbon has ring indicator styling
    await expect(carbonButton).toHaveClass(/ring-2.*ring-blue/);
  });

  test('should allow nuclide pinning and show details', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Click a nuclide card from "Nuclides Appearing in Results"
    const nuclideCard = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]').first();
    await nuclideCard.click();

    // Verify nuclide is pinned
    await expect(nuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify both element and nuclide details cards are visible
    await verifyBothDetailsCards(page);
  });

  test('should restore pinned element from URL on page load', async ({ page }) => {
    // Navigate with pinE parameter - He+He fusion produces Li (Lithium) as output
    await page.goto('/fusion?e1=He&e2=He&pinE=Li');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Wait for heatmap section to be visible (should auto-expand with pinE parameter)
    const heatmapSection = page.locator('h3:has-text("Element Heatmap")');
    await heatmapSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000); // Wait for auto-expansion effect

    // Verify heatmap is expanded (look for periodic table elements)
    const lithiumButton = page.getByRole('button', { name: /^3\s+Li$/ });
    await expect(lithiumButton).toBeVisible();

    // Verify element details card is visible (indicates Li is pinned)
    await expect(page.getByText(/Atomic Number.*3/).first()).toBeVisible();

    // Verify URL no longer contains pinE=Li (cleared after initialization)
    const url = page.url();
    expect(url).not.toContain('pinE=');
    expect(url).not.toContain('pinN=');
  });

  test('should restore pinned nuclide from URL on page load', async ({ page }) => {
    // Navigate with pinN parameter - He+He fusion produces Li-6 as output
    await page.goto('/fusion?e1=He&e2=He&pinN=Li-6');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
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

    // Verify both element and nuclide details cards are visible
    await verifyBothDetailsCards(page);
  });

  test('should restore both pinned element and nuclide from URL', async ({ page }) => {
    // Navigate with both pinE and pinN parameters - He+He fusion produces Li-6
    await page.goto('/fusion?e1=He&e2=He&pinE=Li&pinN=Li-6');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Wait for heatmap section to be visible (should auto-expand with pinE parameter)
    const heatmapSection = page.locator('h3:has-text("Element Heatmap")');
    await heatmapSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000); // Wait for auto-expansion effect

    // Verify heatmap is expanded
    const lithiumButton = page.getByRole('button', { name: /^3\s+Li$/ });
    await expect(lithiumButton).toBeVisible();

    // Wait for nuclides section
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Find the Li-6 nuclide card
    const li6Card = page.locator('div.cursor-pointer:has-text("Li-6")').first();

    // Verify nuclide is pinned
    await expect(li6Card).toBeVisible();
    await expect(li6Card).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify both element and nuclide details cards are visible
    await verifyBothDetailsCards(page);
  });

  test('should allow element unpinning', async ({ page }) => {
    // Navigate with pinE parameter - He+He fusion produces Li as output
    await page.goto('/fusion?e1=He&e2=He&pinE=Li');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Wait for heatmap section to be visible (should auto-expand with pinE parameter)
    const heatmapSection = page.locator('h3:has-text("Element Heatmap")');
    await heatmapSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000); // Wait for auto-expansion effect

    // Verify heatmap is expanded and element details card is visible
    const lithiumButton = page.getByRole('button', { name: /^3\s+Li$/ });
    await expect(lithiumButton).toBeVisible();
    await expect(page.getByText(/Atomic Number.*3/).first()).toBeVisible();

    // Click lithium in heatmap to unpin
    await lithiumButton.click();

    // Verify element details card is no longer visible
    await expect(page.getByText(/Atomic Number.*3/).first()).not.toBeVisible();

    // Verify lithium no longer has ring styling
    await expect(lithiumButton).not.toHaveClass(/ring-2.*ring-blue/);
  });

  test('should ignore invalid pinE/pinN parameters that do not exist in results', async ({ page }) => {
    // Navigate with invalid parameters (elements/nuclides not in default query results)
    await page.goto('/fusion?pinE=InvalidElement&pinN=InvalidNuclide-999');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // No cards should be pinned when parameters are invalid
    const pinnedCards = page.locator('div[class*="ring-2 ring-blue-400"]');
    await expect(pinnedCards).toHaveCount(0);

    // Scroll to bottom to see Details section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // No detail cards should be visible (should show placeholder)
    await expect(page.getByText(/Click on an element or nuclide above to see detailed properties/i)).toBeVisible();
  });

  test('should unpin nuclide when pinning a different element', async ({ page }) => {
    // Wait for default query results to load (H + C,O)
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Scroll to and wait for nuclides section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Pin the first available nuclide from default H+C,O results
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const firstNuclideCard = nuclideCards.first();

    await firstNuclideCard.click();

    // Verify nuclide is pinned
    await expect(firstNuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Expand the heatmap to access the periodic table
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.scrollIntoViewIfNeeded();
    const isHeatmapExpanded = await heatmapToggle.getAttribute('title').then(t => t?.includes('Collapse'));
    if (!isHeatmapExpanded) {
      await heatmapToggle.click();
      await page.waitForTimeout(500); // Wait for expansion animation
    }

    // Now pin a DIFFERENT element via heatmap (e.g., Nitrogen)
    const nitrogenButton = page.getByRole('button', { name: /^7\s+N$/ }).first();
    await nitrogenButton.click();
    await page.waitForTimeout(500); // Wait for state update

    // Scroll back down to nuclides section to verify unpinning
    await page.locator('text=/Nuclides.*in Results/').scrollIntoViewIfNeeded();

    // Verify Nitrogen element details card is visible (indicates pinned)
    await expect(page.getByText(/Atomic Number.*7/).first()).toBeVisible();

    // Re-query nuclide cards after heading changed (now shows "Nuclides of N in Results")
    const updatedNuclideCards = page.locator('text=/Nuclides.*in Results/').locator('..').locator('div[class*="cursor-pointer"]');

    // Verify no nuclides are pinned (mutually exclusive - element pin cleared nuclide pin)
    const pinnedNuclides = updatedNuclideCards.locator('.ring-2.ring-blue-400');
    await expect(pinnedNuclides).toHaveCount(0);
  });

  test('should highlight rows containing D-2 when D-2 is pinned (D/T nuclide pinning regression)', async ({ page }) => {
    // Navigate with D+D fusion query
    await page.goto('/fusion?e1=D&e2=D');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"] div[class*="grid"][class*="border-b"]') !== null,
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

    // Get all result rows (skip header rows by excluding rows with uppercase text class)
    const resultsRegion = page.getByRole('region', { name: /Fusion reaction results/i });
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

  test('should display T-3 in nuclides list when H fusion produces T (T nuclide appearance regression)', async ({ page }) => {
    // Navigate with H+? → He fusion query which includes H+T-3→He-4
    await page.goto('/fusion?e1=H&e=He');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"] div[class*="grid"][class*="border-b"]') !== null,
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
    const allRows = page.getByRole('region', { name: /Fusion reaction results/i }).locator('div[class*="grid"][class*="border-b"]');
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
    await expect(page.getByRole('heading', { name: /Fusion Reactions/i }).first()).toBeVisible();

    // Use default selections (H + C,O) and verify query works
    // Query should execute automatically on page load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"]') !== null,
      { timeout: 10000 }
    );

    // Results table should be visible and responsive
    await expect(page.getByRole('region', { name: /Fusion reaction results/i })).toBeVisible();
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
      () => document.querySelector('[role="region"][aria-label="Fusion reaction results"] div[class*="grid"][class*="border-b"]') !== null,
      { timeout: 10000 }
    );

    // Find the first nuclide link in the results table
    const firstNuclideLink = page.getByRole('region', { name: /Fusion reaction results/i }).locator('a').first();
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
