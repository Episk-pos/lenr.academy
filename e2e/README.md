# End-to-End Testing with Playwright

This directory contains the E2E test suite for LENR Academy, providing comprehensive coverage of all application functionality.

## Overview

The test suite uses [Playwright](https://playwright.dev/) to test the application across multiple browsers (Chromium, Firefox, WebKit) and device viewports. Tests run automatically in CI for all pull requests and pushes to the main branch.

## Test Structure

```
e2e/
├── fixtures/
│   └── test-helpers.ts          # Reusable test utilities
├── tests/
│   ├── database.spec.ts         # Database loading, caching, updates
│   ├── navigation.spec.ts       # Routing and navigation
│   ├── fusion-query.spec.ts     # Fusion reaction queries
│   ├── fission-query.spec.ts    # Fission reaction queries
│   ├── twotwo-query.spec.ts     # Two-to-two reaction queries
│   ├── element-data.spec.ts     # Element data page and URL state
│   ├── preferences.spec.ts      # Theme, privacy, metered connection
│   └── accessibility.spec.ts    # WCAG compliance and keyboard navigation
└── README.md                     # This file
```

## Running Tests Locally

### Prerequisites

```bash
# Install dependencies (if not already done)
npm install

# Install Playwright browsers
npx playwright install
```

### Test Commands

```bash
# Run all tests headless
npm run test:e2e

# Run tests with interactive UI
npm run test:e2e:ui

# Run tests in debug mode (step through)
npm run test:e2e:debug

# Run only Chromium tests (fastest)
npm run test:e2e:chromium

# View last test report
npm run test:e2e:report
```

### Running Specific Tests

```bash
# Run a specific test file
npx playwright test e2e/tests/database.spec.ts

# Run tests matching a pattern
npx playwright test --grep "should load element from URL"

# Run only mobile tests
npx playwright test --project="Mobile Chrome"

# Run tests in headed mode (see browser)
npx playwright test --headed
```

## Test Coverage

### Database Tests (`database.spec.ts`)

- ✅ Database initialization from IndexedDB cache
- ✅ Download progress tracking for fresh installs
- ✅ Version checking and update detection
- ✅ Metered connection warning flow
- ✅ Consent persistence across sessions

### Navigation Tests (`navigation.spec.ts`)

- ✅ All 8 routes (Home, Fusion, Fission, TwoToTwo, ElementData, Tables, AllTables, Cascades)
- ✅ Sidebar navigation on desktop and mobile
- ✅ Browser back/forward navigation
- ✅ URL parameter persistence
- ✅ Mobile menu toggle

### Query Tests (`fusion-query.spec.ts`, `fission-query.spec.ts`, `twotwo-query.spec.ts`)

- ✅ Element selection from periodic tables
- ✅ Energy range filtering (MeV min/max)
- ✅ Neutrino type filtering
- ✅ Multi-element combinations
- ✅ Results display and pagination
- ✅ CSV export functionality
- ✅ URL parameter synchronization
- ✅ No results handling
- ✅ Performance with large datasets (two-to-two)

### Element Data Tests (`element-data.spec.ts`)

- ✅ Element selection and display
- ✅ URL state management (Z and A parameters)
- ✅ Isotope table rendering
- ✅ Element properties display
- ✅ Navigation between isotopes
- ✅ Invalid parameter handling
- ✅ Stable vs unstable isotope indication

### Preferences Tests (`preferences.spec.ts`)

- ✅ Theme switching (light/dark)
- ✅ Theme persistence in localStorage
- ✅ Privacy consent banner
- ✅ Analytics opt-in/opt-out
- ✅ Metered connection consent
- ✅ Preference persistence across sessions

### Accessibility Tests (`accessibility.spec.ts`)

- ✅ WCAG 2.1 AA compliance (axe-core)
- ✅ Keyboard navigation
- ✅ Focus management
- ✅ Screen reader compatibility
- ✅ Color contrast ratios
- ✅ ARIA landmarks and labels
- ✅ Form input labels
- ✅ Table structure semantics
- ✅ Dark mode accessibility

## CI/CD Integration

### Pull Request Checks (`.github/workflows/e2e-pr.yml`)

Runs on every PR to `main`:
- **Browser**: Chromium only (for speed)
- **Timeout**: 60 minutes
- **Artifacts**: Test report and screenshots (on failure)
- **Strategy**: Fast feedback for contributors

### Main Branch Tests (`.github/workflows/e2e-main.yml`)

Runs on pushes to `main`:
- **Browsers**: Chromium, Firefox, WebKit (matrix)
- **Timeout**: 90 minutes
- **Artifacts**: Per-browser reports and screenshots
- **Strategy**: Comprehensive cross-browser validation

## Writing New Tests

### Test Helpers

Use the provided test helpers from `fixtures/test-helpers.ts`:

```typescript
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  clearAllStorage,
  setTheme,
  getPeriodicTableElement,
  selectElements,
  navigateToPage
} from '../fixtures/test-helpers';

test('my test', async ({ page }) => {
  await acceptPrivacyConsent(page);
  await page.goto('/fusion');
  await acceptMeteredWarningIfPresent(page);
  await waitForDatabaseReady(page);

  // Your test code here
});
```

### Test Data Attributes

For reliable element selection, use `data-testid` attributes in components:

```tsx
// In component
<div data-testid="database-loading">Loading...</div>

// In test
const loadingCard = page.locator('[data-testid="database-loading"]');
```

### Best Practices

1. **Independent tests**: Each test should be self-contained and not rely on other tests
2. **Accept consent early**: Use `acceptPrivacyConsent(page)` in `beforeEach` to avoid banner interference
3. **Wait for database**: Always call `waitForDatabaseReady(page)` after navigation
4. **Handle modals**: Accept metered warnings with `acceptMeteredWarningIfPresent(page)`
5. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
6. **Avoid hard waits**: Use `waitForFunction` or element visibility instead of `waitForTimeout`
7. **Test mobile**: Add mobile-specific tests for responsive components

## Debugging Failed Tests

### Local Debugging

```bash
# Run with headed browser
npx playwright test --headed

# Open specific test in debug mode
npx playwright test database.spec.ts --debug

# Generate trace for failed tests
npx playwright test --trace on
```

### CI Debugging

1. Download artifacts from failed CI run
2. Extract `playwright-report/` or `playwright-screenshots/`
3. View HTML report: `npx playwright show-report path/to/playwright-report`

### Common Issues

#### Database timeout
- **Cause**: 207MB database download takes too long
- **Solution**: Tests allow up to 60 seconds; adjust timeout if needed

#### Metered warning not dismissing
- **Cause**: Modal might not be visible
- **Solution**: Check that `acceptMeteredWarningIfPresent` uses proper timeout

#### Flaky element selection
- **Cause**: Periodic table not fully rendered
- **Solution**: Add `waitForDatabaseReady` before interaction

#### Mobile tests failing
- **Cause**: Sidebar might need opening on mobile
- **Solution**: Use `navigateToPage` helper which handles mobile menu

## Performance Considerations

### Test Execution Time

- **Database loading**: ~30-60s on first run (download 207MB)
- **Cached database**: ~2-5s (from IndexedDB)
- **Query tests**: ~5-15s per test
- **Full suite**: ~10-15 minutes (all browsers)

### Optimizations

- PR checks run Chromium only for 3-5 minute feedback
- Database is cached across tests in same session
- Parallel execution enabled (up to 4 workers locally)
- CI uses single worker for stability

## Database Considerations

The application uses a 207MB SQLite database. In CI:

1. **First test**: Downloads database from `/public/parkhomov.db`
2. **Subsequent tests**: Load from IndexedDB cache
3. **Network**: Tests may be slower in CI due to download time

To speed up local development:
- Database is cached after first download
- Use `test:e2e:chromium` for faster single-browser testing
- Consider running specific test files during development

## Accessibility Testing

We use `@axe-core/playwright` for automated accessibility testing:

```typescript
import AxeBuilder from '@axe-core/playwright';

test('should not have a11y violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
```

All pages are tested for:
- WCAG 2.1 Level AA compliance
- Color contrast ratios
- Keyboard navigation
- Screen reader compatibility
- Focus management

## Continuous Improvement

### Adding New Tests

When adding new features:

1. Add corresponding E2E tests
2. Test happy path and error cases
3. Test mobile responsiveness
4. Add accessibility checks
5. Update this README if needed

### Updating Tests

When changing UI:

1. Update affected test selectors
2. Run full test suite locally
3. Verify CI passes on PR

### Test Maintenance

- Review flaky tests monthly
- Update dependencies quarterly
- Add new test patterns as needed
- Remove obsolete tests

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Support

For questions or issues:

1. Check this README
2. Review test examples in `e2e/tests/`
3. Consult Playwright docs
4. Ask in pull request comments
