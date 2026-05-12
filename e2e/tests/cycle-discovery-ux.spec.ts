import { test, expect, Page } from '@playwright/test'
import {
  acceptPrivacyConsent,
  waitForDatabaseReady,
  navigateToPage,
} from '../fixtures/test-helpers'

// ---------------------------------------------------------------------------
// Increase timeout for this spec — cycle discovery can take ~30 s per run,
// and the 161 MB database may need to be downloaded on first load.
// ---------------------------------------------------------------------------
const SPEC_TIMEOUT_MS = 180000 // 3 minutes per test

// ---------------------------------------------------------------------------
// File-local helper: ensure db is loaded, navigate to /cycles, run discovery
// with default params, and open the first cycle detail view.
//
// Strategy:
//  1. Go to /fusion first — this page shows DatabaseLoadingCard, giving us
//     a reliable signal that the 161 MB db has finished loading.
//  2. Use navigateToPage('Cycle Discovery') which handles mobile sidebar
//     (hamburger menu) automatically.
//  3. Click "Discover Cycles" and wait up to 90 s for results.
//  4. Open the first cycle's detail view.
// ---------------------------------------------------------------------------

async function runDiscoveryAndOpenFirst(page: Page) {
  await page.goto('/fusion')
  await waitForDatabaseReady(page, 120000) // up to 2 min on first cold load

  // Use navigateToPage so the mobile sidebar is opened when needed.
  await navigateToPage(page, 'Cycle Discovery')
  await expect(page).toHaveURL('/cycles')

  const discoverBtn = page.getByRole('button', { name: /discover cycles/i })
  await discoverBtn.waitFor({ state: 'visible', timeout: 10000 })
  await discoverBtn.click()

  // Cycle search can take 30–90 s with default params.
  await expect(page.getByText('Discovery Complete')).toBeVisible({ timeout: 90000 })

  // Click the View (Eye icon) button; title is "View cycle details" from i18n.
  const viewBtn = page.locator('button[title="View cycle details"]').first()
  await viewBtn.waitFor({ state: 'visible', timeout: 10000 })
  await viewBtn.click()

  // Wait for the cycle detail hero panel to render.
  await expect(page.getByText('Net Cycle Transformation')).toBeVisible({ timeout: 10000 })
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Catalytic Cycle Discovery UX', () => {
  // Raise the per-test timeout for this suite.
  test.describe.configure({ timeout: SPEC_TIMEOUT_MS })

  // Privacy consent must be set BEFORE any page.goto so addInitScript fires.
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page)
  })

  // -------------------------------------------------------------------------
  // Test 1: Page header and info banner (P5 + P6)
  // Static content only — no discovery run needed.
  // -------------------------------------------------------------------------

  test('page header uses catalytic cycle terminology with CNO example', async ({ page }) => {
    await page.goto('/')
    // navigateToPage opens the sidebar hamburger on mobile automatically.
    await navigateToPage(page, 'Cycle Discovery')
    await expect(page).toHaveURL('/cycles')

    // Two h1s on page (sidebar "Nanosoft Suite" + page title) — match by name.
    await expect(
      page.getByRole('heading', { name: 'Catalytic Cycle Discovery' })
    ).toBeVisible()

    // Info banner contains "How it works:" bold prefix plus CNO example text.
    const infoBanner = page.locator('.card').filter({
      has: page.getByText(/how it works/i),
    }).first()
    await expect(infoBanner).toBeVisible()
    await expect(infoBanner).toContainText('CNO cycle')
    await expect(infoBanner).toContainText('C-12')

    // Empty-state section visible before any search.
    await expect(page.getByText('How Catalytic Cycles Work')).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 2: Results table uses catalytic terminology and shows cycle-preview SVG
  // Strategy: use runDiscoveryAndOpenFirst (guarantees cycles exist), then go
  // back to the results table via window.history.back().
  // -------------------------------------------------------------------------

  test('results table uses catalytic terminology and shows cycle preview indicator', async ({ page }) => {
    // Run discovery and open detail view (guarantees results exist).
    await runDiscoveryAndOpenFirst(page)

    // Go back to the results table — the detail view used pushState to get here.
    await page.evaluate(() => window.history.back())

    // Wait for the results banner to confirm we're back on the table view.
    await expect(page.getByText('Discovery Complete')).toBeVisible({ timeout: 10000 })

    // Column header "Steps" must be visible.
    // Use locator().filter() since th also contains sort-icon SVGs.
    await expect(
      page.locator('th').filter({ hasText: /steps/i })
    ).toBeVisible()

    // "Depth" standalone header must NOT exist (renamed to "Steps").
    await expect(
      page.locator('th').filter({ hasText: /^depth$/i })
    ).not.toBeVisible()

    // "Catalyst Recovery" column header visible (renamed from "Feedback").
    await expect(
      page.locator('th').filter({ hasText: /catalyst recovery/i })
    ).toBeVisible()

    // No column with text exactly "Feedback".
    await expect(
      page.locator('th').filter({ hasText: /^feedback$/i })
    ).not.toBeVisible()

    // At least one data row in the table body.
    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible()

    // First row contains the inline CyclePreviewIcon SVG element.
    const firstRowSvg = rows.first().locator('svg').first()
    await expect(firstRowSvg).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 3: Net Cycle Transformation hero shows fuel-in equals fuel-out (P1)
  // This is the load-bearing UX assertion for the whole feature.
  // -------------------------------------------------------------------------

  test('net cycle transformation hero shows fuel in and catalyst recovered', async ({ page }) => {
    await runDiscoveryAndOpenFirst(page)

    // Hero panel heading.
    await expect(page.getByText('Net Cycle Transformation')).toBeVisible()

    // --- FUEL IN section: must have at least one nuclide chip ---
    const fuelInLabel = page.locator('span').filter({ hasText: /^FUEL IN$/i }).first()
    await expect(fuelInLabel).toBeVisible()
    const fuelInSection = fuelInLabel.locator('..')
    const fuelInChips = fuelInSection.locator('span').filter({ has: page.locator('sup') })
    expect(await fuelInChips.count()).toBeGreaterThan(0)

    // --- CATALYST RECOVERED section (replaces the old "FUEL OUT (recovered)"
    // label whenever the cycle has true catalysts, which the algorithm
    // guarantees for any emitted cycle). Must have at least one chip. ---
    const catalystLabel = page.locator('span').filter({ hasText: /^CATALYST RECOVERED$/i }).first()
    await expect(catalystLabel).toBeVisible()
    const catalystSection = catalystLabel.locator('..')
    const catalystChips = catalystSection.locator('span').filter({ has: page.locator('sup') })
    expect(await catalystChips.count()).toBeGreaterThan(0)

    // NET ENERGY section shows a numeric MeV value (e.g. "+12.34 MeV").
    const netEnergyLabel = page.locator('span').filter({ hasText: /^NET ENERGY$/i }).first()
    await expect(netEnergyLabel).toBeVisible()
    const netEnergySection = netEnergyLabel.locator('..')
    expect(await netEnergySection.textContent()).toMatch(/[\d.]+\s*MeV/)

    // BYPRODUCTS section present (may show "(none)" — both acceptable).
    const byproductsLabel = page.locator('span').filter({ hasText: /^BYPRODUCTS$/i }).first()
    await expect(byproductsLabel).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 4: Catalytic Cycle Diagram has catalyst label at centre (P2)
  // -------------------------------------------------------------------------

  test('catalytic cycle diagram has catalyst at centre', async ({ page }) => {
    await runDiscoveryAndOpenFirst(page)

    // "Catalytic Cycle Diagram" heading.
    await expect(page.getByText('Catalytic Cycle Diagram')).toBeVisible()

    // SVG caption: i18n value is "Catalyst (recycled)". CSS text-transform:uppercase
    // is applied visually; textContent() returns the original mixed-case string.
    await expect(page.getByText(/catalyst.*recycled/i)).toBeVisible()

    // Diagram SVG is inside the card section containing the heading.
    const diagramSection = page.locator('div.card').filter({
      has: page.getByText('Catalytic Cycle Diagram'),
    })
    await expect(diagramSection).toBeVisible()

    const diagramSvg = diagramSection.locator('svg').first()
    await expect(diagramSvg).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 5: Reaction steps end with cycle-closure footer (P3)
  // -------------------------------------------------------------------------

  test('reaction steps end with cycle-closure footer', async ({ page }) => {
    await runDiscoveryAndOpenFirst(page)

    // Scroll to bottom to bring the closure footer into viewport.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    await expect(
      page.getByText('Cycle closes — catalyst regenerated')
    ).toBeVisible({ timeout: 5000 })
  })

  // -------------------------------------------------------------------------
  // Test 6: Metric card uses "Catalyst Recovery", not "Feedback Ratio" (P5)
  // -------------------------------------------------------------------------

  test('metric card uses Catalyst Recovery, not Feedback Ratio', async ({ page }) => {
    await runDiscoveryAndOpenFirst(page)

    // MetricCard renders its label with uppercase tracking-wide CSS.
    // The i18n key metricFeedback → "Catalyst Recovery".
    await expect(page.getByText(/catalyst recovery/i)).toBeVisible()

    // "Feedback Ratio" must NOT appear anywhere on the page.
    await expect(page.getByText(/feedback ratio/i)).not.toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 7: Row click opens cycle detail (alternative to eyeball button)
  // Asserts the entire <tr> is clickable as a redundant affordance.
  // -------------------------------------------------------------------------

  test('row click opens cycle detail (alternative to eyeball)', async ({ page }) => {
    await page.goto('/fusion')
    await waitForDatabaseReady(page, 120000)

    await navigateToPage(page, 'Cycle Discovery')
    await expect(page).toHaveURL('/cycles')

    const discoverBtn = page.getByRole('button', { name: /discover cycles/i })
    await discoverBtn.waitFor({ state: 'visible', timeout: 10000 })
    await discoverBtn.click()

    await expect(page.getByText('Discovery Complete')).toBeVisible({ timeout: 90000 })

    // Click the first row's first data cell (NOT a button) to confirm
    // the row-level click handler — not just the eyeball — opens detail.
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.waitFor({ state: 'visible', timeout: 10000 })
    await firstRow.locator('td').first().click()

    await expect(
      page.getByRole('heading', { name: /Net Cycle Transformation/i })
    ).toBeVisible({ timeout: 10000 })
  })
})
