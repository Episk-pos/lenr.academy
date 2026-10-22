import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  setLanguagePreference
} from '../fixtures/test-helpers';

test.describe('Weighted Cascade (Issue #96)', () => {
  test.beforeEach(async ({ page }) => {
    // Set language preference to avoid language selection modal
    await setLanguagePreference(page, 'en');
    // Dismiss the analytics banner so it can't cover the Run button
    await acceptPrivacyConsent(page);
    // Navigate to cascades page
    await page.goto('/cascades');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
    // Wait for cascade to initialize (may take longer on first load)
    await expect(page.locator('button:has-text("Run Cascade Simulation")')).toBeEnabled({ timeout: 30000 });
  });

  test('should display weighted mode toggle', async ({ page }) => {
    // Check for weighted mode toggle (sr-only checkbox inside label)
    const weightedToggle = page.getByTestId('weighted-mode-toggle');
    await expect(weightedToggle).toBeAttached();

    // Toggle should be unchecked by default
    await expect(weightedToggle).not.toBeChecked();

    // Should have label "Weighted Mode"
    await expect(page.locator('text=Weighted Mode')).toBeVisible();
  });

  test('should display materials catalog button', async ({ page }) => {
    // Check for materials button
    const materialsButton = page.getByTestId('materials-catalog-button');
    await expect(materialsButton).toBeVisible();
    await expect(materialsButton).toContainText('Materials');
  });

  test('should open and close materials catalog modal', async ({ page }) => {
    // Click materials button
    const materialsButton = page.getByTestId('materials-catalog-button');
    await materialsButton.click();

    // Modal should open
    const modal = page.getByTestId('materials-catalog-modal');
    await expect(modal).toBeVisible();

    // Should have Materials Catalog heading
    await expect(modal.locator('h2')).toContainText('Materials Catalog');

    // Should have materials list (use button selector for specificity)
    await expect(modal.locator('button:has-text("Natural Lithium")')).toBeVisible();

    // Close modal using Cancel button within modal
    await modal.locator('button:has-text("Cancel")').click();

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('should filter materials by category', async ({ page }) => {
    // Open materials catalog
    await page.getByTestId('materials-catalog-button').click();
    await expect(page.locator('h2:has-text("Materials Catalog")')).toBeVisible();

    // Click on Natural tab (first button with "Natural" is the tab, not material cards)
    await page.locator('button:has-text("Natural")').first().click();

    // Should show natural abundance materials
    await expect(page.locator('button:has-text("Natural Lithium")')).toBeVisible();
    await expect(page.locator('button:has-text("Natural Nickel")')).toBeVisible();

    // Click on Alloys tab (first button with "Alloys" is the tab)
    await page.locator('button:has-text("Alloys")').first().click();

    // Should show alloy materials
    await expect(page.locator('button:has-text("Stainless Steel 304")')).toBeVisible();
  });

  test('should search materials', async ({ page }) => {
    // Open materials catalog
    const modal = page.getByTestId('materials-catalog-modal');
    await page.getByTestId('materials-catalog-button').click();
    await expect(modal).toBeVisible();

    // Search for nickel
    await modal.locator('input[placeholder*="Search"]').fill('nickel');

    // Should filter results - use button selector for material cards
    await expect(modal.locator('button:has-text("Natural Nickel")')).toBeVisible();
    // Other non-matching materials should be filtered
    await expect(modal.locator('button:has-text("Natural Lithium")')).not.toBeVisible();
  });

  test('should load material and enable weighted mode', async ({ page }) => {
    // Open materials catalog
    const modal = page.getByTestId('materials-catalog-modal');
    await page.getByTestId('materials-catalog-button').click();
    await expect(modal).toBeVisible();

    // Click on Natural tab (first button matching "Natural" is the tab, not material cards)
    await modal.locator('button:has-text("Natural")').first().click();

    // Click on Natural Lithium material card to select it
    await modal.locator('button:has-text("Natural Lithium")').click();

    // Wait for Load button to become enabled after selection
    const loadButton = modal.getByTestId('load-material-button');
    await expect(loadButton).toBeEnabled();
    await loadButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Weighted mode should be enabled
    const weightedToggle = page.getByTestId('weighted-mode-toggle');
    await expect(weightedToggle).toBeChecked();

    // Proportion input should be visible (use testId for specificity)
    await expect(page.getByTestId('fuel-proportion-input')).toBeVisible();
  });

  test('should show proportion input when weighted mode enabled', async ({ page }) => {
    // Enable weighted mode by clicking the label (checkbox is sr-only)
    await page.locator('label:has-text("Weighted Mode")').click();

    // Verify it's checked
    const weightedToggle = page.getByTestId('weighted-mode-toggle');
    await expect(weightedToggle).toBeChecked();

    // Should show proportion input (use testId for specificity)
    const proportionInput = page.getByTestId('fuel-proportion-input');
    await expect(proportionInput).toBeVisible();

    // Should have the Fuel Proportions label within the component
    await expect(proportionInput.locator('text=Fuel Proportions')).toBeVisible();
  });

  test('should show weighted mode info banner', async ({ page }) => {
    // Enable weighted mode by clicking the label (checkbox is sr-only)
    await page.locator('label:has-text("Weighted Mode")').click();

    // Should show weighted mode info
    await expect(page.locator('text=Weighted Mode:')).toBeVisible();
    await expect(page.locator('text=Pathway frequencies will be weighted')).toBeVisible();
  });

  test('should disable weighted mode toggle', async ({ page }) => {
    // Enable weighted mode by clicking the label (checkbox is sr-only)
    const weightedToggleLabel = page.locator('label:has-text("Weighted Mode")');
    await weightedToggleLabel.click();

    const weightedToggle = page.getByTestId('weighted-mode-toggle');
    await expect(weightedToggle).toBeChecked();

    // Proportion input should be visible (use testId)
    const proportionInput = page.getByTestId('fuel-proportion-input');
    await expect(proportionInput).toBeVisible();

    // Disable weighted mode by clicking the label again
    await weightedToggleLabel.click();
    await expect(weightedToggle).not.toBeChecked();

    // Proportion input should be hidden
    await expect(proportionInput).not.toBeVisible();
  });

  test('should run cascade with weighted mode and display results', async ({ page }) => {
    // Enable weighted mode by clicking the label (checkbox is sr-only)
    await page.locator('label:has-text("Weighted Mode")').click();

    // Set low loop count for speed
    const loopInput = page.locator('label:has-text("Max Cascade Loops")').locator('..').locator('input[type="range"]');
    await loopInput.fill('3');

    // Run simulation
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await runButton.click();

    // Wait for results
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });

    // Results should display
    await expect(page.locator('text=Reactions Found')).toBeVisible();
  });

  test('should reset weighted mode on parameter reset', async ({ page }) => {
    // Enable weighted mode by clicking the label (checkbox is sr-only)
    await page.locator('label:has-text("Weighted Mode")').click();

    const weightedToggle = page.getByTestId('weighted-mode-toggle');
    await expect(weightedToggle).toBeChecked();

    // Reset parameters
    await page.click('button:has-text("Reset Parameters")');

    // Weighted mode should be disabled
    await expect(weightedToggle).not.toBeChecked();
  });
});

