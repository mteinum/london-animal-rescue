import proj4 from 'proj4';
import type { Incident } from './types';
export const BNG =
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.1502,0.2470,0.8421,-20.4894 +units=m +no_defs';
export function gridToWgs84(easting: number, northing: number): [number, number] {
  return proj4(BNG, 'EPSG:4326', [easting, northing]) as [number, number];
}
export function classifyLocation(
  easting: number | null,
  northing: number | null,
): Incident['location'] {
  if (
    easting === null ||
    northing === null ||
    !Number.isFinite(easting) ||
    !Number.isFinite(northing) ||
    easting < 450000 ||
    easting > 600000 ||
    northing < 100000 ||
    northing > 250000
  )
    return null;
  const coordinates = gridToWgs84(easting, northing);
  return { coordinates, precision: 'rounded-grid', easting, northing };
}
export function gridArea(
  location: NonNullable<Incident['location']>,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const { easting: e, northing: n } = location;
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [e - 50, n - 50],
          [e + 50, n - 50],
          [e + 50, n + 50],
          [e - 50, n + 50],
          [e - 50, n - 50],
        ].map(([x, y]) => gridToWgs84(x, y)),
      ],
    },
  };
}
