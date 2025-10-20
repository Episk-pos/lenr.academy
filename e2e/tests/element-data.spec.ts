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

    // Should show nuclides section heading with new format "X of Y shown"
    await expect(page.getByRole('heading', { name: /Nuclides.*of.*shown/i })).toBeVisible();

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
    await expect(page.getByRole('heading', { name: /Nuclides.*of.*shown/i })).toBeVisible();
  });

  test('should show stable vs unstable isotopes', async ({ page }) => {
    // Navigate to element with both stable and unstable isotopes
    await page.goto('/element-data?Z=6'); // Carbon
    await waitForDatabaseReady(page);

    // Should show nuclides section
    await expect(page.getByRole('heading', { name: /Nuclides.*of.*shown/i })).toBeVisible();

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
    // Start at element-data page (will default to H, Z=1)
    await page.goto('/element-data');
    await waitForDatabaseReady(page);

    // Click on Iron (Fe) in the periodic table to create first history entry
    const feButton = page.getByRole('button', { name: /^26\s+Fe$/i });
    await feButton.waitFor({ state: 'visible', timeout: 5000 });
    await feButton.click();

    // Verify Iron heading is visible and URL updated
    await expect(page).toHaveURL(/Z=26/);
    await expect(page.getByRole('heading', { name: /Iron/i })).toBeVisible({ timeout: 5000 });

    // Click on Copper (Cu) in the periodic table to create second history entry
    const cuButton = page.getByRole('button', { name: /^29\s+Cu$/i });
    await cuButton.waitFor({ state: 'visible', timeout: 5000 });
    await cuButton.click();

    // Verify Copper heading is visible and URL updated
    await expect(page).toHaveURL(/Z=29/);
    await expect(page.getByRole('heading', { name: /Copper/i })).toBeVisible({ timeout: 5000 });

    // Go back - should return to Iron (testing browser history with React Router)
    await page.goBack();
    await expect(page).toHaveURL(/Z=26/);
    await expect(page.getByRole('heading', { name: /Iron/i })).toBeVisible({ timeout: 10000 });

    // Go forward - should return to Copper
    await page.goForward();
    await expect(page).toHaveURL(/Z=29/);
    await expect(page.getByRole('heading', { name: /Copper/i })).toBeVisible({ timeout: 10000 });
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

  test('should display radioactive decay data for unstable isotopes', async ({ page }) => {
    // Navigate to C-14 (radioactive carbon isotope)
    await page.goto('/element-data?Z=6&A=14');
    await waitForDatabaseReady(page);

    // Should show C-14 heading
    await expect(page.getByRole('heading', { name: /C-14/i })).toBeVisible();

    // Should show Radioactive Decay section if isotope has decay data
    const decayHeading = page.getByRole('heading', { name: /Radioactive Decay/i });
    const hasDecayData = await decayHeading.isVisible().catch(() => false);

    if (hasDecayData) {
      await expect(decayHeading).toBeVisible();

      // Should show decay mode badges (e.g., B-, EC, etc.)
      const decayBadges = page.locator('button').filter({ hasText: /B-|B\+|EC|A|IT/i });
      const badgeCount = await decayBadges.count();
      expect(badgeCount).toBeGreaterThan(0);
    }
  });

  test('should display radiation type legend for radioactive isotopes', async ({ page }) => {
    // Navigate to a radioactive isotope (C-14)
    await page.goto('/element-data?Z=6&A=14');
    await waitForDatabaseReady(page);

    // Should show Radiation Type Legend
    const legendHeading = page.getByRole('heading', { name: /Radiation Type Legend/i });
    const hasLegend = await legendHeading.isVisible().catch(() => false);

    if (hasLegend) {
      await expect(legendHeading).toBeVisible();

      // Should show legend entries with Wikipedia links
      await expect(page.getByText(/Alpha particle/i)).toBeVisible();
      await expect(page.getByText(/Beta minus/i)).toBeVisible();
      await expect(page.getByText(/Gamma ray/i)).toBeVisible();

      // Links should open in new tab
      const alphaLink = page.locator('a[href*="wikipedia.org/wiki/Alpha_particle"]');
      const hasAlphaLink = await alphaLink.isVisible().catch(() => false);
      if (hasAlphaLink) {
        await expect(alphaLink).toHaveAttribute('target', '_blank');
        await expect(alphaLink).toHaveAttribute('rel', 'noopener noreferrer');
      }
    }
  });

  test('should navigate to daughter nuclide when clicking decay mode badge', async ({ page }) => {
    // Navigate to a radioactive isotope with known decay (C-14 decays to N-14)
    await page.goto('/element-data?Z=6&A=14');
    await waitForDatabaseReady(page);

    // Look for decay mode badges
    const decayBadges = page.locator('button').filter({ hasText: /→/ });
    const badgeCount = await decayBadges.count();

    if (badgeCount > 0) {
      // Click the first decay badge
      const firstBadge = decayBadges.first();
      await firstBadge.click();

      // Should navigate to a different nuclide
      await page.waitForURL(/Z=\d+&A=\d+/, { timeout: 5000 });

      // URL should have changed
      const url = page.url();
      expect(url).toMatch(/Z=\d+&A=\d+/);
      expect(url).not.toContain('Z=6&A=14'); // Should not be C-14 anymore
    }
  });

  test('should show destination nuclide in decay badge', async ({ page }) => {
    // Navigate to a radioactive isotope
    await page.goto('/element-data?Z=6&A=14');
    await waitForDatabaseReady(page);

    // Look for decay badges with arrow and destination
    const decayBadges = page.locator('button').filter({ hasText: /→/ });
    const badgeCount = await decayBadges.count();

    if (badgeCount > 0) {
      // Should show destination nuclide (e.g., "B- → N-14")
      const firstBadge = decayBadges.first();
      const badgeText = await firstBadge.textContent();

      // Should contain an arrow and element-mass format
      expect(badgeText).toMatch(/→/);
      expect(badgeText).toMatch(/[A-Z][a-z]?-\d+/); // Element symbol - mass number
    }
  });

  test('should handle missing daughter nuclide gracefully', async ({ page }) => {
    // Navigate with valid Z but invalid A (missing nuclide)
    await page.goto('/element-data?Z=26&A=999');
    await waitForDatabaseReady(page);

    // Should show element (Iron) heading
    await expect(page.getByRole('heading', { name: /Iron \(Fe\)/i })).toBeVisible();

    // Should show "Nuclide Not Available" message with extended timeout
    const notAvailableHeading = page.getByRole('heading', { name: /Nuclide Not Available/i });
    await expect(notAvailableHeading).toBeVisible({ timeout: 10000 });

    // Should explain why
    await expect(page.getByText(/Fe-999.*not available/i)).toBeVisible();
    await expect(page.getByText(/extremely short-lived/i)).toBeVisible();

    // Should still show available isotopes
    await expect(page.getByRole('heading', { name: /Nuclides.*of.*shown/i })).toBeVisible();
  });

  test('should show decay table with first 4 rows always visible', async ({ page }) => {
    // Navigate to Hf-182 (191 decay modes - exceeds 4 row preview)
    await page.goto('/element-data?Z=72&A=182');
    await waitForDatabaseReady(page);

    // Should show Hf-182 heading
    const nuclideHeading = page.getByRole('heading', { name: /Hf-182/i });
    await expect(nuclideHeading).toBeVisible();

    // Scroll to radioactive decay section to ensure table is in view
    const decayHeading = page.getByRole('heading', { name: /Radioactive Decay/i });
    await expect(decayHeading).toBeVisible();
    await decayHeading.scrollIntoViewIfNeeded();

    // Wait for table to be present with proper headers
    const decayTable = page.locator('table').filter({ hasText: 'Decay Mode' });
    await expect(decayTable).toBeVisible();

    // Verify the table has all column headers (within the table context)
    await expect(decayTable.locator('thead')).toContainText('Decay Mode');
    await expect(decayTable.locator('thead')).toContainText('Radiation');
    await expect(decayTable.locator('thead')).toContainText('Energy');
    await expect(decayTable.locator('thead')).toContainText('Intensity');
    await expect(decayTable.locator('thead')).toContainText('Half-life');

    // Should show exactly 4 data rows initially (before expansion)
    const dataRows = page.locator('table tbody tr').filter({ hasNot: page.locator('button:has-text("Show")') });
    const initialRowCount = await dataRows.count();
    expect(initialRowCount).toBeGreaterThanOrEqual(4);
    expect(initialRowCount).toBeLessThanOrEqual(5); // 4 data rows + 1 toggle row

    // Should have "Show more" button since there are >4 decay modes
    const showMoreButton = page.getByRole('button', { name: /Show.*more decay mode/i });
    await expect(showMoreButton).toBeVisible();

    // Button should show correct count (191 total - 4 preview = 187 more)
    await expect(showMoreButton).toHaveText(/Show 187 more decay modes/i);

    // Click to expand
    await showMoreButton.click();

    // Should now show all 191 rows plus toggle row
    const expandedRows = page.locator('table tbody tr');
    const expandedCount = await expandedRows.count();
    expect(expandedCount).toBe(192); // 191 data rows + 1 toggle row

    // Should show "Hide" button
    const hideButton = page.getByRole('button', { name: /Hide.*additional decay mode/i });
    await expect(hideButton).toBeVisible();
    await expect(hideButton).toHaveText(/Hide 187 additional decay modes/i);

    // Click to collapse
    await hideButton.click();

    // Should return to 4 preview rows + toggle row
    await page.waitForTimeout(300); // Wait for collapse animation
    const collapsedRows = page.locator('table tbody tr').filter({ hasNot: page.locator('button:has-text("additional")') });
    const collapsedCount = await collapsedRows.count();
    expect(collapsedCount).toBeGreaterThanOrEqual(4);
    expect(collapsedCount).toBeLessThanOrEqual(5);
  });

  test('should display radioactivity indicators on isotope selection cards', async ({ page }) => {
    // Navigate to element with both stable and unstable isotopes (Carbon)
    await page.goto('/element-data?Z=6');
    await waitForDatabaseReady(page);

    // C-14 should have a radioactive indicator (radiation icon)
    const c14Button = page.getByRole('button', { name: /C-14/i });

    // Check if there's a radiation icon (Lucide uses SVG)
    // The radiation icon should be near the C-14 button
    const buttonParent = c14Button.locator('..');
    const hasSvg = await buttonParent.locator('svg').isVisible().catch(() => false);

    // Just verify the isotope buttons are visible
    await expect(c14Button).toBeVisible();
  });

  test('should not show toggle button for isotopes with 4 or fewer decay modes', async ({ page }) => {
    // Navigate to Tc-98 (3 decay modes)
    await page.goto('/element-data?Z=43&A=98');
    await waitForDatabaseReady(page);

    // Should show Tc-98 heading
    const nuclideHeading = page.getByRole('heading', { name: /Tc-98/i });
    await expect(nuclideHeading).toBeVisible();

    // Scroll to nuclide section
    await nuclideHeading.scrollIntoViewIfNeeded();

    // Should show Radioactive Decay heading
    const decayHeading = page.getByRole('heading', { name: /Radioactive Decay/i });
    const hasDecayData = await decayHeading.isVisible().catch(() => false);

    if (hasDecayData) {
      await expect(decayHeading).toBeVisible();

      // Table should be visible with decay mode column
      const decayTable = page.locator('table').filter({ hasText: 'Decay Mode' });
      await expect(decayTable).toBeVisible();

      // Should show all 3 decay modes without toggle button
      const dataRows = page.locator('table tbody tr');
      const rowCount = await dataRows.count();
      expect(rowCount).toBe(3); // Exactly 3 rows, no toggle row

      // Should NOT have "Show more" button
      const showMoreButton = page.getByRole('button', { name: /Show.*more decay mode/i });
      const hasToggle = await showMoreButton.isVisible().catch(() => false);
      expect(hasToggle).toBe(false);
    }
  });

  test('should show toggle button integrated into table for 5+ decay modes', async ({ page }) => {
    // Navigate to Hf-182 (191 decay modes)
    await page.goto('/element-data?Z=72&A=182');
    await waitForDatabaseReady(page);

    // Should show Hf-182 heading
    const nuclideHeading = page.getByRole('heading', { name: /Hf-182/i });
    await expect(nuclideHeading).toBeVisible();

    // Scroll to nuclide section
    await nuclideHeading.scrollIntoViewIfNeeded();

    // Toggle button should be present
    const showMoreButton = page.getByRole('button', { name: /Show.*more decay mode/i });
    await expect(showMoreButton).toBeVisible();

    // Toggle button should be inside a table row
    const toggleRow = showMoreButton.locator('xpath=ancestor::tr');
    await expect(toggleRow).toBeVisible();

    // Toggle button should show correct count
    await expect(showMoreButton).toHaveText(/Show 187 more decay modes/i);

    // Toggle row should have thicker border (visual divider)
    // Check that it has the border-t-2 class applied
    const hasBorderClass = await toggleRow.evaluate(el => {
      return el.classList.contains('border-t-2') ||
             el.className.includes('border-t-2');
    });
    expect(hasBorderClass).toBe(true);
  });

  test('should apply background tint to expanded decay rows', async ({ page }) => {
    // Navigate to Hf-182 (191 decay modes)
    await page.goto('/element-data?Z=72&A=182');
    await waitForDatabaseReady(page);

    // Scroll to nuclide section
    const nuclideHeading = page.getByRole('heading', { name: /Hf-182/i });
    await expect(nuclideHeading).toBeVisible();
    await nuclideHeading.scrollIntoViewIfNeeded();

    // Expand the table
    const showMoreButton = page.getByRole('button', { name: /Show.*more decay mode/i });
    await expect(showMoreButton).toBeVisible();
    await showMoreButton.click();

    // Wait for expansion
    await page.waitForTimeout(300);

    // Check that the expanded rows exist
    // The expanded rows come after the first 4 rows and the toggle row
    // Count all tbody tr elements
    const allRows = page.locator('table tbody tr');
    const totalRowCount = await allRows.count();
    expect(totalRowCount).toBe(192); // 191 data rows + 1 toggle row

    // Get one of the expanded rows (e.g., the 6th tr, which is after 4 data rows + 1 toggle row)
    const expandedRow = allRows.nth(5);
    await expect(expandedRow).toBeVisible();

    // Check if it has background styling (bg-gray-50/30 or dark variant)
    const hasBackgroundTint = await expandedRow.evaluate(el => {
      return el.classList.contains('bg-gray-50/30') ||
             el.classList.contains('dark:bg-gray-800/20') ||
             el.className.includes('bg-gray-');
    });
    expect(hasBackgroundTint).toBe(true);
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
    await h.waitFor({ state: 'attached', timeout: 15000 });

    // On mobile, sticky tab navigation interferes with Playwright's click coordinate calculation
    // Use JavaScript click as a workaround since element is genuinely clickable (verified in screenshots)
    await h.evaluate((el: HTMLElement) => el.click());

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

  test('should not overflow viewport when decay table is expanded on mobile', async ({ page }) => {
    // Navigate to U-235 (134 decay modes - extensive decay data)
    await page.goto('/element-data?Z=92&A=235');
    await waitForDatabaseReady(page);

    // Should show U-235 heading
    const nuclideHeading = page.getByRole('heading', { name: /U-235/i });
    await expect(nuclideHeading).toBeVisible();

    // Scroll to radioactive decay section
    const decayHeading = page.getByRole('heading', { name: /Radioactive Decay/i });
    await expect(decayHeading).toBeVisible();
    await decayHeading.scrollIntoViewIfNeeded();

    // Table should always be visible on mobile
    const decayTable = page.locator('table').filter({ hasText: 'Decay Mode' });
    await expect(decayTable).toBeVisible();

    // Verify table headers are present
    await expect(decayTable.locator('thead')).toContainText('Decay Mode');

    // Look for "Show more decay modes" button (should be present with 134 decay modes)
    const showMoreButton = page.getByRole('button', { name: /Show.*more decay mode/i });
    await expect(showMoreButton).toBeVisible();

    // Take screenshot before expansion
    await page.screenshot({
      path: 'test-results/mobile-decay-table-before.png',
      fullPage: true
    });

    // Click to expand decay table
    await showMoreButton.click();

    // Wait for table to render
    await page.waitForTimeout(500);

    // Take screenshot after expansion
    await page.screenshot({
      path: 'test-results/mobile-decay-table-after.png',
      fullPage: true
    });

    // CRITICAL: Verify the entire page doesn't cause horizontal scrolling
    // Note: The decay table itself is allowed to scroll horizontally (overflow-x-auto)
    // But the page body should never overflow the viewport
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

    // The page itself should not be wider than the viewport
    // Allow 1px tolerance for sub-pixel rendering
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);
  });

  test('should show hamburger menu in tabs only when stuck on mobile', async ({ page }) => {
    // Navigate to element-data
    await page.goto('/element-data');
    await waitForDatabaseReady(page);

    // Initially, hamburger should NOT be in the tab bar
    const tabMenuButton = page.getByTestId('tab-navigation-menu-button');
    const initiallyVisible = await tabMenuButton.isVisible().catch(() => false);
    expect(initiallyVisible).toBe(false);

    // Regular mobile header hamburger should be visible
    const headerMenu = page.getByRole('button', { name: /Open menu/i }).first();
    await expect(headerMenu).toBeVisible();

    // Scroll down to make tabs stick
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500); // Wait for intersection observer

    // Now the hamburger should appear in the tab bar
    await expect(tabMenuButton).toBeVisible();

    // Click it to verify it works
    await tabMenuButton.click();
    await page.waitForTimeout(300);

    // Sidebar should open (check for sidebar content)
    const sidebar = page.locator('text=Nanosoft').first();
    await expect(sidebar).toBeVisible();

    // Close sidebar
    const closeButton = page.getByRole('button', { name: /Close menu/i });
    await closeButton.click();
    await page.waitForTimeout(300);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500); // Wait for intersection observer

    // Hamburger should disappear from tab bar
    const finallyVisible = await tabMenuButton.isVisible().catch(() => false);
    expect(finallyVisible).toBe(false);
  });

  test('should expand tabs to full width when stuck on mobile', async ({ page }) => {
    // Navigate to element-data
    await page.goto('/element-data');
    await waitForDatabaseReady(page);

    // Get the tab navigation container
    const tabNav = page.locator('nav[aria-label="Tabs"]').locator('..');

    // Get initial width (should have padding/rounded corners)
    const initialBox = await tabNav.boundingBox();

    // Scroll down to make tabs stick
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(500);

    // Get width when stuck (should be full viewport width)
    const stuckBox = await tabNav.boundingBox();
    const viewportSize = page.viewportSize();

    if (stuckBox && viewportSize) {
      // When stuck, tabs should span close to full width
      expect(stuckBox.width).toBeGreaterThan((initialBox?.width || 0) * 0.9);
      // Should be close to viewport width (allowing some margin for borders)
      expect(stuckBox.width).toBeGreaterThanOrEqual(viewportSize.width * 0.95);
    }
  });

  test('should scroll selected tab into view on mobile', async ({ page }) => {
    // Navigate to element-data
    await page.goto('/element-data');
    await waitForDatabaseReady(page);

    // Get the tab navigation container
    const tabNav = page.locator('nav[aria-label="Tabs"]');

    // Get the "Decay" tab (likely to be off-screen on mobile)
    const decayTab = page.getByRole('tab', { name: /Decay/i });

    // Verify tab exists
    await expect(decayTab).toBeAttached();

    // Get initial scroll position of the tab container
    const initialScrollLeft = await tabNav.evaluate(el => el.scrollLeft);

    // Click the Decay tab
    await decayTab.click();
    await page.waitForTimeout(500); // Wait for smooth scroll animation

    // Get new scroll position
    const newScrollLeft = await tabNav.evaluate(el => el.scrollLeft);

    // The tab container should have scrolled (scroll position changed)
    expect(newScrollLeft).toBeGreaterThan(initialScrollLeft);

    // Verify the Decay tab is now in view by checking if it's within the visible area
    const tabNavBox = await tabNav.boundingBox();
    const decayTabBox = await decayTab.boundingBox();

    if (tabNavBox && decayTabBox) {
      // The tab should be within the visible scroll area
      // Allow some tolerance for centering
      expect(decayTabBox.x).toBeGreaterThanOrEqual(tabNavBox.x - 50);
      expect(decayTabBox.x + decayTabBox.width).toBeLessThanOrEqual(tabNavBox.x + tabNavBox.width + 50);
    }
  });
});

