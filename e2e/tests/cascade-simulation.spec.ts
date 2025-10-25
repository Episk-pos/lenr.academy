import { test, expect } from '@playwright/test';

test.describe('Cascade Simulation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to cascades page
    await page.goto('/');
    await page.getByRole('link', { name: 'Cascades' }).click();
    await expect(page).toHaveURL('/cascades');
  });

  test('should load cascade simulation page with default parameters', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: 'Cascade Simulations' })).toBeVisible();

    // Check default fuel nuclides are populated (now shown as chips, not textarea)
    const fuelSummary = page.locator('text=9 selected:');
    await expect(fuelSummary).toBeVisible();

    // Verify some default nuclides are shown as chips
    await expect(page.locator('text=H-1').first()).toBeVisible();
    await expect(page.locator('text=Li-7').first()).toBeVisible();
    await expect(page.locator('text=Al-27').first()).toBeVisible();

    // Check default parameter values
    await expect(page.locator('input[type="number"]').first()).toHaveValue('2400'); // Temperature

    // Check Run button is enabled (after database loads)
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });
  });

  test('should run cascade simulation and display results', async ({ page }) => {
    // Wait for database to load
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });

    // Click run button
    await runButton.click();

    // Wait for progress card to appear
    await expect(page.locator('text=Running Cascade Simulation')).toBeVisible({ timeout: 2000 });

    // Wait for results to appear (cascade should complete within 30 seconds for default params)
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });

    // Verify results summary is displayed
    await expect(page.locator('text=Reactions Found')).toBeVisible();
    await expect(page.locator('text=Loops Executed')).toBeVisible();
    await expect(page.locator('text=Total Energy')).toBeVisible();
    await expect(page.locator('text=Execution Time')).toBeVisible();

    // Verify at least one reaction was found (check the value after "Reactions Found")
    const reactionsElement = page.locator('text=Reactions Found').locator('..').locator('p');
    const reactionsText = await reactionsElement.textContent();
    expect(reactionsText).toMatch(/\d+/); // Contains a number
    expect(parseInt(reactionsText || '0')).toBeGreaterThan(0);
  });

  test('should display progress updates during simulation', async ({ page }) => {
    // Wait for database to load
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });

    // Click run button
    await runButton.click();

    // Progress card should appear
    await expect(page.locator('text=Running Cascade Simulation')).toBeVisible({ timeout: 2000 });

    // Progress should show loop information
    await expect(page.locator('text=Loop Progress')).toBeVisible();
    await expect(page.locator('text=New Reactions (this loop)')).toBeVisible();

    // Wait for completion (don't check for progress bar as it may complete too fast)
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });
  });

  test('should handle cancel operation', async ({ page }) => {
    // Wait for database to load
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });

    // Increase loop count to make simulation longer
    const loopInput = page.locator('label:has-text("Max Cascade Loops")').locator('..').locator('input[type="range"]');
    await loopInput.fill('5');

    // Click run button
    await runButton.click();

    // Wait for progress to appear
    await expect(page.locator('text=Running Cascade Simulation')).toBeVisible();

    // Click cancel button
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Progress should disappear or error should show
    await expect(page.locator('text=Running Cascade Simulation')).not.toBeVisible({ timeout: 2000 });
  });

  test('should validate fuel nuclides input', async ({ page }) => {
    // Wait for database to load
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });

    // Clear all fuel nuclides using Clear all button
    await page.locator('button:has-text("Clear all")').click();

    // Verify no nuclides are selected (button shows "Any" when empty)
    await expect(page.locator('button:has-text("Any")')).toBeVisible();

    // Try to run with no fuel
    await runButton.click();

    // Should show error
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=at least one fuel nuclide')).toBeVisible();
  });

  test('should respect feedback rule settings', async ({ page }) => {
    // Wait for database to load
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });

    // Disable all feedback (use default fuel nuclides)
    await page.locator('text=Feedback Bosons').locator('..').locator('input').uncheck();
    await page.locator('text=Feedback Fermions').locator('..').locator('input').uncheck();

    // Run simulation
    await runButton.click();

    // Wait for results
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });

    // With no feedback, cascade should terminate quickly with fewer loops
    await expect(page.locator('text=Loops Executed')).toBeVisible();
    await expect(page.locator('text=Termination')).toBeVisible();
  });

  test('should correctly query database tables (regression for table names)', async ({ page }) => {
    // This test ensures FusionAll and TwoToTwoAll tables are queried correctly
    // Previously failed with "no such table: Fus_Fis" error

    // Wait for database to load
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });

    // Set max loops to 1 for speed (use default fuel nuclides)
    const loopInput = page.locator('input[type="range"]').filter({ hasText: /Max Cascade Loops/i }).or(
      page.locator('label:has-text("Max Cascade Loops")').locator('..').locator('input[type="range"]')
    );
    await loopInput.fill('1');

    // Run simulation
    await runButton.click();

    // Should NOT show "no such table" error
    const errorText = await page.locator('text=Error').count();
    if (errorText > 0) {
      const errorContent = await page.locator('text=Error').locator('..').textContent();
      expect(errorContent).not.toContain('no such table');
      expect(errorContent).not.toContain('Fus_Fis');
      expect(errorContent).not.toContain('TwoToTwo');
    }

    // Should show results
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });
  });

  test('should display reaction types correctly', async ({ page }) => {
    // Wait for database and run simulation
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });
    await runButton.click();

    // Wait for results
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });

    // Check for reaction type badges (fusion, twotwo)
    const reactionTypes = page.locator('span:has-text("fusion"), span:has-text("twotwo")');
    const count = await reactionTypes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display product distribution', async ({ page }) => {
    // Wait for database and run simulation
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });
    await runButton.click();

    // Wait for results
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });

    // Click on Products tab to see product distribution
    await page.locator('button:has-text("Products")').click();

    // Wait for product distribution to load (heading is "Top Products")
    await expect(page.locator('text=Top Products')).toBeVisible({ timeout: 5000 });

    // Should show unique nuclide count in the heading
    const distributionHeader = await page.locator('text=Top Products').textContent();
    expect(distributionHeader).toMatch(/\d+ unique nuclides/);
  });

  test('should allow parameter adjustments', async ({ page }) => {
    // Wait for database to load
    await expect(page.locator('button:has-text("Run Cascade Simulation")')).toBeEnabled({ timeout: 10000 });

    // Adjust temperature
    const tempInput = page.locator('input[type="number"]').first();
    await tempInput.fill('1500');
    await expect(tempInput).toHaveValue('1500');

    // Adjust min fusion energy
    const fusionInput = page.locator('input[type="number"]').nth(1);
    await fusionInput.fill('2.0');
    await expect(fusionInput).toHaveValue('2.0');

    // Adjust max nuclides (now a range slider)
    const nuclidesInput = page.locator('label:has-text("Max Nuclides to Pair")').locator('..').locator('input[type="range"]');
    await nuclidesInput.fill('3000');
    // Verify it changed (value displayed in label)
    await expect(page.locator('text=Max Nuclides to Pair: 3000')).toBeVisible();

    // Reset parameters
    await page.click('button:has-text("Reset Parameters")');

    // Should restore defaults
    await expect(tempInput).toHaveValue('2400');
  });

  test('should show appropriate message when no reactions found', async ({ page }) => {
    // Wait for database to load
    const runButton = page.locator('button:has-text("Run Cascade Simulation")');
    await expect(runButton).toBeEnabled({ timeout: 10000 });

    // Set very high energy threshold to get no results
    const fusionInput = page.locator('input[type="number"]').nth(1);
    await fusionInput.fill('1000');

    const twoToTwoInput = page.locator('input[type="number"]').nth(2);
    await twoToTwoInput.fill('1000');

    // Set max loops to 1 (now a range slider)
    const loopInput = page.locator('label:has-text("Max Cascade Loops")').locator('..').locator('input[type="range"]');
    await loopInput.fill('1');

    // Run simulation
    await runButton.click();

    // Wait for completion
    await expect(page.locator('text=Cascade Complete')).toBeVisible({ timeout: 30000 });

    // Should show "No Reactions Found" message
    await expect(page.locator('text=No Reactions Found')).toBeVisible();
  });
});
