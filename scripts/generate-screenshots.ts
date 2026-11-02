/**
 * Automated Screenshot Generation for README
 *
 * Captures the six README screenshots (3 desktop, 3 mobile) from a running
 * dev server. Every shot uses a fresh browser context with localStorage
 * preset so no first-visit language modal, privacy banner, metered-download
 * warning or PWA install prompt appears.
 *
 * Usage:
 *   npm run dev            # in another terminal (or: npx vite --port 5199)
 *   npm run screenshots    # BASE_URL defaults to http://localhost:5199
 *
 *   BASE_URL=http://localhost:5173 npm run screenshots
 *   npm run screenshots -- --only cycles-dark   # capture a single shot
 */

import { chromium, Browser, BrowserContext, Locator, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5199';
const SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots');

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
// Desktop rendered at 80% zoom: 1800x1125 CSS px -> 1440x900 PNG. Used where
// the interesting UI is taller than one 900px screen.
const DESKTOP_ZOOMED = { viewport: { width: 1800, height: 1125 }, deviceScaleFactor: 0.8 };
// Larger phone: the language dropdown is capped at 100vh - 200px
const MOBILE_TALL = {
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};
const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

type Theme = 'light' | 'dark';
type Lang = 'en' | 'ja';

interface Shot {
  name: string;
  dir: 'desktop' | 'mobile';
  device: typeof DESKTOP | typeof DESKTOP_ZOOMED | typeof MOBILE | typeof MOBILE_TALL;
  theme: Theme;
  lang: Lang;
  capture: (page: Page) => Promise<void>;
}

/** Open a fresh context with first-visit prompts suppressed. */
async function newContext(browser: Browser, shot: Shot): Promise<BrowserContext> {
  const context = await browser.newContext({ ...shot.device, colorScheme: shot.theme });
  await context.addInitScript(
    ({ theme, lang }) => {
      const preset: Record<string, string> = {
        theme,
        'lenr-language-preference': lang, // i18next detector lookup key
        'lenr-language-selected': 'true', // suppresses first-visit language modal
        'lenr-analytics-consent': 'declined', // suppresses privacy banner (and Umami)
        'lenr-metered-download-consent': 'accepted', // suppresses metered warning
        'lenr-pwa-install-snoozed-until': '2999-01-01T00:00:00.000Z',
      };
      for (const [k, v] of Object.entries(preset)) localStorage.setItem(k, v);

      // Seed Math.random (mulberry32) so force-directed layouts are repeatable
      let seed = 0x1e4a;
      Math.random = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    { theme: shot.theme, lang: shot.lang }
  );
  return context;
}

/**
 * Hide transient UI: the global bottom banner stack (app/database update
 * banners), the offline indicator, the text caret, and the sidebar version
 * label (it reads "(modified)" on a dirty dev tree and goes stale anyway).
 */
async function hideTransientUi(page: Page) {
  await page.addStyleTag({
    content: `
      .fixed.bottom-0.z-50 { display: none !important; }
      [role="status"] { display: none !important; }
      *, *::before, *::after { caret-color: transparent !important; }
      [data-testid="app-version"] { visibility: hidden !important; }
    `,
  });
}

async function waitForDatabaseReady(page: Page, timeout = 120000) {
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="database-loading"]'),
    undefined,
    { timeout }
  );
}

