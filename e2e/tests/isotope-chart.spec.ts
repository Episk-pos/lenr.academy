import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent
} from '../fixtures/test-helpers';

test.describe('Isotope Chart', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should navigate to isotope chart page', async ({ page }) => {
    // Click on Isotope Chart navigation link
    await page.click('text=Isotope Chart');

    // Wait for page to load
    await expect(page).toHaveURL('/isotope-chart');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Isotope Chart');
    await expect(page.locator('h1')).toContainText('Segré Chart');
  });

  test('should display chart with controls', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Verify main elements are present
    await expect(page.locator('h1')).toContainText('Isotope Chart');

    // Check for toggle controls
    await expect(page.locator('text=Valley of Stability')).toBeVisible();
    await expect(page.locator('text=Magic Numbers')).toBeVisible();

    // Check for legend button
    await expect(page.locator('text=Legend')).toBeVisible();

    // Check for canvas element (chart rendering)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should toggle valley of stability', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Find the valley of stability checkbox
    const valleyCheckbox = page.locator('input[type="checkbox"]').first();

    // Should be checked by default
    await expect(valleyCheckbox).toBeChecked();

    // Uncheck it
    await valleyCheckbox.click();
    await expect(valleyCheckbox).not.toBeChecked();

    // Check it again
    await valleyCheckbox.click();
    await expect(valleyCheckbox).toBeChecked();
  });

  test('should toggle magic numbers', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Find the magic numbers checkbox (second checkbox)
    const magicCheckbox = page.locator('input[type="checkbox"]').nth(1);

    // Should be checked by default
    await expect(magicCheckbox).toBeChecked();

    // Uncheck it
    await magicCheckbox.click();
    await expect(magicCheckbox).not.toBeChecked();

    // Check it again
    await magicCheckbox.click();
    await expect(magicCheckbox).toBeChecked();
  });

  test('should toggle legend visibility', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Legend should be visible by default
    await expect(page.locator('text=Nuclide Stability')).toBeVisible();
    await expect(page.locator('text=Chart Features')).toBeVisible();

    // Click hide legend button
    await page.click('text=Hide Legend');

    // Legend sections should not be visible
    await expect(page.locator('text=Nuclide Stability')).not.toBeVisible();

    // Click show legend button
    await page.click('text=Show Legend');

    // Legend should be visible again
    await expect(page.locator('text=Nuclide Stability')).toBeVisible();
  });

  test('should display info banner with explanation', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Check for info banner
    await expect(page.locator('text=What is the Segré Chart?')).toBeVisible();
    await expect(page.locator('text=valley of stability')).toBeVisible();
    await expect(page.locator('text=Magic numbers')).toBeVisible();
  });

  test('should show stability legend items', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Verify stability color legend
    await expect(page.locator('text=Stable')).toBeVisible();
    await expect(page.locator('text=Long-lived')).toBeVisible();
    await expect(page.locator('text=Short-lived')).toBeVisible();
    await expect(page.locator('text=Unknown / Not in database')).toBeVisible();
  });

  test('should show axes information in legend', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Verify axes information
    await expect(page.locator('text=Proton number (Z)')).toBeVisible();
    await expect(page.locator('text=Neutron number (N)')).toBeVisible();
    await expect(page.locator('text=Z=1-94, N=0-150')).toBeVisible();
  });

  test('should show interaction instructions', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Verify interaction instructions
    await expect(page.locator('text=Hover:')).toBeVisible();
    await expect(page.locator('text=Click:')).toBeVisible();
    await expect(page.locator('text=Scroll:')).toBeVisible();
    await expect(page.locator('text=Drag:')).toBeVisible();
  });

  test('should render canvas chart', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Wait for canvas to be rendered
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Canvas should have non-zero dimensions
    const boundingBox = await canvas.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);
  });

  test('should have zoom controls hint', async ({ page }) => {
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Check for zoom hints
    await expect(page.locator('text=Scroll to zoom')).toBeVisible();
    await expect(page.locator('text=Double-click to reset')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/isotope-chart');
    await waitForDatabaseReady(page);

    // Page should still load
    await expect(page.locator('h1')).toContainText('Isotope Chart');

    // Canvas should be visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});
