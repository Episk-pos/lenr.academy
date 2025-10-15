import { defineConfig, devices } from '@playwright/test';

const devServerPort = process.env.PLAYWRIGHT_PORT ?? '5173';
const devServerHost = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${devServerHost}:${devServerPort}`;
const devServerCommand =
  process.env.PLAYWRIGHT_DEV_COMMAND ?? `npm run dev -- --host ${devServerHost} --port ${devServerPort}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e/tests',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry flaky tests - 2 retries on CI, 1 retry locally */
  retries: process.env.CI ? 2 : 1,

  /* Use 2 workers on CI to utilize both CPU cores on GitHub-hosted runners */
  workers: process.env.CI ? 2 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'html' : 'list',

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Global test timeout - 60 seconds per test */
  timeout: 60000,

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            // Auto-allow persistent storage requests
            'dom.storage.next_gen': true,
            'dom.storageManager.enabled': true,
            'dom.storageManager.prompt.testing': false,
            'dom.storageManager.prompt.testing.allow': true,
            'permissions.default.persistent-storage': 1, // 1 = allow, 2 = deny
          },
        },
      },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: devServerCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for dev server to start
  },
});
