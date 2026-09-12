import type { Filters } from './types';
import {
  allowedOptions,
  dimensions,
  classificationLabel,
  situationLabel,
  type CategoryIndex,
  type Dimension,
} from './classifications';
import { escape as e } from './ui';

export function situationControlsHTML(): string {
  return `<details class="situation-controls"><summary>Situation & setting <span id="situation-count"></span></summary><p class="muted">Official recorded classifications. Choose any within a selector; all dimensions apply together.</p>${dimensions.map((d) => `<div class="classification-selector"><label for="${d.key}">${d.label}</label><input type="search" id="find-${d.key}" data-option-search="${d.key}" aria-label="Search ${d.label.toLowerCase()} options" placeholder="Find an option…"><select id="${d.key}" data-dimension="${d.key}" aria-label="Add ${d.label.toLowerCase()}"></select></div>`).join('')}<p class="muted">Detailed choices follow the selected parent categories. Invalid detailed choices are cleared when a parent changes.</p></details><div id="filter-chips" class="filter-chips" aria-label="Active filters"></div>`;
}
export function syncSituationControls(
  root: HTMLElement,
  index: CategoryIndex,
  filters: Filters,
): void {
  for (const d of dimensions) {
    const input = root.querySelector<HTMLInputElement>(`#find-${d.key}`)!;
    const options = allowedOptions(index, filters, d.key).filter(
      (v) =>
        classificationLabel(v).toLowerCase().includes(input.value.trim().toLowerCase()) ||
        situationLabel(v).toLowerCase().includes(input.value.trim().toLowerCase()),
    );
    root.querySelector<HTMLSelectElement>(`#${d.key}`)!.innerHTML =
      `<option value="">${options.length ? 'Choose to add or remove…' : 'No matching options'}</option>` +
      options
        .map(
          (v) =>
            `<option value="${e(v)}">${filters[d.key].includes(v) ? '✓ ' : ''}${e(d.key === 'serviceCategories' ? `${situationLabel(v)} · ${classificationLabel(v)}` : classificationLabel(v))}</option>`,
        )
        .join('');
  }
  const n = dimensions.reduce((n, d) => n + filters[d.key].length, 0);
  root.querySelector('#situation-count')!.textContent = n ? `(${n})` : '';
  root.querySelector('#filter-chips')!.innerHTML = filterChipsHTML(filters);
}
export function filterChipsHTML(filters: Filters): string {
  const values: [string, string, string][] = [];
  if (filters.query) values.push(['query', '', `Search: ${filters.query}`]);
  for (const a of filters.animals) values.push(['animals', a, a]);
  if (filters.from) values.push(['from', '', `From ${filters.from}`]);
  if (filters.to) values.push(['to', '', `To ${filters.to}`]);
  if (filters.borough) values.push(['borough', '', filters.borough]);
  if (filters.overnight) values.push(['overnight', '', '18:00–05:59']);
  for (const d of dimensions)
    for (const v of filters[d.key])
      values.push([
        d.key,
        v,
        `${d.label}: ${d.key === 'serviceCategories' ? situationLabel(v) : classificationLabel(v)}`,
      ]);
  return values
    .map(
      ([key, value, label]) =>
        `<button class="filter-chip" data-chip="${key}" data-value="${e(value)}" aria-label="Remove filter: ${e(label)}">${e(label)} <span aria-hidden="true">×</span></button>`,
    )
    .join('');
}
export function removeFilter(filters: Filters, key: keyof Filters, value: string): void {
  if (key === 'overnight') filters.overnight = false;
  else if (key === 'animals' || dimensions.some((d) => d.key === key)) {
    const dimension = key as Dimension | 'animals';
    filters[dimension] = filters[dimension].filter((v) => v !== value);
  } else if (['query', 'from', 'to', 'borough'].includes(key))
    filters[key as 'query' | 'from' | 'to' | 'borough'] = '';
}
