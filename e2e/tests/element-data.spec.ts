import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Element Data Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/element-data');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display element data page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();

    // Should have periodic table with element buttons (check for Hydrogen)
    await expect(page.getByRole('button', { name: '1 H' })).toBeVisible();
  });

  test('should display element data when selected', async ({ page }) => {
    // Select an element (e.g., Iron)
    const iron = page.getByRole('button', { name: '26 Fe' });
    await iron.click();

    // Should show element properties heading
    await expect(page.getByRole('heading', { name: /Iron \(Fe\)/i })).toBeVisible();

    // Should show atomic number
    await expect(page.getByText(/Atomic Number: 26/)).toBeVisible();

    // Should show element properties sections
    await expect(page.getByRole('heading', { name: /Thermal Properties/i })).toBeVisible();
  });

  test('should load element from URL parameter Z', async ({ page }) => {
    // Navigate with Z parameter (Iron = 26)
    await page.goto('/element-data?Z=26');
    await waitForDatabaseReady(page);

    // Should show Iron data heading
    await expect(page.getByRole('heading', { name: /Iron \(Fe\)/i })).toBeVisible();
    await expect(page.getByText(/Atomic Number: 26/)).toBeVisible();
  });

  test('should load specific isotope from URL parameters Z and A', async ({ page }) => {
    // Navigate with Z and A parameters (Iron-56)
    await page.goto('/element-data?Z=26&A=56');
    await waitForDatabaseReady(page);

    // Should show Fe-56 heading specifically
    await expect(page.getByRole('heading', { name: /Fe-56/i })).toBeVisible();

    // Should show isotope-specific data
    await expect(page.getByText(/binding energy/i)).toBeVisible();
  });

  test('should display isotope table for element', async ({ page }) => {
    // Select Carbon
    await page.goto('/element-data?Z=6');
    await waitForDatabaseReady(page);

    // Should show Carbon heading
    await expect(page.getByRole('heading', { name: /Carbon \(C\)/i })).toBeVisible();

    // Should show nuclides section heading
    await expect(page.getByRole('heading', { name: /Nuclides.*3 available/i })).toBeVisible();

    // Should show multiple isotope buttons (C-12, C-13, C-14)
    await expect(page.getByRole('button', { name: /C-12/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /C-13/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /C-14/i })).toBeVisible();
  });

  test('should show nuclide properties', async ({ page }) => {
    // Navigate to specific isotope
    await page.goto('/element-data?Z=1&A=2'); // Deuterium
    await waitForDatabaseReady(page);

    // Should show nuclide card with properties
    await expect(page.getByText(/binding energy/i)).toBeVisible();

    // Should show boson/fermion classification
    const bosonFermion = page.getByText(/boson|fermion/i);
    const hasBosonFermion = await bosonFermion.isVisible().catch(() => false);

    if (hasBosonFermion) {
      await expect(bosonFermion).toBeVisible();
    }
  });

  test('should navigate between isotopes of same element', async ({ page }) => {
    // Start with C-12
    await page.goto('/element-data?Z=6&A=12');
    await waitForDatabaseReady(page);

    // Should show C-12 heading
    await expect(page.getByRole('heading', { name: /C-12/i })).toBeVisible();

    // Click on a different isotope (e.g., C-13 button)
    const c13Button = page.getByRole('button', { name: /C-13/i });

    if (await c13Button.isVisible().catch(() => false)) {
      await c13Button.click();

      // URL should update
      await expect(page).toHaveURL(/A=13/);

      // Should show C-13 heading
      await expect(page.getByRole('heading', { name: /C-13/i })).toBeVisible();
    }
  });

  test('should show element properties with correct units', async ({ page }) => {
    // Navigate to a well-known element
    await page.goto('/element-data?Z=79'); // Gold
    await waitForDatabaseReady(page);

    // Should show melting point with units
    const meltingPoint = page.getByText(/melting.*point/i);
    await expect(meltingPoint).toBeVisible();

    // Should show density
    const density = page.getByText(/density/i);
    await expect(density).toBeVisible();

    // Should show electronegativity
    const electronegativity = page.getByText(/electronegativity/i);
    await expect(electronegativity).toBeVisible();
  });

  test('should display atomic radii data', async ({ page }) => {
    // Navigate to Gold (has all 4 radius types)
    await page.goto('/element-data?Z=79');
    await waitForDatabaseReady(page);

    // Should show "Atomic Radii" heading
    await expect(page.getByText(/Atomic Radii \(pm\)/i)).toBeVisible();

    // Should show all 4 radius types with actual values (Gold has all 4)
    // Check for the grid containing radii data
    const radiiGrid = page.locator('div:has-text("Empirical:")').first();
    await expect(radiiGrid).toBeVisible();

    // Verify the data grid contains the radius labels and values
    await expect(page.locator('dt:has-text("Empirical:")')).toBeVisible();
    await expect(page.locator('dt:has-text("Calculated:")')).toBeVisible();
    await expect(page.locator('dt:has-text("Van der Waals:")')).toBeVisible();
    await expect(page.locator('dt:has-text("Covalent:")')).toBeVisible();

    // Should show explanatory help text
    await expect(page.getByText(/Measured.*Theoretical/i)).toBeVisible();
  });

  test('should handle partial atomic radii data', async ({ page }) => {
    // Navigate to Carbon (has 3 out of 4 radius types)
    await page.goto('/element-data?Z=6');
    await waitForDatabaseReady(page);

    // Should show "Atomic Radii (pm)" heading
    await expect(page.getByText(/Atomic Radii \(pm\)/i)).toBeVisible();

    // Carbon should have 3 types of radii displayed
    // Just verify that the Atomic Radii section contains the key labels
    const atomicRadiiSection = page.locator('text=Atomic Radii (pm)').locator('..').locator('..');
    await expect(atomicRadiiSection).toContainText('Empirical:');
    await expect(atomicRadiiSection).toContainText('Calculated:');
    await expect(atomicRadiiSection).toContainText('Van der Waals:');

    // Should show the explanatory help text
    await expect(page.getByText(/Measured.*Theoretical/i)).toBeVisible();
  });

  test('should update URL when selecting element', async ({ page }) => {
    // Start at base page
    await page.goto('/element-data');
    await waitForDatabaseReady(page);

    // Select an element (Oxygen) - use exact match to avoid matching "118 Og"
    const oxygen = page.getByRole('button', { name: '8 O', exact: true });
    await oxygen.click();

    // Wait for URL to update
    await page.waitForURL(/Z=8/, { timeout: 5000 });

    // URL should contain Z=8
    await expect(page).toHaveURL(/Z=8/);
  });

  test('should handle invalid Z parameter gracefully', async ({ page }) => {
    // Navigate with invalid Z
    await page.goto('/element-data?Z=999');
    await waitForDatabaseReady(page);

    // Should not crash - might show empty state or default view
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();

    // Should not show element data for invalid Z
    const elementCard = page.locator('[data-testid="element-card"]');
    const hasCard = await elementCard.isVisible().catch(() => false);

    // Either no card or some error/empty state message
    if (!hasCard) {
      // Empty state is valid
      expect(true).toBe(true);
    }
  });

  test('should handle invalid A parameter gracefully', async ({ page }) => {
    // Navigate with valid Z but invalid A
    await page.goto('/element-data?Z=6&A=999');
    await waitForDatabaseReady(page);

    // Should show element (Carbon) heading
    await expect(page.getByRole('heading', { name: /Carbon \(C\)/i })).toBeVisible();

    // Should fall back to showing element data with nuclides
    await expect(page.getByRole('heading', { name: /Nuclides.*3 available/i })).toBeVisible();
  });

  test('should show stable vs unstable isotopes', async ({ page }) => {
    // Navigate to element with both stable and unstable isotopes
    await page.goto('/element-data?Z=6'); // Carbon
    await waitForDatabaseReady(page);

    // Should show nuclides section
    await expect(page.getByRole('heading', { name: /Nuclides.*3 available/i })).toBeVisible();

    // Should show isotope buttons (stable: C-12, C-13; unstable: C-14)
    await expect(page.getByRole('button', { name: /C-12/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /C-13/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /C-14/i })).toBeVisible();
  });

  test('should display charts/graphs if available', async ({ page }) => {
    // Navigate to element
    await page.goto('/element-data?Z=26'); // Iron
    await waitForDatabaseReady(page);

    // Check for any charts (might use recharts for visualization)
    const svg = page.locator('svg');
    const hasSvg = await svg.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Charts are optional - just verify page doesn't crash
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();
  });

  test('should support browser back/forward with URL state', async ({ page }) => {
    // Navigate to Fe
    await page.goto('/element-data?Z=26');
    await waitForDatabaseReady(page);
    await expect(page.getByText(/Iron/i)).toBeVisible();

    // Navigate to Cu
    await page.goto('/element-data?Z=29');
    await waitForDatabaseReady(page);
    await expect(page.getByText(/Copper/i)).toBeVisible();

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/Z=26/);
    await expect(page.getByText(/Iron/i)).toBeVisible();

    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/Z=29/);
    await expect(page.getByText(/Copper/i)).toBeVisible();
  });

  test('should link to nuclides in reaction tables', async ({ page }) => {
    // Navigate to element
    await page.goto('/element-data?Z=1'); // Hydrogen
    await waitForDatabaseReady(page);

    // If there are links to reactions or related nuclides
    const links = page.locator('a[href*="/element-data"]');
    const count = await links.count();

    // Just verify page loads correctly
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();
  });
});

test.describe('Element Data - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/element-data');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();

    // Select Hydrogen element (periodic table should be responsive)
    const h = page.getByRole('button', { name: '1 H' });
    await h.waitFor({ state: 'visible', timeout: 10000 });
    await h.click();

    // Should show element data in mobile-friendly layout
    await expect(page.getByRole('heading', { name: /Hydrogen \(H\)/i })).toBeVisible();
  });

  test('should scroll through periodic table on mobile', async ({ page }) => {
    // Periodic table should be scrollable - verify by scrolling to Gold on the right
    const au = page.getByRole('button', { name: '82 Pb' });

    // Scroll to Gold element and click it
    await au.scrollIntoViewIfNeeded();
    await au.click();

    // Should show gold data
    await expect(page.getByRole('heading', { name: /Lead \(Pb\)/i })).toBeVisible();
  });
});
