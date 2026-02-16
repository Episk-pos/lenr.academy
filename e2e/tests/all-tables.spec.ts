import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
} from '../fixtures/test-helpers';

test.describe('All Tables Query Tool', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/all-tables');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display the SQL editor page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /All Tables Query Tool/i }).first()).toBeVisible();

    // Should have SQL textarea
    await expect(page.locator('textarea')).toBeVisible();

    // Should have Execute button
    await expect(page.getByRole('button', { name: /Execute/i })).toBeVisible();
  });

  test('should have a default query in the textarea', async ({ page }) => {
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('SELECT');
    expect(value).toContain('FusionAll');
  });

  test('should execute default query and show results', async ({ page }) => {
    // Click Execute
    await page.getByRole('button', { name: /Execute/i }).click();

    // Wait for results to appear
    await expect(page.getByText(/Query Results/i)).toBeVisible({ timeout: 15000 });

    // Should show execution time
    await expect(page.getByText(/Executed in/i)).toBeVisible();

    // Should show Export CSV button
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
  });

  test('should display example queries', async ({ page }) => {
    await expect(page.getByText(/Example Queries/i)).toBeVisible();

    // Should have clickable example queries
    const examples = page.locator('button.font-mono');
    const count = await examples.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should load example query into textarea when clicked', async ({ page }) => {
    // Click first example query
    const firstExample = page.locator('button.font-mono').first();
    const exampleText = await firstExample.textContent();
    await firstExample.click();

    // Textarea should now contain the example query
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toBe(exampleText);
  });

  test('should show error for invalid SQL', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('SELECT * FROM NonExistentTable');
    await page.getByRole('button', { name: /Execute/i }).click();

    // Should show error message
    await expect(page.getByText(/Query Error/i)).toBeVisible({ timeout: 5000 });
  });

  test('should clear query and results', async ({ page }) => {
    // Execute default query first
    await page.getByRole('button', { name: /Execute/i }).click();
    await expect(page.getByText(/Query Results/i)).toBeVisible({ timeout: 15000 });

    // Click Clear
    await page.getByRole('button', { name: /Clear/i }).click();

    // Textarea should be empty
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toBe('');

    // Results should be gone
    await expect(page.getByText(/Query Results/i)).not.toBeVisible();
  });

  test('should execute COUNT query successfully', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('SELECT COUNT(*) as TotalReactions FROM FusionAll');
    await page.getByRole('button', { name: /Execute/i }).click();

    // Should show results
    await expect(page.getByText(/Query Results/i)).toBeVisible({ timeout: 15000 });
  });

  test('should display available tables section', async ({ page }) => {
    await expect(page.getByText(/Available Tables/i)).toBeVisible();
    // Scope assertions to the Available Tables section to avoid matching textarea/examples
    const availableTablesSection = page.locator('h3', { hasText: /Available Tables/i }).locator('..');
    await expect(availableTablesSection.getByText('FusionAll')).toBeVisible();
    await expect(availableTablesSection.getByText('FissionAll')).toBeVisible();
    await expect(availableTablesSection.getByText('TwoToTwoAll')).toBeVisible();
    await expect(availableTablesSection.getByText('NuclidesPlus')).toBeVisible();
    await expect(availableTablesSection.getByText('ElementsPlus')).toBeVisible();
  });

  test('should display SQL tips section', async ({ page }) => {
    await expect(page.getByText(/SQL Tips/i)).toBeVisible();
  });
});
