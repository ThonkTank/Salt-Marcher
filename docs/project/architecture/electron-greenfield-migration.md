# Electron greenfield migration

## Status

**Current milestone: M1 — qualification in progress.** M0 is complete: the
JavaFX baseline is preserved by tag `javafx-final-2026-07-27` at `e29b305`, and
`stable` is unchanged. The secure Electron shell, utility-process SQLite
campaign skeleton, and Pixi/Babylon prototypes are present. Typecheck, lint,
unit tests, build and a headless Electron smoke test pass locally. Remaining
M1 gates are measured p95 qualification on the specified laptop profile,
GPU/memory-loss simulation, real Electron E2E coverage, packaging validation,
and the three-platform CI result.

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

Preserve the JavaFX commit, document this target architecture and roadmap,
retire JavaFX-specific source architecture, make issue evidence
product-neutral, close superseded Java PRs after retaining their visible
requirements, and add this contributor guide.

### M1 — qualifying foundation (Go/No-Go)

Replace the active Java/Gradle application with a secure Electron/React shell,
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

1. `docs: adopt Electron target and retire JavaFX gates`
2. `build: replace JavaFX application with secure Electron shell`
3. `feat: create switch and reopen campaigns`
4. `feat: qualify sparse Pixi and Babylon renderers`

The Go/No-Go decision follows package 4. Do not broaden feature work before
that decision.

## Open blockers

M1 cannot yet be accepted until the recorded cross-platform and integrated-GPU
qualification evidence is attached. This is a gate, not a reason to weaken the
16-ms/50-ms budgets.
