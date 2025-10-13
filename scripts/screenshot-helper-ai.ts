#!/usr/bin/env tsx
/**
 * AI-Assisted Screenshot Helper Tool
 *
 * This enhanced version logs all user interactions to help Claude Code
 * suggest scenario configurations. Run this, then paste the log into
 * Claude Code to get AI-generated scenarios.
 *
 * Usage:
 *   npm run screenshots:helper:ai [scenario-name]
 *
 * After navigating:
 *   1. Copy the interaction log from terminal
 *   2. Paste into Claude Code
 *   3. Ask: "Generate screenshot scenario from these interactions"
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface InteractionLog {
  timestamp: number;
  type: string;
  data: any;
}

const VIEWPORTS = {
  'desktop-16:9-small': { width: 1280, height: 720 },
  'mobile-16:9': { width: 640, height: 360 },
  'desktop-16:9-large': { width: 1920, height: 1080 },
};

class AIAssistedScreenshotHelper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private interactions: InteractionLog[] = [];
  private scenarioName: string;
  private baseURL = 'http://localhost:5173';
  private viewport: keyof typeof VIEWPORTS = 'desktop-16:9-small';
  private theme: 'light' | 'dark' = 'light';
  private outputDir = path.join(process.cwd(), 'docs/screenshots/pr');
  private logFile: string;

  constructor(scenarioName?: string) {
    this.scenarioName = scenarioName || 'untitled-scenario';
    this.logFile = path.join(process.cwd(), `interaction-log-${this.scenarioName}.json`);
  }

  async start() {
    console.log('🤖 AI-Assisted Screenshot Helper\n');
    console.log('This tool logs your interactions for Claude Code to analyze.\n');
    console.log('Base URL:', this.baseURL);
    console.log('Scenario:', this.scenarioName);
    console.log('Log file:', this.logFile);
    console.log('\n📋 Keyboard Shortcuts:');
    console.log('  S - Take screenshot preview');
    console.log('  L - Show interaction log');
    console.log('  E - Export log for Claude Code');
    console.log('  C - Clear interaction log');
    console.log('  T - Toggle theme');
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

    // Log navigation
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page!.mainFrame()) {
        const url = frame.url();
        this.logInteraction('navigation', { url });
        console.log(`🔗 Navigated to: ${url}`);
      }
    });

    // Inject scroll position overlay and interaction tracking
    await this.injectTracking();

    // Navigate to home
    await this.page.goto(this.baseURL);

    // Set up keyboard listener
    this.setupKeyboardListener();

    console.log('\n✅ Browser opened! Navigate and interact with the app.');
    console.log('   All interactions are being logged for AI analysis.\n');
  }

  private async injectTracking() {
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
          const scrollX = window.scrollX;
          overlay.innerHTML = `
            Scroll: (${scrollX}, ${scrollY})px<br>
            <span style="color: #888">Recording...</span>
          `;

          // Send scroll event to parent
          (window as any).__lastScroll = { x: scrollX, y: scrollY };
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition);

        // Track clicks
        document.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          const selector = getSelector(target);
          (window as any).__lastClick = {
            selector,
            text: target.textContent?.substring(0, 50),
            x: e.clientX,
            y: e.clientY,
          };
        });

        function getSelector(el: HTMLElement): string {
          if (el.id) return `#${el.id}`;
          if (el.className) {
            const classes = el.className.split(' ').filter(c => c).slice(0, 2).join('.');
            return `${el.tagName.toLowerCase()}.${classes}`;
          }
          return el.tagName.toLowerCase();
        }
      });
    });

    // Poll for scroll events
    this.startScrollTracking();
  }

  private startScrollTracking() {
    setInterval(async () => {
      if (!this.page) return;

      const scrollData = await this.page.evaluate(() => (window as any).__lastScroll);
      if (scrollData && scrollData.y > 0) {
        const lastLog = this.interactions[this.interactions.length - 1];
        if (!lastLog || lastLog.type !== 'scroll' || lastLog.data.y !== scrollData.y) {
          // New scroll position
          this.logInteraction('scroll', scrollData);
        }
      }

      // Check for clicks
      const clickData = await this.page.evaluate(() => {
        const data = (window as any).__lastClick;
        (window as any).__lastClick = null;
        return data;
      });

      if (clickData) {
        this.logInteraction('click', clickData);
        console.log(`👆 Clicked: ${clickData.text || clickData.selector}`);
      }
    }, 500);
  }

  private logInteraction(type: string, data: any) {
    this.interactions.push({
      timestamp: Date.now(),
      type,
      data,
    });
  }

  private setupKeyboardListener() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', async (str, key) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        await this.quit();
        return;
      }

      switch (key.name.toLowerCase()) {
        case 's':
          await this.takeScreenshot();
          break;
        case 'l':
          this.showLog();
          break;
        case 'e':
          await this.exportForAI();
          break;
        case 'c':
          this.clearLog();
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

    console.log('\n📸 Taking screenshot...');
    const timestamp = Date.now();
    const filename = `preview-${this.scenarioName}-${timestamp}.png`;
    const filepath = path.join(this.outputDir, filename);

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    await this.page.screenshot({ path: filepath });
    this.logInteraction('screenshot', { filename, filepath });
    console.log(`✅ Screenshot saved: ${filename}\n`);
  }

  private showLog() {
    console.log('\n📊 Interaction Log:');
    console.log('─'.repeat(60));

    if (this.interactions.length === 0) {
      console.log('No interactions recorded yet.');
    } else {
      this.interactions.forEach((log, idx) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        console.log(`${idx + 1}. [${time}] ${log.type}:`, JSON.stringify(log.data, null, 2));
      });
    }

    console.log('─'.repeat(60));
    console.log(`Total interactions: ${this.interactions.length}\n`);
  }

  private async exportForAI() {
    if (!this.page) return;

    console.log('\n🤖 Exporting for Claude Code...');

    const currentURL = this.page.url();
    const url = new URL(currentURL);
    const currentPath = url.pathname + url.search;

    const exportData = {
      scenarioName: this.scenarioName,
      viewport: this.viewport,
      theme: this.theme,
      startURL: this.baseURL,
      currentURL: currentURL,
      currentPath: currentPath,
      interactions: this.interactions,
      summary: this.generateSummary(),
    };

    // Save to file
    fs.writeFileSync(this.logFile, JSON.stringify(exportData, null, 2));

    console.log('\n📋 Copy this into Claude Code:\n');
    console.log('─'.repeat(60));
    console.log(`I navigated the app to create a screenshot scenario. Here's what I did:

Scenario Name: ${this.scenarioName}
Current Page: ${currentPath}
Viewport: ${this.viewport} (${VIEWPORTS[this.viewport].width}x${VIEWPORTS[this.viewport].height})
Theme: ${this.theme}

Interactions:
${exportData.summary}

Please generate a screenshot scenario configuration in JSON format that I can add to screenshot-scenarios.json.

Include:
- Appropriate wait actions (wait-for-db, accept-metered, wait 3000ms)
- The scroll position I ended at
- Any clicks I made
- Proper scenario naming and description

Full interaction log saved to: ${this.logFile}
    `);
    console.log('─'.repeat(60));
    console.log(`\n✅ Log exported to: ${this.logFile}`);
    console.log('\nPaste the above text into Claude Code to get AI-generated scenario!\n');
  }

  private generateSummary(): string {
    const summary: string[] = [];

    // Group interactions by type
    const navigations = this.interactions.filter(i => i.type === 'navigation');
    const scrolls = this.interactions.filter(i => i.type === 'scroll');
    const clicks = this.interactions.filter(i => i.type === 'click');
    const screenshots = this.interactions.filter(i => i.type === 'screenshot');

    if (navigations.length > 0) {
      const lastNav = navigations[navigations.length - 1];
      summary.push(`- Navigated to: ${lastNav.data.url}`);
    }

    if (scrolls.length > 0) {
      const lastScroll = scrolls[scrolls.length - 1];
      summary.push(`- Scrolled to position: (${lastScroll.data.x}, ${lastScroll.data.y})`);
    }

    if (clicks.length > 0) {
      summary.push(`- Clicked ${clicks.length} times:`);
      clicks.slice(-3).forEach(click => {
        summary.push(`  • ${click.data.text || click.data.selector}`);
      });
    }

    if (screenshots.length > 0) {
      summary.push(`- Took ${screenshots.length} preview screenshot(s)`);
    }

    return summary.join('\n');
  }

  private clearLog() {
    console.log('\n🗑️  Clearing interaction log...');
    this.interactions = [];
    console.log('✅ Log cleared\n');
  }

  private async toggleTheme() {
    if (!this.page) return;

    this.theme = this.theme === 'light' ? 'dark' : 'light';
    console.log(`\n🎨 Switching to ${this.theme} theme...`);

    await this.page.emulateMedia({ colorScheme: this.theme });
    this.logInteraction('theme-change', { theme: this.theme });
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
    this.logInteraction('viewport-change', { viewport: this.viewport, size: VIEWPORTS[this.viewport] });
    console.log(`✅ Viewport changed (${VIEWPORTS[this.viewport].width}x${VIEWPORTS[this.viewport].height})\n`);
  }

  private showHelp() {
    console.log('\n📖 AI-Assisted Screenshot Helper - Keyboard Shortcuts:');
    console.log('─'.repeat(60));
    console.log('  S - Take screenshot preview');
    console.log('  L - Show interaction log');
    console.log('  E - Export log for Claude Code (copy/paste into chat)');
    console.log('  C - Clear interaction log');
    console.log('  T - Toggle theme (light/dark)');
    console.log('  V - Change viewport size');
    console.log('  Q - Quit');
    console.log('  H - Show this help');
    console.log('─'.repeat(60));
    console.log('');
  }

  private async quit() {
    console.log('\n👋 Closing browser and exiting...');

    // Save log before exiting
    if (this.interactions.length > 0) {
      await this.exportForAI();
    }

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
  console.error('\nUsage: npm run screenshots:helper:ai [scenario-name]');
  console.error('Example: npm run screenshots:helper:ai pr-32-new-feature');
  process.exit(1);
}

const helper = new AIAssistedScreenshotHelper(scenarioName);
helper.start().catch(console.error);
