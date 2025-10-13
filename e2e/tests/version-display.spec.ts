import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
} from '../fixtures/test-helpers';

test.describe('Version Display', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display version in desktop sidebar', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Version should be visible in the sidebar footer (get last one for desktop)
    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    // Should have text content
    const versionText = await versionElement.textContent();
    expect(versionText).toBeTruthy();
    expect(versionText?.trim()).not.toBe('');
  });

  test('should display version with correct format', async ({ page }) => {
    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    const versionText = await versionElement.textContent();

    // Should match one of these patterns:
    // - Semver: v0.1.0, v0.1.0-alpha.0
    // - Dev build: v0.1.0-alpha.0+4.g72f289d, v0.1.0-alpha.0 (modified)
    // - Commit SHA: 9abc6cf (fallback when git tags aren't available)
    // - Unknown: 'unknown' (fallback when git isn't available)
    expect(versionText).toMatch(/^(v\d+\.\d+\.\d+[\w.\-+()]*|[a-f0-9]{7,40}|unknown)/);
  });

  test('should have tooltip with version details', async ({ page }) => {
    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    // Should have a title attribute for tooltip
    const titleAttribute = await versionElement.getAttribute('title');
    expect(titleAttribute).toBeTruthy();
    expect(titleAttribute).toContain('Version:');
    expect(titleAttribute).toContain('Click to view release on GitHub');
  });

  test('should be a clickable link to GitHub releases', async ({ page }) => {
    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    // Should be a link element
    const tagName = await versionElement.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('a');

    // Should have href attribute
    const href = await versionElement.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toContain('github.com/Episk-pos/lenr.academy/releases');

    // Should open in new tab
    const target = await versionElement.getAttribute('target');
    expect(target).toBe('_blank');

    // Should have security attributes
    const rel = await versionElement.getAttribute('rel');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');

    // Should have hover classes for transition
    const className = await versionElement.getAttribute('class');
    expect(className).toContain('hover:');
    expect(className).toContain('transition-colors');
  });

  test('should hide version when desktop sidebar is collapsed', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Version should be visible initially (desktop version is last)
    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    // Find and click the collapse button
    const collapseButton = page.getByRole('button', { name: /collapse sidebar/i });
    await collapseButton.click();

    // Wait for animation
    await page.waitForTimeout(350);

    // Version should be visually hidden (opacity 0) when sidebar is collapsed
    const opacity = await versionElement.evaluate(el => window.getComputedStyle(el.parentElement!).opacity);
    expect(parseFloat(opacity)).toBe(0);
  });

  test('should show version when desktop sidebar is expanded', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Collapse sidebar first
    const collapseButton = page.getByRole('button', { name: /collapse sidebar/i });
    await collapseButton.click();
    await page.waitForTimeout(350);

    // Version should be visually hidden (opacity 0) when collapsed
    const versionElement = page.getByTestId('app-version').last();
    let opacity = await versionElement.evaluate(el => window.getComputedStyle(el.parentElement!).opacity);
    expect(parseFloat(opacity)).toBe(0);

    // Expand sidebar
    const expandButton = page.getByRole('button', { name: /expand sidebar/i });
    await expandButton.click();
    await page.waitForTimeout(350);

    // Version should be visible again (opacity 1)
    opacity = await versionElement.evaluate(el => window.getComputedStyle(el.parentElement!).opacity);
    expect(parseFloat(opacity)).toBe(1);
  });

  test('should display version on mobile sidebar', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Open mobile sidebar
    const menuButton = page.getByRole('button', { name: /open menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Wait for sidebar animation
    await page.waitForTimeout(300);

    // Version should be visible in mobile sidebar (first one is mobile)
    const versionElement = page.getByTestId('app-version').first();
    await expect(versionElement).toBeVisible();

    // Should have text content
    const versionText = await versionElement.textContent();
    expect(versionText).toBeTruthy();
    expect(versionText?.trim()).not.toBe('');
  });

  test('should persist version display across page navigation', async ({ page }) => {
    // Start at home
    await expect(page).toHaveURL('/');

    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();
    const versionTextHome = await versionElement.textContent();

    // Navigate to fusion page
    await page.goto('/fusion');
    await waitForDatabaseReady(page);
    await expect(versionElement).toBeVisible();
    const versionTextFusion = await versionElement.textContent();

    // Navigate to element data
    await page.goto('/element-data');
    await waitForDatabaseReady(page);
    await expect(versionElement).toBeVisible();
    const versionTextElement = await versionElement.textContent();

    // Version should be the same across all pages
    expect(versionTextHome).toBe(versionTextFusion);
    expect(versionTextFusion).toBe(versionTextElement);
  });

  test('should be styled appropriately for dark mode', async ({ page }) => {
    // Set dark mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
    });
    await page.reload();
    await waitForDatabaseReady(page);

    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    // Should have dark mode classes
    const className = await versionElement.getAttribute('class');
    expect(className).toContain('dark:');
  });

  test('should be styled appropriately for light mode', async ({ page }) => {
    // Set light mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
    });
    await page.reload();
    await waitForDatabaseReady(page);

    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    // Should have text-gray classes for light mode
    const className = await versionElement.getAttribute('class');
    expect(className).toContain('text-gray');
  });
});

test.describe('Version Display - Tablet Viewport', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should display version on tablet', async ({ page }) => {
    // At 768px width, it's still mobile view (lg breakpoint is 1024px)
    // Open mobile sidebar to see version
    const menuButton = page.getByRole('button', { name: /open menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Wait for sidebar animation
    await page.waitForTimeout(300);

    // Version should be visible in mobile sidebar (first one is mobile)
    const versionElement = page.getByTestId('app-version').first();
    await expect(versionElement).toBeVisible();

    const versionText = await versionElement.textContent();
    expect(versionText).toBeTruthy();
  });
});

test.describe('Version Display - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should have accessible tooltip text', async ({ page }) => {
    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    const titleAttribute = await versionElement.getAttribute('title');
    expect(titleAttribute).toBeTruthy();

    // Title should be human-readable and descriptive
    expect(titleAttribute).toMatch(/Version:/);
  });

  test('should be keyboard accessible', async ({ page }) => {
    // The version link should be keyboard accessible
    const versionElement = page.getByTestId('app-version').last();
    await expect(versionElement).toBeVisible();

    // Links are naturally keyboard accessible via Tab key
    // Should be a link element
    const tagName = await versionElement.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('a');

    // Should have an href (links are focusable by default)
    const href = await versionElement.getAttribute('href');
    expect(href).toBeTruthy();
  });
});
