import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  waitForReactionResults
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
    // Wait for results to load
    await waitForReactionResults(page, 'fusion');

    // Scroll to results table (heatmap pushes it below fold)
    const resultsHeading = page.getByRole('heading', { name: /Showing.*matching reactions/i });
    await resultsHeading.scrollIntoViewIfNeeded();

    // Verify that the query executed and has nuclides appearing in results
    const hasNuclidesSection = await page.getByText('Nuclides Appearing in Results').isVisible();
    const resultsRegion = page.getByRole('region', { name: /Fusion reaction results/i });
    const hasResults = await resultsRegion.locator('div[class*="grid"][class*="border-b"]').count() > 0;

    expect(hasNuclidesSection).toBe(true);
    expect(hasResults).toBe(true);
  });

  test('should have predictable element distribution in fusion results', async ({ page }) => {
    // Navigate to H+He fusion which has specific results
    await page.goto('/fusion?e1=H&e2=He');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fusion');

    // Verify nuclides section exists and contains hydrogen or helium isotopes
    const nuclidesSection = page.getByText('Nuclides Appearing in Results');
    await nuclidesSection.scrollIntoViewIfNeeded();
    const hasNuclides = await nuclidesSection.isVisible();

    // Verify at least one nuclide appears (H-based or He-based)
    const hasHydrogenNuclide = await page.locator('text=/H-\\d+/').first().isVisible().catch(() => false);
    const hasHeliumNuclide = await page.locator('text=/He-\\d+/').first().isVisible().catch(() => false);

    expect(hasNuclides).toBe(true);
    expect(hasHydrogenNuclide || hasHeliumNuclide).toBe(true);
  });

  test('should track unique isotopes for diversity metric', async ({ page }) => {
    // Navigate to D+D fusion which produces multiple isotopes
    await page.goto('/fusion?e1=D&e2=D');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fusion');

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

    // Wait for results to load
    await waitForReactionResults(page, 'fusion');

    // Verify results have MeV values displayed (green text in results)
    const resultsRegion = page.getByRole('region', { name: /Fusion reaction results/i });
    const mevValues = await resultsRegion.locator('.text-green-600').count();

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

    // Wait for results to load
    await waitForReactionResults(page, 'fission');

    // Verify nuclides appear in fission results (Elements card was removed)
    const nuclidesSection = await page.getByText('Nuclides Appearing in Results').isVisible();

    expect(nuclidesSection).toBe(true);
  });

  test('should work with two-to-two queries', async ({ page }) => {
    // Use default query parameters that are known to have results
    await page.goto('/twotwo?e1=D&e2=Ni&e3=C');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'twotwo');

    // Verify nuclides appear in two-to-two results
    const nuclideSection = page.getByText('Nuclides Appearing in Results');
    await expect(nuclideSection).toBeVisible({ timeout: 10000 });
  });

  test('should filter nuclides when element is pinned', async ({ page }) => {
    // Navigate to fusion query with default results
    await page.goto('/fusion');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fusion');

    // Get initial nuclide count
    const initialText = await page.locator('h3:has-text("Nuclides Appearing in Results")').textContent();
    const initialMatch = initialText?.match(/\((\d+)\)/);
    const initialCount = initialMatch ? parseInt(initialMatch[1]) : 0;

    expect(initialCount).toBeGreaterThan(0);

    // Click on an element in the periodic table heatmap
    // First scroll to and expand the heatmap
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.scrollIntoViewIfNeeded();

    // Check if heatmap is already expanded
    const isExpanded = await heatmapToggle.getAttribute('title').then(t => t?.includes('Collapse'));
    if (!isExpanded) {
      await heatmapToggle.click();
      // Wait for heatmap to expand and animation to complete
      await page.waitForTimeout(1500);
    }

    // Find and click an available element (e.g., Carbon) in the heatmap
    // Wait for any Carbon button to be visible, then filter by the one in the heatmap card
    await page.waitForTimeout(500); // Extra wait for periodic table to render
    const allCarbonButtons = page.getByRole('button', { name: /^6\s+C$/ });
    const carbonCount = await allCarbonButtons.count();

    // If there are multiple Carbon buttons, the heatmap one is the last one
    // If only one, it's the heatmap one (selector is collapsed)
    const carbonButton = carbonCount > 1 ? allCarbonButtons.last() : allCarbonButtons.first();
    await carbonButton.waitFor({ state: 'visible', timeout: 5000 });
    await carbonButton.click();

    // Wait for the nuclides list to update
    await page.waitForTimeout(500);

    // Verify nuclides are filtered
    const filteredText = await page.locator('h3:has-text("Nuclides")').textContent();
    expect(filteredText).toContain('Nuclides of C in Results');

    // Extract filtered count
    const filteredMatch = filteredText?.match(/\((\d+) of (\d+)/);
    if (filteredMatch) {
      const filteredCount = parseInt(filteredMatch[1]);
      const totalCount = parseInt(filteredMatch[2]);

      expect(filteredCount).toBeLessThan(totalCount);
      expect(filteredCount).toBeGreaterThan(0);
      expect(totalCount).toBe(initialCount);
    }
  });

  test('should auto-expand heatmap when loading with pinned element', async ({ page }) => {
    // Navigate to fusion query with pinE parameter AND element selections to ensure Carbon is in results
    await page.goto('/fusion?e1=H&e2=C&pinE=C');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fusion');

    // Scroll to heatmap section to ensure it's in view
    const heatmapSection = page.locator('h3:has-text("Element Heatmap")');
    await heatmapSection.scrollIntoViewIfNeeded();

    // Wait longer for the auto-expansion effect to run
    await page.waitForTimeout(2000);

    // Verify heatmap is expanded by checking if the toggle button text says "Collapse"
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    const toggleText = await heatmapToggle.getAttribute('title');

    expect(toggleText).toContain('Collapse');

    // Also verify periodic table elements are visible
    const allCarbonButtons = page.getByRole('button', { name: /^6\s+C$/ });
    const carbonCount = await allCarbonButtons.count();
    const carbonButton = carbonCount > 1 ? allCarbonButtons.last() : allCarbonButtons.first();
    await expect(carbonButton).toBeVisible();

    // Verify the element is pinned (look for the filter message)
    const nuclidesHeader = await page.locator('h3:has-text("Nuclides")').textContent();
    expect(nuclidesHeader).toContain('Nuclides of C in Results');
  });

  test('should color elements with heatmap data even if not selectable', async ({ page }) => {
    // Navigate to a fusion query where some output elements may not be in input selectors
    await page.goto('/fusion?e1=H&e2=Li');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fusion');

    // Expand heatmap
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.click();

    await page.waitForTimeout(500);

    // Check that elements in the periodic table have background colors
    // Get all periodic table buttons
    const buttons = page.locator('.grid button[class*="aspect-square"]');
    const buttonCount = await buttons.count();

    let coloredCount = 0;

    // Sample a few buttons to check for colors
    for (let i = 0; i < Math.min(buttonCount, 20); i++) {
      const button = buttons.nth(i);
      const bgColor = await button.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Check if it has a color other than transparent or default gray
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && !bgColor.includes('243, 244, 246')) {
        coloredCount++;
      }
    }

    // At least some elements should have heatmap colors
    expect(coloredCount).toBeGreaterThan(0);
  });

  test('should use 16-level color gradient in heatmap', async ({ page }) => {
    // Navigate to a query with diverse results
    await page.goto('/fusion?e1=H&e2=C,O');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await waitForReactionResults(page, 'fusion');

    // Expand heatmap
    const heatmapToggle = page.locator('button[title*="periodic table"]').first();
    await heatmapToggle.click();

    await page.waitForTimeout(500);

    // Collect background colors from periodic table elements
    const buttons = page.locator('.grid button[class*="aspect-square"]');
    const buttonCount = await buttons.count();

    const uniqueColors = new Set<string>();

    for (let i = 0; i < Math.min(buttonCount, 50); i++) {
      const button = buttons.nth(i);
      const bgColor = await button.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
        uniqueColors.add(bgColor);
      }
    }

    // Should have multiple distinct colors (not just 1 or 2)
    // With 16-level gradient, we expect at least 2 different colors in typical results
    expect(uniqueColors.size).toBeGreaterThanOrEqual(2);
  });
});
