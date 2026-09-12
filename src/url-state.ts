import { emptyFilters } from './filters';
import { validDay } from './dates';
import type { Filters } from './types';
export function decodeState(
  search: string,
  categories: string[],
  boroughs: string[],
): { filters: Filters; selected: string; warnings: string[] } {
  const p = new URLSearchParams(search),
    f = emptyFilters(),
    warnings: string[] = [];
  f.query = (p.get('q') ?? '').slice(0, 300);
  f.animals = p.getAll('animal').filter((a) => categories.includes(a));
  for (const key of ['from', 'to'] as const) {
    const v = p.get(key);
    if (v) {
      if (validDay(v)) f[key] = v;
      else warnings.push(`Invalid ${key} date ignored.`);
    }
  }
  if (f.from && f.to && f.from > f.to) {
    [f.from, f.to] = [f.to, f.from];
    warnings.push('Date range was reversed and has been corrected.');
  }
  const borough = p.get('borough') ?? '';
  if (boroughs.includes(borough)) f.borough = borough;
  f.overnight = p.get('night') === '1';
  const id = p.get('incident') ?? '';
  return {
    filters: f,
    selected: /^[\w-]{1,100}$/.test(id) ? id : '',
    warnings: [
      ...warnings,
      ...(id && !/^[\w-]{1,100}$/.test(id) ? ['Invalid incident identifier ignored.'] : []),
    ],
  };
}
export function encodeState(url: string, f: Filters, selected = ''): string {
  const u = new URL(url);
  const p = u.searchParams;
  for (const key of ['q', 'animal', 'from', 'to', 'borough', 'night', 'incident']) p.delete(key);
  if (f.query) p.set('q', f.query);
  for (const animal of f.animals) p.append('animal', animal);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.borough) p.set('borough', f.borough);
  if (f.overnight) p.set('night', '1');
  if (selected) p.set('incident', selected);
  return u.toString();
}
