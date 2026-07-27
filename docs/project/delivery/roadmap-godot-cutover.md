# Godot Cutover Roadmap

Status: Active migration ledger
Owner: Godot Cutover Program
Last Reviewed: 2026-07-27
Source of Truth: This document

## Objective And Status Authority

Migrate SaltMarcher completely to one Godot project and remove JavaFX and
SQLite. This file is the temporary sequencing and deletion ledger. Product
behavior remains owned by requirements; technical obligations by
`program-technical-needs.md`; the greenfield runtime target by
`source-architecture.md`; persistence semantics by `persistence-lifecycle.md`.

Current overall status: **in progress**. A Godot Campaign foundation exists,
but the Java runtime and most capabilities still remain. No milestone may use a
narrow green test to claim this objective complete.

## Global Slice Rules

Every milestone must:

1. derive its behavior from the current owner requirements, not Java layout;
2. use the production Godot composition and file-store route;
3. cover success, empty, restart, stale-result, damage, and cancellation states
   applicable to the slice;
4. verify keyboard/focus, 1366 x 768 layout, scaling, and truthful failure copy
   for visible work;
5. prove its representative technical-needs budget where the needed fixture and
   capability exist;
6. delete superseded Java/JavaFX/SQLite code, Gradle wiring, resources, and
   technology-specific docs for that complete owner slice.

Dual writes, a Java-to-Godot bridge, SQLite conversion, and new Java product
work are forbidden. Pre-completion data is disposable.

## Milestones

| Milestone | Outcome | Deletion gate | Status |
| --- | --- | --- | --- |
| `G0` Target and executable foundation | Godot project starts; Campaign desk creates, lists, activates, restarts, rejects stale activation, and recovers a corrupted newest registry generation through immutable JSON files. Target architecture and persistence contract name no SQLite solution. | None yet: this is the shared foundation and not feature parity. | In progress: code, headless contract/UI journeys, injected write/publication failures, production-scene startup, and a 1366 x 768 render are green; list/open scale and Windows durability qualification remain. |
| `G1` Transactional Campaign runtime | Partitioned Campaign commit manifests, bounded indexes, automatic preservation, activation drain/revoke, recovery, trash, complete export/import, assets, backups, and representative data fixtures work without SQLite. | Delete Java Campaign registry/runtime, `platform.persistence`, all installation/campaign SQLite lifecycle code, and superseded persistence docs/tests. | In progress: immutable owner partitions, atomic runtime state, stale-write rejection, recovery continuation, recoverable Campaign trash/restore, the explicit permanent-deletion backend, current-format streaming export/import with installation-wide Shared-Definition closure, an off-main-thread progress/cancellation controller, and a keyboard-operable explicit conflict ledger, 60-second background scheduling of restore-tested content-addressed recovery points, controlled restore, pressure-triggered rollback-safe retention, the 2 GiB storage-reserve floor, and synchronous runtime admission/revoke are green. Normal retention tiers, the cross-platform total-volume probe for exact five-percent admission, asynchronous drain, compaction, repeated-cancellation resource qualification, and scale/OS qualification remain. |
| `G2` Knowledge and table foundation | Native shell plus Campaign objects, Catalog, Creatures, Items, Roster/current Party/planning Party, note-first records, explicit deletion, and shared-definition read semantics. | Delete corresponding JavaFX views, Java application/domain implementations, SQLite adapters, CSS, and shell contributions. | Pending |
| `G3` Preparation | Session Planner timeline, Session Generation, World planning, treasures, notes, weather/music preparation, and editable generated output use Godot and file partitions. | Delete Session Planner, Session Generation, World Planner, and preparation-side Java/SQLite owners. | Pending |
| `G4` Live table | Running Scenes, Encounters, initiative/HP/turns, masks, split Party state, independent time, live notes/search/music, and passive display preserve and resume exact runtime truth. | Delete Scene, Encounter, Encounter Table, Travel state-shell, and related Java owners. | Pending |
| `G5` Spatial runtime | Shared Godot canvas mechanisms plus Hex and Dungeon authoring, sparse rendering, visibility/knowledge, movement, routes, transitions, pursuit, and passive projection meet representative map profiles. | Delete `features/hex`, `features/dungeon`, Java map canvas, their SQLite adapters, JavaFX renderers, and old map resources. | Pending |
| `G6` Progression and world systems | Follow-up/history, XP, rewards, character loot ledger, shops/trade/restock, calendar, climate, autonomy, and world progression are complete and failure-isolated. | Delete remaining equivalent Java owners and stale feature docs. | Pending |
| `G7` Product-wide qualification | Current-format recovery and portability, localization, accessibility, tutorials, capability isolation, permission-gated extensions, three-OS export templates, and `RP-R` qualification are green. | Delete temporary compatibility scaffolding, fallback scenes, and migration-only fixtures. | Pending |
| `G8` JavaFX/SQLite extinction | Godot is the only build, runtime, storage, documentation, and packaging route. Full capability acceptance and completion audit are green. | Delete all paths and dependencies listed below, then delete this roadmap after routing references are cleared. | Pending |

