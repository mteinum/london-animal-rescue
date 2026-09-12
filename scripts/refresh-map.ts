import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import osmtogeojson from 'osmtogeojson';
import type { FeatureCollection, Feature, Geometry, Position } from 'geojson';
await mkdir('public/map', { recursive: true });
if (!process.argv.includes('--local'))
  execFileSync('curl', [
    '-fLSs',
    '--max-time',
    '240',
    '--data-urlencode',
    'data@scripts/london.overpass',
    'https://overpass-api.de/api/interpreter',
    '-o',
    'data/source/london-osm.json',
  ]);
const input = JSON.parse(await readFile('data/source/london-osm.json', 'utf8'));
if (input.remark) throw new Error(input.remark);
const geo = osmtogeojson(input, { flatProperties: true }) as FeatureCollection;
const base: Feature[] = [];
const buildings: Feature[] = [];
const labels: Feature[] = [];
for (const f of geo.features) {
  const p = f.properties ?? {};
  const polygon = /Polygon/.test(f.geometry.type);
  let kind = '';
  if (p.natural === 'water' || p.waterway === 'riverbank') kind = 'water';
  else if (p.leisure === 'park') kind = 'park';
  else if (p.highway) kind = 'road';
  else if (p.building && polygon) kind = 'building';
  if (kind) {
    const height = Number.parseFloat(p.height);
    const levels = Number(p['building:levels']);
    f.properties = {
      kind,
      name: p.name ?? '',
      road: p.highway ?? '',
      height:
        Number.isFinite(height) && height > 0
          ? Math.min(height, 400)
          : levels > 0
            ? Math.min(levels * 3, 400)
            : 0,
    };
    (kind === 'building' ? buildings : base).push(f);
  }
  if (p.place && p.name && f.geometry.type === 'Point')
    labels.push({
      type: 'Feature',
      properties: { name: p.name, kind: 'place' },
      geometry: f.geometry,
    });
  if (
    p.tourism === 'attraction' &&
    p.name &&
    [
      'Big Ben',
      'London Eye',
      'Tower Bridge',
      'Tower of London',
      'St Paul’s Cathedral',
      'Buckingham Palace',
      'The Shard',
    ].includes(p.name)
  ) {
    const coords =
      f.geometry.type === 'Point'
        ? f.geometry.coordinates
        : (f.geometry as GeoJSON.Polygon).coordinates?.[0]?.[0];
    if (Array.isArray(coords) && typeof coords[0] === 'number')
      labels.push({
        type: 'Feature',
        properties: { name: p.name, kind: 'landmark' },
        geometry: { type: 'Point', coordinates: coords as Position },
      });
  }
}
// Round to ~1 m; geometry remains OSM-derived.
function roundGeometry(g: Geometry): Geometry {
  return JSON.parse(
    JSON.stringify(g, (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v)),
  ) as Geometry;
}
for (const [name, features] of [
  ['base', base],
  ['buildings', buildings],
  ['labels', labels],
] as const) {
  const collection = {
    type: 'FeatureCollection',
    features: features.map((f) => ({ ...f, geometry: roundGeometry(f.geometry) })),
  };
  await writeFile(`public/map/${name}.geojson`, JSON.stringify(collection));
  console.log(name, features.length);
}
await writeFile(
  'public/map/provenance.json',
  JSON.stringify(
    {
      source: 'https://overpass-api.de/api/interpreter',
      osmTimestamp: input.osm3s.timestamp_osm_base,
      retrieved: (await stat('data/source/london-osm.json')).mtime.toISOString(),
      license: 'ODbL 1.0',
      attribution: '© OpenStreetMap contributors',
      bounds: [-0.53, 51.28, 0.34, 51.71],
      buildingsBounds: [-0.17, 51.49, -0.07, 51.53],
      note: 'Roads, water, parks and places across London; local roads and buildings in central London only. Extrusions use OSM height or building:levels × 3 m, an explicit estimate; unknown heights are flat. Coordinates rounded to 5 decimals. Current cartography is not historical.',
    },
    null,
    2,
  ),
);
