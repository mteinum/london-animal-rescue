import type { Incident, Filters, Metadata } from './types';
import { escape, count } from './ui';
import { monthlyCounts } from './case-files';
export function table(title: string, rows: [string, number][]): string {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return `<section class="pattern-card"><h3>${title}</h3><table><caption class="sr-only">${title}: attended incident counts</caption><thead><tr><th scope="col">${title === 'By month' ? 'Month' : 'Category'}</th><th scope="col">Incidents</th></tr></thead><tbody>${rows.map(([label, n]) => `<tr><th scope="row">${escape(label)}</th><td><span class="bar" style="--bar:${(n / max) * 100}%" aria-hidden="true"></span><span>${count(n)}</span></td></tr>`).join('')}</tbody></table></section>`;
}
export function patternsHTML(records: Incident[], filters: Filters, meta: Metadata): string {
  const group = (fn: (r: Incident) => string): [string, number][] => {
    const c = new Map<string, number>();
    records.forEach((r) => c.set(fn(r), (c.get(fn(r)) ?? 0) + 1));
    return [...c].sort((a, b) => b[1] - a[1]);
  };
  const monthCounts = monthlyCounts(records);
  const start = filters.from || meta.coverage.from.slice(0, 10),
    end = filters.to || meta.coverage.to.slice(0, 10);
  return `<div class="view-heading"><span class="eyebrow">THE BIGGER PICTURE</span><h2>Patterns in the callouts</h2><p>${count(records.length)} attended incidents · using your current filters.</p></div><div class="notice">Coverage: ${coverageNote(filters, meta)}</div><p class="muted">Each record is an attended incident, not an animal count or a rescue outcome. Higher counts do not establish greater danger.</p><div class="patterns-grid">${table(
    'By animal',
    group((r) => r.category),
  )}${table('By month', monthCounts)}${
    table(
      'By borough',
      group((r) => r.borough),
    ) +
    table(
      'By year',
      group((r) => r.date.slice(0, 4))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([year, n]) => [
          year + (start > year + '-01-01' || end < year + '-12-31' ? ' · partial year' : ''),
          n,
        ]),
    )
  }</div>`;
}

export function coverageNote(filters: Filters, meta: Metadata): string {
  const start = [filters.from, meta.coverage.from.slice(0, 10)].filter(Boolean).sort().at(-1)!;
  const end = [filters.to, meta.coverage.to.slice(0, 10)].filter(Boolean).sort()[0];
  if (start > end) return 'The selected period is outside snapshot coverage.';
  const partial = [...new Set([start.slice(0, 4), end.slice(0, 4)])].filter(
    (y) => start > `${y}-01-01` || end < `${y}-12-31`,
  );
  return `${escape(start)} – ${escape(end)}. Monthly counts aggregate the available dates${start.slice(0, 4) !== end.slice(0, 4) ? ' across multiple years' : ' in this year'}. ${partial.length ? `${partial.join(' and ')}: incomplete years for this period. ` : ''}Boundary months may be partial. These are counts, not seasonal rates or comparisons of equal exposure.`;
}
