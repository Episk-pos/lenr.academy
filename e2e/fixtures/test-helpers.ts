import { Page, Locator } from '@playwright/test';

/**
 * Helper to wait for database to be loaded
 * The app shows a loading card while database initializes
 *
 * IMPORTANT: Only call this helper after operations that trigger a full page load!
 *
 * When to use:
 * - After `page.goto()` - full page load requires DB initialization
 * - After `page.reload()` - full page reload requires DB re-initialization
 * - After navigating to a new browser context
 *
 * When NOT to use:
 * - After `page.goBack()` / `page.goForward()` - browser history navigation preserves DB in memory
 * - After clicking sidebar links via `navigateToPage()` - client-side React Router navigation
 * - After clicking elements that trigger React Router navigation (URL changes without full page reload)
 * - Between tests in the same describe block (beforeEach already handles initial load)
 *
 * Performance impact: Each unnecessary call adds 2-5 seconds of wait time to test execution!
 */
export async function waitForDatabaseReady(page: Page, timeout = 60000) {
  // Wait for either the database to load or the metered connection warning
  await page.waitForFunction(
    () => {
      // Check if metered warning is shown
      const meteredWarning = document.querySelector('[data-testid="metered-warning"]');
      if (meteredWarning) {
        return true;
      }

      // Check if database loading is complete (loading card is gone)
      const loadingCard = document.querySelector('[data-testid="database-loading"]');
      return !loadingCard;
    },
    { timeout }
  );
}

/**
 * Helper to accept metered connection warning if present
 */
export async function acceptMeteredWarningIfPresent(page: Page) {
  const meteredWarning = page.locator('[data-testid="metered-warning"]');

  if (await meteredWarning.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByRole('button', { name: /download anyway/i }).click();
    await meteredWarning.waitFor({ state: 'hidden' });
  }
}

/**
 * Helper to clear all browser storage (localStorage, IndexedDB, cookies)
 */
export async function clearAllStorage(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Clear IndexedDB
  await page.evaluate(async () => {
    const dbs = await window.indexedDB.databases();
    for (const db of dbs) {
      if (db.name) {
        window.indexedDB.deleteDatabase(db.name);
      }
    }
  });
}

/**
 * Helper to set theme preference
 */
export async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((themeValue) => {
    localStorage.setItem('theme', themeValue);
  }, theme);
}

/**
 * Helper to accept privacy consent and dismiss changelog
 */
export async function acceptPrivacyConsent(page: Page) {
  await page.context().addInitScript(() => {
    localStorage.setItem('lenr-analytics-consent', 'accepted');
    // Disable changelog auto-launch (tests will open it explicitly if needed)
    localStorage.setItem('lenr-changelog-disable-auto', 'true');
  });
}

/**
 * Helper to dismiss changelog modal if present
 */
export async function dismissChangelogIfPresent(page: Page) {
  // Wait a moment for the modal to potentially appear
  await page.waitForTimeout(500);

  const closeButton = page.getByRole('button', { name: /close/i }).first();

  if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeButton.click({ force: true });
    await page.waitForTimeout(500); // Wait for modal close animation
  }
}

/**
 * Helper to set metered connection consent
 */
export async function setMeteredConsent(page: Page, consented: boolean) {
  await page.evaluate((value) => {
    if (value) {
      localStorage.setItem('lenr-metered-download-consent', 'true');
    } else {
      localStorage.removeItem('lenr-metered-download-consent');
    }
  }, consented);
}

/**
 * Helper to get periodic table element by symbol
 */
export function getPeriodicTableElement(page: Page, symbol: string) {
  return page.locator(`[data-element="${symbol}"]`);
}

/**
 * Helper to select multiple elements from periodic table
 */
export async function selectElements(page: Page, symbols: string[]) {
  for (const symbol of symbols) {
    await getPeriodicTableElement(page, symbol).click();
  }
}

/**
 * Helper to wait for query results to load
 */
export async function waitForQueryResults(page: Page) {
  // Wait for loading spinner to disappear
  await page.waitForFunction(
    () => {
      const spinner = document.querySelector('[data-testid="query-loading"]');
      return !spinner;
    },
    { timeout: 10000 }
  );
}

/**
 * Helper to wait for query results to be visible (works with both virtualized and non-virtualized rendering)
 * This replaces table-specific selectors that break with small result sets
 */
