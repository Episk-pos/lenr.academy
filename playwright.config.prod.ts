import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for PRODUCTION E2E tests.
 *
 * Used when testing against a production build served via `npm run preview` (port 4173).
 * Enables testing of service workers, PWA features, and other production-only behavior.
 *
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
    baseURL: 'http://localhost:4173',

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

  /* Run your local preview server before starting the tests */
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for preview server to start
  },
});
