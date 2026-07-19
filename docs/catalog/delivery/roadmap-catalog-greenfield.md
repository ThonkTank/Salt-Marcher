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

- Current foundation: the shipped Catalog has seven sections and typed provider APIs,
  but eagerly activates every section, builds parallel JavaFX section trees, and runs
  persistence-backed work through shared global lifecycle mechanisms.
- Completed milestone: M0 locked the replacement target, persistence contract,
  user-visible behavior, migration order, and deletion gates on 2026-07-19.
- Locally completed milestone: M1 replaced global migration execution with owner-scoped
  definitions, readiness, and handles and passed literal `./gradlew check` on 2026-07-19.
- Publication state: the M1 pull request and required CI are pending; M2 must start only
  after that pull request merges.
- Next milestone: M2 migrates both supported Items predecessor shapes.
- No Greenfield production route has been implemented yet.

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

- move Creatures and Items to prepared owner handles
- delete the all-registered-plans loop from connection opening and tests that require it
- retain the current `SqliteConnectionSource` shape only as an internal adapter within M1;
  delete it before M1 exits if no unchanged provider still requires it

The temporary adapter is concretely `SqliteDatabase.connections(...)` returning
`SqliteConnectionSource`. It remains only for unchanged Encounter, Encounter Table,
Party, World Planner, Dungeon, Hex, Session Planner, Session Generation, and Scene
SQLite adapters. Creatures and Items use `FeatureStoreHandle` directly. The adapter
is deleted with the last unchanged provider during the final compatibility cleanup.

### Exit Gate

- a newer unrelated owner cannot block a Creature or Item connection
- no production startup task can race migration registration
- owner migration failure rolls back that owner and leaves other ready owners usable
- focused persistence/startup tests and `./gradlew check` are green

### M1 Implementation Evidence

- `SqliteDatabase` prepares immutable owner definitions independently and no longer
  iterates all registered plans when a handle opens.
- Creatures and Items consume `FeatureStoreHandle`; unchanged providers remain behind
  the named temporary adapter above.
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

## M5: Atomic Cutover, Deletion, And Qualification

### Deliver

- rehearse the complete storage and Catalog upgrade on an isolated copy of the installed
  database and record literal semantic readback without committing user data
- remove the old Catalog runtime, obsolete compatibility code, false architecture rules,
  and superseded documentation
- run failure-isolation, migration rollback, startup-order, debounce, stale-result,
  responsive UI, and explicit-action qualification through production routes
- perform independent architecture and quality review after the final code and document diff

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
