import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
} from '../fixtures/test-helpers';

test.describe('Cascade Sankey Diagram Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/cascades');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Wait for database to load and run a simulation (longer timeout for test isolation)
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 20000 });

    // Use default params which should generate enough pathways
    await runButton.click();

    // Wait for results
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });

    // Navigate to the Flow View tab (Sankey diagram)
    await page.click('button:has-text("Flow View")');
    await page.waitForTimeout(1000);
  });

  test('should enforce maximum pathway limit of 30', async ({ page }) => {
    // Open filters
    await page.click('button:has-text("Show Filters")');
    await page.waitForTimeout(500);

    // Find the "Show Top Pathways" slider specifically
    const topNSlider = page.locator('label:has-text("Show Top Pathways")').locator('..').locator('input[type="range"]');
    const max = await topNSlider.getAttribute('max');
    expect(max).toBe('30');

    // Verify the slider label shows the max
    await expect(page.getByText('30 (max)')).toBeVisible();
  });

  test('should show warning when pathway count is high', async ({ page }) => {
    // Open filters
    await page.click('button:has-text("Show Filters")');
    await page.waitForTimeout(500);

    // Set pathway count above warning threshold (>20)
    const topNSlider = page.locator('label:has-text("Show Top Pathways")').locator('..').locator('input[type="range"]');
    await topNSlider.fill('25');
    await page.waitForTimeout(500);

    // Should show warning message
    await expect(page.locator('text=High pathway counts may cause slow rendering or errors')).toBeVisible();
  });

  test('should not show warning when pathway count is low', async ({ page }) => {
    // Open filters
    await page.click('button:has-text("Show Filters")');
    await page.waitForTimeout(500);

    // Set pathway count below warning threshold (≤20)
    const topNSlider = page.locator('label:has-text("Show Top Pathways")').locator('..').locator('input[type="range"]');
    await topNSlider.fill('15');
    await page.waitForTimeout(500);

    // Should NOT show warning message
    const warningCount = await page.locator('text=High pathway counts may cause slow rendering').count();
    expect(warningCount).toBe(0);
  });

  test('should display filter status showing pathway limits', async ({ page }) => {
    // Should show status like "Showing X of Y total pathways"
    const statusText = await page.locator('text=Showing').first().textContent();
    expect(statusText).toMatch(/Showing \d+ of \d+ total pathways/);
  });

  test('should handle empty pathway results gracefully', async ({ page }) => {
    // Open filters
    await page.click('button:has-text("Show Filters")');
    await page.waitForTimeout(500);

    // Combine high frequency filter with feedback-only to get zero results
    const freqSlider = page.locator('label:has-text("Minimum Frequency")').locator('..').locator('input[type="range"]');
    const maxFreq = await freqSlider.getAttribute('max');
    await freqSlider.fill(maxFreq || '100');

    // Also enable feedback-only filter
    await page.locator('#feedback-only').check();
    await page.waitForTimeout(1000);

    // Should show "no pathways match" message (combination of filters produces zero results)
    await expect(page.locator('text=No pathways match current filters.')).toBeVisible({ timeout: 5000 });
  });

  test('should handle feedback-only filter reducing pathways', async ({ page }) => {
    // Open filters
    await page.click('button:has-text("Show Filters")');
    await page.waitForTimeout(1000); // Wait longer for animation

    // Enable feedback-only filter using the ID
    await page.locator('#feedback-only').check();
    await page.waitForTimeout(1000);

    // Should either show reduced pathways or "no pathways" message
    const hasResults = await page.locator('text=Showing').first().isVisible();
    const hasNoResults = await page.locator('text=No pathways match').isVisible();

    expect(hasResults || hasNoResults).toBe(true);
  });

  test('should show help guide on first visit', async ({ page }) => {
    // Clear localStorage to ensure guide shows
    await page.evaluate(() => localStorage.removeItem('cascade-sankey-guide-seen'));

    // Reload to trigger guide - wait for state restoration from IndexedDB
    await page.reload();

    // Wait for simulation results to be restored
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Flow View")');
    await page.waitForTimeout(2000); // Wait for diagram to render

    // Guide should be visible on first visit
    await expect(page.locator('text=How to Read This Diagram')).toBeVisible({ timeout: 5000 });

    // Guide should have helpful content
    await expect(page.locator('text=Green boxes')).toBeVisible();
    await expect(page.locator('text=Blue boxes')).toBeVisible();
    await expect(page.locator('text=Orange boxes')).toBeVisible();

    // Find close button (X icon button near the guide heading)
    const guideCard = page.locator('text=How to Read This Diagram').locator('../..');
    const closeButton = guideCard.locator('button').last();
    await closeButton.click();

    // Guide should be hidden after closing
    await expect(page.locator('text=How to Read This Diagram')).not.toBeVisible();
  });

  test('should provide help button to reshow guide', async ({ page }) => {
    // First ensure guide is hidden (set localStorage key)
    await page.evaluate(() => localStorage.setItem('cascade-sankey-guide-seen', 'true'));
    await page.reload();

    // Wait for simulation results to be restored from localStorage
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Flow View")');
    await page.waitForTimeout(1000);

    // Look for help button (has title="Show guide")
    const helpButton = page.locator('button[title="Show guide"]');

    await expect(helpButton).toBeVisible();

    // Click help to show guide
    await helpButton.click();

    // Guide should be visible
    await expect(page.locator('text=How to Read This Diagram')).toBeVisible();
  });

  test('should handle node count limit gracefully', async ({ page }) => {
    // This test verifies that if there are too many unique nuclides (>50 nodes),
    // the diagram either shows an error or automatically reduces the pathway count

    // Open filters
    await page.click('button:has-text("Show Filters")');
    await page.waitForTimeout(500);

    // Try to show maximum pathways
    const topNSlider = page.locator('label:has-text("Show Top Pathways")').locator('..').locator('input[type="range"]');
    await topNSlider.fill('30');

    // Wait for diagram to render or error to appear
    await page.waitForTimeout(3000);

    // Check if error message appears
    const complexityError = await page.locator('text=too complex').isVisible();
    const nuclideError = await page.locator('text=Too many unique nuclides').isVisible();

    if (complexityError || nuclideError) {
      // Error message should suggest using filters
      const errorLocator = complexityError
        ? page.locator('text=too complex')
        : page.locator('text=Too many unique nuclides');
      const errorText = await errorLocator.textContent();
      expect(errorText).toMatch(/filter|reduce|complexity|nuclide/i);
    } else {
      // Otherwise diagram should render successfully
      // (automatic reduction to safe pathway count occurred or diagram handles it)
      const sankeyDiagram = page.locator('svg').first();
      await expect(sankeyDiagram).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show legend explaining node colors', async ({ page }) => {
    // Scroll to bottom where legend is
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Legend should be visible
    await expect(page.getByRole('heading', { name: 'Legend' })).toBeVisible();

    // Should explain color coding - use more specific locators within the legend
    const legend = page.locator('text=Legend').locator('..');
    await expect(legend.locator('div').filter({ hasText: /^Fuel Nuclides$/ })).toBeVisible();
    await expect(legend.locator('div').filter({ hasText: /^Intermediates$/ })).toBeVisible();
    await expect(legend.locator('div').filter({ hasText: /^Final Products$/ })).toBeVisible();
  });

  test('should update diagram when filters change', async ({ page }) => {
    // Take initial status
    const initialStatus = await page.locator('text=Showing').first().textContent();

    // Open filters and change pathway count
    await page.click('button:has-text("Show Filters")');
    await page.waitForTimeout(500);

    const topNSlider = page.locator('label:has-text("Show Top Pathways")').locator('..').locator('input[type="range"]');
    const currentValue = await topNSlider.inputValue();

    // Change to different value
    const newValue = parseInt(currentValue) > 10 ? '10' : '20';
    await topNSlider.fill(newValue);

    // Wait for update
    await page.waitForTimeout(1000);

    // Status should update
    const newStatus = await page.locator('text=Showing').first().textContent();
    expect(newStatus).not.toBe(initialStatus);
  });

  test('should handle rapid filter changes without crashing', async ({ page }) => {
    // Open filters
    await page.click('button:has-text("Show Filters")');
    await page.waitForTimeout(500);

    const topNSlider = page.locator('label:has-text("Show Top Pathways")').locator('..').locator('input[type="range"]');

    // Rapidly change slider value multiple times
    await topNSlider.fill('5');
    await topNSlider.fill('15');
    await topNSlider.fill('25');
    await topNSlider.fill('10');

    // Wait for stabilization
    await page.waitForTimeout(1500);

    // Page should still be functional (no error, no crash)
    await expect(page.locator('text=Showing')).toBeVisible();

    // No JavaScript errors should be visible
    const errorMessages = await page.locator('text=Error').count();
    const jsErrors = await page.locator('text=undefined').count();

    // Some error text might be okay (like in instructions), but should be minimal
    expect(errorMessages + jsErrors).toBeLessThan(3);
  });
});
