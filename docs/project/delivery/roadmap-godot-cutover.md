# Godot Cutover Roadmap

Status: Active migration ledger
Owner: Godot Cutover Program
Last Reviewed: 2026-07-28
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
| `G1` Transactional Campaign runtime | Partitioned Campaign commit manifests, bounded indexes, automatic preservation, activation drain/revoke, recovery, trash, complete export/import, assets, backups, and representative data fixtures work without SQLite. | Delete Java Campaign registry/runtime, `platform.persistence`, all installation/campaign SQLite lifecycle code, and superseded persistence docs/tests. | In progress: immutable owner partitions, atomic runtime state, stale-write rejection, recovery continuation, recoverable Campaign trash/restore, the explicit permanent-deletion backend, current-format streaming export/import with installation-wide Shared-Definition and binary-asset closure, an off-main-thread progress/cancellation controller with a green local Linux 20-cycle lifecycle/resource envelope, and a keyboard-operable explicit conflict ledger, 60-second background scheduling of restore-tested content-addressed recovery points, controlled restore, configurable normal and pressure retention, production total-volume admission with the greater-of-2-GiB-or-five-percent reserve, serial asynchronous accepted-write drain/revoke with bounded off-UI create/switch and timeout recovery, stable-ID asset/chunk commits with isolated damage, and automatic lifecycle-exclusive active-Campaign compaction across partitions/assets/chunks at 64 local generations are green. Full `RP-R` repeated-cancellation resource qualification and real Windows/macOS plus representative binary scale/OS qualification remain. |
| `G2` Knowledge and table foundation | Native shell plus Campaign objects, Catalog, Creatures, Items, Roster/current Party/planning Party, note-first records, explicit deletion, and shared-definition read semantics. | Delete corresponding JavaFX views, Java application/domain implementations, SQLite adapters, CSS, and shell contributions. | In progress: the production Godot shell has one Katalog route with seven retained sections. Creature and Item metadata use bounded Shared-Definition queries; NPCs, factions, and places use a Campaign-owned immutable partition with stable identity, name-only create, rich typed detail/readback, owner-native edit, explicit NPC lifecycle, recoverable delete/restore, and a serial generation-bound writer. Searchable paginated provider pickers maintain NPC Creature/faction/last-place, place-faction, faction-primary-table, and place-table references without raw IDs; faction editing also owns a bounded Creature-backed ledger for finite stock limits while omitted statblocks remain unlimited. Selected world records expose note-first Quest/rumour threads with typed subjects, free-form notes, explicit open/closed state, recoverable trash, stored Quest contributors, and structured but undistributed rewards through a bounded latest-wins read lane and the same serial writer. Encounter Tables now own a separate Campaign partition with stable identity, bounded active/trash Catalog summaries, full active/trash details, create/edit, provider-selected weighted Creature membership, recoverable delete/restore with atomic dependent World Planner cleanup and conflict-safe reattachment, serial commits, restart persistence, and latest-wins candidate evaluation preserving XP ceilings and per-table weights. Saved Encounters now own a separate Campaign partition with stable identity, ordered concrete Creature quantities, last-known labels, bounded Catalog/trash summaries, current-label detail hydration, Creature-validated create/edit, recoverable delete/restore, serial commits, restart persistence, and a 50-row roster-manifest editor. Encounter generated preparation captures one active-Party and complete Creature snapshot, resolves every ordered intent jointly and deterministically, commits every plan through one idempotent owner-partition publication, and hydrates requested current-fact summaries in order. All active provider families sort stably before bounded paging through one retained table. Party owns a native Campaign Roster/current-Party partition with a top-bar dropdown, stable duplicate-name identities, optional profile facts, explicit membership, XP/rest progression, recoverable deletion/restore, bounded async read/write lanes, and a separate native Adventuring-Day calculator with active/custom inputs, exact rest budgets, multi-day XP/level-up timelines, and latest-wins CPU work. Session Planner owns a native versioned Campaign partition, guarded revisions, multiple Sessions, independent planning Party references, exact day and scene budgets, ordered scenes, rest gaps, places, saved Encounter links, manual loot notes, bounded latest-wins projection, and a production master-detail route. The free-form Encounter runtime builder/generator, Encounter-Table group entries, Loot Table selection/conflict context, destination handoffs, provider-specific filters/semantic columns and sorts, concrete Party travel/Scene integration, visible owner acceptance, and corresponding Java/JavaFX/SQLite deletion remain. |
| `G3` Preparation | Session Planner timeline, Session Generation, World planning, treasures, notes, weather/music preparation, and editable generated output use Godot and file partitions. | Delete Session Planner, Session Generation, World Planner, and preparation-side Java/SQLite owners. | In progress: the native Session timeline and selected-scene director sheet are live, including atomic dirty-draft switches. Session Generation now validates and caches the complete versioned catalog, preserves the Golden target vector, produces deterministic structured encounters/rewards/packing/audits, commits immutable content-fingerprinted runs, resolves and commits Encounter batches, revision-checks the final Session replacement, rehydrates rewards, and exposes generate/progress/cancel controls. Owner-visible acceptance, richer generated-output editing, weather/music preparation, and legacy-owner deletion remain. |
| `G4` Live table | Running Scenes, Encounters, initiative/HP/turns, masks, split Party state, independent time, live notes/search/music, and passive display preserve and resume exact runtime truth. | Delete Scene, Encounter, Encounter Table, Travel state-shell, and related Java owners. | In progress: the native Scene bridge deck owns the Standardszene, parallel focus, split Party membership, World Planner NPC/place references, prepared-scene copies, Creature-backed mobs, participant state, and exact Encounter deep links. Each mutation atomically publishes the complete Scene and Encounter-context replacements; assigned PCs, hostile/friendly NPCs, mobs, prepared plans, restart truth, and compatible combat-state reconciliation are covered. The JavaFX/SQLite Scene owner, its store/composition, resources, and Java Catalog handoffs are deleted. Encounter's manual route remains native and restart-safe. Reinforcements, masks, independent time, live search/music, passive display, visible owner acceptance, and remaining Encounter/Travel legacy deletion remain. |
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
  pre-commit pointer failure. Ticketed accepted writes serialize, late work is
  rejected after revoke, pointer publication waits for terminal success, and a
  bounded controller timeout preserves the source pointer and UI fence until
  automatic source-authority recovery;
