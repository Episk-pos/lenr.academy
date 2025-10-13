import { chromium } from '@playwright/test';

async function quickCheck() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const page = await context.newPage();

  try {
    // Set a shorter timeout
    page.setDefaultTimeout(10000);

    console.log('Loading page...');
    await page.goto('http://localhost:5173/element-data', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    // Just wait for the heading to appear
    await page.waitForSelector('h1', { timeout: 5000 });

    console.log('Taking screenshot...');
    await page.screenshot({
      path: 'test-results/mobile-tabs-quick.png',
      fullPage: true
    });

    console.log('Screenshot saved!');
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({
      path: 'test-results/mobile-tabs-error.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

quickCheck().catch(console.error);
