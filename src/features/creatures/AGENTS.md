# Creatures Platform

## Purpose

`features.creatures` owns creature data, the canonical creature catalog root, the current public creature compatibility surface, and reusable creature UI consumed by other features and shell surfaces.

## Canonical Types and APIs

- `features.creatures.catalog.CatalogObject` — canonical creature catalog root for counts, filter options, search/list reads, and encounter-facing candidate loads.
- `features.creatures.api` — current public creature compatibility surface for reads and reusable creature UI. Preserve compatibility here, but do not treat `api/` as the default placement for new owner-local code.
- `features.creatures.parsing.ParsingObject` — creature-owned HTML/stat-block parsing seam for monster crawl and import flows.
- `CreatureBrowserPane`, `CreatureFilterPane` — reusable creature-owned browser surfaces.
- `StatBlockLoader`, `StatBlockRequest` — public stat-block loading seam.
- `features.creatures.ui.shared` — creature-owned reusable UI implementation behind the API surface.
- `shared/creatures/parser/ActionToHitParser` — shared parser seam reused by importer parsing and creature UI rendering.

## Where New Code Goes

- Put canonical creature catalog reads in `features.creatures.catalog`.
- Put creature search/filter UI and reusable creature widgets in `features.creatures`.
- Put creature-detail HTML extraction and monster stat-block parsing in `features.creatures.parsing`.
- Keep importer-adjacent creature helpers creature-owned unless they are truly shared-owned.
- Keep cross-feature DnD rule vocabulary in `shared/rules`, not in creature-owned model packages.
- Treat `features.creatures.service.DndMath` as a compatibility wrapper only; new cross-feature CR rule work belongs in `shared/rules/service`.
- Move UI to `ui/components` only when it is no longer creature-owned and is reused by unrelated features.
- Do not use legacy `api`, `application`, or `service` package names here as placement precedent for new touched architecture work.

## Forbidden Drift

- Do not import `features.creatures.ui.shared.*` or other creature internals directly from consuming features.
- Do not treat `features.creatures.api.CreatureCatalogService` as the canonical creature catalog root again.
- Do not move creature-owned UI into generic shared UI by default.
- Do not duplicate stat-block loading or attack-calculation seams outside the creature platform.
- Do not recreate creature stat-block parsing in `src/importer`.
