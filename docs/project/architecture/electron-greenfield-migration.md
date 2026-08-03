# Electron greenfield migration

## Status

**Current milestone: M1 — qualification in progress.** M0 is complete. The
retired implementation is preserved by tag `javafx-final-2026-07-27` and the
`stable` branch at the same final JavaFX commit. The
secure Electron shell, utility-process SQLite
campaign skeleton, and Pixi/Babylon prototypes are present. Typecheck, lint,
unit/integration tests, build, headless Electron smoke test, and Linux AppImage
packaging pass locally. The project has a WebdriverIO Electron journey and
axe-core is part of the target test stack; CI runs native packaging on all
three target systems plus the Linux E2E gate. Remaining M1 acceptance evidence
is the measured RP-H p95,
context-loss, 200%-scale, screen-reader, and axe matrix recorded in
`m1-render-qualification.md`.

## Decisions

- Rebuild in the same repository; do not mechanically translate Java code.
- Product specifications, acceptance cases, load profiles, static catalogs,
  reference tables, and Golden Masters are retained. Java source is behavior
  reference only.
- There is no parallel operation, old-development-data opening requirement, or
  SQLite conversion path.
- Each capability arrives as a vertical product slice.

## Roadmap

### M0 — target foundation

Preserve the retired baseline by tag, document this target architecture and
roadmap, retire source-specific architecture, make issue evidence
product-neutral, close superseded Java PRs after retaining their visible
requirements, and add this contributor guide.

### M1 — qualifying foundation (Go/No-Go)

Replace the retired application with a secure Electron/React shell,
one canonical `pnpm check`, cross-platform CI and packaging. Build a
utility-process-owned campaign skeleton that creates name-only campaigns,
switches A/B/A, and resumes exactly after restart. Qualify PixiJS at 100,000
sparse cells/8,192 visible facts and Babylon chunks, camera, hover, picking,
and selection on the defined integrated-GPU laptop profile: camera/hover p95
≤16 ms and local preview p95 ≤50 ms. Simulate memory/GPU loss and verify
keyboard use, 200% scaling, and accessible alternative representations.

### M2 — campaign knowledge and common catalog

UUIDv7 identities, campaign objects and reusable definitions, NPCs, places,
factions, quests, rumours, notes, FTS5, virtualized catalog, name-only dialog,
independent cross-campaign copies, trash/restore, and typed rejections.

### M3 — running play state

Roster and party; primary/shared running scenes; assignments; independent
scene time; weather and overrides; encounter/chase masks; notes/search;
durable scene/encounter/travel state; and a read-only secondary window.

### M4 — spatial platform

Deliver usable slices for shared coordinate/camera/selection, sparse chunk
storage, Pixi hex map, Babylon voxel dungeon, semantic spatial objects and
tools, 200-step undo/redo, synchronized views, geometry-loss reassignment,
and party routing/exploration/travel interruption. Store compact voxel chunks;
SQLite indexes chunks, revisions, semantic objects, and spatial bounding boxes
instead of individual voxels.

### M5 — planning, encounter, generators

Session workspace/timeline, planning party, placed content, creature/item
catalogs, encounter lifecycle, editable loot, and pure TypeScript rules.
Implement confirmed behavior anew with Golden Masters, reference snapshots,
seeds, stable ordering, and explainable diffs.

### M6 — completeness and first data-format release

Music/autoplay, import/export, backup/recovery/salvage, tutorial, optional
actor autonomy, platform accessibility, localization/scaling, large campaigns,
installers, and all 78 confirmed GM-core cases. Then freeze the SQLite format.

## First change packages

1. `docs: adopt Electron target and retire legacy gates`
2. `build: establish secure Electron shell`
3. `feat: create switch and reopen campaigns`
4. `feat: qualify sparse Pixi and Babylon renderers`

The Go/No-Go decision follows package 4. Do not broaden feature work before
that decision.

## Open blockers

M1 cannot yet be accepted until the recorded integrated-GPU qualification and
accessibility evidence is attached. This is a gate, not a reason to weaken the
16-ms/50-ms budgets. Store reproducible measurements in
`docs/project/evidence/`; track current CI state in the relevant pull request.

## Approved vertical slice in progress

The first running-play slice crosses the roadmap labels deliberately without
claiming completion of M3 or M5. Its approved expansion contains:

- the complete Party roster dropdown, Party membership, progression, rests,
  and the separate Adventuring Day top-bar calculator
- the productive Monster section of the common Catalog, backed by a versioned
  local SRD 5.1 resource; the other Catalog sections remain later slices
- one focused persistent runtime Scene with explicit PC assignments and named
  GM creature groups; one two-pane builder combines the shared filtered
  creature catalog, transient manual editing, live balancing, and fill-or-
  replace generation before an explicit Scene save
- a scenario dropdown for Encounter and read-only Reise; Encounter consumes
  only selected Scene groups and owns difficulty evaluation, Initiative,
  Combat, and Resolution, with the explicit no-loot state until Loot migrates
- a persistent four-panel Session surface with one shared column divider and
  an independent right-side Details/Scenario divider, focused-scene control,
  scene-local detail history, inline statblocks, and an honest provider-ready
  map/route-planning shell; Combat is persisted independently per running Scene
- campaign-local World Planner location and faction CRUD plus authored
  Encounter Tables in Catalog; locations link factions and tables, factions
  own disposition, a primary table and optional finite inventory caps, while
  Scene stores only a stable focused-location reference
- one shared source resolver supplies both the visible Monster catalog and the
  Scene-group generator with union-within/intersection-across semantics,
  weighted deterministic ranking, finite caps, and explicit fallback/no-
  solution behavior
- Scene groups and Encounter Tables share one two-pane creature-collection
  manager component rather than parallel look-alike dialogs; faction stock is
  edited only from the selected table's creature membership
- one campaign-local Hex vertical slice now connects a Pixi editor, static
  catalog-backed terrain IDs, World Planner location placement, focused-Scene
  Party position, waypoint route planning, durable checkpoints and Scene time,
  and the Session Karte/Reise surfaces; editable Terrain catalog CRUD remains a
  later slice

Encounter-table, faction, and location filter controls appear only when their
owning providers publish real options. NPC membership, loot links, and stock
consumption remain later work. The slice uses only secure typed capabilities
and utility-process-owned feature stores; it does not introduce copied creature
truth, a Java compatibility layer, or claim that the open M1 qualification
gate is complete.
