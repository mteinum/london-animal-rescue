import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import streetFontUrl from '@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2?url';
maplibregl.setWorkerUrl(workerUrl);
import { type GeoJSONSource, type Map as LibreMap } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { Incident } from './types';
import { gridArea } from './geo';
import { animalArt, asset } from './ui';
export interface RescueMap {
  update(records: Incident[], cursor: number, recent: boolean): void;
  select(record: Incident | null, move?: boolean): void;
  resize(): void;
  reset(): void;
  destroy(): void;
}
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
function textImage(text: string, cluster = false): ImageData {
  const canvas = document.createElement('canvas');
  const size = cluster ? 96 : Math.max(100, text.length * 17 + 30);
  canvas.width = size;
  canvas.height = cluster ? 96 : 58;
  const c = canvas.getContext('2d')!;
  if (cluster) {
    c.beginPath();
    c.arc(48, 48, 40, 0, Math.PI * 2);
    c.fillStyle = '#f9f4e7';
    c.fill();
    c.strokeStyle = '#ac5149';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#a93431';
    c.font = 'bold 29px sans-serif';
    c.textAlign = 'center';
    c.fillText(text, 48, 59);
  } else {
    c.font = '600 24px sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 6;
    c.strokeStyle = '#f5f1e5';
    c.strokeText(text, size / 2, 37);
    c.fillStyle = '#465d59';
    c.fillText(text, size / 2, 37);
  }
  return c.getImageData(0, 0, canvas.width, canvas.height);
}
export async function createMap(
  container: HTMLElement,
  onSelect: (id: string) => void,
  onCluster: (ids: string[]) => void,
  onError: (message: string) => void,
  signal: AbortSignal,
): Promise<RescueMap> {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let map: LibreMap;
  try {
    map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        'font-faces': { 'Rescue Street': streetFontUrl },
        sources: {},
        layers: [{ id: 'paper', type: 'background', paint: { 'background-color': '#ece8d9' } }],
      },
      center: [-0.12, 51.509],
      zoom: 12.9,
      pitch: 48,
      bearing: -12,
      minZoom: 9,
      maxZoom: 17,
      maxBounds: [
        [-0.65, 51.2],
        [0.48, 51.8],
      ],
      attributionControl: false,
      renderWorldCopies: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
  } catch {
    throw new Error('WebGL is unavailable. Explore every record in the incident list.');
  }
  let destroyed = false,
    loaded = false,
    buildingsLoaded = false;
  let pending: Incident[] = [];
  let selected: Incident | null = null;
  let cursor = 0,
    recent = false;
  let selectedMarker: maplibregl.Marker | null = null;
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;
  const fail = () => {
    if (!destroyed)
      onError('Some map assets could not load. The full incident list remains available.');
  };
  map.on('error', fail);
  map.on('movestart', () => {
    container.dataset.ready = 'false';
  });
  map.on('idle', () => {
    if (loaded && !destroyed) container.dataset.ready = 'true';
  });
  map
    .getCanvas()
    .setAttribute(
      'aria-label',
      'London incident map. Use arrow keys to pan, plus and minus to zoom. Use the incident list to select records.',
    );
  map.getCanvas().addEventListener('webglcontextlost', fail, { signal });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  map.on('styleimagemissing', (e) => {
    if (e.id.startsWith('count-') && !map.hasImage(e.id))
      map.addImage(e.id, textImage(e.id.slice(6), true), { pixelRatio: 2 });
  });
  const source = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
  const apply = () => {
    if (!loaded || destroyed) return;
    const data: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: pending
        .filter((r) => r.location)
        .map((r) => ({
          type: 'Feature',
          id: r.id,
          properties: {
            id: r.id,
            icon: animalArt(r.category),
            clock: r.clock,
            old: recent && r.clock < cursor - 30 * 86400000,
          },
          geometry: { type: 'Point', coordinates: r.location!.coordinates },
        })),
    };
    container.dataset.ready = 'false';
    source('incidents')?.setData(data);
    map.setPaintProperty(
      'clusters',
      'icon-opacity',
      recent ? ['case', ['<', ['get', 'latest'], cursor - 30 * 86400000], 0.25, 1] : 1,
    );
    map.once('idle', () => {
      if (!destroyed) container.dataset.ready = 'true';
    });
  };
  const choose = (r: Incident | null, move = true) => {
    selected = r;
    selectedMarker?.remove();
    selectedMarker = null;
    if (!loaded || destroyed) return;
    source('selected-area')?.setData(
      r?.location ? { type: 'FeatureCollection', features: [gridArea(r.location)] } : empty,
    );
    if (!r?.location) return;
    const button = document.createElement('button');
    button.className = 'selected-marker';
    button.title = `Selected ${r.animal} incident ${r.id}`;
    button.setAttribute('aria-label', button.title);
    const img = document.createElement('img');
    img.src = asset(`art/${animalArt(r.category)}.svg`);
    img.alt = '';
    button.append(img);
    button.addEventListener('click', () => onSelect(r.id));
    selectedMarker = new maplibregl.Marker({ element: button, anchor: 'bottom' })
      .setLngLat(r.location.coordinates)
      .addTo(map);
    if (!reduced()) {
      button.classList.add('pulse');
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => button.classList.remove('pulse'), 1600);
    }
    const p = map.project(r.location.coordinates);
    const rect = container.getBoundingClientRect();
    if (move && (p.x < 90 || p.x > rect.width - 80 || p.y < 100 || p.y > rect.height - 190))
      map.easeTo({ center: r.location.coordinates, duration: reduced() ? 0 : 550 });
  };
  const ready = new Promise<void>((resolve, reject) => {
    map.once('load', () => resolve());
    signal.addEventListener(
      'abort',
      () => {
        if (!destroyed) {
          destroyed = true;
          map.remove();
        }
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
  try {
    const [, baseResponse, labelsResponse] = await Promise.all([
      ready,
      fetch(asset('map/base.geojson'), { signal }),
      fetch(asset('map/labels.geojson'), { signal }),
    ]);
    if (!baseResponse.ok || !labelsResponse.ok) throw new Error('Map files unavailable');
    const [base, labels] = (await Promise.all([baseResponse.json(), labelsResponse.json()])) as [
      FeatureCollection,
      FeatureCollection,
    ];
    if (destroyed) throw new Error('Map closed');
    for (const [i, f] of labels.features.entries()) {
      const key = `label-${i}`;
      map.addImage(key, textImage(String(f.properties?.name)), { pixelRatio: 2 });
      f.properties = { ...f.properties, icon: key };
    }
    for (const kind of ['cat', 'dog', 'bird', 'fox', 'paw']) {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = asset(`art/${kind}.svg`);
      });
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      map.addImage(kind, ctx.getImageData(0, 0, 128, 128), { pixelRatio: 2 });
    }
    map.addSource('base', { type: 'geojson', data: base });
    map.addSource('labels', { type: 'geojson', data: labels });
    map.addLayer({
      id: 'parks',
      source: 'base',
      type: 'fill',
      filter: ['==', 'kind', 'park'],
      paint: { 'fill-color': '#bccda2', 'fill-opacity': 0.8 },
    });
    map.addLayer({
      id: 'water',
      source: 'base',
      type: 'fill',
      filter: ['==', 'kind', 'water'],
      paint: { 'fill-color': '#93c5d2' },
    });
    map.addLayer({
      id: 'water-edge',
      source: 'base',
      type: 'line',
      filter: ['==', 'kind', 'water'],
      paint: { 'line-color': '#80b5c5', 'line-width': 1 },
    });
    map.addLayer({
      id: 'road-casing',
      source: 'base',
      type: 'line',
      filter: ['==', 'kind', 'road'],
      paint: {
        'line-color': '#d1c7af',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 5, 17, 15],
      },
    });
    map.addLayer({
      id: 'roads',
      source: 'base',
      type: 'line',
      filter: ['==', 'kind', 'road'],
      paint: {
        'line-color': '#fff9e9',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 14, 3, 17, 12],
      },
    });
    // Use the recorded OSM names on their actual road lines. Smaller streets
    // appear only at closer zooms; symbol collision handling keeps names apart.
    for (const major of [true, false]) {
      map.addLayer({
        id: major ? 'major-street-labels' : 'local-street-labels',
        source: 'base',
        type: 'symbol',
        minzoom: major ? 12 : 14,
        filter: [
          'all',
          ['==', ['get', 'kind'], 'road'],
          ['==', ['geometry-type'], 'LineString'],
          ['!=', ['get', 'name'], ''],
          [
            'match',
            ['get', 'road'],
            ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
            major,
            !major,
          ],
        ],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': major ? 350 : 250,
          'text-field': ['get', 'name'],
          'text-font': ['Rescue Street'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            major ? 11 : 10,
            17,
            major ? 15 : 13,
          ],
          'text-padding': 5,
          'text-max-angle': 30,
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'viewport',
          'text-keep-upright': true,
        },
        paint: {
          'text-color': '#40545b',
          'text-halo-color': '#fff9e9',
          'text-halo-width': 1.5,
          'text-halo-blur': 0.4,
        },
      });
    }
    map.addLayer({
      id: 'place-labels',
      source: 'labels',
      type: 'symbol',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.65, 14, 0.85],
        'icon-padding': 12,
        'symbol-sort-key': ['case', ['==', ['get', 'kind'], 'landmark'], 0, 1],
      },
    });
    map.addSource('incidents', {
      type: 'geojson',
      data: empty,
      cluster: true,
      clusterRadius: 65,
      clusterMaxZoom: 17,
      clusterProperties: { latest: ['max', ['get', 'clock']] },
    });
    map.addLayer({
      id: 'clusters',
      source: 'incidents',
      type: 'symbol',
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': ['concat', 'count-', ['to-string', ['get', 'point_count']]],
        'icon-allow-overlap': true,
        'icon-size': 0.95,
      },
    });
    map.addLayer({
      id: 'animals',
      source: 'incidents',
      type: 'symbol',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 0.7,
        'icon-allow-overlap': false,
        'icon-padding': 3,
      },
      paint: { 'icon-opacity': ['case', ['get', 'old'], 0.25, 1] },
    });
    map.addSource('call-pulses', { type: 'geojson', data: empty });
    map.addLayer({
      id: 'call-pulses',
      source: 'call-pulses',
      type: 'circle',
      paint: {
        'circle-color': '#b82d2b',
        'circle-radius': 8,
        'circle-opacity': 0.3,
        'circle-radius-transition': { duration: 1200 },
        'circle-opacity-transition': { duration: 1200 },
      },
    });
    map.addSource('selected-area', { type: 'geojson', data: empty });
    map.addLayer({
      id: 'selected-area-fill',
      source: 'selected-area',
      type: 'fill',
      paint: { 'fill-color': '#be302e', 'fill-opacity': 0.17 },
    });
    map.addLayer({
      id: 'selected-area-line',
      source: 'selected-area',
      type: 'line',
      paint: { 'line-color': '#b82d2b', 'line-width': 2, 'line-dasharray': [2, 2] },
    });
    map.on('click', 'animals', (e) => {
      const id = e.features?.[0]?.properties.id;
      if (id) onSelect(String(id));
    });
    map.on('click', 'clusters', async (e) => {
      try {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== 'Point') return;
        const s = source('incidents')!;
        const leaves = await s.getClusterLeaves(
          f.properties.cluster_id,
          f.properties.point_count,
          0,
        );
        if (destroyed) return;
        onCluster(leaves.map((l) => String(l.properties?.id)));
        const zoom = await s.getClusterExpansionZoom(f.properties.cluster_id);
        if (destroyed) return;
        map.easeTo({
          center: f.geometry.coordinates as [number, number],
          zoom: Math.min(zoom, 17),
          duration: reduced() ? 0 : 450,
        });
      } catch {
        if (!destroyed)
          onError('This cluster changed during replay. Pause and try again, or use the list.');
      }
    });
    for (const layer of ['animals', 'clusters']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    loaded = true;
    apply();
    choose(selected, false);
    const addBuildings = async () => {
      if (buildingsLoaded || map.getZoom() < 12.5 || destroyed) return;
      buildingsLoaded = true;
      try {
        const res = await fetch(asset('map/buildings.geojson'), { signal });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as FeatureCollection;
        if (destroyed) return;
        map.addSource('buildings', { type: 'geojson', data });
        map.addLayer(
          {
            id: 'buildings-flat',
            source: 'buildings',
            type: 'fill',
            paint: { 'fill-color': '#d8cdb7', 'fill-outline-color': '#c2b39a' },
          },
          'major-street-labels',
        );
        map.addLayer(
          {
            id: 'buildings-3d',
            source: 'buildings',
            type: 'fill-extrusion',
            minzoom: 13,
            filter: ['>', 'height', 0],
            paint: {
              'fill-extrusion-color': '#cdbda1',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-opacity': 0.8,
            },
          },
          'major-street-labels',
        );
      } catch {
        if (!signal.aborted)
          onError('Building detail unavailable. The base map and records remain usable.');
      }
    };
    map.on('zoomend', () => void addBuildings());
    void addBuildings();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Map rendering timed out')), 30000);
      const done = () => {
        clearTimeout(timeout);
        resolve();
      };
      if (map.loaded()) done();
      else map.once('idle', done);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  } catch (error) {
    if (!destroyed) {
      destroyed = true;
      map.remove();
    }
    throw error;
  }
  return {
    update(records, c, r) {
      const fresh =
        pending.length && c > cursor
          ? records.filter((event) => event.clock > cursor && event.location).slice(-8)
          : [];
      pending = records;
      cursor = c;
      recent = r;
      apply();
      if (fresh.length && !reduced()) {
        source('call-pulses')?.setData({
          type: 'FeatureCollection',
          features: fresh.map((event) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: event.location!.coordinates },
          })),
        });
        map.setPaintProperty('call-pulses', 'circle-radius', 24);
        map.setPaintProperty('call-pulses', 'circle-opacity', 0.05);
        clearTimeout(pulseTimer);
        pulseTimer = setTimeout(() => {
          if (!destroyed) {
            source('call-pulses')?.setData(empty);
            map.setPaintProperty('call-pulses', 'circle-radius', 8);
            map.setPaintProperty('call-pulses', 'circle-opacity', 0.3);
          }
        }, 1300);
      }
    },
    select: choose,
    resize() {
      if (!destroyed) map.resize();
    },
    reset() {
      map.easeTo({
        center: [-0.12, 51.509],
        zoom: 12.9,
        pitch: 48,
        bearing: -12,
        duration: reduced() ? 0 : 450,
      });
    },
    destroy() {
      clearTimeout(pulseTimer);
      selectedMarker?.remove();
      if (!destroyed) {
        destroyed = true;
        map.remove();
      }
    },
  };
}
