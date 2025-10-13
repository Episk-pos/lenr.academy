import { chromium } from '@playwright/test';

async function testMobileTabs() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to element-data page...');
    await page.goto('http://localhost:5173/element-data', { waitUntil: 'networkidle', timeout: 60000 });

    console.log('Waiting for page to load...');
    await page.waitForTimeout(2000);

    // Take screenshot before scrolling
    console.log('Taking screenshot before scroll...');
    await page.screenshot({
      path: 'test-results/mobile-tabs-1-before-scroll.png',
      fullPage: false
    });

    // Scroll down to make tabs stick
    console.log('Scrolling down...');
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(500);

    // Take screenshot after tabs stick
    console.log('Taking screenshot after scroll (tabs should be stuck with hamburger)...');
    await page.screenshot({
      path: 'test-results/mobile-tabs-2-stuck.png',
      fullPage: false
    });

    // Select Carbon to show tabs with counts
    console.log('Selecting Carbon element...');
    const carbon = page.getByRole('button', { name: '6 C', exact: true });
    await carbon.scrollIntoViewIfNeeded();
    await carbon.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'test-results/mobile-tabs-3-with-element.png',
      fullPage: false
    });

    // Scroll to top
    console.log('Scrolling to top...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'test-results/mobile-tabs-4-top-again.png',
      fullPage: false
    });

    console.log('Screenshots saved to test-results/');
    console.log('Press Ctrl+C to close the browser');

    // Keep browser open for manual inspection
    await page.waitForTimeout(300000); // 5 minutes
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

testMobileTabs().catch(console.error);
