#!/usr/bin/env tsx
/**
 * Interactive Screenshot Helper Tool
 *
 * Opens a Playwright browser in headed mode to help you:
 * - Navigate to the page you want to screenshot
 * - Interact with the UI (click, scroll, etc.)
 * - See the current scroll position overlaid on screen
 * - Take preview screenshots
 * - Export the scenario JSON configuration
 *
 * Usage:
 *   npm run screenshot:helper [scenario-name]
 *
 * Keyboard shortcuts:
 *   S - Take screenshot preview
 *   E - Export scenario JSON
 *   C - Clear recorded actions
 *   Q - Quit
 *   H - Show help
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface RecordedAction {
  type: string;
  [key: string]: any;
}

interface ScenarioConfig {
  name: string;
  description: string;
  page: string;
  viewport: string;
  theme: string;
  actions: RecordedAction[];
  output: string;
}

const VIEWPORTS = {
  'desktop-16:9-small': { width: 1280, height: 720 },
  'mobile-16:9': { width: 640, height: 360 },
  'desktop-16:9-large': { width: 1920, height: 1080 },
};

class ScreenshotHelper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private actions: RecordedAction[] = [];
  private scenarioName: string;
  private baseURL = 'http://localhost:5173';
  private currentPath = '/';
  private viewport: keyof typeof VIEWPORTS = 'desktop-16:9-small';
  private theme: 'light' | 'dark' = 'light';
  private outputDir = path.join(process.cwd(), 'docs/screenshots/pr');

  constructor(scenarioName?: string) {
    this.scenarioName = scenarioName || 'untitled-scenario';
  }

  async start() {
    console.log('🚀 Screenshot Helper Tool Starting...\n');
    console.log('Base URL:', this.baseURL);
    console.log('Scenario:', this.scenarioName);
    console.log('Output Directory:', this.outputDir);
    console.log('\n📋 Keyboard Shortcuts:');
    console.log('  S - Take screenshot preview');
    console.log('  E - Export scenario JSON');
    console.log('  C - Clear recorded actions');
    console.log('  R - Record scroll position');
    console.log('  T - Toggle theme (light/dark)');
    console.log('  V - Change viewport');
    console.log('  Q - Quit');
    console.log('  H - Show help\n');

    // Launch browser
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext({
      viewport: VIEWPORTS[this.viewport],
      colorScheme: this.theme,
    });

    this.page = await context.newPage();

    // Add initial actions
    this.actions.push(
      { type: 'wait-for-db' },
      { type: 'accept-metered' },
      { type: 'wait', timeout: 3000 }
    );

    // Navigate to home
    await this.page.goto(this.baseURL);
    this.currentPath = '/';

    // Inject scroll position overlay
    await this.injectOverlay();

    // Set up keyboard listener
    this.setupKeyboardListener();

    // Keep the process alive
    console.log('\n✅ Browser opened! Navigate to your target page and interact with it.');
    console.log('   Press keyboard shortcuts to control the tool.\n');
  }

  private async injectOverlay() {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      // Create overlay div
      const overlay = document.createElement('div');
      overlay.id = 'screenshot-helper-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: #00ff00;
        padding: 10px 15px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 14px;
        z-index: 999999;
        pointer-events: none;
      `;

      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(overlay);

        // Update scroll position
        const updatePosition = () => {
          const scrollY = window.scrollY;
          overlay.textContent = `Scroll Y: ${scrollY}px`;
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition);
      });
    });
  }

  private setupKeyboardListener() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', async (str, key) => {
      if (!key) return;

      // Handle Ctrl+C
      if (key.ctrl && key.name === 'c') {
        await this.quit();
        return;
      }

      switch (key.name.toLowerCase()) {
        case 's':
          await this.takeScreenshot();
          break;
        case 'e':
          await this.exportScenario();
          break;
        case 'c':
          this.clearActions();
          break;
        case 'r':
          await this.recordScrollPosition();
          break;
        case 't':
          await this.toggleTheme();
          break;
        case 'v':
          await this.changeViewport();
          break;
        case 'q':
          await this.quit();
          break;
        case 'h':
          this.showHelp();
          break;
      }
    });
  }

  private async takeScreenshot() {
    if (!this.page) return;

    console.log('\n📸 Taking screenshot preview...');

    const timestamp = Date.now();
    const filename = `preview-${this.scenarioName}-${timestamp}.png`;
    const filepath = path.join(this.outputDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    await this.page.screenshot({ path: filepath });
    console.log(`✅ Screenshot saved: ${filename}`);
    console.log(`   Path: ${filepath}\n`);
  }

  private async recordScrollPosition() {
    if (!this.page) return;

    const scrollY = await this.page.evaluate(() => window.scrollY);
    console.log(`\n📍 Recording scroll position: y=${scrollY}`);

    this.actions.push({ type: 'scroll', y: scrollY });
    console.log(`✅ Added scroll action to scenario\n`);
  }

  private async exportScenario() {
    if (!this.page) return;

    console.log('\n📦 Exporting scenario...');

    // Get current page URL
    const currentURL = this.page.url();
    const url = new URL(currentURL);
    this.currentPath = url.pathname + url.search;

    const scenario: ScenarioConfig = {
      name: `PR #${this.scenarioName}`,
      description: `Description for ${this.scenarioName}`,
      page: this.currentPath,
      viewport: this.viewport,
      theme: this.theme,
      actions: this.actions,
      output: `${this.scenarioName}.png`,
    };

    // Pretty print JSON
    const json = JSON.stringify({ [this.scenarioName]: scenario }, null, 2);

    console.log('\n📋 Scenario JSON:');
    console.log('─'.repeat(60));
    console.log(json);
    console.log('─'.repeat(60));

    // Save to file
    const jsonPath = path.join(process.cwd(), `scenario-${this.scenarioName}.json`);
    fs.writeFileSync(jsonPath, json);
    console.log(`\n✅ Scenario saved to: ${jsonPath}`);
    console.log('\nYou can copy this JSON into screenshot-scenarios.json\n');
  }

  private clearActions() {
    console.log('\n🗑️  Clearing recorded actions...');
    this.actions = [
      { type: 'wait-for-db' },
      { type: 'accept-metered' },
      { type: 'wait', timeout: 3000 }
    ];
    console.log('✅ Actions cleared (kept initial wait actions)\n');
  }

  private async toggleTheme() {
    if (!this.page) return;

    this.theme = this.theme === 'light' ? 'dark' : 'light';
    console.log(`\n🎨 Switching to ${this.theme} theme...`);

    await this.page.emulateMedia({ colorScheme: this.theme });
    console.log(`✅ Theme changed to ${this.theme}\n`);
  }

  private async changeViewport() {
    if (!this.page) return;

    const viewportKeys = Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>;
    const currentIndex = viewportKeys.indexOf(this.viewport);
    const nextIndex = (currentIndex + 1) % viewportKeys.length;
    this.viewport = viewportKeys[nextIndex];

    console.log(`\n📐 Changing viewport to: ${this.viewport}`);

    await this.page.setViewportSize(VIEWPORTS[this.viewport]);
    console.log(`✅ Viewport changed (${VIEWPORTS[this.viewport].width}x${VIEWPORTS[this.viewport].height})\n`);
  }

  private showHelp() {
    console.log('\n📖 Screenshot Helper - Keyboard Shortcuts:');
    console.log('─'.repeat(60));
    console.log('  S - Take screenshot preview');
    console.log('      Saves a timestamped preview image');
    console.log('');
    console.log('  R - Record current scroll position');
    console.log('      Adds scroll action with current Y position');
    console.log('');
    console.log('  E - Export scenario JSON');
    console.log('      Generates JSON configuration for screenshot-scenarios.json');
    console.log('');
    console.log('  C - Clear recorded actions');
    console.log('      Resets action list (keeps initial wait actions)');
    console.log('');
    console.log('  T - Toggle theme (light/dark)');
    console.log('      Switches between light and dark mode');
    console.log('');
    console.log('  V - Change viewport');
    console.log('      Cycles through available viewport sizes');
    console.log('');
    console.log('  Q - Quit');
    console.log('      Closes browser and exits tool');
    console.log('');
    console.log('  H - Show this help');
    console.log('─'.repeat(60));
    console.log('');
  }

  private async quit() {
    console.log('\n👋 Closing browser and exiting...');

    if (this.browser) {
      await this.browser.close();
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.exit(0);
  }
}

// Main entry point
const scenarioName = process.argv[2];

if (!scenarioName) {
  console.error('❌ Error: Please provide a scenario name');
  console.error('\nUsage: npm run screenshot:helper [scenario-name]');
  console.error('Example: npm run screenshot:helper pr-32-new-feature');
  process.exit(1);
}

const helper = new ScreenshotHelper(scenarioName);
helper.start().catch(console.error);
