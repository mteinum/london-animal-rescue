import { readFile, writeFile } from 'node:fs/promises';
import { parseCSV, number } from './normalize';
import { gridToWgs84 } from '../src/geo';
const rows = parseCSV(await readFile('public/data/source.csv', 'utf8'));
const east: Record<string, number> = {},
  north: Record<string, number> = {},
  errors: number[] = [];
for (const row of rows) {
  for (const [key, counter] of [
    ['Easting_rounded', east],
    ['Northing_rounded', north],
  ] as const) {
    const v = number(row[key]);
    if (v !== null) counter[v % 100] = (counter[v % 100] ?? 0) + 1;
  }
  const e = number(row.Easting_m),
    n = number(row.Northing_m),
    lat = Number(row.Latitude),
    lon = Number(row.Longitude);
  if (
    e === null ||
    n === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 50 ||
    lat > 53
  )
    continue;
  const point = gridToWgs84(e, n);
  errors.push(Math.hypot((point[0] - lon) * 69000, (point[1] - lat) * 111000));
}
errors.sort((a, b) => a - b);
const audit = {
  comparedPairs: errors.length,
  maxMetres: errors.at(-1),
  medianMetres: errors[Math.floor(errors.length / 2)],
  eastingRemainders: east,
  northingRemainders: north,
  note: 'Approximate horizontal error in metres against supplied latitude/longitude. CRS is inferred from source column names and paired values; not explicitly documented on animal dataset page.',
};
await writeFile('data/source/coordinate-audit.json', JSON.stringify(audit, null, 2));
console.log(audit);