test.describe('Materials Catalog Categories', () => {
  test.beforeEach(async ({ page }) => {
    // Set language preference to avoid language selection modal
    await setLanguagePreference(page, 'en');
    await page.goto('/cascades');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
    await expect(page.locator('button:has-text("Run Cascade Simulation")')).toBeEnabled({ timeout: 30000 });
    // Open materials catalog
    await page.getByTestId('materials-catalog-button').click();
    await expect(page.getByTestId('materials-catalog-modal')).toBeVisible();
  });

  test('should display LENR experiments', async ({ page }) => {
    // Click on LENR tab (first button with "LENR" is the tab)
    await page.locator('button:has-text("LENR")').first().click();

    // Wait for tab content to update and show LENR experiment materials
    await expect(page.locator('button:has-text("Parkhomov")')).toBeVisible();
    await expect(page.locator('button:has-text("Piantelli")')).toBeVisible();
  });

  test('should display compounds', async ({ page }) => {
    // Click on Compounds tab (first button with "Compounds" is the tab)
    await page.locator('button:has-text("Compounds")').first().click();

    // Should show compound materials (these are button cards)
    await expect(page.locator('button:has-text("LiAlH4")')).toBeVisible();
    await expect(page.locator('button:has-text("NaBH4")')).toBeVisible();
  });

  test('should show material composition preview', async ({ page }) => {
    const modal = page.getByTestId('materials-catalog-modal');

    // Click on Natural tab (first button with "Natural" is the tab)
    await modal.locator('button:has-text("Natural")').first().click();

    // Click on Natural Lithium material card to select it and show preview
    await modal.locator('button:has-text("Natural Lithium")').click();

    // Should show composition details in the preview panel (use table cells for specificity)
    await expect(modal.getByRole('cell', { name: 'Li-6' })).toBeVisible();
    await expect(modal.getByRole('cell', { name: 'Li-7' })).toBeVisible();
    // Should show isotopic proportions (at least one percentage cell visible)
    await expect(modal.getByRole('cell', { name: /%/ }).first()).toBeVisible();
  });
});
