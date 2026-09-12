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

Street-label update: desktop and mobile Chromium were checked at overview and closer zooms. After waiting for the map to settle, screenshots confirmed road-aligned labels including Waterloo Bridge, Strand, Drury Lane, Bankside and Union Street. No page errors, console errors or failed requests were observed in these checks. See [streets-desktop.png](streets-desktop.png) and [streets-mobile.png](streets-mobile.png).

## Analytics update

- `npm test`: 22 tests passed, including consent validation, expiry and storage failures.
- `tests/browser/analytics.spec.ts`: eight desktop/mobile scenarios passed with Google requests stubbed. Verified no request before consent, persistent rejection/acceptance, one configured page view, URL query/fragment exclusion, withdrawal, app-scoped cookie removal, unrelated-cookie preservation, cleanup, blocked script/storage handling, keyboard focus and other-tab withdrawal.
- Production build and strict TypeScript checking passed. Production-path browser checks passed on desktop/mobile for consent, scoped cookie configuration, map/assets and deep links; the desktop cluster-selection check also passed. The existing fixed-coordinate mobile cluster check remains intentionally skipped.
- Desktop and mobile production consent screenshots were visually checked: [desktop](analytics-consent-desktop.png), [mobile](analytics-consent-mobile.png). Google requests were intercepted during all consent-positive browser tests; live Google Analytics report ingestion was not checked.

## Practical limits

- Browser checks used Chromium, including software WebGL; Safari/Firefox, real phones and assistive-technology user testing were not performed.
- Hidden-tab behaviour was tested by simulating the document visibility signal, not by leaving a physical device asleep.
- Building asset loading was checked and the extrusion layer uses real footprint/height metadata; individual heights and all map features have not been manually surveyed.
- Map failure and WebGL denial were intentionally injected; related errors are expected in those negative scenarios. Successful interaction scenarios had no page errors; the targeted asset check also monitored failed requests and console errors. Software renderer performance warnings are not application failures.
- The map base is intentionally bounded and relatively large (about 30 MB uncompressed plus 11 MB optional buildings). Slow-network and low-memory physical-device performance remain unmeasured. HTTP compression is recommended for hosting.
- Exact incident addresses, timezone/DST offsets and outcomes cannot be recovered from undocumented or redacted source fields. The interface and README retain these uncertainties.
- The original application validation preceded publication. Deployment checks are recorded below separately.

## Deployment checks

- `bash -n scripts/deploy-cpanel.sh` and the production build with `BASE_PATH=/london-animal-rescue/` passed.
- `npm test`: all 20 tests passed, including three deployment tests for input validation, incorrect asset base rejection, encrypted-key loading, assets-before-index upload order and cleanup. Remote SSH/rsync calls are stubbed; the tests do not publish anything. The agent test requires permission to create a local SSH-agent socket.
- Desktop and mobile production-path browser checks passed at `http://127.0.0.1:4174/london-animal-rescue/`, including map readiness, worker/assets, incident deep links and list search, with no failed requests or page errors.

## Situation filters and animal case files

Validated locally on 12 September 2026. No push or deployment was performed for this change.

- `npm run data:normalize` rebuilt the normalized snapshot from the existing local official workbook without an upstream request. All four classification fields are preserved. The snapshot audit checks every normalized record against the local CSV, plus metadata totals: 14,046 incidents; rescue categories 6,537 other assistance, 5,645 height, 1,294 below ground and 570 water; Cat/cat 7,435.
- `npm test`: **34 tests passed**. New focused coverage includes original classifications, missing/unexpected categories, case-insensitive animal grouping and distinct birds, legacy v1 snapshot loading, parent/child reconciliation, AND/OR semantics, unknown buckets, percentage denominators, monthly/filter/timeline agreement, URL round trips and old incident links, redacted descriptions, and the actual church/ditch record.
- `npm run typecheck` and `BASE_PATH=/london-animal-rescue/ npm run build` passed. The existing informational large MapLibre chunk warning remains; the application shell is approximately 19 kB gzip.
- The final combined browser suite completed with **33 passed, 1 intentionally skipped**. Command: `TEST_URL=http://127.0.0.1:5175 PRODUCTION_URL=http://127.0.0.1:4176/london-animal-rescue/ npm run test:browser`. Development and production preview servers were local only.
- Desktop (1512 × 982) and mobile (390 × 844) checked folder search, opening/switching animals, current/entire-file counts, situation counts and percentages, selectors and dependent options, removing chips, empty states, map/list/Patterns counts, playback and scrubbing, notebook save/removal/reload, record classification shortcuts, old incident links, conflicting/invalid links, and Back/Forward restoration. Keyboard Enter opens folders and records; heading and bookmark focus were checked.
- Production case links retained their base path and classifications through navigation and history. Existing production tests also checked local map, worker, artwork and fonts. Successful monitored scenarios reported no page errors or failed assets. Failure tests deliberately aborted map assets, blocked WebGL/storage and denied clipboard access; the record explorer remained available.
- Existing analytics checks passed, including blocked scripts/storage, consent persistence and withdrawal. Google requests were stubbed. The narrow 320 × 640 consent test caught a navigation overflow regression; reducing mobile navigation spacing fixed it. Opening filters now closes the mobile incident sheet, preventing overlapping sheets after a deep link.
- The existing fixed-position mobile canvas-cluster click remains skipped; the desktop geographic cluster selection passed. Safari/Firefox, physical mobile devices and screen-reader user testing remain unperformed.
- Desktop and mobile screenshots were visually reviewed for folder presentation, readable tables, navigation, scrolling and overflow: [desktop case file](case-file-desktop.png), [mobile directory](case-files-mobile.png). Existing [desktop](desktop.png) and [mobile](mobile.png) explorer screenshots were refreshed by the regression suite. The original map geography and assets were reused.
