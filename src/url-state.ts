import { emptyFilters } from './filters';
import { validDay } from './dates';
import { dimensions, reconcileChildren, animalGroup, type CategoryIndex } from './classifications';
import type { Filters, Navigation, View } from './types';
export function decodeState(
  search: string,
  categories: string[],
  boroughs: string[],
  index?: CategoryIndex,
): Navigation & { filters: Filters; selected: string; warnings: string[] } {
  const p = new URLSearchParams(search),
    f = emptyFilters(),
    warnings: string[] = [];
  const animal = (value: string) => categories.find((c) => animalGroup(c) === animalGroup(value));
  f.query = (p.get('q') ?? '').slice(0, 300);
  for (const a of p.getAll('animal')) {
    const found = animal(a);
    if (found) {
      if (!f.animals.includes(found)) f.animals.push(found);
    } else warnings.push(`Unknown animal category ignored: ${a.slice(0, 80)}.`);
  }
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
  else if (borough) warnings.push('Unknown borough ignored.');
  f.overnight = p.get('night') === '1';
  for (const d of dimensions) {
    for (const v of new Set(p.getAll(d.parameter))) {
      if (index?.options[d.key].includes(v)) f[d.key].push(v);
      else warnings.push(`Unknown ${d.label.toLowerCase()} ignored.`);
    }
  }
  if (index && reconcileChildren(f, index).length)
    warnings.push('Detailed filters outside the selected parent categories were cleared.');
  const requestedView = p.get('view') || 'explore';
  const view: View = ['explore', 'patterns', 'notebook', 'cases'].includes(requestedView)
    ? (requestedView as View)
    : 'explore';
  if (view !== requestedView) warnings.push('Unknown view ignored.');
  const requestedCase = p.get('case') || '';
  const caseAnimal = view === 'cases' && requestedCase ? animal(requestedCase) || '' : '';
  if (view === 'cases') {
    if (requestedCase && !caseAnimal)
      warnings.push('This animal case file is unavailable. Showing the directory.');
    f.animals = caseAnimal ? [caseAnimal] : [];
  }
  const id = p.get('incident') ?? '';
  if (id && !/^[\w-]{1,100}$/.test(id)) warnings.push('Invalid incident identifier ignored.');
  return { filters: f, selected: /^[\w-]{1,100}$/.test(id) ? id : '', warnings, view, caseAnimal };
}
export function encodeState(
  url: string,
  f: Filters,
  selected = '',
  navigation: Navigation = { view: 'explore', caseAnimal: '' },
): string {
  const u = new URL(url),
    p = u.searchParams;
  for (const key of [
    'q',
    'animal',
    'from',
    'to',
    'borough',
    'night',
    'incident',
    'view',
    'case',
    ...dimensions.map((d) => d.parameter),
  ])
    p.delete(key);
  if (f.query) p.set('q', f.query);
  for (const animal of f.animals) p.append('animal', animal);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.borough) p.set('borough', f.borough);
  if (f.overnight) p.set('night', '1');
  for (const d of dimensions) for (const value of f[d.key]) p.append(d.parameter, value);
  if (navigation.view !== 'explore') p.set('view', navigation.view);
  if (navigation.view === 'cases' && navigation.caseAnimal) p.set('case', navigation.caseAnimal);
  if (selected) p.set('incident', selected);
  return u.toString();
}
