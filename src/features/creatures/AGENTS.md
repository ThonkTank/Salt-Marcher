# Creatures Platform

## Purpose

`features.creatures` owns creature data, the current public creature compatibility surface, and reusable creature UI consumed by other features and shell surfaces.

## Canonical Types and APIs

- `features.creatures.api` — current public creature compatibility surface for reads and reusable creature UI. Keep cross-feature access here, but do not treat `api/` as the default placement for new owner-local code.
- `CreatureBrowserPane`, `CreatureFilterPane` — reusable creature-owned browser surfaces.
- `StatBlockLoader`, `StatBlockRequest` — public stat-block loading seam.
- `features.creatures.ui.shared` — creature-owned reusable UI implementation behind the API surface.
- `shared/creatures/parser/ActionToHitParser` — shared parser seam reused by importer parsing and creature UI rendering.

## Where New Code Goes

- Put creature search, filtering, detail reads, and reusable creature widgets in `features.creatures`.
- Keep importer-adjacent creature helpers creature-owned unless they are truly shared-owned.
- Keep cross-feature DnD rule vocabulary in `shared/rules`, not in creature-owned model packages.
- Move UI to `ui/components` only when it is no longer creature-owned and is reused by unrelated features.
- Do not use legacy `api`, `application`, or `service` package names here as placement precedent for new touched architecture work.

## Forbidden Drift

- Do not import `features.creatures.ui.shared.*` or other creature internals directly from consuming features.
- Do not move creature-owned UI into generic shared UI by default.
- Do not duplicate stat-block loading or attack-calculation seams outside the creature platform.