## G0 Remaining Gate

- qualify Campaign-registry list/open latency with a representative campaign
  count and verify no unbounded per-frame work;
- review the file protocol against Windows rename and durability semantics
  before using it for Campaign commits.

## Final Absence And Completion Audit

`G8` cannot close until current evidence proves all of the following:

- `project.godot` is the sole application/build entry point and export presets
  produce supported Linux, Windows, and macOS desktop artifacts;
- every confirmed capability and acceptance criterion has a production Godot
  journey and appropriate headless/visible proof;
- representative correctness, latency, memory, recovery, portability, offline,
  accessibility, and failure-isolation scenarios are green;
- repository search finds no `.java`, `.kt`, `.kts`, `.gradle`, Gradle wrapper,
  JavaFX import, JDBC import, SQLite dependency, `adapter/javafx`, or
  `adapter/sqlite` path;
- runtime inspection finds no `.sqlite`, `-wal`, `-shm`, JDBC URL, database
  migration, or hidden legacy-data fallback created or opened by Godot;
- `app/`, `shell/`, legacy `platform/`, legacy `features/`, `gradle/`, `gradlew`,
  `build.gradle.kts`, and `settings.gradle.kts` are gone;
- README, architecture, contracts, feature docs, packaging, and user-visible
  copy describe only the Godot/file-store product;
- the full requirements-to-proof matrix has no missing, indirect, or merely
  compatible evidence.

## Current Evidence

- Godot version used for foundation proof: `4.6.2.stable.fedora`
- headless parser/import: `godot --headless --path . --editor --quit`
- foundation contract test: `godot --headless --path . --script res://godot/tests/run_all.gd`
- the same headless suite drives the production Campaign desk through Enter
  creation and rendered Campaign-button activation;
- a real OpenGL production render completed at 1366 x 768 on Intel UHD 620 and
  was visually inspected for clipping, hierarchy, focus, and empty-state copy;
- persistence proof covers owner-partition commits, atomic runtime state,
  immutable recovery continuation, recoverable Campaign trash/restore, injected
  pre/post-rename failures, explicit confirmed permanent deletion with a removal
  report, and exact current-format export/import under a new identity;
- runtime-admission proof prepares a target before pointer publication, rejects
  stale activation generations and detached-session writes, preserves the prior
  session on target-preparation failure, and resumes it after a definite
  pre-commit pointer failure;
- backup proof covers restore-tested content-addressed Campaign closures,
  physical reuse of unchanged files across points, rejection of damaged blobs
  and active write authority, a production background queue with a 60-second
  due boundary, recovery publication above replaced live generations, and
  unchanged retention of the replaced Campaign root;
- storage-pressure proof covers exact injected five-percent admission, the
  production 2 GiB reserve floor, mutation rejection without new Campaign
  truth, export to a destination with capacity, import/create rejection without
  staging or live orphans, one-at-a-time oldest-point quarantine, interrupted
  retention rollback after restart, unreferenced-blob collection, and a hard
  minimum of three verified recovery points;
- untrusted-bundle proof rejects checksum damage, stale registration, parent
  traversal, oversized declared content, and undeclared bytes without changing
  existing registry truth;
- Shared-Definition proof covers installation-scoped immutable generations,
  stable Campaign references, closed export, missing-definition import,
  restart-stable conflict staging, affected-Campaign consequences, explicit
  keep-existing/use-imported/retain-both/discard decisions, atomic registry
  visibility, and unchanged completed historical facts;
- production portability UI proof covers one admitted background worker,
  competing-action exclusion, file/definition progress, cancellation before
  publication, independent round trip, keyboard focus, all three simultaneous
  conflict consequences, affected-Campaign disclosure, visible retain-both,
  and two inspected 1366 x 768 OpenGL renders;
- current contradiction: 1,536 Java files and the Gradle/OpenJFX/SQLite build
  still exist and are owned by `G1` through `G8`.
