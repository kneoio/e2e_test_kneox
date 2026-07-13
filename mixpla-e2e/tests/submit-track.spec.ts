import { test, expect, type Locator, type Page } from '@playwright/test';
import { waitForSoundFragmentIdByTitle, deleteSoundFragmentById, closeDbPool } from './utils/db-cleanup';

// QA-only bypass pair from OtpService (datanest): this exact email+code always
// verifies without a real email being sent. See com.semantyca.datanest.service.OtpService.
const QA_EMAIL = 'qa-test@mixpla.io';
const QA_CODE = '424242';
const TEST_TRACK_TITLE = 'test-audio.wav';

function fieldRow(page: Page, labelText: string): Locator {
  return page.locator('.field-row').filter({ has: page.getByText(labelText, { exact: true }) });
}

let submittedFragmentId: string | undefined;

test.afterEach(async () => {
  if (submittedFragmentId) {
    await deleteSoundFragmentById(submittedFragmentId);
    submittedFragmentId = undefined;
  }
});

test.afterAll(async () => {
  await closeDbPool();
});

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

  // "Sunonation" is used over other stations on mixpla.io because they can
  // hit their free-plan submission cap in that environment and reject the
  // upload. Fall back to whatever station is first when it isn't seeded
  // (e.g. a local dev DB).
  const stationRow = fieldRow(page, 'Station');
  await stationRow.locator('.n-select').click();
  const stationOptions = page.locator('.n-base-select-option');
  await stationOptions.first().waitFor();
  const preferredStation = stationOptions.filter({ hasText: 'Sunonation' });
  if (await preferredStation.count() > 0) {
    await preferredStation.first().click();
  } else {
    await stationOptions.first().click();
  }

  await page.locator('input[type="file"]').setInputFiles('fixtures/test-audio.wav');

  await page.getByText('I confirm that I own the rights to this track and agree to the Mixpla submission terms.').click();

  const uploadPromise = page.waitForResponse((response) => {
    return response.url().includes('/public/songs/chunk') && response.request().method() === 'POST';
  });

  await page.getByRole('button', { name: 'Submit Track', exact: true }).click();
  await uploadPromise;

  submittedFragmentId = await waitForSoundFragmentIdByTitle(TEST_TRACK_TITLE);

  await expect(page.getByText('Thank you!')).toBeVisible();
  await expect(page.getByText('Your track has been submitted successfully.')).toBeVisible();
});
