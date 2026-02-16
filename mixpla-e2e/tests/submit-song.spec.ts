import { test, expect } from '@playwright/test';

test('user can submit a song with audio file and agreement', async ({ page }) => {
  await page.goto('/sunonation/submit-song');

  await page.getByLabel('Email').fill('test-user@example.com');
  await page.getByRole('button', { name: /send code/i }).click();

  // Use fixed dummy confirmation code that backend accepts
  await page.getByLabel(/confirmation code/i).fill('faffafa456');

  await page.getByLabel(/audio file/i).setInputFiles('fixtures/test-audio.wav');

  await page.getByLabel('Artist').fill('Test Artist');
  await page.getByLabel('Title').fill('Test Title');

  await page.getByLabel(/music upload agreement/i).check();
  // Optional: second checkbox
  // await page.getByLabel(/share this song with other radio stations/i).check();

  await page.getByRole('button', { name: /submit/i }).click();

  // Assert success indication; use tolerant regex
  await expect(page.getByText(/thank you|success|submitted/i)).toBeVisible();
});