- backup proof covers restore-tested content-addressed Campaign closures,
  physical reuse of unchanged files across points, rejection of damaged blobs
  and active write authority, a production background queue with a 60-second
  due boundary, recovery publication above replaced live generations, and
  unchanged retention of the replaced Campaign root;
- storage-pressure proof covers exact injected five-percent admission, the
  live Linux total-volume probe below one second, deterministic POSIX/macOS/BSD
  and Windows `DriveInfo` parsing, opaque path arguments without a shell,
  fail-closed malformed/unsupported probes, the production 2 GiB reserve floor,
  mutation rejection without new Campaign
  truth, export to a destination with capacity, import/create rejection without
  staging or live orphans, one-at-a-time oldest-point quarantine, interrupted
  retention rollback after restart, unreferenced-blob collection, and a hard
  minimum of three verified recovery points;
- normal-retention proof covers configurable all/hour/day/week windows, a hard
  count ceiling, newest-point protection, deterministic repeated maintenance,
  exact removal reporting, and restart cleanup after the durable removal
  tombstone;
- compaction proof covers active-writer refusal, exact current-backup coverage,
  a three-generation local fallback, reachability-based partition collection,
  unchanged active semantic truth, independent pre-compaction restore,
  damage-evidence deferral, rollback before the commit marker, and cleanup after
  it. Production scheduling additionally proves silent not-due assessment,
  one observable off-main due operation, create/switch/transition-recovery
  exclusion, three-generation retention, authority restoration after success
  and interruption, shared backup-maintenance serialization, a newer-generation
  race with terminal stale disclosure and reassessment, automatic
  quarantine-recovery retry, and teardown without a live worker or lifecycle
  lease;
- binary-closure proof covers a streamed local asset, generated chunk bytes,
  portable filename rejection, multi-chunk streaming, stable semantic IDs with
  fresh immutable content paths, stale-write rejection before artifacts,
  low-space and pre-rename-fault cleanup, serial asynchronous runtime
  publication, update/remove fallback, byte-exact independent export/import,
  complete backup/restore, isolated asset damage with unaffected chunk access,
  refusal of incomplete backup/export, and reachability collection of
  asset/chunk revisions with historical recovery;
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
- portability-worker lifecycle proof covers twenty warmed early, middle, and
  post-commit cancellation cycles with exactly one terminal result, sub-second
  request acknowledgement p95, sub-ten-second cleanup p95, zero remaining
  worker handles or queue entries, publication only after the linearization
  boundary, Linux resident-memory return within ten percent, and a real partial
  export cancellation with neither final nor pending bundle bytes;
- native Katalog foundation proof covers one production shell route, all seven
  retained section identities, bounded stable-id Creature/Item metadata search,
  stable name/identity ordering before bounded 57-record paging, retained
  per-section page/sort/selection/input state, synchronous local navigation
  feedback, cancellation of invisible section work, one active plus one
  latest-wins pending worker, stale-result suppression, released worker state,
  and explicit unavailable behavior without Catalog-owned replacement truth.
  Real OpenGL renders at 1150 x 700 and 900 x 650 keep the seven-section rail,
  two-column result table, Inspector, and shared paging footer visible without
  horizontal scrolling;
- native World Planner provider proof covers independently identified
  same-named NPC/faction/place records, bounded active/trash queries, name-only
  creation, name/note editing, atomic relationship cleanup, same-ID restore,
  JSON restart readback, one off-thread preparation worker, serial
  generation-bound Campaign publication, released tickets, and the visible
  Catalog create/edit/trash/restore journey. A separate bounded detail proof
  covers complete active/trash entity readback, latest-wins cancellation and
  worker cleanup, rich NPC field editing, stable selection, and explicit
  defeated/reactivated lifecycle transitions. Reference-picker proof covers
  bounded Creature and Campaign-owned option reads, latest-wins cleanup,
  paginated search, NPC statblock/faction/place selection, place-faction
  removal/relink, faction/place Encounter Table references without endpoint
  deletion, and finite faction stock with current Creature labels, explicit
  unlimited removal, eight-row materialization, serial persistence, and
  restart readback. Its narrative proof additionally
  covers typed Quest/rumour subjects, manual resolution, contributor/reward
  validation without distribution, entity-link cleanup and safe restore,
  independent restart readback, bounded latest-wins query cleanup, and the
  visible Inspector create/close/trash/restore journey;
