# Validation performed

Completed on 12 September 2026 with Node 22.22, strict TypeScript, Vite 7.3.6, MapLibre 6.9.0 and Playwright Chromium 1.63.0.

## Passed

- `npm run data:refresh`: discovered the current official download, recognised the XLSX signature despite the CSV label, downloaded it and generated the complete local snapshot. Final source SHA-256 matches the initially inspected workbook. Extraction caches ExcelJS column count once to avoid repeated full-sheet scans.
- `npm run data:normalize`: rebuilt the snapshot from the local workbook without downloading.
- `npm run map:refresh -- --local`: produced 92,932 base features, 33,724 building footprints and 538 place/landmark labels from the bounded OSM download. 16,868 footprints have height or floor-count information suitable for the extrusion layer.
- `npm run data:audit`: all 14,046 rounded easting/northing pairs end in 50; 6,398 unrounded BNG/WGS84 pairs cross-checked, median ~1.91 m / maximum ~3.05 m difference.
- `npm test`: 17 tests covering CSV quoting/BOM/newlines/schema errors, normalisation and missing values, duplicates, dates/leap days and unspecified offsets, geographic conversion and grid areas, AND/OR filters, timeline elapsed-time independence/clamping/end/reset/fading, notebook failure/versioning/deduplication, and URL round trips/validation.
- `npm run typecheck` and `npm run build`: passed. MapLibre is lazy loaded, including its separately bundled worker. Vite reports an informational warning about the map chunk size (~328 kB gzip main map chunk, plus worker); the application shell is ~13 kB gzip.
- `npm run test:browser -- tests/browser/app.spec.ts`: ten interaction scenarios passed across desktop (1512 × 982) and mobile (390 × 844), then two additional embedding-cleanup scenarios passed. Checks include map rendering; animal/search filters and empty counts; list searching and record selection; actual incident text; notebook save/reload/removal/confirmed clearing; missing saved IDs; clipboard denial and selectable links; play/pause/scrub; patterns and tables; conflicting deep links; keyboard selection; map asset failure; denied WebGL and localStorage; simulated hidden-document replay; reduced-motion animation suppression; and preservation of host classes on pending mount cleanup.
- `PRODUCTION_URL=http://127.0.0.1:4174/animal-rescue/ npm run test:browser -- tests/browser/production.spec.ts`: three scenarios passed: production subdirectory loading on desktop/mobile, plus clicking a visually identified rendered geographic cluster and opening one of its actual member records. The fixed-coordinate cluster click is intentionally skipped on mobile; mobile record and marker selection are covered separately. All production data, font, illustration and worker requests stayed on the local origin/path; no failed requests or page errors were observed in successful scenarios.
- `npm audit`: zero reported advisories after installing patched dependency versions/overrides.
- Desktop/mobile screenshots were inspected for map/Thames alignment, readability and layout. No horizontal document overflow was detected at the tested mobile width. See [desktop.png](desktop.png) and [mobile.png](mobile.png).

## Practical limits

- Browser checks used Chromium, including software WebGL; Safari/Firefox, real phones and assistive-technology user testing were not performed.
- Hidden-tab behaviour was tested by simulating the document visibility signal, not by leaving a physical device asleep.
- Building asset loading was checked and the extrusion layer uses real footprint/height metadata; individual heights and all map features have not been manually surveyed.
- Map failure and WebGL denial were intentionally injected; related errors are expected in those negative scenarios. Successful interaction scenarios had no page errors; the targeted asset check also monitored failed requests and console errors. Software renderer performance warnings are not application failures.
- The map base is intentionally bounded and relatively large (about 30 MB uncompressed plus 11 MB optional buildings). Slow-network and low-memory physical-device performance remain unmeasured. HTTP compression is recommended for hosting.
- Exact incident addresses, timezone/DST offsets and outcomes cannot be recovered from undocumented or redacted source fields. The interface and README retain these uncertainties.
- No deployment, publishing, accounts or external writes were performed.
