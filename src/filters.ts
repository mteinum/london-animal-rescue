import type { Filters, Incident } from './types';
export const emptyFilters = (): Filters => ({
  query: '',
  animals: [],
  from: '',
  to: '',
  borough: '',
  overnight: false,
});
export function matches(r: Incident, f: Filters): boolean {
  const day = r.date.slice(0, 10),
    hour = Number(r.date.slice(11, 13));
  return (
    (!f.animals.length || f.animals.includes(r.category)) &&
    (!f.from || day >= f.from) &&
    (!f.to || day <= f.to) &&
    (!f.borough || r.borough === f.borough) &&
    (!f.overnight || hour >= 18 || hour < 6) &&
    (!f.query ||
      [r.id, r.description, r.animal, r.street, r.borough, r.ward, r.postcode, r.station]
        .join(' ')
        .toLocaleLowerCase('en-GB')
        .includes(f.query.trim().toLocaleLowerCase('en-GB')))
  );
}