- native Encounter Table proof covers Campaign-partition validation, unique
  weighted Creature membership, bounded active/trash Catalog summaries,
  complete active/trash details, serial create/edit/trash/restore, one-commit
  cleanup of dependent World Planner references, conflict-safe relationship
  reattachment, stable restart readback, provider-backed selection, exact
  Creature fact resolution, XP ceilings, per-table weight context, latest-wins
  cancellation, released worker state, and the visible weighted ledger and
  lifecycle journeys;
- native saved Encounter proof covers Campaign-partition validation, ordered
  positive-quantity rosters, last-known label fallback, bounded active/trash
  Catalog summaries, complete details with current Creature labels, serial
  create/edit/trash/restore, stable restart readback, rejection of missing
  Creature truth without a Campaign commit, isolated owner-byte damage,
  latest-wins cancellation, released worker state, and the visible 50-row
  roster-manifest journey. Native generated-preparation proof additionally
  covers active-Party capture, one complete Creature snapshot, deterministic
  joint role/CR/XP resolution, roster diversity, no-partial failure, ordered
  found/missing/unresolvable summaries, latest-wins cancellation, one atomic
  Campaign publication, stable restart readback, exact no-write retry, changed
  retry conflict, worker cleanup, and the warmed canonical three-Encounter
  route below its two-second p95 target over 20 runs with separately recorded
  phases. Manual combat now runs through the production Encounter route with a
  versioned runtime collection, saved-plan current-fact materialization,
  active-Party initiative, per-member enemy HP, durable round/active-turn
  restart truth, result derivation, and atomic Encounter-plus-Party XP award.
  The headless production journey traverses the visible plan, initiative,
  combat, result, and return controls. Inspected real OpenGL renders at 1366 x
  768 and 1150 x 700 keep the saved-plan rail, complete turn strip, round and
  end controls, two-column combat cards, HP controls, status, and vertical
  overflow legible without horizontal scrolling. Native Scene proof now covers
  no-empty initialization, create/focus, split Party, NPC/place/mob assignment,
  participant state, prepared-copy semantics, exact context deep links,
  independent combat, atomic context reconciliation, latest-wins read cleanup,
  and restart. Inspected real OpenGL renders at 1366 x 768 and 1150 x 700 keep
  the focus compass, details, split-party controls, mob/NPC state, Encounter
  summary, terminal status, and vertical overflow legible without horizontal
  scrolling. Free-form runtime generation, reinforcements, masks, passive
  display, and final cockpit composition remain unfinished;
- native Party proof covers name-only and duplicate-name character creation,
  exact optional absence, stable identity, explicit current-Party membership,
  level-floor-safe XP correction, short/long-rest progression, character-owned
  travel validation, recoverable delete/same-ID restore without implicit
  participation, bounded latest-wins reads, JSON restart, serial
  generation-bound publication, and the production top-bar create/membership/
  XP/rest journey; a 1366 x 768 OpenGL render confirms the compact dropdown
  remains visible beneath the top bar;
- native Adventuring-Day proof covers the exact level budget table, mixed-level
  group thirds, active-Party rest cadence, missing-level refusal, full/partial
  day progress, grouped level-up breakpoints, ordered Short-/Long-Rest events,
  profile/input/rounding provenance, counted 100,000-character cohorts without
  an artificial content cap, invalid input, one-active/one-latest-pending
  cancellation and cleanup, and the production active/custom calculator
  journey. A real 1366 x 768 OpenGL render
  confirms both top-bar triggers, scrollable rows/timeline, and visible terminal
  feedback without clipping;
- native Session Generation proof validates all 16 manifest-pinned TSV
  families and their canonical content hash, preserves Golden targets
  `[680, 1000, 1800]`, completes deterministic encounter, treasure, loot,
  magic, curse, packing, summary, and hard-audit stages, survives JSON
  round-trip with the same semantic fingerprint, rejects identity conflicts,
  and hydrates unique reward references in request order. The production
  coordinator proves ordered immutable run, idempotent Encounter batch, and
  exact-revision Session commits plus cancellation without a partial visible
  Session or retained worker. Two inspected 1366 x 768 OpenGL renders confirm
  the generate/seed/count controls and structured reward cards fit the existing
  master-detail Regiebuch without clipping;
- the Gradle-free local development installer archives only the committed Godot
  project and icon, verifies the installed commit by readback, and publishes a
  desktop launcher; self-contained three-OS export presets remain a `G7`/`G8`
  gate;
- current contradiction: 1,515 Java files and the Gradle/OpenJFX/SQLite build
  still exist and are owned by `G1` through `G8`.
