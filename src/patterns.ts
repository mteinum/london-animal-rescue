import type { Incident, Filters, Metadata } from './types';
import { escape, count } from './ui';
function table(title: string, rows: [string, number][]): string {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return `<section class="pattern-card"><h3>${title}</h3><table><caption class="sr-only">${title}: attended incident counts</caption><thead><tr><th scope="col">${title === 'By month' ? 'Month' : 'Category'}</th><th scope="col">Incidents</th></tr></thead><tbody>${rows.map(([label, n]) => `<tr><th scope="row">${escape(label)}</th><td><span class="bar" style="--bar:${(n / max) * 100}%" aria-hidden="true"></span><span>${count(n)}</span></td></tr>`).join('')}</tbody></table></section>`;
}
export function patternsHTML(records: Incident[], filters: Filters, meta: Metadata): string {
  const group = (fn: (r: Incident) => string): [string, number][] => {
    const c = new Map<string, number>();
    records.forEach((r) => c.set(fn(r), (c.get(fn(r)) ?? 0) + 1));
    return [...c].sort((a, b) => b[1] - a[1]);
  };
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthCounts = months.map(
    (label, i) =>
      [label, records.filter((r) => Number(r.date.slice(5, 7)) === i + 1).length] as [
        string,
        number,
      ],
  );
  const start = filters.from || meta.coverage.from.slice(0, 10),
    end = filters.to || meta.coverage.to.slice(0, 10);
  return `<div class="view-heading"><span class="eyebrow">THE BIGGER PICTURE</span><h2>Patterns in the callouts</h2><p>${count(records.length)} attended incidents · using your current filters.</p></div><div class="notice">Coverage: ${escape(start)} – ${escape(end)}. Boundary months may be partial; ${meta.coverage.to.slice(0, 4)} is an incomplete year. Monthly totals pool years with unequal coverage and are not rates.</div><p class="muted">Each record is an attended incident, not an animal count or a rescue outcome. Higher counts do not establish greater danger.</p><div class="patterns-grid">${table(
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
