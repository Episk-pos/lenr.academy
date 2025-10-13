import { chromium } from '@playwright/test';

async function testMobileTabs() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const page = await context.newPage();

  console.log('Navigating to element-data page...');
  await page.goto('http://localhost:5173/element-data');

  // Accept privacy consent if present
  const consentButton = page.getByRole('button', { name: /Accept/i });
  if (await consentButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await consentButton.click();
  }

  // Wait for database to load
  console.log('Waiting for database...');
  await page.waitForTimeout(3000);

  // Take screenshot of the tabs
  console.log('Taking screenshot of tabs...');
  await page.screenshot({
    path: 'test-results/mobile-tabs-before-select.png',
    fullPage: false
  });

  // Select Carbon to show tabs with counts
  console.log('Selecting Carbon element...');
  const carbon = page.getByRole('button', { name: '6 C' });
  await carbon.click();
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: 'test-results/mobile-tabs-with-element.png',
    fullPage: false
  });

  console.log('Screenshots saved to test-results/');
  await browser.close();
}

testMobileTabs().catch(console.error);
