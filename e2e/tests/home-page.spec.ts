import { test, expect } from '@playwright/test';
import {
  acceptPrivacyConsent,
} from '../fixtures/test-helpers';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/');
  });

  test('should display the main title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /LENR Academy/i })).toBeVisible();
  });

  test('should display four feature cards', async ({ page }) => {
    const featureHeadings = [
      /Query Nuclear Reactions/i,
      /Cascade Simulations/i,
      /Elements.*Nuclides.*Decay/i,
      /Muller Resonance/i,
    ];
    for (const heading of featureHeadings) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('should have navigation links to query pages in main content', async ({ page }) => {
    // Main content links include arrow prefix "→"
    const mainContent = page.getByRole('main');
    await expect(mainContent.getByRole('link', { name: /Fusion Reactions/i })).toBeVisible();
    await expect(mainContent.getByRole('link', { name: /Fission Reactions/i })).toBeVisible();
    await expect(mainContent.getByRole('link', { name: /Two-To-Two Reactions/i })).toBeVisible();
  });

  test('should navigate to fusion query page from home', async ({ page }) => {
    const mainContent = page.getByRole('main');
    await mainContent.getByRole('link', { name: /Fusion Reactions/i }).click();
    await page.waitForURL(/\/fusion/);
  });

  test('should navigate to fission query page from home', async ({ page }) => {
    const mainContent = page.getByRole('main');
    await mainContent.getByRole('link', { name: /Fission Reactions/i }).click();
    await page.waitForURL(/\/fission/);
  });

  test('should navigate to twotwo query page from home', async ({ page }) => {
    const mainContent = page.getByRole('main');
    await mainContent.getByRole('link', { name: /Two-To-Two Reactions/i }).click();
    await page.waitForURL(/\/twotwo/);
  });

  test('should have cascade simulations link', async ({ page }) => {
    const mainContent = page.getByRole('main');
    await expect(mainContent.getByRole('link', { name: /Cascade Simulations/i })).toBeVisible();
  });

  test('should have element data link', async ({ page }) => {
    const mainContent = page.getByRole('main');
    const elementLink = mainContent.getByRole('link', { name: /Element.*Nuclide Explorer/i });
    await elementLink.scrollIntoViewIfNeeded();
    await expect(elementLink).toBeVisible();
  });

  test('should have tables in detail link', async ({ page }) => {
    const mainContent = page.getByRole('main');
    const tablesLink = mainContent.getByRole('link', { name: /Tables in Detail/i });
    await tablesLink.scrollIntoViewIfNeeded();
    await expect(tablesLink).toBeVisible();
  });

  test('should have all tables query tool link', async ({ page }) => {
    const mainContent = page.getByRole('main');
    const allTablesLink = mainContent.getByRole('link', { name: /Custom SQL Queries/i });
    await allTablesLink.scrollIntoViewIfNeeded();
    await expect(allTablesLink).toBeVisible();
  });

  test('should display data heritage section', async ({ page }) => {
    // The "About the Data" section summarizes Parkhomov's analysis and Nanosoft origins
    const sectionHeading = page.getByRole('heading', { name: /About the Data/i });
    await sectionHeading.scrollIntoViewIfNeeded();
    await expect(sectionHeading).toBeVisible();
    // Reaction counts are called out inline
    await expect(page.getByText(/1,389 fusion/)).toBeVisible();
  });

  test('should display nanosoft external link in data heritage section', async ({ page }) => {
    const nanosoftLink = page.getByRole('link', { name: /Visit Original Nanosoft Package/i });
    await nanosoftLink.scrollIntoViewIfNeeded();
    await expect(nanosoftLink).toBeVisible();
    await expect(nanosoftLink).toHaveAttribute('href', 'https://nanosoft.co.nz');
    await expect(nanosoftLink).toHaveAttribute('target', '_blank');
  });

  test('should display open source section with GitHub link', async ({ page }) => {
    const githubLink = page.getByRole('link', { name: /GitHub/i }).first();
    await githubLink.scrollIntoViewIfNeeded();
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute('href', /github\.com\/Episk-pos\/lenr\.academy/);
  });

  test('should have discussions and issues links', async ({ page }) => {
    const discussionLink = page.getByRole('link', { name: /Discussion/i });
    await discussionLink.scrollIntoViewIfNeeded();
    await expect(discussionLink).toBeVisible();
    const issueLink = page.getByRole('link', { name: /Report|Issue/i }).first();
    await issueLink.scrollIntoViewIfNeeded();
    await expect(issueLink).toBeVisible();
  });
});