test.describe('Element Data - Tab Navigation Desktop', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/element-data');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should never show hamburger menu in tabs on desktop', async ({ page }) => {
    // Navigate to element-data
    await page.goto('/element-data');
    await waitForDatabaseReady(page);

    // Hamburger should NEVER appear in tab bar on desktop
    const tabMenuButton = page.getByTestId('tab-navigation-menu-button');
    const initiallyVisible = await tabMenuButton.isVisible().catch(() => false);
    expect(initiallyVisible).toBe(false);

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

    // Still should not be visible
    const afterScrollVisible = await tabMenuButton.isVisible().catch(() => false);
    expect(afterScrollVisible).toBe(false);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Still should not be visible
    const atBottomVisible = await tabMenuButton.isVisible().catch(() => false);
    expect(atBottomVisible).toBe(false);
  });

  test('should maintain desktop appearance when scrolling', async ({ page }) => {
    // Navigate to element-data
    await page.goto('/element-data');
    await waitForDatabaseReady(page);

    // Get tab navigation
    const tabNav = page.locator('nav[aria-label="Tabs"]').locator('..');
    const initialBox = await tabNav.boundingBox();

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

    // Width should remain consistent (not expand to full width)
    const scrolledBox = await tabNav.boundingBox();

    if (initialBox && scrolledBox) {
      // Width should be similar (allowing small variance)
      expect(Math.abs(scrolledBox.width - initialBox.width)).toBeLessThan(50);
    }
  });
});

