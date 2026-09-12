import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalize, parseCSV } from '../scripts/normalize';
import {
  animalGroup,
  buildCategoryIndex,
  allowedOptions,
  reconcileChildren,
  UNKNOWN,
  descriptionText,
  dimensions,
} from '../src/classifications';
import { breakdown, monthlyCounts } from '../src/case-files';
import { readSnapshot } from '../src/snapshot';
import { emptyFilters, matches } from '../src/filters';
import { decodeState, encodeState } from '../src/url-state';
import { removeFilter } from '../src/situation-controls';
import { coverageNote } from '../src/patterns';
import { Timeline } from '../src/timeline';

const row = {
  IncidentNumber: 'one',
  DateTimeOfCall: '2024-07-11T00:21:00',
  AnimalGroupParent: 'Cat',
  FinalDescription: 'NOT PHYSICALLY TRAPPED',
  Borough: 'CAMDEN',
  Easting_rounded: '',
  Northing_rounded: '',
  SpecialServiceTypeCategory: 'Other animal assistance',
  SpecialServiceType: 'Assist trapped domestic animal',
  PropertyCategory: 'Non Residential',
  PropertyType: 'Church/Chapel',
};
const fixture = () =>
  normalize([
    row,
    {
      ...row,
      IncidentNumber: 'two',
      AnimalGroupParent: 'cat',
      SpecialServiceTypeCategory: 'Animal rescue from height',
      SpecialServiceType: 'Animal in tree',
      PropertyCategory: 'Outdoor',
      PropertyType: 'Tree',
    },
    {
      ...row,
      IncidentNumber: 'three',
      AnimalGroupParent: 'Dog',
      SpecialServiceTypeCategory: '',
      SpecialServiceType: '',
      PropertyCategory: '',
      PropertyType: '',
    },
  ]).records;
const snapshot = readSnapshot(JSON.parse(readFileSync('public/data/incidents.json', 'utf8')));

