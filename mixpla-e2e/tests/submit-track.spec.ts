import { test, expect, type Locator, type Page } from '@playwright/test';

// QA-only bypass pair from OtpService (datanest): this exact email+code always
// verifies without a real email being sent. See com.semantyca.datanest.service.OtpService.
const QA_EMAIL = 'qa-test@mixpla.io';
const QA_CODE = '424242';

function fieldRow(page: Page, labelText: string): Locator {
  return page.locator('.field-row').filter({ has: page.getByText(labelText, { exact: true }) });
}

test('user can submit a track with audio file and agreement', async ({ page }) => {
  await page.goto('/submission');
  await page.waitForLoadState('domcontentloaded');

  // Step 1: email + confirmation code
  await fieldRow(page, 'your@email.com').locator('input').fill(QA_EMAIL);
  await page.getByRole('button', { name: /send code/i }).click();
  await expect(page.getByText('Code sent — check your inbox.')).toBeVisible();

  await fieldRow(page, 'Enter code').locator('input').fill(QA_CODE);
  await page.getByRole('button', { name: /verify/i }).click();

  // Step 2: track details
  await fieldRow(page, 'Artist name').locator('input').fill('Test Artist');

  await fieldRow(page, 'Genre').locator('.n-tree-select').click();
  const genreOption = page.locator('.n-tree-node-content').first();
  await genreOption.waitFor();
  await genreOption.click();

  // "Sunonation" is used over other stations because they can hit their
  // free-plan submission cap in this environment and reject the upload.
  const stationRow = fieldRow(page, 'Station');
  await stationRow.locator('.n-select').click();
  const stationOption = page.locator('.n-base-select-option').filter({ hasText: 'Sunonation' });
  await stationOption.waitFor();
  await stationOption.click();

  await page.locator('input[type="file"]').setInputFiles('fixtures/test-audio.wav');

  await page.getByText('I confirm that I own the rights to this track and agree to the Mixpla submission terms.').click();

  const uploadPromise = page.waitForResponse((response) => {
    return response.url().includes('/public/songs/chunk') && response.request().method() === 'POST';
  });

  await page.getByRole('button', { name: 'Submit Track', exact: true }).click();
  await uploadPromise;

  await expect(page.getByText('Thank you!')).toBeVisible();
  await expect(page.getByText('Your track has been submitted successfully.')).toBeVisible();
});
