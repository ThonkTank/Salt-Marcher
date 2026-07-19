Status: Temporary Migration
Owner: Catalog Feature
Last Reviewed: 2026-07-19
Source of Truth: Catalog replacement order, slice boundaries, deletion gates,
current migration state, and finish criteria.

# Catalog Greenfield Roadmap

## Purpose

This roadmap replaces the current Catalog implementation as one complete
production cutover. It does not preserve internal Catalog classes, eager
section lifecycles, the shared global execution queue, or architecture tests
that require seven independently assembled JavaFX sections.

Observable behavior is owned by the [Catalog requirements](../requirements/requirements-catalog.md).
The permanent target is owned by the [Catalog architecture](../architecture/architecture-catalog.md),
and shared storage compatibility is owned by the
[persistence lifecycle](../../project/contract/persistence-lifecycle.md).

No intermediate slice is an approved product fallback. Each slice must leave a
green repository, but the replacement is installed only after M5 removes the
old runtime and the complete migration is qualified.

## Fixed Delivery Decisions

- Start from current `origin/main`; do not merge the superseded Catalog controls branch.
- Change internal architecture **as far as needed** (`so weit wie nötig`). Existing
  implementation layers, tests, and non-user-visible documentation are not compatibility
  boundaries; only accepted observable behavior, provider and persisted truth, and data
  safety constrain the replacement.
- Preserve the approved seven-section visual design and explicit handoff behavior.
- Use one physical SQLite database with owner-scoped readiness and connection handles.
- Prepare storage before any feature starts background work.
- Keep Provider truth in Creatures, Items, Encounter, World Planner, and Encounter Tables;
  Catalog owns no stored records.
- Keep exactly seven statically composed sections, but render them through one generic renderer.
- Activate and query only the selected section. Preserve inactive section state without I/O.
- Apply search and filter edits after 200 ms of inactivity; Enter submits immediately.
- Ship no long-lived dual runtime. Temporary translation surfaces are named in their
  milestone and deleted at that milestone's exit.
- Do not modify real local data before an owner-approved, restore-tested backup and
  migration rehearsal on a copy.

## Dependency Order

```text
M0 Target Lock And Baseline
  -> M1 Owner-Scoped Storage And Startup
      -> M2 Provider Compatibility And Items Migration
          -> M3 Catalog Browse Runtime
              -> M4 Single JavaFX Renderer
                  -> M5 Atomic Cutover, Deletion, And Qualification
```

Use one feature branch and one pull request per milestone. Merge only after
literal green `./gradlew check` and required PR CI, then start the next milestone
from refreshed `origin/main`.

## Current Migration State

- Current foundation: M0 through M4 are merged. The shipped Catalog has seven typed,
  selected-only browse sessions rendered through one JavaFX renderer; provider truth
  remains feature-owned. M5 is replacing the final global storage-lifecycle seam and
  qualifying the installed cutover.
- Completed milestone: M0 locked the replacement target, persistence contract,
  user-visible behavior, migration order, and deletion gates on 2026-07-19.
- Completed milestone: M1 replaced global migration execution with owner-scoped
  definitions, readiness, and handles and passed literal `./gradlew check` on 2026-07-19.
- M1 publication: PR #530 merged with required CI green.
- Completed milestone: M2 migrates both supported Items predecessor shapes into
  the unambiguous version-2 target and passed literal `./gradlew check` on 2026-07-19.
- M2 publication: PR #531 merged with required CI green.
- Completed milestone: M3 replaces the five section-controller lifecycles with
  one typed `BrowseSession`, seven explicit definitions, selected-only activation,
  retained immutable section state, 200 ms debounce, immediate submit, and stale-result rejection.
- M3 publication: PR #532 merged with required CI green.
- Completed milestone: M4 replaces every section-specific JavaFX tree with one typed
  renderer and one control factory. PR #535 merged with required CI green.
- Current milestone: M5 removes the remaining storage compatibility seam, qualifies the
  complete production cutover, and prepares the owner-controlled installed-data rehearsal
  and desktop acceptance.

