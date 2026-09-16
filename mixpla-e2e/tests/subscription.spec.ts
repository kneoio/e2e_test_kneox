import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { login, openPlans, changePlan, getSubscription, planBadge } from './support/mixdeck';

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
});
