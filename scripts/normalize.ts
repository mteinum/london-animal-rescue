import Papa from 'papaparse';
import { animalGroup } from '../src/classifications';
import { parseDate } from '../src/dates';
import { classifyLocation } from '../src/geo';
import type { Incident } from '../src/types';
export const required = [
  'IncidentNumber',
  'DateTimeOfCall',
  'AnimalGroupParent',
  'FinalDescription',
  'Borough',
  'Easting_rounded',
  'Northing_rounded',
];
export function parseCSV(input: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(input.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
  });
  if (result.errors.length)
    throw new Error(`Invalid CSV: ${JSON.stringify(result.errors.slice(0, 5))}`);
  for (const key of required)
    if (!result.meta.fields?.includes(key))
      throw new Error(`Source schema changed: missing ${key}`);
  return result.data;
}
export function clean(v: string | undefined): string {
  const s = (v ?? '').trim();
  return /^(NULL|N\/A|NaN)$/i.test(s) ? '' : s;
}
export function number(v: string | undefined): number | null {
  const s = clean(v).replace(/[£,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function title(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
export function normalize(rows: Record<string, string>[]) {
  const records: Incident[] = [];
  const rejected: { row: number; reason: string }[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const id = clean(r.IncidentNumber),
      dt = parseDate(clean(r.DateTimeOfCall));
    if (!id || !dt) {
      rejected.push({
        row: i + 2,
        reason: !id ? 'Missing incident identifier' : 'Invalid recorded date/time',
      });
      return;
    }
    if (seen.has(id)) {
      duplicates.push(id);
      rejected.push({ row: i + 2, reason: `Duplicate identifier ${id}; first valid row retained` });
      return;
    }
    seen.add(id);
    const animal = clean(r.AnimalGroupParent) || 'Unspecified';
    records.push({
      id,
      ...dt,
      animal,
      category: animalGroup(animal),
      description: clean(r.FinalDescription),
      borough: title(clean(r.Borough)) || 'Unspecified',
      ward: clean(r.Ward),
      postcode: clean(r.PostcodeDistrict),
      street: clean(r.Street),
      station: clean(r.StnGroundName),
      location: classifyLocation(number(r.Easting_rounded), number(r.Northing_rounded)),
      pumps: number(r.PumpCount),
      pumpHours: number(r.PumpHoursTotal),
      hourlyCost: number(r['HourlyNotionalCost(£)']),
      cost: number(r['IncidentNotionalCost(£)']),
      serviceCategory: clean(r.SpecialServiceTypeCategory),
      service: clean(r.SpecialServiceType),
      propertyCategory: clean(r.PropertyCategory),
      property: clean(r.PropertyType),
    });
  });
  records.sort((a, b) => a.clock - b.clock || a.id.localeCompare(b.id));
  return { records, rejected, duplicates };
}
