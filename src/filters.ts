import type { Filters, Incident } from './types';
import { dimensions, classificationValue, animalGroup, descriptionText } from './classifications';
export const emptyFilters = (): Filters => ({
  query: '',
  animals: [],
  from: '',
  to: '',
  borough: '',
  overnight: false,
  serviceCategories: [],
  services: [],
  propertyCategories: [],
  properties: [],
});
export function matches(r: Incident, f: Filters): boolean {
  const day = r.date.slice(0, 10),
    hour = Number(r.date.slice(11, 13));
  return (
    (!f.animals.length || f.animals.some((a) => animalGroup(a) === animalGroup(r.category))) &&
    dimensions.every(
      (d) => !f[d.key].length || f[d.key].includes(classificationValue(r[d.field])),
    ) &&
    (!f.from || day >= f.from) &&
    (!f.to || day <= f.to) &&
    (!f.borough || r.borough === f.borough) &&
    (!f.overnight || hour >= 18 || hour < 6) &&
    (!f.query ||
      [
        r.id,
        descriptionText(r.description) === 'Description unavailable.' ? '' : r.description,
        r.animal,
        r.street,
        r.borough,
        r.ward,
        r.postcode,
        r.station,
      ]
        .join(' ')
        .toLocaleLowerCase('en-GB')
        .includes(f.query.trim().toLocaleLowerCase('en-GB')))
  );
}
