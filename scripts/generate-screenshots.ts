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
 *   npm run screenshots -- --only cascades-dark   # capture a single shot
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
        'cascade-sankey-guide-seen': 'true',
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
    // Cascades: H-1 + Li-7 + Ni-58 fuel, 3 MeV thresholds, Max Nuclides 30.
    // ~1.3k reactions over 2 loops: a network that is rich but still legible
    // (the default fuel/limits produce thousands of overlapping edges).
    // Framed on the "Cascade Complete" summary card with the Network tab below.
    name: 'cascades-dark',
    dir: 'desktop',
    device: DESKTOP_ZOOMED,
    theme: 'dark',
    lang: 'en',
    capture: async (page) => {
      await gotoReady(page, '/cascades?fuel=H-1,Li-7,Ni-58&maxNuclides=30&maxLoops=10&minFusionMeV=3&minTwoToTwoMeV=3');
      await page.getByRole('button', { name: /run cascade simulation/i }).click();
      const complete = page.getByText('Cascade Complete', { exact: true });
      await complete.waitFor({ timeout: 300000 });
      await page.getByRole('button', { name: 'Network', exact: true }).click();
      await page.getByTitle('Zoom out').click();
      await page.waitForTimeout(6000); // let the D3 force layout settle
      await complete.evaluate((el) => el.closest('.card, div')?.scrollIntoView({ block: 'start' }));
      await page.mouse.wheel(0, -48);
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
    // Decay chain: Th-230 (ionium, U-238 series daughter), depth 15, min
    // branching 1%: 10 generations Th-230 -> Ra-226 -> Rn-222 -> ... -> Pb-206
    // with the Bi-210 -> {Po-210 | Tl-206} branch. Ra-224 / Pb-212 (thorium
    // series) are only in RadioNuclides, so they get the limited-data card,
    // which has no decay chain section.
    name: 'decay-chain-th230-dark',
    dir: 'desktop',
    device: DESKTOP,
    theme: 'dark',
    lang: 'en',
    capture: async (page) => {
      await gotoReady(page, '/element-data?Z=90&A=230');
      const expand = page.getByRole('button', { name: 'Expand decay chain' });
      await expand.click();
      const section = page.locator('div.bg-purple-50', { has: page.locator('.react-transform-wrapper') }).filter({ visible: true });
      const sliders = section.locator('input[type="range"]');
      await setRange(sliders.nth(0), '15'); // max generations
      await setRange(sliders.nth(1), '1'); // min branching ratio %
      await page.waitForTimeout(2000); // max-h transition + diagram layout
      await section.evaluate((el) => el.scrollIntoView({ block: 'end' }));
      await page.evaluate(() => window.scrollBy(0, 16));
      // Zoom in one step and pan left until the tail (Bi-210 branch -> Pb-206)
      // hits the right bound; the clamp makes the final position repeatable
      const zoomIn = section.getByRole('button', { name: 'Zoom in', exact: true });
      await zoomIn.click();
      await page.waitForTimeout(400);
      const canvas = section.locator('.react-transform-wrapper');
      const box = (await canvas.boundingBox())!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height * 0.12; // empty canvas above the chain (a drag ending on a node navigates)
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 400, cy, { steps: 20 });
      await page.waitForTimeout(400); // settle so release adds no pan inertia
      await page.mouse.up();
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
    // Japanese UI on the fusion query form. The Segre chart and heatmap
    // periodic tables overflow 390px, and segreChart.* is not yet translated.
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
