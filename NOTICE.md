# Third-party notices

## Atlas MapLibre/deck.gl runtime

The replacement Atlas runtime includes MapLibre GL JS 6.15.0 (BSD-3-Clause),
deck.gl core/layers/mesh-layers/maplibre 9.4.0 (MIT), and math.gl core 4.1.0 (MIT).
Desktop builds include their shipped license texts and those of their installed
runtime dependencies under `licenses/atlas/`, with package names and versions
in `manifest.json`. Worker scripts and styles are bundled locally.

## Three.js

The spatial vegetation renderer includes Three.js 0.186.1, copyright
2010–2026 Three.js Authors, under the MIT license. The complete license is
included in desktop builds at `licenses/three-LICENSE.txt`.

## Dungeons & Dragons System Reference Document 5.1

This work includes material taken from the
[System Reference Document 5.1](https://dnd.wizards.com/resources/systems-reference-document)
by Wizards of the Coast LLC and available under the
[Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/).

The included creature catalog was normalized by
[`5e-bits/5e-database` v5.10.0](https://github.com/5e-bits/5e-database/tree/v5.10.0),
then enriched with biome assignments and stable IDs by SaltMarcher. The
resulting SaltMarcher artifact was copied into this plugin without further data
changes. Its upstream commit, archive hash, source hash, source document,
license and attribution are pinned in the catalog manifest. The copied JSON
artifact is independently guarded by SHA-256
`afdce83b65e0863e1247c6297f89460396fe8ce4fd6893139ae3284e8451073d`.

## Geographic comparison catalog

Natural Earth administrative map units, German states, physical islands and
continents: public domain, revision
`ca96624a56bd078437bca8184e78163e5039ad19` of
https://github.com/nvkelso/natural-earth-vector .

City boundaries (except Tokyo) and Rügen/Sylt: © OpenStreetMap contributors,
https://www.openstreetmap.org/copyright , available under the Open Database
License (ODbL), https://opendatacommons.org/licenses/odbl/1-0/ .
The derived bounding coordinates, source links and rounded dimensions are
provided in `src/app/atlas-reference-catalog.ts`, retrieved 2026-10-18. The
OSM-derived subset remains available under ODbL. Natural Earth data retains
its public-domain status. Dimensions are approximate geographic extents,
not land areas; separate overseas map units remain separate comparisons.