## M0: Target Lock And Baseline

### Deliver

- align Catalog requirements and architecture with live search, lazy activation,
  one renderer, provider truth, typed outcomes, and explicit actions
- replace the global migration semantics in the persistence contract with owner-scoped
  readiness and fail-isolated compatibility
- define the required synthetic database fixtures for the legacy Items shape, the flawed
  intermediate Items shape, and a foreign owner whose schema is newer than the running application
- retain current production behavior tests as the observable baseline; do not preserve
  their structural assumptions as target rules

### Exit Gate

- owner documents contain no contradictory Catalog lifecycle, renderer, or persistence rule
- this roadmap has no unresolved implementation choice for M1
- `git diff --check` and `./gradlew check` are green

## M1: Owner-Scoped Storage And Startup

### Deliver

- replace dynamic global migration execution with immutable owner definitions and
  owner-scoped connection handles
- add typed readiness: `READY`, `MIGRATION_FAILED`, `NEWER_SCHEMA`, and `CORRUPT`
- make connection opening validate and migrate only its owner
- split application startup into composition, storage preparation, service start, and
  shell activation; no feature may enqueue storage work before preparation completes
- retain one verified physical backup and local recovery behavior without exposing paths
  or payloads in diagnostics

### Production Consumer And Deletion Gate

- move the first production consumers, Creatures and Items, to prepared owner handles
- delete the all-registered-plans loop from connection opening and tests that require it
- name the remaining provider compatibility seam and require its deletion at M5 cutover

### Exit Gate

- a newer unrelated owner cannot block a Creature or Item connection
- no production startup task can race migration registration
- owner migration failure rolls back that owner and leaves other ready owners usable
- focused persistence/startup tests and `./gradlew check` are green

### M1 Implementation Evidence

- `SqliteDatabase` prepares immutable owner definitions independently and no longer
  iterates all registered plans when a handle opens.
- Creatures and Items consume `FeatureStoreHandle`; M5 completes the same boundary for
  every remaining provider and deletes the compatibility seam.
- production composition prepares all eleven registered stores before explicitly
  starting Creature, Party, World Planner, Encounter, Dungeon, and Hex work.
- the startup guard failed on the former Encounter and Dungeon constructor work and is
  green only after both moved behind the explicit start phase.
- focused `SqliteDatabaseTest` and `SmokeStartupTest` routes are green.
- literal merge-blocking proof: `./gradlew check --console=plain` returned
  `BUILD SUCCESSFUL in 6m 29s` after rebasing onto the Encounter batch M2 merge.

## M2: Provider Compatibility And Items Migration

### Deliver

- introduce an Items schema whose table names and structural signature are unambiguous
- migrate both supported predecessor shapes transactionally:
  legacy `id/slug/is_magic/requires_attunement` and intermediate
  `source_key/magic/attunement`
- preserve stable item identity, details, tags, nullable provenance, and read-only behavior
- return typed provider availability and compatibility failures without leaking JDBC
- add production-route provider tests against synthetic predecessor databases

### Migration And Deletion Gate

- legacy numeric identity is retained only as migration provenance; the stable target id
  is `legacy:<slug>` for legacy rows and the provider's canonical source key otherwise
- unknown structural signatures fail before mutation
- row identity, tag ownership, semantic fields, integrity, and foreign keys are validated
  before commit
- delete old Items tables and shape-detection code from the target database after the
  transactional copy validates; retain only the versioned migration step required for
  supported upgrades

### Exit Gate

- both predecessor fixtures migrate exactly once and reopen without further writes
- failed validation leaves the complete before-state unchanged
- Items failure does not affect Creature search
- focused provider tests and `./gradlew check` are green

### M2 Implementation Evidence

- target tables are `items_catalog_entries` and `items_catalog_tags` under owner version `2`.
- the released v1 step remains unchanged; v2 classifies the exact legacy, intermediate,
  or target signature before mutation.
