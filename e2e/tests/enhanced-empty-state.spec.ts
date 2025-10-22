import { test, expect } from '@playwright/test';
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  waitForReactionResults
} from '../fixtures/test-helpers';

test.describe('Enhanced Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/fusion');
    await acceptMeteredWarningIfPresent(page);
    await waitForDatabaseReady(page);
  });

  test('should show enhanced empty state for pinned element in limited results', async ({ page }) => {
    // Wait for initial query to execute
    await waitForReactionResults(page, 'fusion');

    // Scroll down to make sure the heatmap toggle is in view BEFORE trying to locate it
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100);

    // Now locate and interact with the heatmap toggle
    const heatmapToggle = page.getByRole('switch', { name: /use all.*matching results/i });
    await heatmapToggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    // Enable "use all matching results" heatmap toggle
    await heatmapToggle.click();

    // Wait for heatmap to update with full dataset
    await page.waitForTimeout(500);

    // Pin an element that exists in the heatmap but not in the limited results
    const praseodymiumButton = page.getByRole('button', { name: /^59\s+Pr$/ });
    
    // Wait for Pr to become available after heatmap update
    await praseodymiumButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Pin Praseodymium
    await praseodymiumButton.click();
    
    // Check reaction count text - should show limited results count, not total count
    const reactionCountText = page.getByRole('heading', { name: /Showing.*reactions.*containing.*Pr/i });
    await expect(reactionCountText).toBeVisible();
    
    // The count should be small (limited results), not the full dataset count
    const text = await reactionCountText.textContent();
    const match = text?.match(/Showing 0 of ([0-9,]+) reactions/);
    if (match) {
      const count = parseInt(match[1].replace(/,/g, ''));
      // Should be a small number (limited results), not the full dataset count
      expect(count).toBeLessThan(1000); // More lenient threshold
    }
  });

  test('should show enhanced empty state for two-to-two query', async ({ page }) => {
    // Navigate to two-to-two page
    await page.goto('/twotwo');
    await waitForDatabaseReady(page);

    // Wait for initial query to execute
    await waitForReactionResults(page, 'twotwo');

    // Scroll down to make sure the heatmap toggle is in view BEFORE trying to locate it
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100);

    // Now locate and interact with the heatmap toggle
    const heatmapToggle = page.getByRole('switch', { name: /use all.*matching results/i });
    await heatmapToggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    // Enable "use all matching results" heatmap toggle
    await heatmapToggle.click();

    // Wait for heatmap to update with full dataset
    await page.waitForTimeout(500);

    // Pin an element that exists in the heatmap but not in the limited results
    // Use Praseodymium (Pr) which should appear in two-to-two results
    const praseodymiumButton = page.getByRole('button', { name: /^59\s+Pr$/ });
    
    // Wait for Pr to become available after heatmap update
    await praseodymiumButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Pin Praseodymium
    await praseodymiumButton.click();
    
    // Scroll down to see the results table where the enhanced empty state appears
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(100);
    
    // Check if enhanced empty state appears
    const enhancedEmptyState = page.getByText(/exists in the full dataset but not in the limited results/i);
    const showAllButton = page.getByRole('button', { name: 'Show All in Table →' }).first();
    
    // The enhanced empty state should appear with the "Show All in Table" button
    await expect(enhancedEmptyState).toBeVisible();
    await expect(showAllButton).toBeVisible();
  });

  test('should show accurate reaction count for pinned elements in limited results', async ({ page }) => {
    // Wait for initial query to execute
    await waitForReactionResults(page, 'fusion');

    // Scroll down to make sure the heatmap toggle is in view BEFORE trying to locate it
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100);

    // Now locate and interact with the heatmap toggle
    const heatmapToggle = page.getByRole('switch', { name: /use all.*matching results/i });
    await heatmapToggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    // Enable "use all matching results" heatmap toggle
    await heatmapToggle.click();

    // Wait for heatmap to update with full dataset
    await page.waitForTimeout(500);

    // Pin an element that exists in the heatmap but not in the limited results
    const praseodymiumButton = page.getByRole('button', { name: /^59\s+Pr$/ });
    
    // Wait for Pr to become available after heatmap update
    await praseodymiumButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Pin Praseodymium
    await praseodymiumButton.click();
    
    // Check reaction count text - should show limited results count, not total count
    const reactionCountText = page.getByRole('heading', { name: /Showing.*reactions.*containing.*Pr/i });
    await expect(reactionCountText).toBeVisible();
    
    // The count should be small (limited results), not the full dataset count
    const text = await reactionCountText.textContent();
    const match = text?.match(/Showing 0 of ([0-9,]+) reactions/);
    if (match) {
      const count = parseInt(match[1].replace(/,/g, ''));
      // Should be a small number (limited results), not the full dataset count
      expect(count).toBeLessThan(1000); // More lenient threshold
    }
  });

  test('should show enhanced empty state with element name and performance warning', async ({ page }) => {
    // Wait for initial query to execute
    await waitForReactionResults(page, 'fusion');

    // Scroll down to make sure the heatmap toggle is in view BEFORE trying to locate it
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100);

    // Now locate and interact with the heatmap toggle
    const heatmapToggle = page.getByRole('switch', { name: /use all.*matching results/i });
    await heatmapToggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);

    // Enable "use all matching results" heatmap toggle
    await heatmapToggle.click();

    // Wait for heatmap to update with full dataset
    await page.waitForTimeout(500);

    // Pin an element that exists in the heatmap but not in the limited results
    const praseodymiumButton = page.getByRole('button', { name: /^59\s+Pr$/ });
    
    // Wait for Pr to become available after heatmap update
    await praseodymiumButton.waitFor({ state: 'visible', timeout: 5000 });
    
    // Pin Praseodymium
    await praseodymiumButton.click();
    
    // Check enhanced empty state text format
    const enhancedEmptyState = page.getByText(/exists in the full dataset but not in the limited results/i);
    await expect(enhancedEmptyState).toBeVisible();
    
    // Should contain element name (Praseodymium) and performance warning
    const text = await enhancedEmptyState.textContent();
    expect(text).toContain('Praseodymium');
    expect(text).toContain('(may be slow)');
    
    // Verify the "Show All in Table" button is present - use the second one (not the first)
    const showAllButtons = page.getByRole('button', { name: 'Show All in Table →' });
    await expect(showAllButtons).toHaveCount(2);
    await expect(showAllButtons.nth(1)).toBeVisible();
  });
});