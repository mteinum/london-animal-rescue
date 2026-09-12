# Licensing scope and asset notices

The root [MIT License](LICENSE) applies to the project's application code and original documentation. It does not replace the separate licences below or relicense third-party material.

## London Fire Brigade incident data

The original download in `data/source/lfb-download.bin`, exported source CSV and derived incident snapshot in `public/data/` contain London Fire Brigade / London Datastore data under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

Contains public sector information licensed under the Open Government Licence v3.0. Preserve attribution and the licence link when redistributing the data. This project is independent and does not imply endorsement by London Fire Brigade or the Greater London Authority. Source, retrieval and transformation details are recorded in `public/data/provenance.json` and the README.

## OpenStreetMap database

The geographic database in `public/map/` is derived from © OpenStreetMap contributors and is distributed under the [Open Data Commons Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). It is not MIT-licensed. Preserve attribution and the applicable ODbL database-sharing obligations. Provenance is in `public/map/provenance.json`; the query and transformation are in `scripts/refresh-map.ts`.

Application screenshots in `docs/` include this map. Retain the visible OpenStreetMap attribution when sharing them.

## Bundled fonts

Barlow Condensed, DM Sans and Lora are supplied through Fontsource under the SIL Open Font Licence. Full notices are retained in:

- `public/licenses/Barlow-Condensed-OFL.txt`
- `public/licenses/DM-Sans-OFL.txt`
- `public/licenses/Lora-OFL.txt`

## Original illustrations and social artwork

The original animal/helmet SVG illustrations in `public/art/` and earlier vector social-card layouts are dedicated under CC0 1.0, as documented in their respective README files.

The newer `public/social/*-v2.png` posters were generated during development using the built-in image-generation tool. Their origin and prompts are documented in `public/social/README.md` and `public/social/prompts.md`. The project's MIT permission applies to any rights it holds in these generated posters; this does not assert exclusive copyright in AI-generated imagery or grant third-party rights. They are promotional illustrations, not photographs, geographic evidence or representations of actual incident animals.

## Software dependencies

Dependencies retain their respective licences. MapLibre GL JS is BSD-3-Clause; its notice is bundled at `public/licenses/MapLibre-BSD-3-Clause.txt`. Consult each installed package's licence and the versions recorded in `package-lock.json` for other dependencies. The root MIT licence does not replace dependency notices.
