# Social artwork

Original London Animal Rescue layouts rendered from HTML/CSS by `scripts/create-social-art.mjs` with the project's CC0 animal/helmet SVGs and bundled SIL Open Font Licence fonts (Barlow Condensed and DM Sans). No stock photographs, external image services or representations of actual incident animals are used. Original layout/artwork is CC0 1.0; font licence notices are in `public/licenses/`.

- `london-animal-rescue.png` — 1200 × 630, Open Graph / Twitter large image and repository preview.
- `london-animal-rescue-square.png` — 1080 × 1080, manual social posts.

Run `npm run art:social` to regenerate both with Playwright Chromium installed. These files are committed and copied into `dist/social/` by Vite; generation is not part of ordinary builds. Page metadata is present in static HTML so crawlers do not need JavaScript. Previews describe the application, not a selected incident or its outcome.
