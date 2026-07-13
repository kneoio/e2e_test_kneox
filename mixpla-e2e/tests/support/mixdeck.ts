import { type Page, expect } from '@playwright/test';

export async function login(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.locator('#creators').getByRole('button', { name: 'Access Mixdeck' }).click();

  await page.getByPlaceholder('Enter your username or email').fill(username);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.locator('.n-page-header__title', { hasText: 'Overview' })).toBeVisible({ timeout: 15000 });
}

// Naive UI teleports the dropdown menu to <body>, so it isn't nested under
// the trigger button in the DOM; locate it by its option text instead.
function userMenuTrigger(page: Page, username: string) {
  return page.locator('.dashboard-header-actions').getByRole('button', { name: new RegExp(username, 'i') });
}

// The only <n-select> on the Profile page is the language picker; anchoring
// on that structure (rather than the card's title text) keeps this working
// after the title itself gets translated by the very select it labels.
function languageSelect(page: Page) {
  return page.locator('.n-card').filter({ has: page.locator('.n-select') }).locator('.n-base-selection');
}

// "Profile" is always the first of the two user-menu options; matching by
// position (not text) keeps this working regardless of the UI language.
export async function openProfile(page: Page, username: string) {
  await userMenuTrigger(page, username).click();
  await page.locator('.n-dropdown-option').first().click();
  await expect(page).toHaveURL(/\/profile/);
  await expect(languageSelect(page)).toBeVisible();
}

export async function changeLanguage(page: Page, optionLabel: string) {
  const select = languageSelect(page);
  await select.click();
  await page.locator('.v-binder-follower-content:visible').getByText(optionLabel, { exact: true }).click();
  await expect(select).toContainText(optionLabel);
}

// "Logout" is always the second/last of the two user-menu options; matching
// by position (not text) keeps this working after the UI language changes.
export async function logout(page: Page, username: string) {
  await userMenuTrigger(page, username).click();
  await page.locator('.n-dropdown-option').last().click();
  await expect(page.locator('#creators')).toBeVisible({ timeout: 10000 });
}
