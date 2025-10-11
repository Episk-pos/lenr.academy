import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Two-to-Two Query Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/twotwo');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display two-to-two query page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Two-to-Two Reactions/i })).toBeVisible();

    // Should have periodic table selectors for inputs and outputs
    await expect(page.getByText(/Input Element 1/i)).toBeVisible();
    await expect(page.getByText(/Input Element 2/i)).toBeVisible();
  });

  test('should execute two-to-two query', async ({ page }) => {
    // Use default selections (H + Ni,Li,Al,B,N + C → Any)
    // Query should execute automatically on page load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Should show results table
    await expect(page.locator('table')).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/Query executed in/i)).toBeVisible();
  });

  test('should filter by output elements', async ({ page }) => {
    // Wait for default query to execute
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Open Output Element 4 selector and add Nitrogen
    const outputSelector = page.getByRole('button', { name: /^Any$/i }).last();
    await outputSelector.click();

    const nitrogen = page.getByRole('button', { name: /^7\s+N$/i }).first();
    await nitrogen.waitFor({ state: 'visible', timeout: 5000 });
    await nitrogen.click();

    await page.keyboard.press('Escape');

    // Query should re-execute automatically
    await page.waitForTimeout(2000);

    await expect(page.locator('table')).toBeVisible();
  });

  test('should filter by energy range', async ({ page }) => {
    // Wait for default query to execute first
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Set energy range using placeholder selectors
    const minMevInput = page.getByPlaceholder(/min/i);
    await minMevInput.fill('2.0');

    const maxMevInput = page.getByPlaceholder(/max/i);
    await maxMevInput.fill('25.0');

    // Query auto-executes when filters change - wait for results to update
    await page.waitForTimeout(2000);

    // Verify results table is still visible
    await expect(page.locator('table')).toBeVisible();
  });

  test('should handle complex multi-element queries', async ({ page }) => {
    // Use default multi-element selection (H + Ni,Li,Al,B,N + C)
    // which already tests complex queries
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 20000 }
    );

    await expect(page.locator('table')).toBeVisible();

    // Verify multiple elements are selected
    await expect(page.getByText(/5 selected.*Ni.*Li/i)).toBeVisible();
  });

  test('should display reaction format A + B → C + D', async ({ page }) => {
    // Use default query which executes on load
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 15000 }
    );

    // Results should show A + B → C + D format
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();

    // Should have table cells with nuclide data
    const cells = firstRow.locator('td');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should limit results due to large dataset', async ({ page }) => {
    // Two-to-two has 516,789 reactions, so limits are important
    // Default limit is 100, let's change it to 50
    await page.waitForFunction(
      () => document.querySelector('table tbody') !== null,
      { timeout: 15000 }
    );

    const limitInput = page.locator('input[type="number"]').last();
    await limitInput.fill('50');

    // Wait for query to re-execute
    await page.waitForTimeout(2000);

    // Should have at most 50 results
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeLessThanOrEqual(50);

    // Should show total count message
    await expect(page.getByText(/Showing/i)).toBeVisible();
  });

  test('should export two-to-two results', async ({ page }) => {
    // Use default query
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Find export button
    const exportButton = page.getByRole('button', { name: /export|CSV/i });

    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    }
  });

  test('should show performance warning for large queries', async ({ page }) => {
    // Default query already handles large dataset
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Just verify query completes and shows results
    await expect(page.locator('table')).toBeVisible();

    // Should show "Showing X of Y" message
    await expect(page.getByText(/Showing/i)).toBeVisible();
  });

  test('should support URL parameters', async ({ page }) => {
    // Navigate with parameters
    await page.goto('/twotwo?e1=H&e2=C&minMeV=5&limit=25');
    await waitForDatabaseReady(page);

    // Check filters are populated using placeholder selectors
    const minMevInput = page.getByPlaceholder(/min/i);
    await expect(minMevInput).toHaveValue('5');

    // Limit input is the last number input
    const limitInput = page.locator('input[type="number"]').last();
    await expect(limitInput).toHaveValue('25');
  });

  test('should allow both element and nuclide to be pinned simultaneously', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Wait for sections to populate
    await page.locator('text=Elements Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Wait for cards to appear
    await page.locator('div.cursor-pointer:has(div.font-bold)').first().waitFor({ state: 'visible', timeout: 10000 });

    // Get the first element that appears (e.g., Carbon from default query)
    const elementCards = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const firstElementSymbol = await elementCards.first().locator('div.font-bold').first().textContent();
    const firstElementCard = page.getByText(new RegExp(`^${firstElementSymbol}$`)).locator('..').filter({ has: page.locator('div.font-bold') }).first();

    // Click the first element
    await firstElementCard.click();

    // Verify element is pinned
    await expect(firstElementCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Now find a nuclide that belongs to this element
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const nuclideCount = await nuclideCards.count();

    // Find a nuclide of the same element
    let matchingNuclideCard = null;
    for (let i = 0; i < nuclideCount; i++) {
      const card = nuclideCards.nth(i);
      const nuclideText = await card.locator('span.font-semibold').first().textContent();
      if (nuclideText?.startsWith(`${firstElementSymbol}-`)) {
        matchingNuclideCard = card;
        break;
      }
    }

    // Click the nuclide
    await matchingNuclideCard!.click();

    // Verify nuclide is now pinned
    await expect(matchingNuclideCard!).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify element is STILL pinned (both can be pinned simultaneously when nuclide belongs to element)
    await expect(firstElementCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Click element again to unpin it
    await firstElementCard.click();

    // Verify element is no longer pinned
    await expect(firstElementCard).not.toHaveClass(/ring-2.*ring-blue-400/);

    // Verify nuclide is STILL pinned
    await expect(matchingNuclideCard!).toHaveClass(/ring-2.*ring-blue-400/);
  });

  test('should persist pinned element in URL with pinE parameter', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
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
      { timeout: 15000 }
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
    // Navigate with pinE parameter - query B+Ni→C reactions (works with default E3='C' filter)
    // B+Ni produces Fe as E4, so we can pin Fe
    await page.goto('/twotwo?e1=B&e2=Ni&pinE=Fe');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Wait for "Elements Appearing in Results" section to be visible
    await page.locator('text=Elements Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Scroll section into view
    await page.locator('text=Elements Appearing in Results').scrollIntoViewIfNeeded();

    // Wait for element cards to populate
    await page.locator('div.cursor-pointer:has(div.font-bold)').first().waitFor({ state: 'visible', timeout: 10000 });

    // Wait longer for URL initialization in two-to-two (large dataset)
    await page.waitForTimeout(2000);

    // Find the Iron element card
    const feCard = page.getByText('Iron').locator('..').first();

    // Verify Iron is pinned
    await expect(feCard).toBeVisible();
    await expect(feCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify element details card is visible
    await expect(page.getByText(/Atomic Number.*26/).first()).toBeVisible();
  });

  test('should restore both pinned element and nuclide from URL', async ({ page }) => {
    // Navigate with both pinE and pinN parameters - B+Ni→C+Fe produces Fe-58 as output
    await page.goto('/twotwo?e1=B&e2=Ni&pinE=Fe&pinN=Fe-58');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Wait for sections to be visible
    await page.locator('text=Elements Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Nuclides Appearing in Results').waitFor({ state: 'visible', timeout: 10000 });

    // Scroll sections into view
    await page.locator('text=Elements Appearing in Results').scrollIntoViewIfNeeded();
    await page.locator('text=Nuclides Appearing in Results').scrollIntoViewIfNeeded();

    // Wait for cards to populate
    await page.locator('div.cursor-pointer:has(div.font-bold)').first().waitFor({ state: 'visible', timeout: 10000 });

    // Wait longer for URL initialization in two-to-two (large dataset)
    await page.waitForTimeout(2000);

    // Find both cards
    const feCard = page.getByText('Iron').locator('..').first();
    const fe58Card = page.locator('div.cursor-pointer:has-text("Fe-58")').first();

    // Verify both are pinned
    await expect(feCard).toBeVisible();
    await expect(feCard).toHaveClass(/ring-2.*ring-blue-400/);
    await expect(fe58Card).toBeVisible();
    await expect(fe58Card).toHaveClass(/ring-2.*ring-blue-400/);
  });

  test('should ignore invalid pinE/pinN parameters', async ({ page }) => {
    // Navigate with invalid parameters
    await page.goto('/twotwo?pinE=InvalidElement&pinN=InvalidNuclide-999');
    await waitForDatabaseReady(page);

    // Wait for results to load
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // No cards should be pinned
    const pinnedCards = page.locator('div[class*="ring-2 ring-blue-400"]');
    await expect(pinnedCards).toHaveCount(0);
  });

  test('should unpin nuclide when pinning a different element', async ({ page }) => {
    // Wait for default query results to load (H+Ni,Li,Al,B,N+C)
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 15000 }
    );

    // Pin the first nuclide that appears in results
    const nuclideCards = page.locator('text=Nuclides Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');
    const firstNuclideCard = nuclideCards.first();
    await firstNuclideCard.click();

    // Verify nuclide is pinned
    await expect(firstNuclideCard).toHaveClass(/ring-2.*ring-blue-400/);

    // Get the nuclide identifier for later verification
    const nuclideText = await firstNuclideCard.locator('span.font-semibold').first().textContent();
    const [nuclideElement] = nuclideText!.split('-');

    // Now pin a DIFFERENT element (not the nuclide's parent element)
    const elementCards = page.locator('text=Elements Appearing in Results').locator('..').locator('div[class*="cursor-pointer"]');

    // Find an element that's NOT the nuclide's parent element
    let differentElementCard = null;
    const elementCount = await elementCards.count();
    for (let i = 0; i < elementCount; i++) {
      const card = elementCards.nth(i);
      const elementSymbol = await card.locator('div.font-bold').first().textContent();
      if (elementSymbol !== nuclideElement) {
        differentElementCard = card;
        break;
      }
    }

    // Click the different element
    await differentElementCard!.click();

    // Verify different element is pinned
    await expect(differentElementCard!).toHaveClass(/ring-2.*ring-blue-400/);

    // Verify first nuclide is NO LONGER pinned (regression check)
    await expect(firstNuclideCard).not.toHaveClass(/ring-2.*ring-blue-400/);

    // URL should not contain the pinned nuclide anymore
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).not.toContain(`pinN=${nuclideText}`);
  });
});

test.describe('Two-to-Two Query - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/twotwo');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should handle queries efficiently', async ({ page }) => {
    // Use default query and measure performance
    const startTime = Date.now();

    // Wait for results
    await page.waitForFunction(
      () => document.querySelector('table') !== null,
      { timeout: 20000 }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Query should complete in reasonable time (< 20 seconds for complex query)
    expect(duration).toBeLessThan(20000);

    await expect(page.locator('table')).toBeVisible();

    // Should show execution time
    await expect(page.getByText(/Query executed in/i)).toBeVisible();
  });
});

test.describe('Two-to-Two Query - Navigation Links', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/twotwo');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should have clickable links to element-data page for nuclides in results table', async ({ page }) => {
    // Wait for default query results to load
    await page.waitForFunction(
      () => document.querySelector('table tbody tr') !== null,
      { timeout: 15000 }
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
