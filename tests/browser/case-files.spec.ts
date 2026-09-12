import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Snapshot } from '../../src/types';
const snapshot = JSON.parse(readFileSync('public/data/incidents.json', 'utf8')) as Snapshot;
const cats = snapshot.records.filter((r) => r.category === 'Cat');
const height = cats.filter((r) => r.serviceCategory === 'Animal rescue from height');
async function filters(page: Page) {
  if (await page.locator('#open-filters').isVisible()) await page.locator('#open-filters').click();
  await page.locator('.situation-controls > summary').click();
}
async function closeFilters(page: Page) {
  if (await page.locator('#close-filters').isVisible())
    await page.locator('#close-filters').click();
}
test('animal folders, scope, bookmarks, shared map and history', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('#matching')).toContainText(
    snapshot.records.length.toLocaleString('en-GB'),
  );
  await expect(page.locator('#map')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  await page.getByRole('button', { name: 'Case files', exact: true }).click();
  await expect(page.locator('.case-folder').first()).toHaveAttribute('data-case', 'Cat');
  await page.locator('#case-search').fill('budgie');
  await expect(page.locator('.case-folder')).toHaveCount(1);
  await page.locator('#case-search').fill('');
  await page.screenshot({ path: `/tmp/lar-cases-directory-${info.project.name}.png` });
  await page.locator('[data-case="Cat"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#case-title')).toBeFocused();
  await expect(page.locator('.case-overview')).toContainText(
    `${cats.length.toLocaleString('en-GB')} matching incidents`,
  );
  await expect(page.locator('.case-seasonal')).toContainText('2026: incomplete');
  await page
    .locator('[data-classification="serviceCategories"][data-value="Animal rescue from height"]')
    .click();
  await expect(page.locator('.case-overview')).toContainText(
    `${height.length.toLocaleString('en-GB')} matching incidents`,
  );
  await expect(page.locator('#matching')).toContainText(height.length.toLocaleString('en-GB'));
  await expect(page.locator('#map-count')).toContainText(
    height.filter((r) => r.location).length.toLocaleString('en-GB'),
  );
  await expect(page.locator('.case-breakdowns').first()).toContainText('100.0%');
  await page.screenshot({ path: `/tmp/lar-case-file-${info.project.name}.png` });
  await page.goBack();
  await expect(page.locator('.case-overview')).toContainText(
    `${cats.length.toLocaleString('en-GB')} matching incidents`,
  );
  await page.goForward();
  await expect(page.locator('.case-overview')).toContainText(
    `${height.length.toLocaleString('en-GB')} matching incidents`,
  );
  const bookmark = page.locator('[data-bookmark]').first();
  await bookmark.click();
  await expect(page.locator('#notebook-count')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#notebook-count')).toHaveText('1');
  await expect(page.locator('#case-title')).toHaveText('Cat');
  await expect(page.locator('[data-bookmark]').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-bookmark]').first().click();
  await expect(page.locator('#notebook-count')).toHaveText('0');
  await page.locator('.open-record').first().click();
  await expect(page.locator('#detail-body .record-classification')).toContainText(
    'Animal rescue from height',
  );
  await page.locator('#close-incident').click();
  await page.locator('[data-case-map]').click();
  await expect(page.locator('#view-panel')).toBeHidden();
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(1);
  await page.locator('#list-toggle').click();
  await expect(page.locator('.view-heading')).toContainText(
    `${height.length.toLocaleString('en-GB')} records`,
  );
  await page.getByRole('button', { name: 'Patterns', exact: true }).click();
  await expect(page.locator('.view-heading')).toContainText(
    `${height.length.toLocaleString('en-GB')} attended incidents`,
  );
  await page.locator('#play').click();
  await expect(page.locator('#view-panel')).toBeHidden();
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Pause timeline');
  await page.locator('#scrub').fill(String(height[0].clock));
  await expect(page.locator('#play')).toHaveAttribute('aria-label', 'Play timeline');
  await page.getByRole('button', { name: 'Case files', exact: true }).click();
  await page.locator('[data-case="Dog"]').click();
  await expect(page.locator('#case-title')).toHaveText('Dog');
  expect(new URL(page.url()).searchParams.getAll('animal')).toEqual(['Dog']);
  await expect(page.locator('#current-date')).toHaveText('All recorded dates');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('dependent searchable selectors, removals, empty records and old incident links', async ({
  page,
}, info) => {
  await page.goto('/?incident=112223-11072024');
  await expect(page.locator('#detail-body')).toContainText(
    'CAT TRAPPED IN DITCH UNDERNEATH CHURCH',
  );
  await expect(page.locator('.record-classification')).toContainText('Other animal assistance');
  await expect(page.locator('.record-classification')).toContainText('Church/Chapel');
  await page.locator('[data-shortcut="properties"]').click();
  await expect(page.locator('#properties')).toHaveValue('');
  expect(new URL(page.url()).searchParams.getAll('propertyCategory')).toEqual(['Non Residential']);
  await page.locator('#close-incident').click();
  await filters(page);
  await page.locator('#find-properties').fill('church');
  await expect(page.locator('#properties option')).toHaveCount(2);
  await page.locator('#find-properties').fill('');
  await page.locator('#propertyCategories').selectOption('Outdoor');
  // OR keeps Church/Chapel valid until Non Residential is removed.
  await expect(page.locator('#filter-chips')).toContainText('Church/Chapel');
  await page.locator('#propertyCategories').selectOption('Non Residential');
  await expect(page.locator('#filter-chips')).not.toContainText('Church/Chapel');
  await expect(page.locator('#properties option')).not.toContainText(['Church/Chapel']);
  await page.locator('#clear').click();
  await page.locator('#serviceCategories').selectOption('Animal rescue from water');
  await page.locator('#serviceCategories').selectOption('Animal rescue from height');
  const expected = snapshot.records.filter((r) =>
    ['Animal rescue from water', 'Animal rescue from height'].includes(r.serviceCategory),
  ).length;
  await expect(page.locator('#matching')).toContainText(expected.toLocaleString('en-GB'));
  await closeFilters(page);
  await page.getByRole('button', { name: 'Case files', exact: true }).click();
  await page.locator('[data-case="Cat"]').click();
  if (info.project.name === 'mobile') await page.locator('#open-filters').click();
  await page.locator('#search').fill('no-such-record-xyz');
  await expect(page.locator('#matching')).toContainText('0 matching');
  await closeFilters(page);
  await expect(page.locator('.case-records')).toContainText('No incidents in this scope');
  await expect(page.locator('.case-breakdowns')).toContainText('0.0%');
  await page.locator('#view-panel [data-chip="query"]').click();
  await expect(page.locator('.case-records')).not.toContainText('No incidents in this scope');
});
test('case links survive map failure, invalid values and conflicting incidents', async ({
  page,
}) => {
  await page.route('**/map/base.geojson', (r) => r.abort());
  await page.goto('/?view=cases&case=Dog&incident=112223-11072024&service=not-real');
  await expect(page.locator('#case-title')).toHaveText('Dog');
  await expect(page.locator('.conflict')).toContainText('outside your current filters');
  await expect(page.locator('#map-message')).toContainText('Map unavailable', { timeout: 60000 });
  await page.locator('#close-incident').click();
  await expect(page.locator('.case-records .open-record')).toHaveCount(12);
  await page.locator('.case-records .open-record').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-body h2')).toHaveText('Dog callout');
  await page.goto('/?view=cases&case=not-real');
  await expect(page.locator('#case-title')).toHaveText('Animal case files');
  await expect(page.locator('#toast')).toContainText('unavailable');
});
