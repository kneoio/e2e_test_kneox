import { type Page, type Locator, expect } from '@playwright/test';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The header user-menu button is labelled with the signed-in account's email.
function userMenuTrigger(page: Page, email: string): Locator {
  return page.locator('.n-layout-header').getByRole('button', { name: new RegExp(escapeRegExp(email), 'i') });
}

// The Profile view exposes a single <n-select>: the interface-language picker.
// Anchoring on that structure (rather than a label) keeps this working after
// the surrounding labels get translated by the very select that controls them.
function languageSelect(page: Page): Locator {
  return page.locator('.n-select').locator('.n-base-selection');
}

// Sign in through the passwordless email + one-time-code flow. `otp` is the
// verification code (the QA bypass pair verifies without a real email).
export async function login(page: Page, email: string, otp: string) {
  await page.goto('/login?redirect=/mixdeck');

  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByRole('button', { name: /continue/i }).click();

  await page.getByPlaceholder('6-digit code').fill(otp);
  await page.getByRole('button', { name: /continue/i }).click().catch(() => {
    // Some flows auto-submit once six digits are entered; ignore a missing
    // button and rely on the logged-in assertion below.
  });

  // Being signed in is confirmed by the header user-menu button, independent
  // of which landing page the account resolves to.
  await expect(userMenuTrigger(page, email)).toBeVisible({ timeout: 15000 });
}

// "Profile" is always the first user-menu option; matching by position keeps
// this working regardless of the current interface language.
export async function openProfile(page: Page, email: string) {
  await userMenuTrigger(page, email).click();
  await page.locator('.n-dropdown-option').first().click();
  await expect(languageSelect(page)).toBeVisible({ timeout: 10000 });
}

export async function changeLanguage(page: Page, optionLabel: string) {
  const select = languageSelect(page);
  await select.click();

  // The option list is virtualized and auto-scrolls to the current selection,
  // so early options (e.g. English at the top) may not be rendered. Scroll the
  // open popover to the top so the target option is present before clicking.
  // Language options are endonyms (English, Deutsch, ...) and are not
  // translated, so matching by exact text is stable across UI languages.
  const popover = page.locator('.v-binder-follower-content:visible').last();
  await popover.waitFor();
  await popover.hover();
  await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(250);

  await popover.getByText(optionLabel, { exact: true }).first().click();
  await expect(select).toContainText(optionLabel);
}

// "Logout" is always the last user-menu option; matching by position keeps
// this working after the interface language changes.
export async function logout(page: Page, email: string) {
  await userMenuTrigger(page, email).click();
  await page.locator('.n-dropdown-option').last().click();
  await expect(userMenuTrigger(page, email)).toBeHidden({ timeout: 10000 });
}
