import { test, expect } from '@playwright/test';
test('complete explorer, persistence, deep link and map', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#matching')).toContainText('14,046');
  await expect(page.locator('#map-loading')).toBeHidden({ timeout: 60000 });
  await expect(page.locator('#map-message')).toBeHidden();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('#map')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await page.screenshot({ path: `docs/${info.project.name}.png` });
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('button', { name: /Cats/ }).click();
  await expect(page.locator('#matching')).toContainText('7,435');
  await page.getByLabel('Search descriptions, identifiers and places').fill('zzzznothingfound');
  await expect(page.locator('#matching')).toContainText('0 matching');
  await expect(page.getByRole('button', { name: 'Surprise me' })).toBeDisabled();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.locator('#matching')).toContainText('14,046');
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  await page.getByRole('button', { name: 'Incident list', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Incident list', exact: true })).toBeVisible();
  await page.getByLabel('Search incident list').fill('131792091');
  await expect(page.locator('.open-record')).toHaveCount(1);
  await page.locator('.open-record').click();
  await expect(page.locator('#detail-body')).toContainText('CAT TRAPPED IN TREE');
  await page.getByRole('button', { name: 'Save to notebook', exact: true }).click();
  await expect(page.locator('#notebook-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Share this record', exact: true }).click();
  const fallback = page.getByLabel('Shareable link');
  if (await fallback.isVisible()) {
    await expect(fallback).toHaveValue(/incident=131792091/);
    await page.getByRole('button', { name: 'Close data notes' }).click();
  }
  const url = page.url();
  await page.reload();
  await expect(page.locator('#notebook-count')).toHaveText('1');
  await expect(page.locator('#detail-body')).toContainText('131792091');
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause timeline', exact: true })).toBeVisible();
  const before = await page.locator('#current-date').textContent();
  await expect(page.locator('#current-date')).not.toHaveText(before!);
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  await page.getByLabel('Replay date and time').fill('1500000000000');
  await expect(page.locator('#current-date')).toContainText('2017');
  await page.getByRole('button', { name: 'Show all dates', exact: true }).click();
  await expect(page.locator('#current-date')).toHaveText('All recorded dates');
  await page.getByRole('button', { name: 'Patterns', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Patterns in the callouts' })).toBeVisible();
  await expect(page.locator('.pattern-card table')).toHaveCount(4);
  await page.getByRole('button', { name: 'Notebook 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your notebook' })).toBeVisible();
  await expect(page.locator('.list-record')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear notebook…' }).click();
  await page.getByRole('button', { name: 'Keep my notebook' }).click();
  await expect(page.locator('#notebook-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Clear notebook…' }).click();
  await page.getByRole('button', { name: 'Clear saved records', exact: true }).click();
  await expect(page.locator('#notebook-count')).toHaveText('0');
  await page.goto(url + '&animal=Dog');
  await expect(page.locator('.conflict')).toContainText('outside your current filters');
  await expect(page.locator('#map-loading')).toBeHidden({ timeout: 60000 });
  const dims = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(dims.width).toBeLessThanOrEqual(dims.viewport);
  expect(errors).toEqual([]);
});
test('map failure retains searchable records and safe invalid links', async ({ page }) => {
  await page.route('**/map/base.geojson', (r) => r.abort());
  await page.goto('/?incident=not-a-record&from=bad');
  await expect(page.locator('#map-message')).toContainText('Map unavailable', { timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Incident list', exact: true })).toBeVisible();
  await page.getByLabel('Search incident list').fill('tree');
  await expect(page.locator('.open-record')).toHaveCount(12);
  await page.locator('.open-record').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-body')).toContainText('ORIGINAL INCIDENT NOTES');
});
test('cluster list and building detail, clipboard denial and unavailable notebook', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    localStorage.setItem(
      'london-animal-rescue:notebook:v1',
      JSON.stringify({ version: 1, ids: ['missing-from-snapshot'] }),
    );
  });
  const failures: string[] = [];
  page.on('requestfailed', (r) => failures.push(r.url()));
  page.on('console', (m) => {
    if (m.type() === 'error') failures.push(m.text());
  });
  await page.goto('/');
  await expect(page.locator('#map')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await page.getByRole('button', { name: 'Notebook 1', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText(
    'Record missing-from-snapshot is unavailable',
  );
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('#notebook-count')).toHaveText('0');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.locator('.selected-marker').click();
  await expect(page.locator('#detail-body')).toContainText('131792091');
  await page.getByRole('button', { name: 'Share this record', exact: true }).click();
  await expect(page.getByLabel('Shareable link')).toHaveValue(/incident=131792091/);
  await page.getByRole('button', { name: 'Close data notes' }).click();
  await page.getByRole('button', { name: 'Close incident', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .some((e) => e.name.endsWith('/map/buildings.geojson')),
      ),
    )
    .toBe(true);
  expect(failures).toEqual([]);
});
test('WebGL and localStorage denial keep the record explorer usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('storage denied');
      },
    });
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof get>
    ) {
      if (String(args[0]).includes('webgl')) return null;
      return get.apply(this, args);
    } as typeof get;
  });
  await page.goto('/');
  await expect(page.locator('#map-message')).toContainText('Map unavailable', { timeout: 60000 });
  await page.getByLabel('Search incident list').fill('131792091');
  await page.locator('.open-record').click();
  await page.getByRole('button', { name: 'Save to notebook', exact: true }).click();
  await expect(page.locator('#notebook-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Notebook 1', exact: true }).click();
  await expect(page.locator('.list-record')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#notebook-count')).toHaveText('0');
});
test('hidden document pauses replay and reduced motion disables marker animation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#map')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause timeline', exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Play timeline', exact: true })).toBeVisible();
  const paused = await page.locator('#current-date').textContent();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#current-date')).toHaveText(paused!);
  expect(
    await page.locator('.selected-marker').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
});
test('embedding cleanup preserves host classes and aborts pending initialisation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#matching')).toContainText('14,046');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/app.ts';
    const { mount } = await import(/* @vite-ignore */ modulePath);
    const host = document.createElement('div');
    host.className = 'embedding-host';
    const cleanup = mount(host);
    cleanup();
    return { children: host.childElementCount, className: host.className };
  });
  expect(result).toEqual({ children: 0, className: 'embedding-host' });
  expect(errors).toEqual([]);
});