describe('official fields and animal grouping', () => {
  it('preserves all four trimmed classifications without inferring from notes', () => {
    const r = normalize([
      {
        ...row,
        SpecialServiceTypeCategory: ' Other animal assistance ',
        PropertyType: ' Church/Chapel ',
      },
    ]).records[0];
    expect([r.serviceCategory, r.service, r.propertyCategory, r.property]).toEqual([
      'Other animal assistance',
      'Assist trapped domestic animal',
      'Non Residential',
      'Church/Chapel',
    ]);
    expect(r.description).toBe('NOT PHYSICALLY TRAPPED');
  });
  it('retains unexpected labels and explicit unknown buckets', () => {
    const records = normalize([
      {
        ...row,
        SpecialServiceTypeCategory: 'New official category',
        PropertyCategory: 'NULL',
        PropertyType: 'N/A',
        AnimalGroupParent: '',
      },
    ]).records;
    const index = buildCategoryIndex(records);
    expect(index.options.serviceCategories).toEqual(['New official category']);
    expect(index.options.propertyCategories).toEqual([UNKNOWN]);
    expect(records[0].property).toBe('');
    expect(records[0].category).toBe('Unspecified');
  });
  it('groups case variants while retaining original animal labels and bird categories', () => {
    const records = fixture();
    expect(buildCategoryIndex(records).animals.get('Cat')).toBe(2);
    expect(records.find((r) => r.id === 'two')?.animal).toBe('cat');
    expect(['Bird', 'Pigeon', 'Budgie'].map(animalGroup)).toEqual(['Bird', 'Pigeon', 'Budgie']);
    expect(
      matches({ ...records[0], category: 'cat' }, { ...emptyFilters(), animals: ['Cat'] }),
    ).toBe(true);
  });
  it('deliberately loads older envelope-v1 snapshots with unknown parents; rejects future envelopes', () => {
    const old = JSON.parse(JSON.stringify(snapshot));
    old.records = [old.records[0]];
    delete old.records[0].serviceCategory;
    delete old.records[0].propertyCategory;
    delete old.metadata.normalizationVersion;
    const read = readSnapshot(old);
    expect(read.records[0].serviceCategory).toBe('');
    expect(read.records[0].propertyCategory).toBe('');
    expect(read.records[0].service).toBeTruthy();
    expect(() => readSnapshot({ ...old, version: 2 })).toThrow();
  });
  it('renders redacted/null/empty descriptions as unavailable but preserves original text', () => {
    for (const value of [null, undefined, '', ' ', ' Redacted ', 'NULL'])
      expect(descriptionText(value)).toBe('Description unavailable.');
    expect(descriptionText('<script>original text</script>')).toBe(
      '<script>original text</script>',
    );
    const r = normalize([{ ...row, FinalDescription: 'Redacted' }]).records[0];
    expect(r.description).toBe('Redacted');
    expect(matches(r, { ...emptyFilters(), query: 'redacted' })).toBe(false);
  });
});
describe('shared situation filtering and aggregates', () => {
  it('uses OR within dimensions and AND across animal, situation, setting and existing filters', () => {
    const records = fixture();
    const f = {
      ...emptyFilters(),
      animals: ['Cat', 'Dog'],
      serviceCategories: ['Other animal assistance', 'Animal rescue from height'],
      propertyCategories: ['Non Residential'],
      services: ['Assist trapped domestic animal', 'Animal in tree'],
      properties: ['Church/Chapel'],
      borough: 'Camden',
      overnight: true,
    };
    expect(records.filter((r) => matches(r, f)).map((r) => r.id)).toEqual(['one']);
    expect(records.filter((r) => matches(r, { ...f, from: '2025-01-01' }))).toEqual([]);
    expect(
      records
        .filter((r) => matches(r, { ...emptyFilters(), serviceCategories: [UNKNOWN] }))
        .map((r) => r.id),
    ).toEqual(['three']);
  });
  it('narrows children by the union of parents and clears only invalid child selections', () => {
    const index = buildCategoryIndex(fixture());
    const f = {
      ...emptyFilters(),
      services: ['Assist trapped domestic animal', 'Animal in tree'],
      properties: ['Tree', 'Church/Chapel'],
      serviceCategories: ['Other animal assistance'],
      propertyCategories: ['Non Residential'],
    };
    expect(allowedOptions(index, f, 'services')).toEqual(['Assist trapped domestic animal']);
    expect(reconcileChildren(f, index).sort()).toEqual(['Animal in tree', 'Tree']);
    expect(f.services).toEqual(['Assist trapped domestic animal']);
    f.serviceCategories.push('Animal rescue from height');
    expect(allowedOptions(index, f, 'services')).toHaveLength(2);
    removeFilter(f, 'serviceCategories', 'Other animal assistance');
    expect(reconcileChildren(f, index)).toEqual(['Assist trapped domestic animal']);
    f.serviceCategories = [];
    expect(allowedOptions(index, f, 'services')).toHaveLength(3);
  });
  it('uses current records once per count and includes unknowns in percentage denominators', () => {
    const rows = fixture();
    for (const d of dimensions) {
      const results = breakdown(rows, d.field);
      expect(results.reduce((n, r) => n + r.count, 0)).toBe(3);
      expect(results.reduce((n, r) => n + r.percentage, 0)).toBeCloseTo(100);
      expect(results.find((r) => r.value === UNKNOWN)?.percentage).toBeCloseTo(100 / 3);
    }
    expect(breakdown([], 'serviceCategory', ['anything'])[0].percentage).toBe(0);
  });
  it('keeps aggregate, monthly, timeline and filtered record sets consistent', () => {
    const f = {
      ...emptyFilters(),
      animals: ['Cat'],
      serviceCategories: ['Other animal assistance'],
      propertyCategories: ['Non Residential'],
      from: '2024-01-01',
      to: '2024-12-31',
    };
    const rows = snapshot.records.filter((r) => matches(r, f));
    expect(rows.length).toBeGreaterThan(0);
    for (const d of dimensions)
      expect(breakdown(rows, d.field).reduce((n, r) => n + r.count, 0)).toBe(rows.length);
    expect(monthlyCounts(rows).reduce((n, r) => n + r[1], 0)).toBe(rows.length);
    const t = new Timeline();
    t.reset(rows);
    expect(t.visible(rows)).toEqual(rows);
    expect(coverageNote(f, snapshot.metadata)).not.toContain('2026: incomplete');
    expect(coverageNote(emptyFilters(), snapshot.metadata)).toContain('2026: incomplete');
  });
});
describe('shareable case navigation', () => {
  it('round trips all dimensions, case file, selected incident and base path', () => {
    const index = buildCategoryIndex(fixture());
    const f = {
      ...emptyFilters(),
      animals: ['Cat'],
      query: 'church & cat',
      borough: 'Camden',
      serviceCategories: ['Other animal assistance'],
      services: ['Assist trapped domestic animal'],
      propertyCategories: ['Non Residential'],
      properties: ['Church/Chapel'],
      from: '2024-01-01',
      to: '2024-12-31',
      overnight: true,
    };
    const url = new URL(
      encodeState('https://example.com/london-animal-rescue/?keep=yes#map', f, 'one', {
        view: 'cases',
        caseAnimal: 'Cat',
      }),
    );
    expect(url.pathname).toBe('/london-animal-rescue/');
    expect(url.hash).toBe('#map');
    expect(url.searchParams.get('keep')).toBe('yes');
    expect(decodeState(url.search, ['Cat', 'Dog'], ['Camden'], index)).toEqual({
      filters: f,
      selected: 'one',
      view: 'cases',
      caseAnimal: 'Cat',
      warnings: [],
    });
  });
  it('keeps old incident-only links and validates unknown/conflicting URL filters', () => {
    const index = buildCategoryIndex(fixture());
    expect(decodeState('?incident=112223-11072024', ['Cat'], [], index)).toMatchObject({
      selected: '112223-11072024',
      view: 'explore',
      filters: emptyFilters(),
    });
    const d = decodeState(
      '?view=cases&case=cat&animal=Dog&serviceCategory=Other+animal+assistance&service=Animal+in+tree&property=madeup',
      ['Cat', 'Dog'],
      [],
      index,
    );
    expect(d.caseAnimal).toBe('Cat');
    expect(d.filters.animals).toEqual(['Cat']);
    expect(d.filters.services).toEqual([]);
    expect(d.warnings).toHaveLength(2);
    expect(decodeState('?view=cases&case=Dragon', ['Cat'], [], index)).toMatchObject({
      view: 'cases',
      caseAnimal: '',
      filters: { animals: [] },
    });
  });
});
describe('bundled source audit', () => {
  it('matches original local source classifications for every incident and computes audited totals', () => {
    const source = normalize(parseCSV(readFileSync('public/data/source.csv', 'utf8'))).records;
    // Projection arithmetic can differ in its last bits between macOS and Linux.
    // Keep source/grid fields exact; 10 decimal places is well below a millimetre.
    expect(snapshot.records).toEqual(
      source.map((r) => ({
        ...r,
        location: r.location
          ? {
              ...r.location,
              coordinates: r.location.coordinates.map((value) => expect.closeTo(value, 10)),
            }
          : null,
      })),
    );
    expect(snapshot.metadata.normalizationVersion).toBe(2);
    expect(snapshot.metadata.total).toBe(source.length);
    for (const d of dimensions)
      expect(snapshot.metadata.classifications?.[d.field]).toEqual(
        Object.fromEntries(breakdown(source, d.field).map((r) => [r.value, r.count])),
      );
    expect(source).toHaveLength(14046);
    expect(buildCategoryIndex(source).animals.get('Cat')).toBe(7435);
    expect(snapshot.metadata.classifications?.serviceCategory).toEqual({
      'Other animal assistance': 6537,
      'Animal rescue from height': 5645,
      'Animal rescue from below ground': 1294,
      'Animal rescue from water': 570,
    });
    expect(snapshot.records.find((r) => r.id === '112223-11072024')).toMatchObject({
      animal: 'Cat',
      serviceCategory: 'Other animal assistance',
      service: 'Assist trapped domestic animal',
      property: 'Church/Chapel',
      description: 'CAT TRAPPED IN DITCH UNDERNEATH CHURCH',
    });
  });
});
