import { test, expect, type Page } from '@playwright/test';

const MIXDECK_USER = process.env.MIXDECK_USER!;
const MIXDECK_PWD = process.env.MIXDECK_PWD!;
const BRAND_NAME = `E2E Test Brand ${Date.now()}`;

async function login(page: Page) {
  await page.goto('/');
  await page.locator('#creators').getByRole('button', { name: 'Access Mixdeck' }).click();

  await page.getByPlaceholder('Enter your username or email').fill(MIXDECK_USER);
  await page.getByPlaceholder('Enter your password').fill(MIXDECK_PWD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByText('Overview')).toBeVisible();
}

async function openNewBrandForm(page: Page) {
  await page.locator('header button').first().click();
  await page.getByText('Add New Brand').click();
  await expect(page.getByText('Create a new brand')).toBeVisible();
}

test('user can create a brand and delete it', async ({ page }) => {
  await login(page);
  await openNewBrandForm(page);

  await page.getByPlaceholder('Please Input').first().fill(BRAND_NAME);

  await page.getByText('Country').locator('..').getByText('Please Select').click();
  await page.getByText('United States', { exact: true }).click();

  await page.getByText('Time Zone').locator('..').getByText('Please Select').click();
  await page.getByText('UTC (+0)', { exact: true }).click();

  // NOTE: as of 2026-07-13 the Genres picker never receives any options
  // ("No Data") because no genre master-data request is ever made for the
  // New Brand form, so this required field can't be filled. This step will
  // fail until that backend/frontend bug is fixed.
  await page.getByText('Genres').locator('..').getByText('Please Select').click();
  const genreOption = page.locator('.v-binder-follower-content').getByRole('option').first();
  await genreOption.waitFor();
  await genreOption.click();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Genres is required')).not.toBeVisible();

  await expect(page.getByText(BRAND_NAME)).toBeVisible();

  const brandCard = page.locator('.field-row, section, div').filter({ hasText: BRAND_NAME }).first();
  await brandCard.getByRole('button', { name: /settings|edit/i }).click();

  await page.getByRole('button', { name: /delete/i }).click();
  await page.getByRole('button', { name: /confirm|yes|delete/i }).last().click();

  await expect(page.getByText(BRAND_NAME)).not.toBeVisible();
});
