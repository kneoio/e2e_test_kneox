import { test } from '@playwright/test';
import { login, openProfile, changeLanguage, logout } from './support/mixdeck';

const MIXDECK_USER = process.env.MIXDECK_USER!;
const MIXDECK_PWD = process.env.MIXDECK_PWD!;

test('user can log in, change interface language, and log out', async ({ page }) => {
  await login(page, MIXDECK_USER, MIXDECK_PWD);

  await openProfile(page, MIXDECK_USER);
  await changeLanguage(page, 'Deutsch');

  await logout(page, MIXDECK_USER);
});
