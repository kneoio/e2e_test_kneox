import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const confirmationCode = process.env.CONFIRMATION_CODE;
if (!confirmationCode) {
  throw new Error('CONFIRMATION_CODE env var must be set before running submit-song test');
}

test('user can submit a song with audio file and agreement', async ({ page }) => {
  await page.goto('/sunonation/submit-song');
  await page.waitForLoadState('domcontentloaded');

  const gdprAccept = page.locator('.gdpr-banner button:has-text("Accept")');
  if (await gdprAccept.count()) {
    await gdprAccept.first().click();
  } else {
    const anyGdprButton = page.locator('.gdpr-banner button');
    if (await anyGdprButton.count()) {
      await anyGdprButton.first().click();
    }
  }

  await page.getByLabel('Email').fill('test-user@example.com');
  await page.getByRole('button', { name: /send code/i }).click();
  await page.getByLabel('Confirmation Code').fill(confirmationCode);
  await page.locator('input[type="file"]').setInputFiles('fixtures/test-audio.wav');
  await page.getByLabel('Artist').fill('Test Artist');
  await page.getByLabel('Title').fill('Test Title');
  await page.getByLabel('Genres').click();
  const genreLabel = page.getByText(/Aggrotech|Ambient|Electronic/i).first();
  await genreLabel.waitFor();
  await genreLabel.click();
  await page.getByLabel(/music upload agreement/i).check();

  const submitPromise = page.waitForResponse((response) => {
    return response.url().includes('/radio/') && response.url().includes('/submissions') && response.request().method() === 'POST';
  });

  await page.getByRole('button', { name: /submit/i }).click();
  await submitPromise;

  const successToast = page.getByRole('alert').filter({ hasText: /thanks! your song was submitted\./i });
  await expect(successToast).toBeVisible();
});