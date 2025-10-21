import { test, expect } from '@playwright/test'
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent
} from '../fixtures/test-helpers'

// LocalStorage key for query states
const STORAGE_KEY = 'lenr-query-states'

// Helper to navigate to query page and handle metered warning
async function navigateToQueryPage(page: any, path: string) {
  await page.goto(path)
  await waitForDatabaseReady(page)

  // Handle metered connection warning if present
  const downloadButton = page.getByRole('button', { name: 'Download Anyway' })
  if (await downloadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await downloadButton.click()
    await page.waitForTimeout(2000) // Wait for database to load
  }

  await page.waitForSelector('text=Showing', { timeout: 30000 })
}

test.describe('Query State Persistence', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up consent before navigating
    await context.addInitScript(() => {
      localStorage.setItem('lenr-analytics-consent', 'accepted')
      localStorage.setItem('lenr-metered-download-consent', 'true')
      localStorage.setItem('lenr-changelog-disable-auto', 'true')
    })

    await page.goto('/')
    await waitForDatabaseReady(page)
    await acceptMeteredWarningIfPresent(page)

    // Clear query state storage but keep consents
    await page.evaluate(() => {
      const meteredConsent = localStorage.getItem('lenr-metered-download-consent')
      const privacyConsent = localStorage.getItem('lenr-analytics-consent')
      const changelogDisable = localStorage.getItem('lenr-changelog-disable-auto')

      localStorage.clear()

      // Restore consents
      if (meteredConsent) localStorage.setItem('lenr-metered-download-consent', meteredConsent)
      if (privacyConsent) localStorage.setItem('lenr-analytics-consent', privacyConsent)
      if (changelogDisable) localStorage.setItem('lenr-changelog-disable-auto', changelogDisable)
    })
  })

  test('should persist FusionQuery state across navigation', async ({ page }) => {
    // Navigate to fusion page
    await navigateToQueryPage(page, '/fusion')

    // Select elements for input
    await page.getByRole('button', { name: 'Select Input Element 1 (E1)' }).click()
    await page.getByRole('button', { name: 'H', exact: true }).first().click()
    await page.getByRole('button', { name: 'Li', exact: true }).first().click()
    await page.keyboard.press('Escape')

    // Select elements for output
    await page.getByRole('button', { name: 'Select Output Element (E)' }).click()
    await page.getByRole('button', { name: 'C', exact: true }).nth(2).click()
    await page.keyboard.press('Escape')

    // Set energy filter
    await page.getByRole('button', { name: 'Expand filters' }).click()
    await page.getByPlaceholder('Min').fill('2')
    await page.getByPlaceholder('Max').fill('10')

    // Wait for results to update
    await page.waitForTimeout(1000)

    // Store the current query state
    const fusionState = await page.evaluate(() => {
      const stored = localStorage.getItem('lenr-query-states')
      return stored ? JSON.parse(stored) : null
    })

    expect(fusionState).toBeTruthy()
    expect(fusionState.fusion).toBeTruthy()
    expect(fusionState.fusion.selectedElement1).toContain('H')
    expect(fusionState.fusion.selectedElement1).toContain('Li')
    expect(fusionState.fusion.selectedOutputElement).toContain('C')
    expect(fusionState.fusion.minMeV).toBe(2)
    expect(fusionState.fusion.maxMeV).toBe(10)

    // Navigate away to another page
    await page.goto('/fission')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Navigate back to fusion page (without URL params)
    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Check that the state was restored
    await expect(page.getByText('H, Li').first()).toBeVisible()
    await expect(page.getByText('C').nth(1)).toBeVisible()

    // Check filters are restored by expanding them
    await page.getByRole('button', { name: 'Expand filters' }).click()
    const minValue = await page.getByPlaceholder('Min').inputValue()
    const maxValue = await page.getByPlaceholder('Max').inputValue()
    expect(minValue).toBe('2')
    expect(maxValue).toBe('10')
  })

  test('should persist FissionQuery state across navigation', async ({ page }) => {
    // Navigate to fission page
    await page.goto('/fission')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Select input element
    await page.getByRole('button', { name: 'Select Input Element (E)' }).click()
    await page.getByRole('button', { name: 'U', exact: true }).first().click()
    await page.keyboard.press('Escape')

    // Select output elements
    await page.getByRole('button', { name: 'Select Output Element 1 (E1)' }).click()
    await page.getByRole('button', { name: 'Ba', exact: true }).nth(1).click()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Select Output Element 2 (E2)' }).click()
    await page.getByRole('button', { name: 'Kr', exact: true }).nth(2).click()
    await page.keyboard.press('Escape')

    // Toggle boson/fermion view
    await page.getByRole('button', { name: /Show B\/F Types/ }).click()

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Store the current query state
    const fissionState = await page.evaluate(() => {
      const stored = localStorage.getItem('lenr-query-states')
      return stored ? JSON.parse(stored) : null
    })

    expect(fissionState).toBeTruthy()
    expect(fissionState.fission).toBeTruthy()
    expect(fissionState.fission.selectedElements).toContain('U')
    expect(fissionState.fission.selectedOutputElement1).toContain('Ba')
    expect(fissionState.fission.selectedOutputElement2).toContain('Kr')
    expect(fissionState.fission.showBosonFermion).toBe(true)

    // Navigate away to another page
    await page.goto('/twotwo')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Navigate back to fission page (without URL params)
    await page.goto('/fission')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Check that the state was restored
    await expect(page.getByText('U').first()).toBeVisible()
    await expect(page.getByText('Ba').nth(1)).toBeVisible()
    await expect(page.getByText('Kr').nth(2)).toBeVisible()

    // Check boson/fermion columns are visible
    await expect(page.getByText('Nuclear').first()).toBeVisible()
    await expect(page.getByText('Atomic').first()).toBeVisible()
  })

  test('should persist TwoToTwoQuery state across navigation', async ({ page }) => {
    // Navigate to twotwo page
    await page.goto('/twotwo')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Select input elements
    await page.getByRole('button', { name: 'Select Input Element 1 (E1)' }).click()
    await page.getByRole('button', { name: 'H', exact: true }).first().click()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Select Input Element 2 (E2)' }).click()
    await page.getByRole('button', { name: 'Ni', exact: true }).nth(1).click()
    await page.keyboard.press('Escape')

    // Select output elements
    await page.getByRole('button', { name: 'Select Output Element 3 (E3)' }).click()
    await page.getByRole('button', { name: 'Cu', exact: true }).nth(2).click()
    await page.keyboard.press('Escape')

    // Set result limit
    await page.getByRole('button', { name: 'Expand filters' }).click()
    const limitInput = page.locator('input[type="number"]').filter({ hasText: '' }).last()
    await limitInput.fill('50')

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Store the current query state
    const twoToTwoState = await page.evaluate(() => {
      const stored = localStorage.getItem('lenr-query-states')
      return stored ? JSON.parse(stored) : null
    })

    expect(twoToTwoState).toBeTruthy()
    expect(twoToTwoState.twotwo).toBeTruthy()
    expect(twoToTwoState.twotwo.selectedElement1).toContain('H')
    expect(twoToTwoState.twotwo.selectedElement2).toContain('Ni')
    expect(twoToTwoState.twotwo.selectedOutputElement3).toContain('Cu')
    expect(twoToTwoState.twotwo.limit).toBe(50)

    // Navigate away to another page
    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Navigate back to twotwo page (without URL params)
    await page.goto('/twotwo')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Check that the state was restored
    await expect(page.getByText('H').first()).toBeVisible()
    await expect(page.getByText('Ni').nth(1)).toBeVisible()
    await expect(page.getByText('Cu').nth(2)).toBeVisible()

    // Check limit was restored by expanding filters
    await page.getByRole('button', { name: 'Expand filters' }).click()
    const limitValue = await page.locator('input[type="number"]').filter({ hasText: '' }).last().inputValue()
    expect(limitValue).toBe('50')
  })

  test('should maintain separate state for each query page', async ({ page }) => {
    // Set up fusion page state
    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    await page.getByRole('button', { name: 'Select Input Element 1 (E1)' }).click()
    await page.getByRole('button', { name: 'Li', exact: true }).first().click()
    await page.keyboard.press('Escape')

    // Set up fission page state
    await page.goto('/fission')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    await page.getByRole('button', { name: 'Select Input Element (E)' }).click()
    await page.getByRole('button', { name: 'U', exact: true }).first().click()
    await page.keyboard.press('Escape')

    // Set up twotwo page state
    await page.goto('/twotwo')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    await page.getByRole('button', { name: 'Select Input Element 2 (E2)' }).click()
    await page.getByRole('button', { name: 'Ni', exact: true }).nth(1).click()
    await page.keyboard.press('Escape')

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Check all states are saved independently
    const allStates = await page.evaluate(() => {
      const stored = localStorage.getItem('lenr-query-states')
      return stored ? JSON.parse(stored) : null
    })

    expect(allStates).toBeTruthy()
    expect(allStates.fusion?.selectedElement1).toContain('Li')
    expect(allStates.fission?.selectedElements).toContain('U')
    expect(allStates.twotwo?.selectedElement2).toContain('Ni')

    // Navigate back to each page and verify state is maintained
    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await expect(page.getByText('Li').first()).toBeVisible()

    await page.goto('/fission')
    await waitForDatabaseReady(page)
    await expect(page.getByText('U').first()).toBeVisible()

    await page.goto('/twotwo')
    await waitForDatabaseReady(page)
    await expect(page.getByText('Ni').nth(1)).toBeVisible()
  })

  test('should prioritize URL parameters over saved state', async ({ page }) => {
    // First, set up some saved state
    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    await page.getByRole('button', { name: 'Select Input Element 1 (E1)' }).click()
    await page.getByRole('button', { name: 'Li', exact: true }).first().click()
    await page.keyboard.press('Escape')

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Navigate away then back with URL parameters
    await page.goto('/fission')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Navigate back with different elements via URL params
    await page.goto('/fusion?e1=H&e2=He')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Check that URL parameters took precedence
    await expect(page.getByText('H').first()).toBeVisible()
    await expect(page.getByText('He').nth(1)).toBeVisible()
    // Li should not be selected
    const liSelected = await page.locator('text=Li').first().isVisible()
    if (liSelected) {
      // Check that Li is not in the selected elements display
      const selectedE1Text = await page.locator('[aria-label*="Input Element 1"]').textContent()
      expect(selectedE1Text).not.toContain('Li')
    }
  })

  test('should persist visualization state (pinned elements/nuclides)', async ({ page }) => {
    // Navigate to fusion page
    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Select some elements to get results with nuclides
    await page.getByRole('button', { name: 'Select Input Element 1 (E1)' }).click()
    await page.getByRole('button', { name: 'H', exact: true }).first().click()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Select Input Element 2 (E2)' }).click()
    await page.getByRole('button', { name: 'Li', exact: true }).nth(1).click()
    await page.keyboard.press('Escape')

    // Wait for results
    await page.waitForTimeout(1000)

    // Pin an element in the heatmap
    const carbonElement = page.locator('[data-element="C"]').first()
    if (await carbonElement.count() > 0) {
      await carbonElement.click()
      // Click again to pin it
      await carbonElement.click()
    }

    // Also collapse the heatmap
    await page.getByRole('button', { name: 'Collapse periodic table' }).click()

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Check state includes visualization settings
    const fusionState = await page.evaluate(() => {
      const stored = localStorage.getItem('lenr-query-states')
      return stored ? JSON.parse(stored) : null
    })

    expect(fusionState?.fusion?.visualization).toBeTruthy()
    expect(fusionState.fusion.visualization.showHeatmap).toBe(false)

    // Navigate away and back
    await page.goto('/fission')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Check heatmap is still collapsed
    const heatmapButton = page.getByRole('button', { name: 'Expand periodic table' })
    await expect(heatmapButton).toBeVisible()
  })

  test('should clear state when using Reset Filters button', async ({ page }) => {
    // Navigate to fusion page and set up state
    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Select elements
    await page.getByRole('button', { name: 'Select Input Element 1 (E1)' }).click()
    await page.getByRole('button', { name: 'Li', exact: true }).first().click()
    await page.keyboard.press('Escape')

    // Set energy filter
    await page.getByRole('button', { name: 'Expand filters' }).click()
    await page.getByPlaceholder('Min').fill('5')

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Click Reset Filters
    await page.getByRole('button', { name: 'Reset Filters' }).click()

    // Wait for state update
    await page.waitForTimeout(1000)

    // Check state was cleared
    const fusionState = await page.evaluate(() => {
      const stored = localStorage.getItem('lenr-query-states')
      return stored ? JSON.parse(stored) : null
    })

    // The state should still exist but with reset values
    expect(fusionState?.fusion).toBeTruthy()
    expect(fusionState.fusion.selectedElement1).toEqual([])
    expect(fusionState.fusion.minMeV).toBeUndefined()
  })

  test('should handle browser back/forward navigation correctly', async ({ page }) => {
    // Navigate to fusion with URL params
    await page.goto('/fusion?e1=H&e2=Li')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Navigate to fission with different params
    await page.goto('/fission?e=U')
    await waitForDatabaseReady(page)
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Use browser back button
    await page.goBack()
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Should be on fusion page with H and Li selected
    await expect(page.url()).toContain('/fusion')
    await expect(page.getByText('H').first()).toBeVisible()
    await expect(page.getByText('Li').nth(1)).toBeVisible()

    // Use browser forward button
    await page.goForward()
    await page.waitForSelector('text=Showing', { timeout: 30000 })

    // Should be on fission page with U selected
    await expect(page.url()).toContain('/fission')
    await expect(page.getByText('U').first()).toBeVisible()
  })
})
