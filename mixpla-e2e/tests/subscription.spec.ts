import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  login,
  openPlans,
  changePlan,
  getSubscription,
  planBadge,
  attemptUpgradeWithDeclinedCard,
  abandonCheckout,
  applyPromoCode,
  attemptUpgradeWith3DS,
} from './support/mixdeck';

const MIXDECK_TEST_USER = process.env.MIXDECK_TEST_USER || 'qa-test@mixpla.io';
const MIXDECK_TEST_OTP = process.env.MIXDECK_TEST_OTP || '424242';

// This suite mutates the shared QA account's billing state, so the steps must
// run in order on a single session. Stripe runs in test/sandbox mode, so the
// upgrades use a Stripe test card and incur no real charge.
test.describe.configure({ mode: 'serial', timeout: 150_000 });

test.describe('subscription lifecycle: free -> plus -> pro -> plus -> free', () => {
  let context: BrowserContext;
  let page: Page;

  async function resetToFree() {
    await openPlans(page, MIXDECK_TEST_USER);
    if ((await getSubscription(page)).subscriptionType !== 'free') {
      await changePlan(page, 'Free');
      await expect
        .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 30_000 })
        .toBe('free');
    }
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: testInfo.outputDir, size: { width: 1920, height: 1080 } },
    });
    page = await context.newPage();
    await login(page, MIXDECK_TEST_USER, MIXDECK_TEST_OTP);
    // Establish a known baseline regardless of the account's prior state.
    await resetToFree();
  });

  test.afterAll(async () => {
    // Leave the shared QA account on the free plan.
    await resetToFree().catch(() => {});
    await context.close();
  });

  test('starts on the free plan', async () => {
    const sub = await getSubscription(page);
    expect(sub.subscriptionType).toBe('free');
    expect(sub.paid).toBe(false);
    expect(await planBadge(page, MIXDECK_TEST_USER)).toBe('FREE');
  });

  test('a declined card does not upgrade the plan', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await attemptUpgradeWithDeclinedCard(page, 'Plus');

    // Return to the app and confirm the account is still on the free plan:
    // a failed payment must never grant a paid subscription.
    await page.goto('/broadcaster-welcome');
    await page.waitForLoadState('domcontentloaded');
    await expect
      .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 20_000 })
      .toBe('free');
    expect((await getSubscription(page)).paid).toBe(false);
  });

  test('abandoning checkout does not upgrade the plan', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await abandonCheckout(page, 'Plus');
    await expect
      .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 20_000 })
      .toBe('free');
    expect((await getSubscription(page)).paid).toBe(false);
  });

  test('an invalid promo code is rejected', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await applyPromoCode(page, 'Plus', 'INVALIDCODE123');
    await expect(page.getByText(/invalid or expired promo code/i)).toBeVisible({ timeout: 15_000 });
    expect((await getSubscription(page)).subscriptionType).toBe('free');
  });

  test('failed 3DS authentication does not upgrade the plan', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await attemptUpgradeWith3DS(page, 'Plus', 'fail');

    await page.goto('/broadcaster-welcome');
    await page.waitForLoadState('domcontentloaded');
    await expect
      .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 20_000 })
      .toBe('free');
    expect((await getSubscription(page)).paid).toBe(false);
  });

  test('upgrades free -> plus via Stripe checkout', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await changePlan(page, 'Plus');
    await expect
      .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 30_000 })
      .toBe('mixpla_plus');
    expect((await getSubscription(page)).paid).toBe(true);
    await openPlans(page, MIXDECK_TEST_USER);
    expect(await planBadge(page, MIXDECK_TEST_USER)).toBe('PLUS');
  });

  test('upgrades plus -> pro directly (card on file)', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await changePlan(page, 'Pro');
    await expect
      .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 30_000 })
      .toBe('mixpla_pro');
    expect((await getSubscription(page)).paid).toBe(true);
    await openPlans(page, MIXDECK_TEST_USER);
    expect(await planBadge(page, MIXDECK_TEST_USER)).toBe('PRO');
  });

  test('downgrades pro -> plus', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await changePlan(page, 'Plus');
    await expect
      .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 30_000 })
      .toBe('mixpla_plus');
    await openPlans(page, MIXDECK_TEST_USER);
    expect(await planBadge(page, MIXDECK_TEST_USER)).toBe('PLUS');
  });

  test('downgrades plus -> free', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await changePlan(page, 'Free');
    await expect
      .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 30_000 })
      .toBe('free');
    const sub = await getSubscription(page);
    expect(sub.paid).toBe(false);
  });

  test('upgrades free -> plus with 3DS authentication (SCA)', async () => {
    await openPlans(page, MIXDECK_TEST_USER);
    await attemptUpgradeWith3DS(page, 'Plus', 'complete');
    await expect
      .poll(async () => (await getSubscription(page)).subscriptionType, { timeout: 30_000 })
      .toBe('mixpla_plus');
    expect((await getSubscription(page)).paid).toBe(true);
  });
});
