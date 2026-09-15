import { test, expect, type Locator, type Page } from '@playwright/test';

// The submission flow authenticates the submitter with an email + one-time
// code. These are taken from MIXDECK_USER / MIXDECK_PWD (the QA bypass pair
// exposed via OtpService.TEST_BYPASS_EMAIL / TEST_BYPASS_CODE in datanest),
// falling back to the documented public bypass values when unset.
const SUBMIT_EMAIL = process.env.MIXDECK_USER || 'qa-test@mixpla.io';
const SUBMIT_CODE = process.env.MIXDECK_PWD || '424242';
const STATION = 'Sunonation';

function fieldRow(page: Page, labelText: string): Locator {
  return page.locator('.field-row').filter({ has: page.getByText(labelText, { exact: true }) });
}

test('user can submit a track with audio file and agreement', async ({ page }) => {
  await page.goto('/submission');
  await page.waitForLoadState('domcontentloaded');

  // Step 1: email + confirmation code
  await fieldRow(page, 'your@email.com').locator('input').fill(SUBMIT_EMAIL);
  await page.getByRole('button', { name: /send code/i }).click();
  await expect(page.getByText('Code sent — check your inbox.')).toBeVisible();

  await fieldRow(page, 'Enter code').locator('input').fill(SUBMIT_CODE);
  await page.getByRole('button', { name: /verify/i }).click();

  // Step 2: track details
  await fieldRow(page, 'Artist name').locator('input').fill('Test Artist');

  await fieldRow(page, 'Genre').locator('.n-tree-select').click();
  const genreOption = page.locator('.n-tree-node-content').first();
  await genreOption.waitFor();
  await genreOption.click();

  // Submit to the Sunonation station.
  const stationRow = fieldRow(page, 'Station');
  await stationRow.locator('.n-select').click();
  const stationOptions = page.locator('.n-base-select-option');
  await stationOptions.first().waitFor();
  await stationOptions.filter({ hasText: STATION }).first().click();

  await page.locator('input[type="file"]').setInputFiles('fixtures/test-audio.wav');

  await page.getByText('I confirm that I own the rights to this track and agree to the Mixpla submission terms.').click();

  const uploadPromise = page.waitForResponse((response) => {
    return response.url().includes('/public/songs/chunk') && response.request().method() === 'POST';
  });

  await page.getByRole('button', { name: 'Submit Track', exact: true }).click();
  await uploadPromise;

  // The upload chunk response resolves before the frontend finishes
  // processing and switching to the success view, so give it more room
  // than the default 5s timeout. The submitted track is cleaned up
  // server-side, so the test does not touch the database directly.
  await expect(page.getByText('Thank you!')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Your track has been submitted successfully.')).toBeVisible();
});
