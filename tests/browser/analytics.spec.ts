import { test, expect, type Page } from '@playwright/test';
import { ANALYTICS_CONSENT_KEY, CONSENT_MAX_AGE } from '../../src/analytics-consent';

const fixture = './tests/browser/analytics.html?private_query=not-for-analytics#private-fragment';
const measurementId = 'G-FC34S4J2L2';
async function openPrivacy(page: Page) {
  const settings = page.getByRole('button', { name: 'Privacy settings', exact: true });
  if (!(await settings.isVisible()))
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await settings.click();
}

async function commands(page: Page) {
  return page.evaluate(() => {
    const dataLayer = (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer;
    return dataLayer.map((command) => Array.from(command));
  });
}
test.beforeEach(async ({ context }) => {
  // Never send automated tests to the real GA property.
  await context.route(/https:\/\/[^/]*(google-analytics\.com|googletagmanager\.com)\//, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: '/* Google tag stub */',
    }),
  );
});

test('no Google request before consent, rejection persists and app controls remain available', async ({
  page,
}) => {
  const googleRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('google')) googleRequests.push(request.url());
  });
  await page.goto(fixture);
  await expect(page.getByRole('region', { name: 'Analytics preferences' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Incident list', exact: true })).toBeVisible();
  expect(googleRequests).toEqual([]);
  await page.getByRole('button', { name: 'Necessary only', exact: true }).click();
  await page.reload();
  await expect(page.locator('.analytics-consent')).toBeHidden();
  expect(googleRequests).toEqual([]);
  await openPrivacy(page);
  await expect(page.locator('.analytics-consent h2')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Privacy settings', exact: true })).toBeFocused();
});

test('acceptance configures the shared property once and withdrawal disables it and clears only its cookies', async ({
  page,
  context,
}) => {
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
  await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(1);
  const calls = await commands(page);
  const config = calls.find((call) => call[0] === 'config')!;
  expect(config[1]).toBe(measurementId);
  expect(config[2]).toMatchObject({
    send_page_view: false,
    allow_google_signals: false,
    cookie_prefix: 'lar',
  });
  const pageviews = calls.filter((call) => call[0] === 'event' && call[1] === 'page_view');
  expect(pageviews).toHaveLength(1);
  expect(pageviews[0][2]).toMatchObject({
    page_location: new URL(page.url()).origin + '/tests/browser/analytics.html',
  });
  expect(JSON.stringify(calls)).not.toContain('private_query');
  await context.addCookies([
    {
      name: 'lar_ga',
      value: 'test-analytics-cookie',
      domain: new URL(page.url()).hostname,
      path: (config[2] as { cookie_path: string }).cookie_path,
    },
    { name: 'unrelated', value: 'keep', url: page.url() },
  ]);
  await openPrivacy(page);
  await page.getByRole('button', { name: 'Necessary only', exact: true }).click();
  expect(
    await page.evaluate(
      (id) => (window as unknown as Record<string, unknown>)[`ga-disable-${id}`],
      measurementId,
    ),
  ).toBe(true);
  expect(await context.cookies()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'lar_ga' })]),
  );
  expect(await context.cookies()).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'unrelated' })]),
  );
  await openPrivacy(page);
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
  expect((await commands(page)).filter((call) => call[0] === 'event')).toHaveLength(1);
  await page.reload();
  await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(1);
  await expect(page.locator('.analytics-consent')).toBeHidden();
  await page.evaluate(() =>
    (window as unknown as { cleanupAnalyticsFixture: () => void }).cleanupAnalyticsFixture(),
  );
  await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      (id) => (window as unknown as Record<string, unknown>)[`ga-disable-${id}`],
      measurementId,
    ),
  ).toBe(true);
});

test('mobile consent is usable with unavailable storage and a blocked Google script', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    }),
  );
  await page.route('**/gtag/js?*', (route) => route.abort());
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(fixture);
  await expect(page.locator('.analytics-consent')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('analytics-consent-narrow.png') });
  const bounds = await page.locator('.analytics-consent').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
  await expect(page.locator('.analytics-status')).toContainText('could not load');
  await page.getByRole('button', { name: 'Incident list', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Incident list', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('expired consent asks again and other-tab withdrawal is applied', async ({
  page,
  context,
}) => {
  await page.addInitScript(
    ({ key, age }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          allowed: true,
          savedAt: Date.now() - age,
        }),
      ),
    { key: ANALYTICS_CONSENT_KEY, age: CONSENT_MAX_AGE + 1 },
  );
  await page.goto(fixture);
  await expect(page.locator('.analytics-consent')).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
  const other = await context.newPage();
  await other.goto(fixture);
  await openPrivacy(other);
  await other.getByRole('button', { name: 'Necessary only', exact: true }).click();
  await expect(page.locator('.analytics-status')).toHaveText('Analytics off.');
  expect(
    await page.evaluate(
      (id) => (window as unknown as Record<string, unknown>)[`ga-disable-${id}`],
      measurementId,
    ),
  ).toBe(true);
  await other.close();
});
