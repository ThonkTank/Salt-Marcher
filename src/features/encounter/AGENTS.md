# Encounter Feature

## Purpose

`features.encounter` owns one encounter workflow with builder and combat modes, live difficulty feedback, generation, and combat tracking.

## Canonical Types and APIs

- `EncounterViewCallbacks` — shell callback bundle passed into the encounter feature.
- `EncounterBuilderService` — request normalization and cross-feature enrichment before generation.
- `EncounterGenerator` — three-phase encounter generation algorithm.
- `EncounterConstraintPolicy` — canonical state, completion, and reachability policy seam for generation.
- `CombatTrackerPane` — combat runtime surface with stable keyboard behavior.

## Where New Code Goes

- Keep builder and combat as two modes of one encounter workflow.
- Keep direct calls into other feature APIs behind local ports and `internal/wiring` adapters.
- Preserve the existing shell callback bundle instead of replacing it with ad-hoc callback plumbing.
- Keep generator search structure staged: candidate selection, slot filling, then top-up.

## Forbidden Drift

- Do not leak builder-only controls into combat interaction.
- Do not collapse fallback selection, slot balancing, and filler heuristics into one opaque generator pass.
- Do not change grouped-mob runtime presentation into canonical persisted combat state.
- Do not silently repurpose `CombatTrackerPane` keyboard shortcuts.
