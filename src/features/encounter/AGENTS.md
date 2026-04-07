# AGENTS.md

This file defines encounter-specific operating constraints for agents working under `src/features/encounter/`. Apply the root `AGENTS.md` first, then this file for feature-local architecture and behavior.

This file uses the root owner-slice architecture. Existing package families here describe current homes and stable feature seams, not permission to keep inventing new sibling structures.

## Scope

This file covers the encounter feature: encounter building, generation, difficulty feedback, and combat tracking behavior. Do not copy these rules back into the root `AGENTS.md`; feature-local behavior belongs here.

## Feature Architecture

Builder mode (`EncounterRosterPane`) and combat mode (`CombatTrackerPane`) are two states of one encounter workflow. Changes must preserve live difficulty feedback across both modes and keep the canonical encounter state coherent across the mode switch.

### Boundary Ownership

- Encounter builder and combat code should depend on local ports plus adapters in `internal/wiring`.
- Direct calls into other feature APIs belong in those adapters, not in encounter application or combat services.

### App Wiring

- `EncounterViewCallbacks` passes `shell::refreshToolbar`, `shell::refreshPanels`, `shell.getShowStatBlockHandler()`, and `shell.getSceneRegistry()` into the feature
- `PartyPopup.setOnPartyChanged(encounterView::refreshPartyState)` propagates party changes into encounter difficulty updates
- Filter data loads asynchronously on the `sm-filter-load` thread and is delivered through `encounterView.setFilterData()`
- `StatBlockPane` uses a 50-entry LRU cache backed by access-ordered `LinkedHashMap` on the FX thread

Treat this wiring as part of the encounter feature contract with the shell. Do not replace typed callback bundles with weaker ad-hoc parameter plumbing.

### Mode Rules

- `switchMode(COMBAT)` installs the scene-level `KEY_PRESSED` filter; `switchMode(BUILDER)` removes it
- `initialLoadDone` exists to prevent duplicate loading on a later `onShow()`; do not bypass or remove that guard without replacing the lifecycle protection
- Combat-mode UI changes must not leak builder-only controls into runtime combat interaction

### Controls

- `EncounterControls` is the left-panel control surface: `FilterPane` plus 4 `SliderControls` (Difficulty, Gruppen, Balance, Staerke)
- Slider default is Auto; checked Auto maps to `-1` for the generator contract
- In combat mode, the sliders are hidden rather than conditionally redefined as a second control model

### Generator Invariants

- `EncounterBuilderService` owns request normalization and cross-feature enrichment before calling the generator.
- Generator search policies stay pure/static and receive already-normalized requests plus resolved analysis data.
- `EncounterResultAssembler` is the single generator-internal factory for `GenerationResult` variants.
- Public generator entrypoints may accept a nullable `GenerationContext`, but they normalize it once before passing it deeper.
- `EncounterConstraintPolicy` exposes one public API per concept: state evaluation, completion checks, and reachability checks.

`EncounterGenerator` is a 3-phase algorithm:

1. Select one creature per shape spec with a 4-tier fallback filter
2. Fill slot counts via lowest-count greedy
3. Top up with filler/round-robin

Weighted selection uses coherence scoring:
- subtype match `+5`
- type match `+3`
- biome match `+2`
- role match `+2`
- same-ID penalty `-1`

When adjusting generator logic, preserve the staged search structure unless the user explicitly asks for an algorithmic redesign. Do not mix fallback selection, slot balancing, and filler heuristics into one opaque pass.

### Combat Tracker Invariants

- Runtime mob grouping is derived live from alive monsters sharing `(Creature-ID, initiative)` with threshold `>= 4`
- Canonical combat state remains individual monsters; grouped mobs are a runtime presentation, not a persisted or authoritative combat model
- Any optimization or refactor must preserve that ownership boundary

### Keyboard Contract

`CombatTrackerPane` keyboard shortcuts are user-facing behavior:
- `Space` / `Right` — next turn
- `Up` / `Down` — focus movement
- `F2` — HP edit
- `I` — initiative edit
- `Enter` — stat block
- `Delete` — remove
- `Ctrl+D` — duplicate

Do not silently repurpose these bindings. If a change needs a shortcut conflict resolution, make that tradeoff explicit in the code and in the final report.
