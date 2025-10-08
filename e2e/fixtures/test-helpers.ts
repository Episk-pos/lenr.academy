import { Page } from '@playwright/test';

/**
 * Helper to wait for database to be loaded
 * The app shows a loading card while database initializes
 */
export async function waitForDatabaseReady(page: Page, timeout = 30000) {
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
 * Helper to accept privacy consent
 */
export async function acceptPrivacyConsent(page: Page) {
  await page.context().addInitScript(() => {
    localStorage.setItem('lenr-analytics-consent', 'true');
  });
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
 * Helper to navigate using sidebar
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
