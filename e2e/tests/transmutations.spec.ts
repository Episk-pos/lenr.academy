import { test, expect } from '@playwright/test';
import {
  acceptPrivacyConsent,
  waitForDatabaseReady,
} from '../fixtures/test-helpers';

test.describe('Transmutations Page', () => {
  test.beforeEach(async ({ page }) => {
    await acceptPrivacyConsent(page);
    await page.goto('/transmutations');
    await waitForDatabaseReady(page);
  });

  test('renders the page title and disclaimer banner', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Transmutation Pathway Explorer/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Documented claims, not verified mechanisms/i)
    ).toBeVisible();
  });

  test('renders documented transmutation cards', async ({ page }) => {
    // Iwamura Cs → Pr is the headline entry
    await expect(page.getByText(/Cs-133/).first()).toBeVisible();
    await expect(page.getByText(/Pr-141/).first()).toBeVisible();
    await expect(
      page.getByText(/Iwamura.*Mitsubishi/i).first()
    ).toBeVisible();
  });

  test('finds Parkhomov pathways for first card without errors', async ({ page }) => {
    const firstButton = page
      .getByTestId(/find-pathways-/)
      .first();
    await expect(firstButton).toBeEnabled();
    await firstButton.click();

    // Either pathway results or "no pathways found" is a valid outcome.
    await expect(
      page
        .getByText(/Candidate pathways|No 1- or 2-step pathway found/i)
        .first()
    ).toBeVisible();
  });

  test('category filter narrows the visible cards', async ({ page }) => {
    // Click the Biological filter
    await page.getByRole('button', { name: 'Biological', exact: true }).click();

    // Scope assertions to transmutation card content (avoid matching against
    // the hidden lab-filter <select>'s <option> elements, which contain
    // every author name regardless of which category is active).
    const transmutationCards = page.locator('div.card').filter({
      has: page.locator('[data-testid^="find-pathways-"]'),
    });

    // Vysotskii biological entries should still be visible in cards.
    await expect(transmutationCards.filter({ hasText: /Vysotskii/i }).first()).toBeVisible();

    // Iwamura (thin-film) should now be hidden from card content.
    await expect(transmutationCards.filter({ hasText: /Iwamura/i })).toHaveCount(0);
  });
});
