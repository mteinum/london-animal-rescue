import { test, expect } from '@playwright/test';
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
  expect(new URL(page.url()).pathname).toBe('/animal-rescue/');
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