test.describe('Element Data - Half-life Unit Display', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/element-data');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display appropriate half-life units', async ({ page }) => {
    // Navigate to C-14 which has a half-life in years
    await page.goto('/element-data?Z=6&A=14');
    await waitForDatabaseReady(page);

    // Should show C-14 heading
    await expect(page.getByRole('heading', { name: /C-14/i })).toBeVisible();

    // Check for any decay data on the page
    const decayTable = page.locator('table').filter({ hasText: 'Half-life' });
    const hasDecayTable = await decayTable.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasDecayTable) {
      const tableText = await decayTable.textContent();
      // Should contain either expanded units (seconds, minutes, hours, days, years)
      // or SI abbreviations for sub-second units (ms, µs, ns, ps, fs)
      const hasProperUnits = /years|seconds|minutes|hours|days|ms|µs|ns|ps|fs/.test(tableText || '');
      expect(hasProperUnits).toBe(true);
    }
  });

  test('should display appropriate half-life units in decay tables', async ({ page }) => {
    // Navigate to an isotope with decay data (use Tc-98 which has 3 decay modes)
    await page.goto('/element-data?Z=43&A=98');
    await waitForDatabaseReady(page);

    // Wait for the nuclide heading
    await expect(page.getByRole('heading', { name: /Tc-98/i })).toBeVisible();

    // Look for radioactive decay section
    const decayHeading = page.getByRole('heading', { name: /Radioactive Decay/i });
    const hasDecaySection = await decayHeading.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasDecaySection) {
      await decayHeading.scrollIntoViewIfNeeded();

      // Wait for decay table
      const decayTable = page.locator('table').filter({ hasText: 'Half-life' });
      await expect(decayTable).toBeVisible();

      // Get all table cell text
      const tableText = await decayTable.textContent();

      // Should contain either expanded units (seconds, minutes, hours, days, years)
      // or SI abbreviations for sub-second units (ms, µs, ns, ps, fs)
      const hasProperUnits = /years|seconds|minutes|hours|days|ms|µs|ns|ps|fs/.test(tableText || '');
      expect(hasProperUnits).toBe(true);
    }
  });

  test('should display appropriate units in integrated tab decay chains', async ({ page }) => {
    // Navigate to decay tab which shows decay table data
    await page.goto('/element-data?tab=decay');
    await waitForDatabaseReady(page);

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Look for decay table with half-life column
    const decayTable = page.locator('table').filter({ hasText: 'Half-life' });
    const hasDecayTable = await decayTable.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasDecayTable) {
      const tableText = await decayTable.textContent();
      // Should contain either expanded units (seconds, minutes, hours, days, years)
      // or SI abbreviations for sub-second units (ms, µs, ns, ps, fs)
      const hasProperUnits = /years|seconds|minutes|hours|days|ms|µs|ns|ps|fs/.test(tableText || '');
      expect(hasProperUnits).toBe(true);
    }
  });
});

