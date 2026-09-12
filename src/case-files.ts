import type { Incident } from './types';
import { classificationValue, type Classification } from './classifications';
export interface Breakdown {
  value: string;
  count: number;
  percentage: number;
}
export function breakdown(
  records: Incident[],
  field: Classification,
  options: string[] = [],
): Breakdown[] {
  const counts = new Map(options.map((v) => [v, 0]));
  for (const r of records) {
    const v = classificationValue(r[field]);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({
      value,
      count,
      percentage: records.length ? (count / records.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
export function monthlyCounts(records: Incident[]): [string, number][] {
  const counts = Array<number>(12).fill(0);
  for (const r of records) counts[Number(r.date.slice(5, 7)) - 1]++;
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
    (m, i) => [m, counts[i]],
  );
}
export function caseCoverage(records: Incident[]): string {
  if (!records.length) return 'No recorded dates in the current matches';
  return `${records[0].date.slice(0, 10)} – ${records.at(-1)!.date.slice(0, 10)}`;
}
