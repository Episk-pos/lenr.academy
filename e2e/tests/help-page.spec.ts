import { test, expect } from '@playwright/test';
import {
  acceptPrivacyConsent,
} from '../fixtures/test-helpers';

test.describe('Help Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/help');
  });

  test('should display page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Help & Glossary/i })).toBeVisible();
  });

  test('should display example queries section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Example Queries/i })).toBeVisible();
  });

  test('should display example query cards with names and descriptions', async ({ page }) => {
    await expect(page.getByText('Hydrogen-Lithium Fusion')).toBeVisible();
    await expect(page.getByText('Deuterium-Deuterium Fusion')).toBeVisible();
    await expect(page.getByText('Uranium Fission Pathways')).toBeVisible();
  });

  test('should show query type badges on example cards', async ({ page }) => {
    // Query type badges are spans inside each example card button in the section
    const exampleSection = page.locator('section').filter({ has: page.getByRole('heading', { name: /Example Queries/i }) });
    await expect(exampleSection.locator('button span', { hasText: 'fusion' }).first()).toBeVisible();
    await expect(exampleSection.locator('button span', { hasText: 'fission' }).first()).toBeVisible();
    await expect(exampleSection.locator('button span', { hasText: '2→2' }).first()).toBeVisible();
  });

  test('should navigate to fusion query when clicking fusion example', async ({ page }) => {
    await page.getByText('Hydrogen-Lithium Fusion').click();
    await page.waitForURL(/\/fusion/);
  });

  test('should navigate to fission query when clicking fission example', async ({ page }) => {
    await page.getByText('Uranium Fission Pathways').click();
    await page.waitForURL(/\/fission/);
  });

  test('should navigate to twotwo query when clicking twotwo example', async ({ page }) => {
    await page.getByText('Deuterium-Nickel Reactions').click();
    await page.waitForURL(/\/twotwo/);
  });

  test('should display glossary section heading', async ({ page }) => {
    // The glossary section has its own heading distinct from the page title
    await expect(page.getByRole('heading', { name: /Glossary/i }).first()).toBeVisible();
  });

  test('should have glossary search input', async ({ page }) => {
    const searchInput = page.getByRole('textbox');
    await expect(searchInput).toBeVisible();
  });

  test('should filter glossary entries by search term', async ({ page }) => {
    const searchInput = page.getByRole('textbox');
    await searchInput.fill('Binding Energy');

    // Should show entries matching "Binding Energy"
    await expect(page.getByText('Binding Energy').first()).toBeVisible();
  });

  test('should show no results message for non-matching search', async ({ page }) => {
    const searchInput = page.getByRole('textbox');
    await searchInput.fill('xyznonexistentterm123');

    await expect(page.getByText(/no results|No matching/i)).toBeVisible();
  });

  test('should have category filter buttons', async ({ page }) => {
    // Category filters are in the glossary section — scope via main content area
    const mainContent = page.getByRole('main');
    await expect(mainContent.getByRole('button', { name: /Nuclear Physics/i })).toBeVisible();
    await expect(mainContent.getByRole('button', { name: /Reaction Types/i })).toBeVisible();
    await expect(mainContent.getByRole('button', { name: /Database Fields/i })).toBeVisible();
  });

  test('should filter glossary by category when clicking category button', async ({ page }) => {
    // Count glossary card items before filtering
    const mainContent = page.getByRole('main');
    const glossaryCards = mainContent.locator('.card');
    // Wait for cards to render before capturing initial count
    await expect(glossaryCards.first()).toBeVisible();
    const initialCount = await glossaryCards.count();
    expect(initialCount).toBeGreaterThan(0);

    // Click "Database Fields" to filter to a specific category
    await mainContent.getByRole('button', { name: /Database Fields/i }).click();

    // After filtering, fewer cards should be visible
    await expect(glossaryCards).not.toHaveCount(initialCount);
    const filteredCount = await glossaryCards.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);
  });

  test('should display glossary entry count', async ({ page }) => {
    const countText = page.getByText(/\d+ terms/i);
    await countText.scrollIntoViewIfNeeded();
    await expect(countText).toBeVisible();
  });

  test('should show related terms on glossary entries', async ({ page }) => {
    // Search for Nuclide to make sure it's visible
    const searchInput = page.getByRole('textbox');
    await searchInput.fill('Nuclide');

    // Wait for filter to apply
    const nuclideEntry = page.locator('.card', { hasText: /^Nuclide/ }).first();
    await expect(nuclideEntry).toBeVisible();
    await expect(nuclideEntry.getByText('Isotope')).toBeVisible();
  });
});
