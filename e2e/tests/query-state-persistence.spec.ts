import { test, expect } from '@playwright/test'
import {
  waitForDatabaseReady,
  acceptMeteredWarningIfPresent,
  acceptPrivacyConsent,
  waitForReactionResults
} from '../fixtures/test-helpers'

// LocalStorage key prefix for query states (actual key includes tab ID)
const STORAGE_KEY_PREFIX = 'lenr-query-states'

// Helper function to find and parse tab-specific query state from localStorage
async function getQueryStateFromStorage(page: any) {
  return await page.evaluate((prefix: string) => {
    // Find the storage key that starts with the prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const stored = localStorage.getItem(key)
        return stored ? JSON.parse(stored) : null
      }
    }
    return null
  }, STORAGE_KEY_PREFIX)
}

test.describe('Query State Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page)
    await page.goto('/fusion')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
  })

  test('should persist FusionQuery state across navigation', async ({ page }) => {

    // Select elements for input using working patterns
    const element1Button = page.getByRole('button', { name: /Any/i }).first()
    await element1Button.scrollIntoViewIfNeeded()
    await element1Button.waitFor({ state: 'visible', timeout: 5000 })
    await element1Button.click({ force: true })
    
    // Wait for periodic table selector to open
    await page.waitForTimeout(1000)
    
    const hydrogenE1 = page.getByRole('button', { name: /^1\s+H$/i }).first()
    await hydrogenE1.waitFor({ state: 'visible', timeout: 5000 })
    await hydrogenE1.click()
    const lithiumE1 = page.getByRole('button', { name: /^3\s+Li$/i }).first()
    await lithiumE1.waitFor({ state: 'visible', timeout: 5000 })
    await lithiumE1.click()
    await page.keyboard.press('Escape')
    
    // Wait for periodic table selector to fully close
    await page.waitForTimeout(500)

    // Select elements for output - target the Output Element button specifically
    const outputElementButton = page.getByRole('button', { name: /Any/i }).nth(1)
    await outputElementButton.scrollIntoViewIfNeeded()
    await outputElementButton.waitFor({ state: 'visible', timeout: 5000 })
    await outputElementButton.click({ force: true })
    const berylliumOutput = page.getByRole('button', { name: /^4\s+Be$/i }).first()
    await berylliumOutput.waitFor({ state: 'visible', timeout: 5000 })
    await berylliumOutput.click()
    await page.keyboard.press('Escape')

    // Set energy filter
    await page.getByRole('button', { name: 'Expand filters' }).click()
    await page.getByPlaceholder('Min').fill('2')
    await page.getByPlaceholder('Max').fill('10')

    // Wait for results to update
    await waitForReactionResults(page, 'fusion')

    // Store the current query state
    const fusionState = await getQueryStateFromStorage(page)

    expect(fusionState).toBeTruthy()
    expect(fusionState.fusion).toBeTruthy()
    expect(fusionState.fusion.selectedElement1).toContain('H')
    expect(fusionState.fusion.selectedElement1).toContain('Li')
    expect(fusionState.fusion.selectedOutputElement).toContain('Be')
    expect(fusionState.fusion.minMeV).toBe(2)
    expect(fusionState.fusion.maxMeV).toBe(10)

    // Navigate away to another page
    await page.goto('/fission')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fission')

    // Navigate back to fusion page (without URL params)
    await page.goto('/fusion')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    // Check that the state was restored
    await expect(page.getByRole('button', { name: /2 selected/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /1 selected.*Be/i })).toBeVisible()

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
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fission')

    // Select input element using data-testid
    const inputElementButton = page.getByTestId('fission-input-element-selector')
    await inputElementButton.click({ force: true })
    const strontiumInput = page.getByRole('button', { name: /^38\s+Sr$/i }).first()
    await strontiumInput.waitFor({ state: 'visible', timeout: 5000 })
    await strontiumInput.click()
    await page.keyboard.press('Escape')
    
    // Scroll back to top after element selection
    await page.evaluate(() => window.scrollTo(0, 0))

    // Select output element 1 using data-testid
    const outputElement1Button = page.getByTestId('fission-output-element-1-selector')
    await outputElement1Button.click({ force: true })
    const siliconOutput1 = page.getByRole('button', { name: /^14\s+Si$/i }).first()
    await siliconOutput1.waitFor({ state: 'visible', timeout: 5000 })
    await siliconOutput1.click()
    await page.keyboard.press('Escape')
    
    // Wait for state to save after first output selection
    await page.waitForTimeout(500)
    
    // Scroll back to top so the next element selector is visible
    await page.evaluate(() => window.scrollTo(0, 0))

    // Select output element 2 using data-testid
    const outputElement2Button = page.getByTestId('fission-output-element-2-selector')
    await outputElement2Button.scrollIntoViewIfNeeded()
    await outputElement2Button.click({ force: true })
    
    // Wait for periodic table to open
    await page.waitForTimeout(1000)
    
    // Scroll the periodic table dropdown to find Chromium (element 24)
    await page.evaluate(() => {
      const dropdown = document.querySelector('[data-testid="periodic-table-dropdown"]');
      if (dropdown) {
        dropdown.scrollTop = dropdown.scrollHeight;
      }
    })
    
    const chromiumOutput2 = page.getByRole('button', { name: /^24\s+Cr$/i }).first()
    await chromiumOutput2.waitFor({ state: 'visible', timeout: 5000 })
    await chromiumOutput2.scrollIntoViewIfNeeded()
    await chromiumOutput2.click()
    await page.keyboard.press('Escape')
    
    // Scroll back to top after element selection
    await page.evaluate(() => window.scrollTo(0, 0))

    // Toggle boson/fermion view (only if not already showing)
    const bfButton = page.getByRole('button', { name: /(Show|Hide) B\/F Types/ })
    await bfButton.scrollIntoViewIfNeeded()
    await bfButton.waitFor({ state: 'visible', timeout: 5000 })
    
    // Only click if button says "Show B/F Types" (meaning B/F types are currently hidden)
    const buttonText = await bfButton.textContent()
    if (buttonText?.includes('Show')) {
      await bfButton.click({ force: true })
    }

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Store the current query state
    const fissionState = await getQueryStateFromStorage(page)

    expect(fissionState).toBeTruthy()
    expect(fissionState.fission).toBeTruthy()
    expect(fissionState.fission.selectedElements).toContain('Sr')
    expect(fissionState.fission.selectedOutputElement1).toContain('Si')
    expect(fissionState.fission.selectedOutputElement2).toContain('Cr')
    expect(fissionState.fission.showBosonFermion).toBe(true)

    // Navigate away to another page
    await page.goto('/twotwo')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'twotwo')

    // Navigate back to fission page (without URL params)
    await page.goto('/fission')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fission')

    // Check that the state was restored
    await expect(page.getByRole('button', { name: /1 selected.*Sr/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /1 selected.*Si/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /1 selected.*Cr/i })).toBeVisible()

    // Check boson/fermion columns are visible
    await expect(page.getByText('Nuclear').first()).toBeVisible()
    await expect(page.getByText('Atomic').first()).toBeVisible()
  })

  test('should persist TwoToTwoQuery state across navigation', async ({ page }) => {
    // Navigate to twotwo page
    await page.goto('/twotwo')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'twotwo')

    // Select input elements using working patterns
    const inputElement1Button = page.getByTestId('twotwo-input-element-1-selector')
    await inputElement1Button.click({ force: true })
    const hydrogenInput1 = page.getByRole('button', { name: /^1\s+H$/i }).first()
    await hydrogenInput1.waitFor({ state: 'visible', timeout: 5000 })
    await hydrogenInput1.click()
    await page.keyboard.press('Escape')

    const inputElement2Button = page.getByTestId('twotwo-input-element-2-selector')
    await inputElement2Button.click({ force: true })
    const lithiumInput2 = page.getByRole('button', { name: /^3\s+Li$/i }).first()
    await lithiumInput2.waitFor({ state: 'visible', timeout: 5000 })
    await lithiumInput2.click()
    await page.keyboard.press('Escape')

    // Select output elements
    const outputElement3Button = page.getByTestId('twotwo-output-element-1-selector')
    await outputElement3Button.click({ force: true })
    const copperOutput3 = page.getByRole('button', { name: /^29\s+Cu$/i }).first()
    await copperOutput3.waitFor({ state: 'visible', timeout: 5000 })
    await copperOutput3.click()
    await page.keyboard.press('Escape')

    // Set result limit
    await page.getByRole('button', { name: 'Expand filters' }).click()
    
    // Open limit dropdown and select 100
    await page.getByTestId('limit-selector-button').click()
    await page.getByTestId('limit-option-100').click()

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Store the current query state
    const twoToTwoState = await getQueryStateFromStorage(page)

    expect(twoToTwoState).toBeTruthy()
    expect(twoToTwoState.twotwo).toBeTruthy()
    expect(twoToTwoState.twotwo.selectedElement1).toContain('H')
    expect(twoToTwoState.twotwo.selectedElement2).toContain('Li')
    expect(twoToTwoState.twotwo.selectedOutputElement3).toContain('Cu')
    expect(twoToTwoState.twotwo.limit).toBe(100)

    // Navigate away to another page
    await page.goto('/fusion')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    // Navigate back to twotwo page (without URL params)
    await page.goto('/twotwo')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'twotwo')

    // Check that the state was restored
    await expect(page.getByTestId('twotwo-input-element-1-selector')).toContainText('H')
    await expect(page.getByTestId('twotwo-input-element-2-selector')).toContainText('Li')
    await expect(page.getByTestId('twotwo-output-element-1-selector')).toContainText('Cu')

    // Check limit was restored by expanding filters
    await page.getByRole('button', { name: 'Expand filters' }).click()
    await expect(page.getByTestId('limit-selector-button')).toContainText('100')
  })

  test('should maintain separate state for each query page', async ({ page }) => {
    // Set up fusion page state
    await page.goto('/fusion')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    const fusionElement1Button = page.getByTestId('fusion-input-element-1-selector')
    await fusionElement1Button.click({ force: true })
    const lithiumFusion = page.getByRole('button', { name: /^3\s+Li$/i }).first()
    await lithiumFusion.waitFor({ state: 'visible', timeout: 5000 })
    await lithiumFusion.click()
    await page.keyboard.press('Escape')

    // Set up fission page state
    await page.goto('/fission')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fission')

    const fissionInputButton = page.getByTestId('fission-input-element-selector')
    await fissionInputButton.click({ force: true })
    const strontiumFission = page.getByRole('button', { name: /^38\s+Sr$/i }).first()
    await strontiumFission.waitFor({ state: 'visible', timeout: 5000 })
    await strontiumFission.click()
    await page.keyboard.press('Escape')

    // Set up twotwo page state
    await page.goto('/twotwo')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'twotwo')

    const twotwoElement2Button = page.getByTestId('twotwo-input-element-2-selector')
    await twotwoElement2Button.click({ force: true })
    const nickelTwotwo = page.getByRole('button', { name: /^28\s+Ni$/i }).first()
    await nickelTwotwo.waitFor({ state: 'visible', timeout: 5000 })
    await nickelTwotwo.click()
    await page.keyboard.press('Escape')

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Check all states are saved independently
    const allStates = await getQueryStateFromStorage(page)

    expect(allStates).toBeTruthy()
    expect(allStates.fusion?.selectedElement1).toContain('Li')
    expect(allStates.fission?.selectedElements).toContain('Sr')
    expect(allStates.twotwo?.selectedElement2).toContain('Ni')

    // Navigate back to each page and verify state is maintained
    await page.goto('/fusion')
    await waitForDatabaseReady(page)
    await expect(page.getByText('Li').first()).toBeVisible()

    await page.goto('/fission')
    await waitForDatabaseReady(page)
    await expect(page.getByText('Sr').first()).toBeVisible()

    await page.goto('/twotwo')
    await waitForDatabaseReady(page)
    await expect(page.getByText('Li').nth(1)).toBeVisible()
  })

  test('should prioritize URL parameters over saved state', async ({ page }) => {
    // First, set up some saved state
    await page.goto('/fusion')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    const fusionElement1Button = page.getByTestId('fusion-input-element-1-selector')
    await fusionElement1Button.click({ force: true })
    const lithiumFusion = page.getByRole('button', { name: /^3\s+Li$/i }).first()
    await lithiumFusion.waitFor({ state: 'visible', timeout: 5000 })
    await lithiumFusion.click()
    await page.keyboard.press('Escape')

    // Wait for state to save
    await page.waitForTimeout(1000)

    // Navigate away then back with URL parameters
    await page.goto('/fission')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fission')

    // Navigate back with different elements via URL params
    await page.goto('/fusion?e1=H&e2=He')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    // Check that URL parameters took precedence
    const element1Button = page.getByTestId('fusion-input-element-1-selector')
    const element2Button = page.getByTestId('fusion-input-element-2-selector')
    
    await expect(element1Button).toContainText('H')
    await expect(element2Button).toContainText('He')
    
    // Li should not be selected
    const liSelected = await page.getByRole('button', { name: /Li/i }).first().isVisible()
    if (liSelected) {
      // Check that Li is not in the selected elements display
      const selectedE1Text = await element1Button.textContent()
      expect(selectedE1Text).not.toContain('Li')
    }
  })

  test('should persist visualization state (pinned elements/nuclides)', async ({ page }) => {
    // Navigate to fusion page
    await page.goto('/fusion')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    // Select some elements to get results with nuclides
    const element1Button = page.getByRole('button', { name: /Any/i }).first()
    await element1Button.click({ force: true })
    const hydrogenE1 = page.getByRole('button', { name: /^1\s+H$/i }).first()
    await hydrogenE1.waitFor({ state: 'visible', timeout: 5000 })
    await hydrogenE1.click()
    await page.keyboard.press('Escape')

    const element2Button = page.getByRole('button', { name: /Any/i }).nth(1)
    await element2Button.click({ force: true })
    const lithiumE2 = page.getByRole('button', { name: /^3\s+Li$/i }).first()
    await lithiumE2.waitFor({ state: 'visible', timeout: 5000 })
    await lithiumE2.click()
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
    const fusionState = await getQueryStateFromStorage(page)

    expect(fusionState?.fusion?.visualization).toBeTruthy()
    expect(fusionState.fusion.visualization.showHeatmap).toBe(false)

    // Navigate away and back
    await page.goto('/fission')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fission')

    await page.goto('/fusion')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    // Check heatmap is still collapsed
    const heatmapButton = page.getByRole('button', { name: 'Expand periodic table' })
    await expect(heatmapButton).toBeVisible()
  })

  test('should clear state when using Reset Filters button', async ({ page }) => {
    // Navigate to fusion page and set up state
    await page.goto('/fusion')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    // Select elements
    const element1Button = page.getByRole('button', { name: /Any/i }).first()
    await element1Button.click({ force: true })
    const lithiumE1 = page.getByRole('button', { name: /^3\s+Li$/i }).first()
    await lithiumE1.waitFor({ state: 'visible', timeout: 5000 })
    await lithiumE1.click()
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
    const fusionState = await getQueryStateFromStorage(page)

    // The state should still exist but with reset values
    expect(fusionState?.fusion).toBeTruthy()
    expect(fusionState.fusion.selectedElement1).toEqual([])
    expect(fusionState.fusion.minMeV).toBeUndefined()
  })

  test('should handle browser back/forward navigation correctly', async ({ page }) => {
    // Navigate to fusion with URL params
    await page.goto('/fusion?e1=H&e2=Li')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fusion')

    // Navigate to fission with different params
    await page.goto('/fission?e=Sr')
    await acceptMeteredWarningIfPresent(page)
    await waitForDatabaseReady(page)
    await waitForReactionResults(page, 'fission')

    // Use browser back button
    await page.goBack()
    await waitForReactionResults(page, 'fusion')

    // Should be on fusion page with H and Li selected
    await expect(page.url()).toContain('/fusion')
    await expect(page.getByRole('button', { name: /1 selected.*H/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /1 selected.*Li/i })).toBeVisible()

    // Use browser forward button
    await page.goForward()
    await waitForReactionResults(page, 'fission')

    // Should be on fission page with Sr selected
    await expect(page.url()).toContain('/fission')
    await expect(page.getByRole('button', { name: /1 selected.*Sr/i })).toBeVisible()
  })
})

