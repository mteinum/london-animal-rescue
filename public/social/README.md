# Social artwork

## Current illustrated posters

- `london-animal-rescue-v2.png` — 1734 × 907 (approximately 1.91:1), Open Graph / Twitter large-image preview.
- `london-animal-rescue-square-v2.png` — 1254 × 1254, square social post.

Created on 12 September 2026 with the built-in image-generation tool, with a new landscape composition followed by an image-guided square adaptation. The complete prompts are in [prompts.md](prompts.md). The actual output dimensions above are recorded in the page metadata; the tool did not return the exact dimensions requested in the prompts.

Art direction: a detailed British travel poster and archival dispatch-desk composition, with expressive animals, golden-hour Thames scenery, fire-engine red, cream paper and navy typography. The skyline is an editorial montage, not geographic evidence or a substitute for the application's accurate map. Animals are generic illustrated companions, not photographs of animals in the incident records. No incident, outcome or operational activity is represented. Both posters are labelled “Independent historical explorer • Illustration”.

Generation happened during development. These PNGs are committed and copied into `dist/social/` by Vite; the application and build have no image-generation dependency or runtime AI service. Prompts document the creative process but generation is not byte-for-byte reproducible. Versioned filenames allow sharing crawlers to distinguish these images from the earlier cards; platforms may still cache page metadata until they recrawl it.

## Earlier vector cards

- `london-animal-rescue.png` — 1200 × 630.
- `london-animal-rescue-square.png` — 1080 × 1080.

These original layouts are rendered from HTML/CSS by `scripts/create-social-art.mjs` with the project's CC0 animal/helmet SVGs and bundled SIL Open Font Licence fonts (Barlow Condensed and DM Sans). Original vector layout/artwork is CC0 1.0; font licence notices are in `public/licenses/`.

`npm run art:social` regenerates only these earlier vector cards with Playwright Chromium installed. It does not overwrite the current illustrated posters.

Page metadata is present in static HTML so crawlers do not need JavaScript. All previews describe the application, not a selected incident or its outcome.
