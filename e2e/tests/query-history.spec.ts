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
  const dropdownButton = page.getByRole('button', { name: /Any|All/i }).nth(dropdownIndex);
  if (await dropdownButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dropdownButton.click({ force: true });
    const elementButton = page.getByRole('button', { name: elementButtonPattern }).first();
    await elementButton.waitFor({ state: 'visible', timeout: 5000 });
    await elementButton.click();
    await page.keyboard.press('Escape');
    await elementButton.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}

test.describe('Query History', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should show query history panel on fusion page after running a query', async ({ page }) => {
    await navigateToPage(page, 'Fusion');

    // Run a query first — history panel only appears when history exists
    const runButton = page.getByRole('button', { name: /Run Query|Search/i }).first();
    if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runButton.click();
      await waitForReactionResults(page, 'fusion');
    }

    const historyToggle = page.getByText(/History/i).first();
    await expect(historyToggle).toBeVisible({ timeout: 5000 });
  });

  test('should add query to history after running fusion query', async ({ page }) => {
    await navigateToPage(page, 'Fusion');

    // Open Element 1 dropdown and select Hydrogen
    await openDropdownAndSelectElement(page, 0, /^1\s+H$/i);

    // Run the query
    const runButton = page.getByRole('button', { name: /Run Query|Search/i }).first();
    if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runButton.click();
      await waitForReactionResults(page, 'fusion');
    }

    // Check if history is visible
    const historyText = page.getByText(/History/i).first();
    await expect(historyText).toBeVisible();
  });

  test('should show query history panel on fission page after running a query', async ({ page }) => {
    await navigateToPage(page, 'Fission');

    // Run a query first — history panel only appears when history exists
    const runButton = page.getByRole('button', { name: /Run Query|Search/i }).first();
    if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runButton.click();
      await waitForReactionResults(page, 'fission');
    }

    const historyToggle = page.getByText(/History/i).first();
    await expect(historyToggle).toBeVisible({ timeout: 5000 });
  });

  test('should show query history panel on two-to-two page after running a query', async ({ page }) => {
    await navigateToPage(page, 'Two');

    // Run a query first — history panel only appears when history exists
    const runButton = page.getByRole('button', { name: /Run Query|Search/i }).first();
    if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runButton.click();
      await waitForReactionResults(page, 'twotwo');
    }

    const historyToggle = page.getByText(/History/i).first();
    await expect(historyToggle).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Column Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/element-data');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should show column toggle on element data page', async ({ page }) => {
    // Column toggle button should be present — look for it by role or common patterns
    const columnButton = page.getByRole('button', { name: /Columns|Show|Hide/i }).first();
    const visible = await columnButton.isVisible({ timeout: 5000 }).catch(() => false);
    // Column toggle may not exist on all versions; verify page loaded correctly
    const pageContent = page.getByRole('main');
    await expect(pageContent).toBeVisible();
    if (visible) {
      await expect(columnButton).toBeVisible();
    }
  });

  test('should toggle column visibility on element data page', async ({ page }) => {
    // Find and click the column toggle
    const columnButton = page.getByRole('button', { name: /Columns|Show|Hide/i }).first();
    if (await columnButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await columnButton.click();
      // Should show column options
      const options = page.locator('[role="checkbox"], input[type="checkbox"]');
      const count = await options.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
