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

// --- Subscription / plans helpers -----------------------------------------

export interface Subscription {
  subscriptionType: string; // "free" | "mixpla_plus" | "mixpla_pro"
  paid: boolean;
  subscriptionStatus: string;
  [key: string]: unknown;
}

// Read the current subscription straight from the nivaro API, reusing the
// app's bearer token from localStorage. This is a stable assertion source
// that does not depend on the (translatable) UI.
export async function getSubscription(page: Page): Promise<Subscription> {
  return await page.evaluate(async () => {
    let token: string | null = null;
    for (const key of Object.keys(localStorage)) {
      const match = (localStorage.getItem(key) || '').match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
      if (match) {
        token = match[0];
        break;
      }
    }
    const res = await fetch('/nivaro/subscriptions/current?sync=true', {
      headers: token ? { authorization: 'Bearer ' + token } : {},
    });
    return (await res.json()) as Subscription;
  });
}

// The header user-menu button label ends with the plan badge (FREE/PLUS/PRO).
export async function planBadge(page: Page, email: string): Promise<string> {
  const text = await userMenuTrigger(page, email).first().innerText();
  return (text.match(/\b(FREE|PLUS|PRO)\b/i)?.[1] || '').toUpperCase();
}

// Open the Plans & Pricing view (user menu -> Profile -> Manage Plan). Safe to
// call from any logged-in page since the header persists across views.
export async function openPlans(page: Page, email: string) {
  await userMenuTrigger(page, email).click();
  await page.locator('.n-dropdown-option').first().click();
  await page.getByRole('button', { name: /manage plan|plan verwalten|manage subscription/i }).first().click();
  // The plan cards always render regardless of the current tier; wait for the
  // card itself (its action button varies: Upgrade/Downgrade/Current plan).
  await expect(planCard(page, 'Pro')).toBeVisible({ timeout: 15000 });
}

// A plan card is an `.n-card-content` block containing the exact tier name.
function planCard(page: Page, planName: string): Locator {
  return page.locator('.n-card-content').filter({ has: page.getByText(planName, { exact: true }) });
}

// The card's primary action button: Upgrade or Downgrade (never the promo
// "Apply" or the disabled "Current plan").
function planCardAction(page: Page, planName: string): Locator {
  return planCard(page, planName).getByRole('button', { name: /^(Upgrade|Downgrade)$/ });
}

// Switch to `planName` by clicking its Upgrade/Downgrade button. Upgrading from
// an unpaid plan redirects to Stripe (test-mode) Checkout, which is completed
// here; changes between paid plans and downgrades apply directly with no
// checkout.
export async function changePlan(page: Page, planName: string) {
  await planCardAction(page, planName).click();
  const wentToStripe = await page
    .waitForURL(/checkout\.stripe\.com/, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (wentToStripe) {
    await completeStripeCheckout(page);
  } else {
    // Direct PATCH/DELETE; give the app a moment to apply and re-render.
    await page.waitForTimeout(2000);
  }
}

// Stripe test card that is always declined by the issuer (generic decline).
export const STRIPE_DECLINE_CARD = '4000000000000002';
const STRIPE_TEST_CARD = '4242424242424242';

// Fill the Stripe test-mode Checkout card form and submit. The "Save my
// information" (Link) box is unchecked because leaving it on makes the phone
// number a required field and blocks submission.
async function fillStripeCardAndSubmit(page: Page, cardNumber: string) {
  await page.waitForSelector('#cardNumber', { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.locator('#cardNumber').pressSequentially(cardNumber, { delay: 20 });
  await page.locator('#cardExpiry').pressSequentially('1234', { delay: 20 });
  await page.locator('#cardCvc').pressSequentially('123', { delay: 20 });
  await page.locator('#billingName').fill('QA Test');
  await page.selectOption('#billingCountry', { label: 'United States' }).catch(() => {});
  const postal = page.locator('#billingPostalCode');
  if (await postal.count()) await postal.fill('10001').catch(() => {});

  const link = page.locator('#enableStripePass');
  if ((await link.count()) && (await link.isChecked().catch(() => false))) {
    await link.uncheck({ force: true }).catch(() => {});
  }

  await page.locator('button[type="submit"], .SubmitButton').first().click();
}

// Complete a Stripe test-mode Checkout with a card that succeeds, then wait for
// the redirect back to the app.
export async function completeStripeCheckout(page: Page) {
  await fillStripeCardAndSubmit(page, STRIPE_TEST_CARD);
  await page.waitForURL(/mixpla\.io/, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
}

// Click a tier's Upgrade button and pay with a declined card. Asserts Stripe
// surfaces a decline error and stays on the checkout page (no redirect back,
// so the plan must not change).
export async function attemptUpgradeWithDeclinedCard(
  page: Page,
  planName: string,
  cardNumber: string = STRIPE_DECLINE_CARD,
) {
  await planCardAction(page, planName).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20000 });
  await fillStripeCardAndSubmit(page, cardNumber);
  await expect(
    page.getByText(/declined|could ?n.?t|could not|insufficient|try a different|invalid/i).first(),
  ).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
}