export async function waitForReactionResults(page: Page, queryType: 'fusion' | 'fission' | 'twotwo', timeout = 10000) {
  const labelMap: Record<string, string> = {
    'fusion': 'Fusion reaction results',
    'fission': 'Fission reaction results',
    'twotwo': 'Two-to-two reaction results'
  };
  const ariaLabel = labelMap[queryType];

  await page.waitForFunction(
    (label) => {
      const resultsRegion = document.querySelector(`[role="region"][aria-label="${label}"]`);
      if (!resultsRegion) return false;

      // Check if results have content (either virtualized list or direct rendering)
      const hasVirtualizedContent = resultsRegion.querySelector('[role="grid"]') !== null;
      const hasDirectContent = resultsRegion.querySelector('div[class*="grid"][class*="border-b"]') !== null;
      const hasEmptyMessage = resultsRegion.textContent?.includes('Run a query') ||
                             resultsRegion.textContent?.includes('no results') ||
                             resultsRegion.textContent?.includes('0 results');

      return hasVirtualizedContent || hasDirectContent || hasEmptyMessage;
    },
    ariaLabel,
    { timeout }
  );
}

/**
 * Helper to navigate using sidebar
 *
 * This performs client-side navigation via React Router (no full page reload).
 * The database remains loaded in memory, so NO waitForDatabaseReady() call is needed after this.
 */
export async function navigateToPage(page: Page, pageName: string) {
  // On mobile, might need to open sidebar first
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 768) {
    const menuButton = page.getByRole('button', { name: /open menu/i });
    if (await menuButton.isVisible().catch(() => false)) {
      await menuButton.click();
      // Wait for sidebar animation
      await page.waitForTimeout(300);
    }
  }

  // Use exact match or more specific patterns to avoid ambiguity
  const linkSelector = page.getByRole('link', { name: new RegExp(pageName, 'i'), exact: false }).first();
  await linkSelector.click();

  // On mobile, close sidebar after navigation
  if (viewport && viewport.width < 768) {
    // Wait a bit for navigation to complete
    await page.waitForTimeout(500);
  }
}

/**
 * Helper to disable CSS animations and transitions for faster tests
 * This significantly improves test performance, especially in Firefox
 */
export async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0ms !important;
      }
    `
  });
}

/**
 * Helper to click on elements in mobile viewport with proper scrolling and timing
 * Handles common mobile click issues like elements outside viewport
 */
export async function clickOnMobile(page: Page, selector: ReturnType<typeof page.getByRole>) {
  // Wait for element to be visible
  await selector.waitFor({ state: 'visible', timeout: 15000 });

  // Scroll element into view
  await selector.scrollIntoViewIfNeeded();

  // Allow layout to settle after scroll
  await page.waitForTimeout(500);

  // Verify element is in viewport (optional logging)
  const box = await selector.boundingBox();
  const viewport = page.viewportSize();

  if (box && viewport) {
    // Ensure element is within viewport bounds
    if (box.y < 0 || box.y + box.height > viewport.height) {
      // Element still not fully visible, try scrolling again
      await selector.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
  }

  // Click with extended timeout
  await selector.click({ timeout: 15000 });
}

/**
 * Helper to wait for CSS opacity transition to complete and stabilize
 * More reliable than fixed timeouts, especially in WebKit on CI
 *
 * @param page - Playwright page instance
 * @param element - Element whose parent's opacity to check
 * @param expectedOpacity - Expected opacity value (0 or 1)
 * @param timeout - Maximum time to wait in milliseconds (default 3000)
 */
export async function waitForOpacityTransition(
  page: Page,
  element: Locator,
  expectedOpacity: number,
  timeout = 3000
) {
  const startTime = Date.now();
  let stableCount = 0;

  while (Date.now() - startTime < timeout) {
    const opacity = parseFloat(
      await element.evaluate(el =>
        window.getComputedStyle(el.parentElement!).opacity
      )
    );

    // Check if within 1% of expected value (tolerance for floating point)
    if (Math.abs(opacity - expectedOpacity) < 0.01) {
      stableCount++;
      if (stableCount >= 3) return; // Stable for 3 consecutive checks (150ms)
    } else {
      stableCount = 0;
    }

    await page.waitForTimeout(50);
  }

  throw new Error(`Opacity never stabilized at ${expectedOpacity} within ${timeout}ms`);
}
