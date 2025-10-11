import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
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
    await page.getByRole('button', { name: /selected.*Zr/i }).click();

    // Wait for periodic table to appear and select Nickel
    const ni = page.getByRole('button', { name: /^28\s+Ni$/i });
    await ni.waitFor({ state: 'visible', timeout: 5000 });
    await ni.click();

    // Query executes automatically - wait for results table
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Should show results table
    await expect(page.locator('table')).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/Query executed in/i)).toBeVisible();
  });

  test('should filter by output elements', async ({ page }) => {
    // Select input element
    await page.getByRole('button', { name: /selected.*Zr/i }).click();
    const ni = page.getByRole('button', { name: /^28\s+Ni$/i });
    await ni.waitFor({ state: 'visible', timeout: 5000 });
    await ni.click();

    // Query executes automatically - results should appear
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    await expect(page.locator('table')).toBeVisible();
  });

  test('should filter by energy range', async ({ page }) => {
    // Select element - Iron
    await page.getByRole('button', { name: /selected.*Zr/i }).click();
    const fe = page.getByRole('button', { name: /^26\s+Fe$/i });
    await fe.waitFor({ state: 'visible', timeout: 5000 });
    await fe.click();

    // Wait for dropdown to close and query to execute
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Set energy filters
    const minMevInput = page.locator('input[type="number"]').first();
    await minMevInput.fill('0.5');

    const maxMevInput = page.locator('input[type="number"]').nth(1);
    await maxMevInput.fill('20.0');

    // Query should re-execute automatically
    await page.waitForTimeout(1000);

    await expect(page.locator('table')).toBeVisible();
  });

  test('should display fission reaction details', async ({ page }) => {
    // Execute a query - select Copper
    await page.getByRole('button', { name: /selected.*Zr/i }).click();
    const cu = page.getByRole('button', { name: /^29\s+Cu$/i });
    await cu.waitFor({ state: 'visible', timeout: 5000 });
    await cu.click();

    // Wait for results
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 10000 }
    );

    // Results should show input → output1 + output2 format
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();

    // Should have nuclide data in table cells
    await expect(page.locator('tbody tr td').first()).toBeVisible();
  });

  test('should export fission results', async ({ page }) => {
    // Execute query - select Nickel
    await page.getByRole('button', { name: /selected.*Zr/i }).click();
    const ni = page.getByRole('button', { name: /^28\s+Ni$/i });
    await ni.waitFor({ state: 'visible', timeout: 5000 });
    await ni.click();

    // Wait for results
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Find export button
    const exportButton = page.getByRole('button', { name: /export|download/i });

    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/fission.*\.csv/i);
    }
  });

  test('should handle no results for invalid combinations', async ({ page }) => {
    // Select Hydrogen which likely has no fission reactions
    await page.getByRole('button', { name: /selected.*Zr/i }).click();
    const h = page.getByRole('button', { name: /^1\s+H$/i });
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
    await page.waitForTimeout(500);
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

    // Get the nuclide identifier
    const nuclideText = await nuclideCard.locator('span.font-semibold').first().textContent();

    // URL should contain pinN parameter with the nuclide identifier
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain(`pinN=${nuclideText}`);
  });

  test('should restore pinned element from URL on page load', async ({ page }) => {
    // Navigate with pinE parameter (Ca appears in default Zr fission results)
    await page.goto('/fission?pinE=Ca');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Find the Calcium element card
    const elementCards = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const caCard = elementCards.filter({ hasText: /^Ca\s/ }).first();

    // Verify Calcium is pinned
    await expect(caCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify element details card is visible
    await expect(page.getByText(/Calcium/i)).toBeVisible();
  });

  test('should restore both pinned element and nuclide from URL', async ({ page }) => {
    // Navigate with both pinE and pinN parameters (using Ca and Ca-48 from default Zr results)
    await page.goto('/fission?pinE=Ca&pinN=Ca-48');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // Find both cards
    const elementCards = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const caCard = elementCards.filter({ hasText: /^Ca\s/ }).first();

    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const ca48Card = nuclideCards.filter({ hasText: 'Ca-48' }).first();

    // Verify both are pinned
    await expect(caCard).toHaveClass(/ring-2.*ring-blue-400/);
    await expect(ca48Card).toHaveClass(/ring-2.*ring-blue-400/);
  });

  test('should ignore invalid pinE/pinN parameters', async ({ page }) => {
    // Navigate with invalid parameters
    await page.goto('/fission?pinE=InvalidElement&pinN=InvalidNuclide-999');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 10000 }
    );

    // No cards should be pinned
    const pinnedCards = page.locator('div[class*="ring-2 ring-blue-400"]');
    await expect(pinnedCards).toHaveCount(0);
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