- the legacy fixture preserves `legacy:<slug>` identity, numeric provenance, semantic
  fields, normalized tags, raw source-property text, and nullable attribution.
- the intermediate fixture preserves canonical source keys, details, tags, and attribution.
- both fixtures reopen at version `2` without predecessor tables or repeat migration.
- the unknown fixture retains its original schema, row, and owner version; Items reports
  `INCOMPATIBLE` while a Creature production adapter remains `READY` and readable.
- all Items tests are green; literal `./gradlew check --console=plain` returned
  `BUILD SUCCESSFUL in 5m 43s` on the final code and documentation diff.

## M3: Catalog Browse Runtime

### Deliver

- replace section-specific lifecycle controllers with a reusable typed `BrowseSession`
- add typed section definitions for Monster, Items, saved Encounters, NPCs, factions,
  locations, and Encounter Tables
- own draft, committed query, request epoch, paging, stable selection, staleness, and
  result state in immutable application state
- activate only the selected session; cancel or invalidate superseded work and retain
  inactive state without subscriptions or provider calls
- use Encounter-owned pool criteria as the canonical Monster generation-filter truth
- distinguish uninitialized, loading, refreshing, ready, empty, invalid, unavailable,
  and failed results

### Deletion Gate

- delete the five current section controller families and eager `sections.activate()` loop
- delete tests that require Items or other inactive sections to load during Catalog activation
- retain no duplicate per-section request revision or lifecycle implementation

### Exit Gate

- switching through all sections preserves draft, query, page, selection, and result
- inactive sections perform zero provider calls
- only the newest debounced or immediate request may publish
- explicit details and handoffs retain accepted behavior
- focused application tests and `./gradlew check` are green

### M3 Implementation Evidence

- `CatalogFeature` explicitly composes exactly seven typed definitions; the workspace
  receives that complete set and contains no Provider construction or discovery.
- one `BrowseSession<Q, R, K>` owns activation, subscription release, draft and committed
  query, 200 ms debounce, immediate submit, request epoch, paging, stable selection,
  provider revision, staleness, and all eight result states.
- the five former controller families and their controller-specific lifecycle and request
  tests are deleted; one shared state-machine test now proves debounce, latest-result wins,
  stable selection, inactive invalidation, and subscription release.
- production-route lifecycle proof shows initial Catalog activation makes zero Items,
  saved-Encounter, NPC, faction, location, or Encounter Table requests and switches only
  the selected session into an active provider lifetime.
- Monster draft commits update Encounter-owned pool filters; unchanged readback is ignored
  as an echo, while external readback replaces the visible draft and refreshes the query.
- literal merge-blocking proof: the complete M3 suite returned `BUILD SUCCESSFUL in 6m 30s`;
  after the composition-only boundary cleanup, the final unchanged-task rerun returned
  `BUILD SUCCESSFUL in 4s` on the final code and documentation diff.

## M4: Single JavaFX Renderer

### Deliver

- render every section from typed search, choice, multi-choice, range, tri-state, column,
  paging, and action specifications
- keep one control factory, one result/table renderer, one status model, and one keyboard
  and selection implementation
- preserve the approved 28 px control, 12 px regular type, inside-label, compact wrapping,
  and visible result-workspace behavior at supported window sizes
- retain section-specific columns, filters, and actions as data and typed callbacks rather
  than JavaFX subclasses

### Deletion Gate

- delete all seven concrete `*CatalogSection` JavaFX classes, `MonsterCatalogControls`,
  parallel scaffold ownership, and architecture tests that require those classes
- forbid section definitions from constructing or styling JavaFX controls
- keep only one renderer tree for the selected section; application state, not retained
  nodes, preserves inactive work

### Exit Gate

- all seven sections pass the same measured visual and interaction contract
- UI tests drive production Catalog application routes rather than self-testing fixtures
- `uiTest`, architecture proof, and `./gradlew check` are green

### M4 Implementation Evidence

