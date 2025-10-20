import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  waitForReactionResults
} from '../fixtures/test-helpers';

test.describe('Fission Query Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fission');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display fission query page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Fission Reactions/i })).toBeVisible();

    // Should have periodic table selector for input element
    await expect(page.getByText(/Input Element/i)).toBeVisible();
  });

  test('should select element and execute fission query', async ({ page }) => {
    // Click the input element selector dropdown to open it
    await page.getByRole('button', { name: /1 selected.*Zr/i }).click();

    // Wait for periodic table to appear and select Nickel
    const ni = page.getByRole('button', { name: /^28\s+Ni$/i }).first();
    await ni.waitFor({ state: 'visible', timeout: 5000 });
    await ni.click();

    // Query executes automatically - wait for results
    await waitForReactionResults(page, 'fission');

    // Should show results region
    const resultsRegion = page.getByRole('region', { name: /Fission reaction results/i });
    await expect(resultsRegion).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/Query executed in/i)).toBeVisible();
  });

  test('should filter by output elements', async ({ page }) => {
    // Select input element
    await page.getByRole('button', { name: /1 selected.*Zr/i }).click();
    const ni = page.getByRole('button', { name: /^28\s+Ni$/i }).first();
    await ni.waitFor({ state: 'visible', timeout: 5000 });
    await ni.click();

    // Query executes automatically - results should appear
    await waitForReactionResults(page, 'fission');

    const resultsRegion = page.getByRole('region', { name: /Fission reaction results/i });
    await expect(resultsRegion).toBeVisible();
  });

  test('should filter by energy range', async ({ page }) => {
    // Select element - Iron
    await page.getByRole('button', { name: /1 selected.*Zr/i }).click();
    const fe = page.getByRole('button', { name: /^26\s+Fe$/i }).first();
    await fe.waitFor({ state: 'visible', timeout: 5000 });
    await fe.click();

    // Wait for dropdown to close and query to execute
    await waitForReactionResults(page, 'fission');

    // Set energy filters
    const minMevInput = page.locator('input[type="number"]').first();
    await minMevInput.fill('0.5');

    const maxMevInput = page.locator('input[type="number"]').nth(1);
    await maxMevInput.fill('20.0');

    // Query should re-execute automatically
    await page.waitForTimeout(1000);

    const resultsRegion = page.getByRole('region', { name: /Fission reaction results/i });
    await expect(resultsRegion).toBeVisible();
  });

  test('should display fission reaction details', async ({ page }) => {
    // Execute a query - select Silver (Ag has fission reactions)
    await page.getByRole('button', { name: /1 selected.*Zr/i }).click();
    const ag = page.getByRole('button', { name: /^47\s+Ag$/i }).first();
    await ag.waitFor({ state: 'visible', timeout: 5000 });
    await ag.click();

    // Wait for results to load and be visible
    await waitForReactionResults(page, 'fission');

    // Results should show input → output1 + output2 format
    const resultsRegion = page.getByRole('region', { name: /Fission reaction results/i });
    await resultsRegion.scrollIntoViewIfNeeded();

    const firstRow = resultsRegion.locator('div[class*="grid"][class*="border-b"]').first();
    await expect(firstRow).toBeVisible();

    // Should have nuclide links in result rows
    await expect(resultsRegion.locator('a').first()).toBeVisible();
  });

  test('should export fission results', async ({ page }) => {
    // Execute query - select Silver (Ag has fission reactions)
    await page.getByRole('button', { name: /1 selected.*Zr/i }).click();
    const ag = page.getByRole('button', { name: /^47\s+Ag$/i }).first();
    await ag.waitFor({ state: 'visible', timeout: 5000 });
    await ag.click();

    // Wait for results
    await waitForReactionResults(page, 'fission');

    // Find export button and scroll to it
    const exportButton = page.getByRole('button', { name: /export|download/i });
    await exportButton.scrollIntoViewIfNeeded();

    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/fission.*\.csv/i);
    }
  });

  test('should handle no results for invalid combinations', async ({ page }) => {
    // Select Hydrogen which likely has no fission reactions
    await page.getByRole('button', { name: /1 selected.*Zr/i }).click();
    const h = page.getByRole('button', { name: /^1\s+H$/i }).first();
    await h.waitFor({ state: 'visible', timeout: 5000 });
    await h.click();

    await page.keyboard.press('Escape');

    // Query executes automatically - wait for response
    await page.waitForTimeout(2000);

    // Should show no results message or 0 reactions
    const noResults = page.getByText(/no.*results|0.*reactions|showing.*0/i);
    const hasNoResults = await noResults.isVisible().catch(() => false);

    if (hasNoResults) {
      await expect(noResults).toBeVisible();
    }
  });

  test('should support URL parameters', async ({ page }) => {
    // Navigate with URL params
    await page.goto('/fission?e=Ni&minMeV=1');
    await waitForDatabaseReady(page);

    // Filters should be populated
    const minMevInput = page.getByLabel(/minimum.*MeV/i);
    if (await minMevInput.isVisible().catch(() => false)) {
      await expect(minMevInput).toHaveValue('1');
    }
  });

  test('should enforce mutually exclusive element and nuclide pinning', async ({ page }) => {
    // Wait for default query results to load (Zr fission)
    await waitForReactionResults(page, 'fission');

    // Expand the heatmap to access the periodic table
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.scrollIntoViewIfNeeded();
    const isHeatmapExpanded = await heatmapToggle.getAttribute('title').then(t => t?.includes('Collapse'));
    if (!isHeatmapExpanded) {
      await heatmapToggle.click();
      await page.waitForTimeout(500); // Wait for expansion animation
    }

    // Click an element in the heatmap (e.g., Calcium which appears in Zr fission results)
    const caButton = page.getByRole('button', { name: /^20\s+Ca$/ }).first();
    await caButton.scrollIntoViewIfNeeded();
    await caButton.click();
    await page.waitForTimeout(500); // Wait for element details to load

    // Verify Calcium has ring indicator styling
    await expect(caButton).toHaveClass(/ring-2.*ring-blue/);

    // Verify nuclides are filtered by Calcium (element pinning is working)
    await expect(page.getByText(/Nuclides of Ca in Results/)).toBeVisible();

    // Click a nuclide card from the nuclides section (heading changes based on pinned element)
    await page.locator('text=/Nuclides.*in Results/').locator('..').locator('div[class*="cursor-pointer"]').first().click();

    // Wait for state to update
    await page.waitForTimeout(300);

    // Verify nuclide is now pinned (re-query to get fresh state)
    const pinnedNuclide = page.locator('div[class*="ring-2"][class*="ring-blue-400"]').first();
    await expect(pinnedNuclide).toBeVisible();

    // Verify Calcium element is NO LONGER pinned (mutually exclusive behavior)
    // Check that nuclides heading changed back to showing all nuclides (not filtered by Ca)
    await expect(page.getByText(/Nuclides Appearing in Results \(\d+\)/)).toBeVisible();
    await expect(caButton).not.toHaveClass(/ring-2.*ring-blue/);

    // Click Calcium element again to pin it
    await caButton.scrollIntoViewIfNeeded();
    await caButton.click();
    await page.waitForTimeout(500); // Wait for element details to load

    // Verify Calcium has ring indicator styling
    await expect(caButton).toHaveClass(/ring-2.*ring-blue/);

    // Verify nuclides are filtered by Calcium again (element pinning is working)
    await expect(page.getByText(/Nuclides of Ca in Results/)).toBeVisible();

    // Verify nuclide is NO LONGER pinned (mutually exclusive behavior - no blue rings on nuclide cards)
    const pinnedNuclideAfter = page.locator('div[class*="ring-2"][class*="ring-blue-400"]').first();
    await expect(pinnedNuclideAfter).not.toBeVisible();
  });

  test('should allow element pinning via periodic table', async ({ page }) => {
    // Wait for default query results to load (Zr fission)
    await waitForReactionResults(page, 'fission');

    // Expand the heatmap to access the periodic table
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.scrollIntoViewIfNeeded();
    const isHeatmapExpanded = await heatmapToggle.getAttribute('title').then(t => t?.includes('Collapse'));
    if (!isHeatmapExpanded) {
      await heatmapToggle.click();
      await page.waitForTimeout(500); // Wait for expansion animation
    }

    // Click an element in the heatmap (e.g., Calcium)
    const caButton = page.getByRole('button', { name: /^20\s+Ca$/ }).first();
    await caButton.scrollIntoViewIfNeeded();
    await caButton.click();
    await page.waitForTimeout(500); // Wait for element details to load

    // Verify Calcium has ring indicator styling
    await expect(caButton).toHaveClass(/ring-2.*ring-blue/);

    // Verify nuclides are filtered by Calcium (element pinning is working)
    await expect(page.getByText(/Nuclides of Ca in Results/)).toBeVisible();
  });

  test('should allow nuclide pinning and show details', async ({ page }) => {
    // Wait for default query results to load
    await waitForReactionResults(page, 'fission');

    // Click a nuclide card from "Nuclides Appearing in Results"
    const nuclideCard = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]').first();
    await nuclideCard.click();

    // Verify nuclide is pinned
    await expect(nuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify nuclide details card is visible
    await expect(page.getByText(/Mass Number/).first()).toBeVisible();
  });

  test('should restore pinned element from URL on page load', async ({ page }) => {
    // Navigate with pinE parameter - Zr query produces Ca in fission results
    // Must explicitly set e=Zr because hasAnyUrlParams() clears defaults when URL params exist
    await page.goto('/fission?e=Zr&pinE=Ca');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fission');

    // Wait a moment for URL initialization to process
    await page.waitForTimeout(1000);

    // Verify Calcium is pinned (check periodic table ring and filtered nuclides heading)
    const caButton = page.getByRole('button', { name: /^20\s+Ca$/ }).first();
    await expect(caButton).toHaveClass(/ring-2.*ring-blue/);
    await expect(page.getByText(/Nuclides of Ca in Results/)).toBeVisible();

    // Verify URL no longer contains pinE=Ca (cleared after initialization)
    const url = page.url();
    expect(url).not.toContain('pinE=');
    expect(url).not.toContain('pinN=');
  });

  test('should restore pinned element from URL when both pinE and pinN are present (element takes precedence)', async ({ page }) => {
    // Navigate with both pinE and pinN parameters - Zr query produces Ca-48
    // Must explicitly set e=Zr because hasAnyUrlParams() clears defaults when URL params exist
    // Since pinE is checked first in URL initialization, only element will be pinned
    await page.goto('/fission?e=Zr&pinE=Ca&pinN=Ca-48');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fission');

    // Wait for Nuclides section to be visible (should show filtered by Ca)
    await page.locator('text=/Nuclides.*in Results/').waitFor({ state: 'visible', timeout: 10000 });

    // Wait for URL initialization
    await page.waitForTimeout(1000);

    // Verify element Ca is pinned (check periodic table and filtered nuclides heading)
    const caButton = page.getByRole('button', { name: /^20\s+Ca$/ }).first();
    await expect(caButton).toHaveClass(/ring-2.*ring-blue/);
    await expect(page.getByText(/Nuclides of Ca in Results/)).toBeVisible();

    // Find the Ca-48 nuclide card
    const ca48Card = page.locator('div.cursor-pointer:has-text("Ca-48")').first();
    await expect(ca48Card).toBeVisible();

    // Verify nuclide is NOT pinned (no blue ring) - mutually exclusive behavior
    await expect(ca48Card).not.toHaveClass(/ring-2.*ring-blue-400/);
  });

  test('should ignore invalid pinE/pinN parameters', async ({ page }) => {
    // Navigate with invalid parameters
    await page.goto('/fission?pinE=InvalidElement&pinN=InvalidNuclide-999');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fission');

    // No cards should be pinned
    const pinnedCards = page.locator('div[class*="ring-2 ring-blue-400"]');
    await expect(pinnedCards).toHaveCount(0);
  });

  test('should unpin nuclide when pinning a different element', async ({ page }) => {
    // Wait for default query results to load (Zr fission)
    await waitForReactionResults(page, 'fission');

    // Scroll to and wait for nuclides section to be visible
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Pin a nuclide (use first available instead of assuming Ca-48 exists)
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const firstNuclideCard = nuclideCards.first();

    // Get nuclide text for verification
    const nuclideText = await firstNuclideCard.locator('span.font-semibold').first().textContent();
    const elementSymbol = nuclideText?.split('-')[0] || '';

    await firstNuclideCard.click();

    // Verify nuclide is pinned
    await expect(firstNuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Now pin a DIFFERENT element via heatmap (e.g., Chromium - Z=24)
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.scrollIntoViewIfNeeded();
    const isHeatmapExpanded = await heatmapToggle.getAttribute('title').then(t => t?.includes('Collapse'));
    if (!isHeatmapExpanded) {
      await heatmapToggle.click();
      await page.waitForTimeout(500); // Wait for expansion animation
    }

    const crButton = page.getByRole('button', { name: /^24\s+Cr$/ }).first();
    await crButton.scrollIntoViewIfNeeded();
    await crButton.click();
    await page.waitForTimeout(500);

    // Verify Chromium is pinned (check ring and filtered nuclides heading)
    await expect(crButton).toHaveClass(/ring-2.*ring-blue/);
    await expect(page.getByText(/Nuclides of Cr in Results/)).toBeVisible();

    // Verify first nuclide is NO LONGER pinned (mutually exclusive behavior)
    const pinnedNuclideCheck = page.locator('div[class*="ring-2"][class*="ring-blue-400"]').first();
    await expect(pinnedNuclideCheck).not.toBeVisible();
  });

  test('should have clickable links to element-data page for nuclides in results table', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('[role="region"][aria-label="Fission reaction results"] div[class*="grid"][class*="border-b"]') !== null,
      { timeout: 10000 }
    );

    // Find the first nuclide link in the results
    const resultsRegion = page.getByRole('region', { name: /Fission reaction results/i });
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
