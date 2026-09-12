import type { Filters, Incident, Metadata } from './types';
import { animalArt, asset, count, icon, escape as e } from './ui';
import { breakdown, monthlyCounts, caseCoverage } from './case-files';
import {
  classificationLabel,
  descriptionText,
  situationLabel,
  type CategoryIndex,
  type Dimension,
  type Classification,
} from './classifications';
import { filterChipsHTML } from './situation-controls';
import { coverageNote, table } from './patterns';
import { displayDate } from './dates';
export function caseFilesHTML(
  records: Incident[],
  filters: Filters,
  animal: string,
  index: CategoryIndex,
  meta: Metadata,
  saved: string[],
  page: number,
  search: string,
): string {
  const scope = `<div class="case-scope"><strong>Current scope</strong><p>Shared filters apply to all views. File counts include every matching date; opening a file resets replay.</p><div class="filter-chips">${filterChipsHTML(filters) || '<span>No active filters · entire snapshot</span>'}</div></div>`;
  if (!animal) {
    const counts = new Map<string, number>();
    for (const r of records) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    const folders = [...index.animals]
      .filter(([a]) => a.toLowerCase().includes(search.trim().toLowerCase()))
      .sort(
        (a, b) => (counts.get(b[0]) ?? 0) - (counts.get(a[0]) ?? 0) || a[0].localeCompare(b[0]),
      );
    return `<div class="view-heading"><span class="eyebrow">THE ANIMAL ARCHIVE</span><h2 tabindex="-1" id="case-title">Animal case files</h2><p>${count(records.length)} matching incidents · folders ordered by current matching count.</p></div>${scope}<label class="search-box">${icon('search')}<span class="sr-only">Find an animal</span><input id="case-search" type="search" value="${e(search)}" placeholder="Find an animal category…"></label><p class="muted">Recorded categories, not necessarily species. Small files are not evidence of risk.</p><div class="case-directory">${folders.map(([a, total]) => `<button class="case-folder" data-case="${e(a)}"><img src="${asset(`art/${animalArt(a)}.svg`)}" alt=""><strong>${e(a)}</strong><span>${count(counts.get(a) ?? 0)} matching incidents</span><small>${count(total)} in the entire file</small></button>`).join('') || '<p class="empty-state">No animal categories match that name.</p>'}</div>`;
  }
  const categories = (title: string, field: Classification, key: Dimension) =>
    `<section class="pattern-card"><h3>${title}</h3><p class="muted">Denominator: ${count(records.length)} current matching incidents. Select categories to add or remove an OR choice.</p><table><caption class="sr-only">${title}, counts and percentage of current matches</caption><thead><tr><th scope="col">Official category</th><th scope="col">Incidents</th><th scope="col">Share</th></tr></thead><tbody>${breakdown(
      records,
      field,
      index.options[key],
    )
      .map(
        (row) =>
          `<tr><th scope="row"><button class="classification-link" data-classification="${key}" data-value="${e(row.value)}" aria-pressed="${filters[key].includes(row.value)}" title="${e(classificationLabel(row.value))}">${e(key === 'serviceCategories' ? situationLabel(row.value) : classificationLabel(row.value))}${filters[key].includes(row.value) ? ' ✓' : ''}</button>${key === 'serviceCategories' ? `<small class="official-label">${e(classificationLabel(row.value))}</small>` : ''}</th><td>${count(row.count)}</td><td>${row.percentage.toFixed(1)}%</td></tr>`,
      )
      .join('')}</tbody></table></section>`;
  const pages = Math.max(1, Math.ceil(records.length / 12));
  const currentPage = Math.min(page, pages - 1);
  return `<div class="case-navigation"><button data-case="" class="text-button">← All case files</button><div class="case-switch" role="group" aria-label="Case file display"><button data-case-map>Map</button><button aria-pressed="true" data-case-records>Records</button></div><button data-share-case class="text-button">Share file</button></div><div class="case-overview"><img src="${asset(`art/${animalArt(animal)}.svg`)}" alt="${e(animalArt(animal))} illustration, not an incident photograph"><div><span class="eyebrow">ANIMAL CASE FILE · ILLUSTRATION</span><h2 id="case-title" tabindex="-1">${e(animal)}</h2><p><strong>${count(records.length)} matching incidents</strong> of ${count(index.animals.get(animal) ?? 0)} in the entire file.</p><p>Recorded dates in current matches: ${caseCoverage(records)}.</p></div></div><p>Historical LFB attendances recorded under “${e(animal)}”. Counts refer to incidents, not individual animals or successful rescues. The original animal label remains on every record.</p>${scope}<div class="case-breakdowns">${categories('Situation', 'serviceCategory', 'serviceCategories')}${categories('Setting', 'propertyCategory', 'propertyCategories')}</div><button data-setting-details class="text-button">Search detailed service and property types →</button><section class="case-records" id="case-records"><h3 tabindex="-1" id="case-records-title">Records in this file</h3><p>${count(records.length)} matches · includes records without map coordinates. Open a record for its dispatch card.</p><div class="record-list">${
    records
      .slice(currentPage * 12, (currentPage + 1) * 12)
      .map(
        (r) =>
          `<article class="list-record"><div><button class="open-record" data-record="${e(r.id)}">${e(r.animal)} · ${e(r.borough)}</button><small>${displayDate(r.date)} · ${e(r.id)}${r.location ? '' : ' · Unmapped'}</small><p>${e(descriptionText(r.description))}</p><button class="text-button" data-bookmark="${e(r.id)}" aria-pressed="${saved.includes(r.id)}">${saved.includes(r.id) ? 'Remove from notebook' : 'Save to notebook'}</button></div></article>`,
      )
      .join('') ||
    '<div class="empty-state"><h3>No incidents in this scope.</h3><p>Remove a filter above, or clear all filters to return to the directory.</p></div>'
  }</div><div class="pagination"><button data-case-page="${currentPage - 1}" ${currentPage === 0 ? 'disabled' : ''}>← Previous</button><span>Page ${currentPage + 1} of ${pages}</span><button data-case-page="${currentPage + 1}" ${currentPage >= pages - 1 ? 'disabled' : ''}>Next →</button></div></section><section class="case-seasonal"><h3>Seasonal record counts</h3><p class="notice">${coverageNote(filters, meta)}</p>${table('By month', monthlyCounts(records))}</section>`;
}
