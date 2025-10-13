/**
 * PR Screenshot Generation Tool
 *
 * Generates targeted screenshots for PRs showcasing UI changes.
 * Uses scenario-based configuration for reproducible captures.
 *
 * Usage:
 *   npm run screenshots:pr <scenario-name>
 *   npm run screenshots:pr pr-30-radioactive-indicators
 */

import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots', 'pr');
const SCENARIOS_FILE = path.join(process.cwd(), 'screenshot-scenarios.json');

// 16:9 viewports for PR screenshots
const VIEWPORTS = {
  'desktop-16:9': { width: 1920, height: 1080 },
  'desktop-16:9-small': { width: 1280, height: 720 },
  'mobile-16:9': { width: 640, height: 360 },
  'tablet-16:9': { width: 1024, height: 576 },
};

interface Action {
  type: 'click' | 'wait' | 'scroll' | 'input' | 'select-element' | 'run-query' | 'toggle-theme' | 'navigate' | 'accept-metered' | 'wait-for-db';
  selector?: string;
  value?: string | number;
  timeout?: number;
  element?: string;
  x?: number;
  y?: number;
  url?: string;
}

interface Scenario {
  name: string;
  description: string;
  page: string;
  viewport: keyof typeof VIEWPORTS;
  theme: 'light' | 'dark';
  actions: Action[];
  output: string;
}

interface ScenariosConfig {
  scenarios: Record<string, Scenario>;
}

// Helper to wait for database loading
async function waitForDatabaseReady(page: Page, timeout = 60000) {
  await page.waitForFunction(
    () => {
      const meteredWarning = document.querySelector('[data-testid="metered-warning"]');
      if (meteredWarning) return true;
      const loadingCard = document.querySelector('[data-testid="database-loading"]');
      return !loadingCard;
    },
    { timeout }
  );
}

// Helper to accept metered warning if present
async function acceptMeteredWarningIfPresent(page: Page) {
  const meteredWarning = page.locator('[data-testid="metered-warning"]');
  if (await meteredWarning.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByRole('button', { name: /download anyway/i }).click();
    await meteredWarning.waitFor({ state: 'hidden' });
  }
}

// Helper to wait for theme to be applied
async function waitForTheme(page: Page, theme: 'light' | 'dark') {
  await page.waitForFunction(
    (expectedTheme) => {
      const html = document.documentElement;
      return html.classList.contains(expectedTheme);
    },
    theme,
    { timeout: 5000 }
  );
}

// Execute a single action
async function executeAction(page: Page, action: Action) {
  switch (action.type) {
    case 'click':
      if (action.selector) {
        await page.click(action.selector);
      }
      break;

    case 'wait':
      await page.waitForTimeout(action.timeout || 1000);
      break;

    case 'scroll':
      await page.evaluate(({ x, y }) => {
        window.scrollBy(x || 0, y || 0);
      }, { x: action.x, y: action.y });
      await page.waitForTimeout(300); // Wait for scroll to settle
      break;

    case 'input':
      if (action.selector && action.value !== undefined) {
        await page.fill(action.selector, String(action.value));
      }
      break;

    case 'select-element':
      if (action.element) {
        await page.waitForSelector(`[data-element="${action.element}"]`, { timeout: 30000 });
        await page.click(`[data-element="${action.element}"]`);
      }
      break;

    case 'run-query':
      await page.getByRole('button', { name: /run query/i }).click();
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="query-loading"]'),
        { timeout: 10000 }
      );
      await page.waitForTimeout(500);
      break;

    case 'toggle-theme':
      const themeButton = page.locator('button').filter({ hasText: /dark mode|light mode/i }).first();
      await themeButton.click();
      await page.waitForTimeout(500);
      break;

    case 'navigate':
      if (action.url) {
        await page.goto(action.url);
      }
      break;

    case 'accept-metered':
      await acceptMeteredWarningIfPresent(page);
      break;

    case 'wait-for-db':
      await waitForDatabaseReady(page, action.timeout || 60000);
      break;
  }
}

// Execute a scenario
async function executeScenario(browser: Browser, scenario: Scenario) {
  console.log(`\n📸 Capturing: ${scenario.name}`);
  console.log(`   ${scenario.description}`);

  const viewport = VIEWPORTS[scenario.viewport];
  const context = await browser.newContext({ viewport });

  // Set localStorage before page loads
  await context.addInitScript((theme) => {
    localStorage.setItem('lenr-analytics-consent', 'true');
    localStorage.setItem('theme', theme);
  }, scenario.theme);

  const page = await context.newPage();

  // Navigate to initial page
  const url = scenario.page.startsWith('http') ? scenario.page : `${BASE_URL}${scenario.page}`;
  await page.goto(url);

  // Execute actions
  for (const action of scenario.actions) {
    await executeAction(page, action);
  }

  // Ensure output directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Capture screenshot
  const outputPath = path.join(SCREENSHOT_DIR, scenario.output);
  await page.screenshot({
    path: outputPath,
    fullPage: false, // Viewport only for consistent 16:9
  });

  console.log(`   ✓ Saved: ${scenario.output}`);

  await context.close();
}

// Load scenarios from JSON file
function loadScenarios(): ScenariosConfig {
  if (!fs.existsSync(SCENARIOS_FILE)) {
    throw new Error(`Scenarios file not found: ${SCENARIOS_FILE}`);
  }

  const content = fs.readFileSync(SCENARIOS_FILE, 'utf-8');
  return JSON.parse(content);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: No scenario specified');
    console.error('\nUsage: npm run screenshots:pr <scenario-name>');
    console.error('   or: npm run screenshots:pr all');
    console.error('\nAvailable scenarios:');

    const config = loadScenarios();
    Object.keys(config.scenarios).forEach(key => {
      const scenario = config.scenarios[key];
      console.error(`   - ${key}: ${scenario.description}`);
    });

    process.exit(1);
  }

  const scenarioArg = args[0];
  const config = loadScenarios();

  console.log('🚀 Starting PR screenshot generation...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output directory: ${SCREENSHOT_DIR}`);

  const browser = await chromium.launch({ headless: true });

  try {
    if (scenarioArg === 'all') {
      // Execute all scenarios
      for (const [key, scenario] of Object.entries(config.scenarios)) {
        await executeScenario(browser, scenario);
      }
    } else {
      // Execute single scenario
      const scenario = config.scenarios[scenarioArg];
      if (!scenario) {
        throw new Error(`Scenario not found: ${scenarioArg}`);
      }
      await executeScenario(browser, scenario);
    }

    console.log('\n✅ Screenshot generation complete!');
    console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  } catch (error) {
    console.error('\n❌ Error generating screenshots:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
