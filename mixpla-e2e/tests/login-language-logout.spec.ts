import { test } from '@playwright/test';
import { login, openProfile, changeLanguage, logout } from './support/mixdeck';

const MIXDECK_TEST_USER = process.env.MIXDECK_TEST_USER || 'qa-test@mixpla.io';
const MIXDECK_TEST_OTP = process.env.MIXDECK_TEST_OTP || '424242';

test('user can log in, change interface language, and log out', async ({ page }) => {
  await login(page, MIXDECK_TEST_USER, MIXDECK_TEST_OTP);

  await openProfile(page, MIXDECK_TEST_USER);

  // Change the interface language, then switch back to English so the shared
  // QA account is always left in a known state (a previous run may have left
  // it in German).
  await changeLanguage(page, 'Deutsch');
  await changeLanguage(page, 'English');

  await logout(page, MIXDECK_TEST_USER);
});