- one `CatalogSectionRenderer` owns the persistent seven-section selector, the selected
  control tree, filter chips, shared table, status, paging, keyboard behavior, stable-id
  selection, confirmations, and explicit row and section actions
- one `CatalogControlFactory` assigns the centralized visual roles; all ordinary size,
  type, spacing, and gap values live in `resources/salt-marcher.css`
- the seven typed definitions provide sealed text, choice, multi-choice, range, and
  tri-state filter specifications plus framework-neutral columns and typed actions
- all seven concrete `*CatalogSection` classes, `MonsterCatalogControls`, auxiliary
  control state, both presentation hosts, `CatalogSection`, and `CatalogTableScaffold`
  are deleted
- production-route Catalog UI tests prove the 28 px and 12 px contract, inside labels,
  absence of redundant headings and tuning controls, all Items outcomes, shared paging,
  retained draft/page/selection, Inspector opening, saved-Encounter confirmation, and
  every supported Encounter or Scene handoff
- final rebased qualification: `./gradlew check uiTest architectureTest --console=plain`
  returned `BUILD SUCCESSFUL in 6m 59s` on the complete implementation and
  documentation diff

## M5: Atomic Cutover, Deletion, And Qualification

### Deliver

- rehearse the complete storage and Catalog upgrade on an isolated copy of the installed
  database and record literal semantic readback without committing user data
- remove the old Catalog runtime, obsolete compatibility code, false architecture rules,
  and superseded documentation
- run failure-isolation, migration rollback, startup-order, debounce, stale-result,
  responsive UI, and explicit-action qualification through production routes
- perform independent architecture and quality review after the final code and document diff

### M5 Cutover Evidence In Progress

- `app` registers all eleven immutable owner definitions, prepares storage, constructs
  components, and only then starts feature work.
- every feature SQLite adapter now accepts its owner handle; feature code no longer
  receives or depends on the global database lifecycle.
- normal owner handles expose only readiness and operation-scoped connections. The desktop
  Items provider receives only catalog-read capability. Its separately composed operator
  import receives one owner-bound maintenance capability that creates the whole-database
  recovery point and opens the later write connection from the same lifecycle.
- opening an unprepared handle fails without creating or migrating a database. The
  compatibility connection type and registration shortcut are deleted, duplicate
  owner registration is rejected, and architecture proof forbids feature dependency
  on the global lifecycle.
- the five temporary M3 presentation projections and five UI-to-controller Intent
  families are deleted. `CatalogWorkspaceState` publishes only the active, type-preserving
  section binding; the passive contribution reaches the shared renderer through one generic
  path and stale callbacks remain section- and confirmation-token guarded.
- every production owner now supplies an explicit structural schema validator. `READY`
  means the owner target signature plus global physical and foreign-key integrity succeeded;
  semantic corpus validation remains on typed provider reads and writes instead of scanning
  every Dungeon, Encounter, or Scene row at desktop startup. Encounter and Dungeon validate
  every owned table's exact column set and ordered primary key plus all canonical foreign keys
  and named indexes. A malformed target owner becomes `MIGRATION_FAILED` without blocking a
  healthy owner; production-route negative tests prove this for both owners.
- additive Dungeon v7, Encounter v5, and Session Planner v4 repairs resolve already recorded
  target-signature gaps without redefining released migrations. Empty older Dungeon v6 stores
  upgrade; an unexpectedly populated old-v6 store fails without deleting rows or advancing its
  ledger. Encounter and Session Planner repairs are idempotent and preserve predecessor rows.
- existing healthy databases are still checked read-only on every startup, but the verified
  `VACUUM INTO` snapshot, restore probe, and versioned backup run only when platform metadata or
  at least one supported owner migration is pending. Newer owners alone do not cause writes.
- startup and rehearsal share one production store manifest. Rehearsal requires an explicit
  absolute copy path and rejects the installed application-data directory. The operator path
  creates a coherent, restore-tested, owner-only SQLite snapshot before rehearsal; the updater
  qualifies that copy before installing the candidate.
