import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  navigateToPage,
  waitForReactionResults,
} from '../fixtures/test-helpers';

/**
 * Helper to open periodic table dropdown and select an element.
 * The periodic table on query pages is inside a dropdown that must be opened first.
 */
async function openDropdownAndSelectElement(
  page: import('@playwright/test').Page,
  dropdownIndex: number,
  elementButtonPattern: RegExp
) {
  // Open the dropdown by clicking the "Any" button (or the current selection button)
  const dropdownButton = page.getByRole('button', { name: /Any|All/i }).nth(dropdownIndex);
  if (await dropdownButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dropdownButton.click({ force: true });
    // Wait for periodic table to appear
    const elementButton = page.getByRole('button', { name: elementButtonPattern }).first();
    await elementButton.waitFor({ state: 'visible', timeout: 5000 });
    await elementButton.click();
    // Close dropdown and wait for it to collapse
    await page.keyboard.press('Escape');
    await elementButton.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}

test.describe('Export Features', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should show export buttons after running fusion query', async ({ page }) => {
    // Open Element 1 dropdown and select Hydrogen
    await openDropdownAndSelectElement(page, 0, /^1\s+H$/i);

    // Click Run Query
    const runButton = page.getByRole('button', { name: /Run Query|Search/i }).first();
    if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runButton.click();
      await waitForReactionResults(page, 'fusion');

      // Export buttons should be visible (JSON and PDF)
      const jsonButton = page.getByRole('button', { name: /JSON/i }).first();
      const pdfButton = page.getByRole('button', { name: /PDF/i }).first();

      const jsonVisible = await jsonButton.isVisible({ timeout: 3000 }).catch(() => false);
      const pdfVisible = await pdfButton.isVisible({ timeout: 3000 }).catch(() => false);

      expect(jsonVisible || pdfVisible).toBe(true);
    }
  });

  test('should show export buttons after running fission query', async ({ page }) => {
    await page.goto('/fission');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);

    // Open Element dropdown and select Uranium
    await openDropdownAndSelectElement(page, 0, /^92\s+U$/i);

    const runButton = page.getByRole('button', { name: /Run Query|Search/i }).first();
    if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runButton.click();
      await waitForReactionResults(page, 'fission');

      // Check for export options (JSON or PDF button should exist)
      const jsonButton = page.getByRole('button', { name: /JSON/i }).first();
      const pdfButton = page.getByRole('button', { name: /PDF/i }).first();
      const jsonVisible = await jsonButton.isVisible({ timeout: 3000 }).catch(() => false);
      const pdfVisible = await pdfButton.isVisible({ timeout: 3000 }).catch(() => false);
      expect(jsonVisible || pdfVisible).toBe(true);
    }
  });

  test('should show share query button on query pages', async ({ page }) => {
    // The share/copy link button should be visible on the fusion page
    const shareButton = page.getByText(/Copy Link|Share/i).first();
    await expect(shareButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Energy Histogram', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should show energy histogram after fusion query with results', async ({ page }) => {
    // Open Element 1 dropdown and select Hydrogen
    await openDropdownAndSelectElement(page, 0, /^1\s+H$/i);

    const runButton = page.getByRole('button', { name: /Run Query|Search/i }).first();
    if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runButton.click();
      await waitForReactionResults(page, 'fusion');

      // Energy histogram section should appear when there are results
      const histogramSection = page.getByText(/Energy Distribution|MeV Distribution|Histogram/i).first();
      await expect(histogramSection).toBeVisible({ timeout: 5000 });
    }
  });
});