async function gotoReady(page: Page, url: string) {
  await page.goto(`${BASE_URL}${url}`);
  await waitForDatabaseReady(page);
  await hideTransientUi(page);
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Set a React-controlled <input type="range"> (styled sliders fail Playwright's visibility check). */
async function setRange(slider: Locator, value: string) {
  await slider.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function save(page: Page, shot: Shot) {
  const out = path.join(SCREENSHOT_DIR, shot.dir, `${shot.name}.png`);
  await page.screenshot({ path: out });
  console.log(`  ✓ ${path.relative(process.cwd(), out)}`);
}

const SHOTS: Shot[] = [
  {
    // Cycle Discovery with the default search parameters (315 cycles found).
    // Opens the 6-step Li-6 cycle: Li-6 + Li-6 -> C-12, then Li-6 climbs
    // C-12 -> O-18 -> Mg-24 -> Si-30 -> Ar-36 and a 2->2 step regenerates
    // C-12 + Si-30. A closed loop with no byproducts, +123 MeV per turn.
    // Framed on the detail view: cycle summary, metrics and the loop diagram.
    name: 'cycles-dark',
    dir: 'desktop',
    device: DESKTOP_ZOOMED,
    theme: 'dark',
    lang: 'en',
    capture: async (page) => {
      await gotoReady(page, '/cycles');
      await page.getByRole('button', { name: 'Discover Cycles' }).click();
      await page.getByText('Discovery Complete').waitFor({ timeout: 300000 });
      await page
        .locator('table tbody tr')
        .filter({ hasText: 'Li-6' })
        .filter({ hasText: '+123.1 MeV' })
        .first()
        .click();
      await page.getByRole('heading', { name: 'Catalytic Cycle Diagram' }).waitFor();
      await page.mouse.move(0, 0); // no hover highlight on the diagram
      await page.waitForTimeout(1500);
      // Cycle Detail card at the top, page title scrolled away
      await page.evaluate(() => window.scrollTo(0, 108));
      await page.waitForTimeout(500);
    },
  },
  {
    // Fusion: H, D, Li, B + C, N, O, Al, Si, Ni -> 97 reactions whose outputs
    // spread across periods 1-4 of the heatmap. Ni-60 is pinned via ?pinN=,
    // which expands the heatmap and filters the results ("6 of 97 ... Ni-60").
    // The pinned details card sits below the results (out of frame).
    name: 'fusion-heatmap-light',
    dir: 'desktop',
    device: DESKTOP_ZOOMED,
    theme: 'light',
    lang: 'en',
    capture: async (page) => {
      await gotoReady(page, '/fusion?e1=H,D,Li,B&e2=C,N,O,Al,Si,Ni&pinN=Ni-60');
      const heatmap = page.getByRole('heading', { name: 'Element Heatmap' });
      await heatmap.waitFor();
      await page.waitForTimeout(1500);
      await heatmap.evaluate((el) => el.closest('.card')?.scrollIntoView({ block: 'start' }));
      // Skip the heatmap intro text so the pinned results table fits below
      await page.evaluate(() => window.scrollBy(0, 180));
      await page.waitForTimeout(500);
    },
  },
  {
    // Decay chain: Ra-224 (thorium series, 4n), depth 15, min branching 1%:
    // Ra-224 -> Rn-220 -> Po-216 -> Pb-212 -> Bi-212 -> {Po-212 | Tl-208}
    // -> Pb-208. Ra-224 is only in RadioNuclides, so this is the limited-data
    // card (the page enables the limited-data toggle for it); its decay chain
    // section needs the limited-data decay chain fix (PR #212).
    name: 'decay-chain-ra224-dark',
    dir: 'desktop',
    device: DESKTOP,
    theme: 'dark',
    lang: 'en',
    capture: async (page) => {
      await gotoReady(page, '/element-data?Z=88&A=224');
      const expand = page.getByRole('button', { name: 'Expand decay chain' });
      await expand.click();
      const section = page.locator('div.bg-purple-50', { has: page.locator('.react-transform-wrapper') }).filter({ visible: true });
      const sliders = section.locator('input[type="range"]');
      await setRange(sliders.nth(0), '15'); // max generations
      await setRange(sliders.nth(1), '1'); // min branching ratio %
      await page.waitForTimeout(2000); // max-h transition + diagram layout
      // Section just below the sticky nuclide tab bar, radiation legend below it
      await section.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -72));
      // Default zoom: the whole chain, including the branch, fits the canvas
      await page.mouse.move(0, 0);
      await page.waitForTimeout(800);
    },
  },
  {
    // Mobile: sidebar open plus the header language switcher expanded, showing
    // native language names (the list scrolls; the last entries are below the fold).
    name: 'sidebar-languages-dark',
    dir: 'mobile',
    device: MOBILE_TALL,
    theme: 'dark',
    lang: 'en',
    capture: async (page) => {
      await gotoReady(page, '/');
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByTestId('mobile-sidebar').waitFor();
      // The open sidebar's backdrop covers the header, so click the header's
      // language button programmatically (no mousedown -> dropdown stays open)
      await page
        .getByRole('button', { name: 'Change language' })
        .filter({ visible: true })
        .first()
        .evaluate((el) => (el as HTMLButtonElement).click());
      await page.getByText('Select Language').waitFor();
      await page.waitForTimeout(500);
    },
  },
  {
    // Transmutations: first documented claim (Iwamura, Cs-133 -> Pr-141) with
    // its candidate Parkhomov pathways found.
    name: 'transmutations-light',
    dir: 'mobile',
    device: MOBILE,
    theme: 'light',
    lang: 'en',
    capture: async (page) => {
      await gotoReady(page, '/transmutations');
      const button = page.locator('[data-testid^="find-pathways-"]').first();
      await button.click();
      const results = page.locator('[data-testid="transmutations-pathway-results"], [data-testid="transmutations-pathway-empty"]').first();
      await results.waitFor({ timeout: 60000 });
      await page.waitForTimeout(800);
      // Card top (claim + source) under the sticky mobile header, results below
      await button.evaluate((el) => el.closest('.card')?.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -72));
      await page.waitForTimeout(500);
    },
  },
  {
    // Japanese UI on the fusion query form (the Segre chart and heatmap
    // periodic tables below it overflow 390px).
    name: 'fusion-query-ja-light',
    dir: 'mobile',
    device: MOBILE,
    theme: 'light',
    lang: 'ja',
    capture: async (page) => {
      await gotoReady(page, '/fusion?e1=H,D,Li,B&e2=C,N,O,Al,Si,Ni');
      await page.getByRole('heading', { name: '元素ヒートマップ' }).waitFor();
      await page.waitForTimeout(1000);
    },
  },
];

async function main() {
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1]?.split(',') : null;
  const shots = only ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;

  for (const dir of ['desktop', 'mobile']) {
    fs.mkdirSync(path.join(SCREENSHOT_DIR, dir), { recursive: true });
  }

  console.log(`📸 Capturing ${shots.length} screenshot(s) from ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const shot of shots) {
      const context = await newContext(browser, shot);
      try {
        const page = await context.newPage();
        try {
          await shot.capture(page);
        } catch (error) {
          const debug = path.join(os.tmpdir(), `${shot.name}.failed.png`);
          await page.screenshot({ path: debug }).catch(() => {});
          console.error(`  ✗ ${shot.name} failed; page state saved to ${debug}`);
          throw error;
        }
        await save(page, shot);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('❌ Screenshot generation failed:', error);
  process.exit(1);
});
