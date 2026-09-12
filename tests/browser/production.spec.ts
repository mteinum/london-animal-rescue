import { test, expect } from '@playwright/test';
test('production analytics waits for consent and uses the deployed base path', async ({
  page,
  context,
}, info) => {
  test.skip(!process.env.PRODUCTION_URL, 'Requires the production preview URL');
  const requests: string[] = [];
  await context.route(/https:\/\/[^/]*(google-analytics\.com|googletagmanager\.com)\//, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: '/* Google tag stub */' });
  });
  await page.goto(process.env.PRODUCTION_URL! + '?incident=131792091');
  await expect(page.locator('#map')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await expect(page.getByRole('region', { name: 'Analytics preferences' })).toBeVisible();
  expect(requests).toEqual([]);
  await page.screenshot({ path: `docs/analytics-consent-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toContain('id=G-FC34S4J2L2');
  const config = await page.evaluate(() => {
    const queue = (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer;
    return queue
      .map((command) => Array.from(command))
      .find((command) => command[0] === 'config')?.[2];
  });
  expect(config).toMatchObject({
    cookie_path: new URL(process.env.PRODUCTION_URL!).pathname,
    page_location: process.env.PRODUCTION_URL,
  });
  const settings = page.getByRole('button', { name: 'Privacy settings', exact: true });
  if (!(await settings.isVisible()))
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await settings.click();
  await page.getByRole('button', { name: 'Necessary only', exact: true }).click();
  await expect(page.locator('.analytics-status')).toHaveText('Analytics off.');
});
test('production subdirectory has local map, worker, assets and deep links', async ({ page }) => {
  test.skip(
    !process.env.PRODUCTION_URL,
    'Run with PRODUCTION_URL after building and previewing the subdirectory variant',
  );
  const errors: string[] = [];
  const external: string[] = [];
  page.on('requestfailed', (r) => errors.push(r.url()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  page.on('request', (r) => {
    if (r.url().startsWith('http') && !r.url().startsWith(process.env.PRODUCTION_URL!))
      external.push(r.url());
  });
  await page.goto(process.env.PRODUCTION_URL! + '?incident=131792091');
  await expect(page.locator('#map')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await expect(page.locator('#detail-body')).toContainText('131792091');
  await expect(page.locator('#map-message')).toBeHidden();
  await page.getByRole('button', { name: 'Incident list', exact: true }).click();
  await page.getByLabel('Search incident list').fill('tree');
  await expect(page.locator('.open-record')).toHaveCount(12);
  expect(new URL(page.url()).pathname).toBe(new URL(process.env.PRODUCTION_URL!).pathname);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('selecting a rendered geographic cluster opens its actual member list', async ({
  page,
}, info) => {
  test.skip(
    info.project.name === 'mobile',
    'Desktop canvas click uses the reviewed desktop screenshot position',
  );
  await page.goto('/');
  await expect(page.locator('#map')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  // The numbered Southwark/Lambeth cluster in the visually reviewed 1512 × 982 screenshot.
  await page.mouse.click(818, 618);
  await expect(page.getByRole('heading', { name: 'Callouts in this cluster' })).toBeVisible();
  await expect(page.locator('.open-record')).toHaveCount(12);
  await page.locator('.open-record').first().click();
  await expect(page.locator('#detail-body')).toContainText('ORIGINAL INCIDENT NOTES');
});

test('production case-file links preserve classifications and base path through history', async ({
  page,
}) => {
  test.skip(!process.env.PRODUCTION_URL, 'Requires the production preview URL');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  await page.goto(
    process.env.PRODUCTION_URL! +
      '?view=cases&case=cat&property=Church%2FChapel&incident=112223-11072024',
  );
  await expect(page.locator('#case-title')).toHaveText('Cat');
  await expect(page.locator('#map')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await expect(page.locator('.record-classification')).toContainText('Other animal assistance');
  await expect(page.locator('.case-scope')).toContainText('Church/Chapel');
  await page.getByRole('button', { name: 'Necessary only', exact: true }).click();
  await page.locator('#close-incident').click();
  await page.locator('[data-case-map]').click();
  await expect(page.locator('#view-panel')).toBeHidden();
  expect(new URL(page.url()).pathname).toBe(new URL(process.env.PRODUCTION_URL!).pathname);
  await page.goBack();
  await expect(page.locator('#case-title')).toHaveText('Cat');
  await expect(page.locator('.case-scope')).toContainText('Church/Chapel');
  expect(errors).toEqual([]);
});
