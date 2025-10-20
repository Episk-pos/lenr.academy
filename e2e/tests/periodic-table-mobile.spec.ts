import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Periodic Table - Mobile Layout', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/element-data');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display periodic table without gaps between particle row and element rows', async ({ page }) => {
    // Wait for periodic table to be visible
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();

    // Verify hydrogen is visible (period 1)
    const hydrogen = page.getByRole('button', { name: '1 H' });
    await expect(hydrogen).toBeVisible();

    // Verify lithium is visible (period 2, row below particles)
    const lithium = page.getByRole('button', { name: '3 Li' });
    await expect(lithium).toBeVisible();

    // Take a screenshot to visually verify the spacing
    await page.screenshot({
      path: 'test-results/periodic-table-mobile-spacing.png',
      fullPage: false
    });

    // Get the bounding boxes for elements in different rows
    const hBox = await hydrogen.boundingBox();
    const liBox = await lithium.boundingBox();

    // Verify elements are positioned correctly (Li should be below H)
    expect(hBox).not.toBeNull();
    expect(liBox).not.toBeNull();

    if (hBox && liBox) {
      // Li should be below H
      expect(liBox.y).toBeGreaterThan(hBox.y);

      // The vertical gap should be reasonable (not excessive)
      // With the fix, gap should be less than 100px
      const verticalGap = liBox.y - (hBox.y + hBox.height);
      expect(verticalGap).toBeLessThan(100);
    }
  });

  test('should display special particles (electron, neutron) properly aligned', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();

    // Look for particle labels - they should be visible in period 2
    const electronLabel = page.getByText('ELECTRON', { exact: true });
    const neutronLabel = page.getByText('NEUTRON', { exact: true });

    // Particles may not always be visible on small screens, but if they are, verify they're properly positioned
    const electronVisible = await electronLabel.isVisible().catch(() => false);
    const neutronVisible = await neutronLabel.isVisible().catch(() => false);

    if (electronVisible || neutronVisible) {
      // Get lithium element position (should be in row below particles)
      const lithium = page.getByRole('button', { name: '3 Li' });
      const liBox = await lithium.boundingBox();

      if (electronVisible) {
        const eBox = await electronLabel.boundingBox();

        if (eBox && liBox) {
          // Electron label should be above lithium
          expect(eBox.y).toBeLessThan(liBox.y);

          // Gap should be minimal (the fix removes extra padding)
          const gap = liBox.y - (eBox.y + eBox.height);
          expect(gap).toBeLessThan(50); // Should be tight spacing
        }
      }

      // Take screenshot showing particle positioning
      await page.screenshot({
        path: 'test-results/periodic-table-particles-mobile.png',
        fullPage: false
      });
    }
  });

  test('should maintain proper row heights across all periods on mobile', async ({ page }) => {
    // Wait for periodic table to load
    await expect(page.getByRole('heading', { name: /Element Data/i })).toBeVisible();

    // Get elements from different periods
    const period1 = page.getByRole('button', { name: '1 H' }); // Period 1
    const period2 = page.getByRole('button', { name: '3 Li' }); // Period 2
    const period3 = page.getByRole('button', { name: '11 Na' }); // Period 3

    // Verify all are visible
    await expect(period1).toBeVisible();
    await expect(period2).toBeVisible();
    await expect(period3).toBeVisible();

    const h = await period1.boundingBox();
    const li = await period2.boundingBox();
    const na = await period3.boundingBox();

    // All elements should have similar heights (allowing small variance)
    expect(h).not.toBeNull();
    expect(li).not.toBeNull();
    expect(na).not.toBeNull();

    if (h && li && na) {
      // Heights should be similar across periods (within 20%)
      const avgHeight = (h.height + li.height + na.height) / 3;
      expect(Math.abs(h.height - avgHeight)).toBeLessThan(avgHeight * 0.2);
      expect(Math.abs(li.height - avgHeight)).toBeLessThan(avgHeight * 0.2);
      expect(Math.abs(na.height - avgHeight)).toBeLessThan(avgHeight * 0.2);
    }
  });
});
