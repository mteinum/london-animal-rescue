import type { Filters, Incident } from './types';

export const dimensions = [
  {
    key: 'serviceCategories',
    field: 'serviceCategory',
    label: 'Rescue category',
    parameter: 'serviceCategory',
  },
  { key: 'services', field: 'service', label: 'Detailed service type', parameter: 'service' },
  {
    key: 'propertyCategories',
    field: 'propertyCategory',
    label: 'Property category',
    parameter: 'propertyCategory',
  },
  { key: 'properties', field: 'property', label: 'Detailed property type', parameter: 'property' },
] as const;
export type Dimension = (typeof dimensions)[number]['key'];
export type Classification = (typeof dimensions)[number]['field'];
// A reserved URL/filter token, never a source classification.
export const UNKNOWN = '~unknown';
export const classificationValue = (value: string | null | undefined): string =>
  value?.trim() || UNKNOWN;
export const classificationLabel = (value: string): string =>
  value === UNKNOWN ? 'Unknown / not supplied' : value;
export function animalGroup(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unspecified'
  );
}
export function descriptionText(value: string | null | undefined): string {
  return !value?.trim() || /^(redacted|null)$/i.test(value.trim())
    ? 'Description unavailable.'
    : value;
}
export function situationLabel(value: string): string {
  return (
    (
      {
        'Other animal assistance': 'Other assistance',
        'Animal rescue from height': 'At height',
        'Animal rescue from below ground': 'Below ground',
        'Animal rescue from water': 'From water',
      } as Record<string, string>
    )[value] ?? classificationLabel(value)
  );
}
export interface CategoryIndex {
  options: Record<Dimension, string[]>;
  children: { services: Map<string, Set<string>>; properties: Map<string, Set<string>> };
  animals: Map<string, number>;
}
export function buildCategoryIndex(records: Incident[]): CategoryIndex {
  const sets = Object.fromEntries(dimensions.map((d) => [d.key, new Set<string>()])) as Record<
    Dimension,
    Set<string>
  >;
  const children: CategoryIndex['children'] = { services: new Map(), properties: new Map() };
  const animals = new Map<string, number>();
  for (const r of records) {
    dimensions.forEach((d) => sets[d.key].add(classificationValue(r[d.field])));
    for (const [parent, child, key] of [
      ['serviceCategory', 'service', 'services'],
      ['propertyCategory', 'property', 'properties'],
    ] as const) {
      const p = classificationValue(r[parent]);
      if (!children[key].has(p)) children[key].set(p, new Set());
      children[key].get(p)!.add(classificationValue(r[child]));
    }
    const animal = animalGroup(r.category);
    animals.set(animal, (animals.get(animal) ?? 0) + 1);
  }
  return {
    options: Object.fromEntries(
      dimensions.map((d) => [
        d.key,
        [...sets[d.key]].sort((a, b) =>
          classificationLabel(a).localeCompare(classificationLabel(b)),
        ),
      ]),
    ) as CategoryIndex['options'],
    children,
    animals,
  };
}
export function allowedOptions(index: CategoryIndex, filters: Filters, key: Dimension): string[] {
  const parent =
    key === 'services'
      ? filters.serviceCategories
      : key === 'properties'
        ? filters.propertyCategories
        : [];
  if (!parent.length || (key !== 'services' && key !== 'properties')) return index.options[key];
  const allowed = new Set(parent.flatMap((p) => [...(index.children[key].get(p) ?? [])]));
  return index.options[key].filter((v) => allowed.has(v));
}
export function reconcileChildren(filters: Filters, index: CategoryIndex): string[] {
  const removed: string[] = [];
  for (const key of ['services', 'properties'] as const) {
    const allowed = new Set(allowedOptions(index, filters, key));
    filters[key] = filters[key].filter((v) => {
      if (allowed.has(v)) return true;
      removed.push(classificationLabel(v));
      return false;
    });
  }
  return removed;
}