- the final synthetic archive roundtrip returned `CATALOG_SNAPSHOT_READY`; the retained
  `tar.gz` was then extracted into a fresh restore directory and that restored copy returned
  `CATALOG_REHEARSAL_READY owners=11 creatures=0 items=0 saved_encounters=0 npcs=0
  factions=0 locations=0 encounter_tables=0`. Invoking
  `rehearseCatalogData` without its required absolute copy property failed before Java
  execution. Hardlink and resolved-path aliases into installed application data are rejected;
  backup/archive/extraction failures block the updater before installation, while failure to
  prune older retained archives is explicitly non-blocking and leaves the restore-tested backup
  intact. This synthetic qualification opened or changed no installed user data.
- the owner-approved installed-data gate created and retained a protected archive before
  extracting a fresh rehearsal copy. Its first run correctly stopped before installation:
  the installed ledger already recorded two historical v1 shapes that the synthetic fixtures
  had not modeled. Creatures contained the complete read projection plus additional immutable
  provider columns; its validator now opts into a required-column superset contract without
  touching rows or advancing the ledger. Hex contained the released hybrid v1 map/tile shape
  plus external legacy foreign keys; additive Hex v2 validates representability, retains the
  referenced v1 rows in immutable archives, lets SQLite retarget those foreign keys atomically,
  and installs the canonical target tables. Unknown or non-representable Hex truth rolls back
  with the owner ledger and every legacy row unchanged.
- a second freshly extracted copy proved the Hex external-reference guard by stopping on the
  previously unmodeled cross-owner foreign keys. After adding archive preservation and its
  regression fixture, the final fresh extraction returned
  `CATALOG_REHEARSAL_READY owners=11 creatures=2526 items=1329 saved_encounters=5 npcs=0
  factions=0 locations=0 encounter_tables=5`. The installed source database remained
  unmigrated; only isolated restored copies were changed.
- the final code and document diff is integrated with current `origin/main` (`0b094e121`).
  Literal pre-review qualification returned `BUILD SUCCESSFUL in 11m 29s` for `test`,
  `2m 43s` for `uiTest`, and `1m 54s` for `architectureTest`. The corrected Encounter, Dungeon,
  and shared persistence routes returned `BUILD SUCCESSFUL in 1m 34s`. Final independent
  architecture and quality re-review reported no remaining findings. Literal merge-blocking
  `./gradlew check --console=plain` returned `BUILD SUCCESSFUL in 11m 50s` before the real-data
  compatibility findings. The final Hex inbound-schema regression route returned
  `BUILD SUCCESSFUL in 30s`, and the post-review fresh restore copy returned the complete
  `CATALOG_REHEARSAL_READY` result in 46s. Final architecture and quality re-review reported
  no remaining findings; renewed literal `./gradlew check --console=plain` returned
  `BUILD SUCCESSFUL in 10m 32s` on the complete real-data compatibility diff. Desktop
  installation and visible owner acceptance remain M5 gates.

### Finish Criteria

- every Catalog provider remains independently readable or reports its own typed failure
- all seven sections use the single renderer and lazy BrowseSession runtime
- no current source or test references the deleted eager/controller/scaffold topology
- literal final `./gradlew check` is green
- the owner approves the restore-tested real-data migration, desktop installation, and
  manual visible behavior
- the feature PR is merged with required CI green, this roadmap is deleted, and Catalog
  plus project README delivery links are cleaned up

## Risks And Escalation

- An unknown Items schema signature, inability to preserve stable identity, or failed
  restore rehearsal stops M2/M5 before real-data mutation.
- A Catalog action requiring a cross-provider atomic transaction is an architecture
  blocker; do not hide it behind callbacks or a shared Catalog database.
- A section that cannot be expressed by the typed renderer must justify a new reusable
  capability in Catalog architecture before adding a one-off JavaFX escape hatch.
- Unrelated feature migrations may continue in separate worktrees. Catalog slices must
  refresh from merged `origin/main` between milestones and never absorb their dirty state.
