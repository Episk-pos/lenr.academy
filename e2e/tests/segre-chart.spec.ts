import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
} from '../fixtures/test-helpers';

test.describe('Segre Chart on Element Data Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/element-data');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display the element data page with tabs', async ({ page }) => {
    // The page has tabs: Integrated, Russell, Element, Nuclides, Decays
    await expect(page.getByText('Integrated')).toBeVisible();
    await expect(page.getByText('Russell')).toBeVisible();
  });

  test('should display Nuclide Chart (Segre Chart) section', async ({ page }) => {
    // The Segre Chart is shown as "Nuclide Chart (Segre Chart)" on the integrated view
    const segreSection = page.getByText(/Nuclide Chart.*Segre Chart/i);
    await segreSection.scrollIntoViewIfNeeded();
    await expect(segreSection).toBeVisible();
  });

  test('should display nuclide count in Segre Chart section', async ({ page }) => {
    // Shows "324 nuclides displayed" or similar count
    const nuclideCount = page.getByText(/\d+ nuclides displayed/i);
    await nuclideCount.scrollIntoViewIfNeeded();
    await expect(nuclideCount).toBeVisible();
  });

  test('should have zoom controls on the chart', async ({ page }) => {
    // Scroll to chart area
    const segreSection = page.getByText(/Nuclide Chart.*Segre Chart/i);
    await segreSection.scrollIntoViewIfNeeded();

    // The chart includes zoom control hint text
    await expect(page.getByText(/zoom/i).first()).toBeVisible();
  });

  test('should redirect /segre-chart to /element-data', async ({ page }) => {
    await page.goto('/segre-chart');
    await page.waitForURL(/\/element-data/);
  });

  test('should show Nuclides tab', async ({ page }) => {
    await expect(page.getByText(/Nuclides/).first()).toBeVisible();
  });
});
