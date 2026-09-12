import { describe, it, expect } from 'vitest';
import { parseCSV, normalize, number } from '../scripts/normalize';
import { parseDate, validDay, displayDate } from '../src/dates';
import { gridToWgs84, classifyLocation, gridArea } from '../src/geo';
import { matches, emptyFilters } from '../src/filters';
import { Timeline, DAY } from '../src/timeline';
import { readNotebook, writeNotebook, NOTEBOOK_KEY, type Store } from '../src/notebook';
import { decodeState, encodeState } from '../src/url-state';
const row = {
  IncidentNumber: 'test-1',
  DateTimeOfCall: '2020-01-01T23:15:00',
  AnimalGroupParent: 'cat',
  FinalDescription: 'Cat, behind "door"\nSecond line',
  Borough: 'CAMDEN',
  Easting_rounded: '529950',
  Northing_rounded: '179950',
  'IncidentNotionalCost(£)': '£1,024',
  PumpHoursTotal: '2',
};
const incident = () => normalize([row]).records[0];
describe('CSV and normalisation', () => {
  it('parses quoting, BOM, multiline fields and escaped double quotes', () => {
    const csv =
      '\uFEFFIncidentNumber,DateTimeOfCall,AnimalGroupParent,FinalDescription,Borough,Easting_rounded,Northing_rounded\r\ntest,2020-01-01 23:15,Cat,"A, ""cat""\nnext line",CAMDEN,529950,179950';
    expect(parseCSV(csv)[0].FinalDescription).toBe('A, "cat"\nnext line');
  });
  it('rejects malformed schema and quoting', () => {
    expect(() => parseCSV('bad,header\n1,2')).toThrow();
    expect(() => parseCSV('IncidentNumber\n"unclosed')).toThrow();
  });
  it('preserves originals, handles currency and blank numbers', () => {
    const r = incident();
    expect(r.animal).toBe('cat');
    expect(r.category).toBe('Cat');
    expect(r.description).toBe(row.FinalDescription);
    expect(r.cost).toBe(1024);
    expect(number('NULL')).toBeNull();
    expect(number('')).toBeNull();
    expect(number('0')).toBe(0);
    expect(number('bad')).toBeNull();
  });
  it('reports duplicate identifiers and invalid dates; retains unmapped records', () => {
    const n = normalize([
      row,
      row,
      { ...row, IncidentNumber: 'bad', DateTimeOfCall: '31/02/2020 12:00' },
      { ...row, IncidentNumber: 'unmapped', Easting_rounded: 'NULL' },
    ]);
    expect(n.records).toHaveLength(2);
    expect(n.rejected).toHaveLength(2);
    expect(n.duplicates).toEqual(['test-1']);
    expect(n.records.find((r) => r.id === 'unmapped')?.location).toBeNull();
  });
});
describe('civil dates', () => {
  it('validates leap days, time and DMY formats', () => {
    expect(parseDate('29/02/2020 23:59')?.date).toBe('2020-02-29T23:59:00');
    expect(validDay('2021-02-29')).toBe(false);
    expect(parseDate('2020-01-01T24:00')).toBeNull();
    expect(parseDate('2020-01-01T01:60')).toBeNull();
  });
  it('does not invent offsets around DST', () => {
    expect(parseDate('2020-10-25T01:30')?.date).toBe('2020-10-25T01:30:00');
    expect(parseDate('2020-10-25T01:30Z')).toBeNull();
    expect(displayDate('2020-10-25T01:30:00')).toBe('25 Oct 2020 · 01:30');
  });
});
describe('geography', () => {
  it('converts an official paired source BNG/WGS84 coordinate within Helmert accuracy', () => {
    const [lon, lat] = gridToWgs84(534785, 167546);
    expect(lon).toBeCloseTo(-0.0641668865, 4);
    expect(lat).toBeCloseTo(51.3909537081, 4);
  });
  it('rejects impossible/missing coordinates and keeps grid precision', () => {
    expect(classifyLocation(0, 0)).toBeNull();
    expect(classifyLocation(null, 180000)).toBeNull();
    expect(classifyLocation(NaN, 180000)).toBeNull();
    const l = classifyLocation(529950, 179950)!;
    expect(l.precision).toBe('rounded-grid');
    expect(gridArea(l).geometry.coordinates[0]).toHaveLength(5);
  });
});
describe('filters', () => {
  it('uses OR for animals and AND between groups, including overnight', () => {
    const r = incident(),
      f = {
        ...emptyFilters(),
        animals: ['Dog', 'Cat'],
        borough: 'Camden',
        query: 'door',
        overnight: true,
      };
    expect(matches(r, f)).toBe(true);
    expect(matches(r, { ...f, borough: 'Hackney' })).toBe(false);
    expect(matches(r, { ...f, from: '2021-01-01' })).toBe(false);
    expect(matches({ ...r, date: '2020-01-01T06:00:00' }, f)).toBe(false);
  });
  it('includes unmapped rows and searches place/identifier with inclusive dates', () => {
    const r = { ...incident(), location: null };
    expect(
      matches(r, { ...emptyFilters(), query: 'test-1', from: '2020-01-01', to: '2020-01-01' }),
    ).toBe(true);
  });
});
describe('timeline', () => {
  const fixture = () => {
    const r = incident();
    return [r, { ...r, id: 'end', clock: r.clock + DAY * 365, date: '2020-12-31T23:15:00' }];
  };
  it('advances independent of frame rate and stops at the end', () => {
    const a = new Timeline(),
      b = new Timeline();
    a.reset(fixture());
    b.reset(fixture());
    a.play();
    b.play();
    a.tick(1000);
    for (let i = 0; i < 10; i++) b.tick(100);
    expect(a.cursor).toBe(b.cursor);
    a.tick(100000);
    expect(a.cursor).toBe(a.end);
    expect(a.playing).toBe(false);
  });
  it('scrubs with clamping, pauses and resets on filter change', () => {
    const t = new Timeline();
    t.reset(fixture());
    t.play();
    t.scrub(-1);
    expect(t.playing).toBe(false);
    expect(t.cursor).toBe(t.start);
    expect(t.visible(fixture())).toHaveLength(1);
    t.reset([]);
    expect(t.active).toBe(false);
    expect(t.end).toBe(0);
  });
  it('fades history beyond 30 days and resumes without jumping', () => {
    const t = new Timeline();
    t.reset(fixture());
    t.scrub(t.start + DAY * 40);
    t.recent = true;
    expect(t.opacity(fixture()[0])).toBe(0.17);
    const cursor = t.cursor;
    t.pause();
    t.tick(9999);
    expect(t.cursor).toBe(cursor);
  });
});
describe('notebook', () => {
  const store = (): Store => {
    const m = new Map<string, string>();
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => {
        m.set(k, v);
      },
    };
  };
  it('persists unique IDs in a versioned envelope, including unavailable IDs', () => {
    const s = store();
    writeNotebook(s, ['a', 'a', 'missing']);
    expect(readNotebook(s).ids).toEqual(['a', 'missing']);
    expect(JSON.parse(s.getItem(NOTEBOOK_KEY)!).version).toBe(1);
  });
  it('handles malformed JSON, future versions and storage denial', () => {
    const s = store();
    s.setItem(NOTEBOOK_KEY, 'bad');
    expect(readNotebook(s).error).toBeTruthy();
    s.setItem(NOTEBOOK_KEY, '{"version":2,"ids":[]}');
    expect(readNotebook(s).error).toBeTruthy();
    const bad: Store = {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    };
    expect(readNotebook(bad).ids).toEqual([]);
    expect(writeNotebook(bad, ['a'])).toBe(false);
  });
});
describe('URL state', () => {
  it('round trips filters, identifiers and a subdirectory', () => {
    const f = {
      ...emptyFilters(),
      query: 'cat & tree',
      animals: ['Cat', 'Dog'],
      borough: 'Camden',
      overnight: true,
      from: '2020-01-01',
      to: '2020-12-31',
    };
    const url = encodeState('https://example.com/explorer/?keep=yes', f, 'test-1');
    expect(new URL(url).pathname).toBe('/explorer/');
    expect(decodeState(new URL(url).search, ['Cat', 'Dog'], ['Camden'])).toEqual({
      filters: f,
      selected: 'test-1',
      warnings: [],
    });
  });
  it('sanitises invalid identifiers/categories/dates and fixes reversed ranges', () => {
    const d = decodeState(
      '?incident=%3Cscript%3E&animal=Bad&from=2021-01-01&to=2020-01-01',
      [],
      [],
    );
    expect(d.selected).toBe('');
    expect(d.filters.animals).toEqual([]);
    expect(d.filters.from).toBe('2020-01-01');
    expect(d.warnings.length).toBe(2);
  });
});
