Status: Temporary Migration
Owner: Session Planner Feature
Last Reviewed: 2026-07-18
Source of Truth: Ordered replacement milestones, compatibility budget, deletion
gates, and current migration position for Session preparation.

# Session Planner Greenfield Roadmap

## Purpose

This roadmap replaces the current Session Planner generation workflow with the
durable target defined by the Session Planner, Session Generation, and
Encounter owner documents. It preserves accepted user behavior while allowing
internal APIs, state models, persistence flow, execution, and JavaFX
composition to be rebuilt without compatibility obligation beyond the explicit
budget below.

This file owns temporary order and migration status. It does not own durable
behavior, domain truth, contracts, architecture, or test inventories. Delete it
after M6 closes every named legacy boundary and the owner accepts the result.

## Authoritative Facts

- Session Planner owns authored session plans and the preparation interaction.
- Party, Encounter, World Planner, and Session Generation retain their own
  truth; Session Planner stores stable references and planner metadata.
- Generate is one user action. Empty sessions apply the complete result
  directly; replacing existing content requires prior confirmation.
- A successful generated session contains concrete Encounter-owned saved
  rosters and structured Session Generation rewards, not only labels or text.
- The completed generated session is immediately editable.
- The master-detail scene workspace remains; controls, Generate, and state
  summary become compact.
- Backend replacement precedes architecture enforcement and performance proof;
  the frontend converges only after those seams are stable.
- Existing canonical Session Planner, Session Generation, and Encounter data
  remains readable. Proof-of-concept schema and Java compatibility are not
  retained.

## Current Structural Problem

The current workflow models one click as a hidden preview followed by Apply.
Session Generation saves and reloads the result before the workflow can
continue. Encounter then resolves abstract XP-and-role slots through repeated
creature lookups. Session Planner publishes several projections that rebuild
overlapping context, hydrate saved plans and creatures repeatedly, and project
generated reward truth mainly through fallback labels. One global serial
execution lane can serialize CPU generation, I/O, projection, and unrelated
commands.

The result can be technically persisted while still looking like generic text:
Encounter composition is selected after generation with weak diversity, and
the planner does not render the structured loot rows the generator already
owns. Latency grows with saved plans, scenes, slots, and roster members instead
of staying bounded by data family.

The principal current evidence is
`features/sessionplanner/application/SessionGenerationCoordinator.java`,
`features/sessionplanner/application/SessionPlannerProjection.java`,
`features/sessionplanner/application/SessionPlannerPublishedState.java`,
`features/encounter/application/GeneratedEncounterPlanImportService.java`, and
`platform/execution/SerialExecutionLane.java`.

PR #512 at reviewed commit `58660a1ec` is the visual and interaction donor for
the accepted master-detail surface. It is not the backend migration base: M6
adapts its useful layout and editing behavior only after the target application
seams and enforcement are complete.

## Target Outcome

The completed replacement has:

- one `prepareSession` application use case and no UI preview/apply chain
- one complete typed `PreparedSessionDraft` before any durable commit
- Session Generation draft and idempotent commit operations with no hot-path
  save/reload transport
- Encounter batch preparation from one creature candidate snapshot, concrete
  roster summaries, and one atomic idempotent commit
- structured generated reward batch reads and reward cards
- one immutable revisioned Session Planner workspace snapshot assembled from
  bounded batch reads
- bounded CPU execution, separate short I/O transactions, cancellation, and
  latest-fingerprint-wins publication
- one compact preparation toolbar, selected-scene Encounter search, compact
  state summary, and the accepted master-detail scene workspace
- production-route proof for consistency, query bounds, responsiveness, and
  the reference performance fixture
- no legacy preview model, abstract generated-slot import, repeated projection
  fan-out, or generation use of the global serial lane

The target remains a local modular monolith. It adds no remote service,
cross-feature database transaction, event bus, workflow database, rules plugin
system, or second generation surface.

## Surface Disposition

The deletion milestone column is authoritative. A rejected surface is deleted
in that milestone only; earlier milestones may stop adding callers but may not
create a second retirement owner.

| Current surface | Decision | Migration consequence | Deletion milestone |
| --- | --- | --- | --- |
| `SessionPlan`, scene order, participants, allocations, rests, and foreign references | Adopt | Preserve ownership and observable authored behavior. | - |
| Master-detail scene workspace, auto-commit editing, reorder, budget editing, summary | Adopt | Retain as the final JavaFX foundation. | - |
| Pure staged Session Generation engine and immutable normalized run | Adapt | Keep rules and run truth; split in-memory draft from idempotent commit. | - |
| Current `generate`/`load` save-reload workflow transport and its deprecated delegates | Reject | Continue with the typed in-memory draft and persist once. | M3 |
| Preview fingerprint and request token | Adapt | Become preparation fingerprint and cancellation/latest-wins guard. | - |
| Backend preview/Apply commands, models, coordinator, projection, and persistence assumptions | Reject | Use one Session Planner preparation command and one final planner commit. | M3 |
| UI auto-Apply dispatch and hidden second-command chaining | Reject | One Generate intent reaches ready state directly. | M3 |
| Preview/Apply UI chrome and nested preparation controls | Reject | Render one compact preparation toolbar with no preview surface. | M6 |
| XP/role slot import, first-match selection, and per-slot or per-member creature queries | Reject | Use one candidate snapshot and concrete roster-batch preparation. | M2 |
| Duplicate generated-origin writer | Reject | Use one atomic idempotent Encounter batch commit. | M2 |
| Backend `LootPlaceholder`/fallback-label projection of available generated reward truth | Reject | Batch-project typed Session Generation reward detail. | M4 |
| Generated loot-placeholder UI presentation | Reject | Render structured reward cards and separate manual notes. | M6 |
| Independent planner publications and repeated context or foreign-detail projection | Reject | Use one coalesced workspace snapshot. | M4 |
| Full saved Encounter catalog in controls | Reject | Search and attach from the selected-scene inspector. | M6 |
| Global serial lane for the preparation hot path | Reject | Use bounded CPU work, I/O execution, and short transactions. | M5 |
| Compatibility constructors, duplicate APIs other than the M1 delegates, and no-op fallbacks introduced by migration | Reject | Keep only canonical target seams. | M5 |
| Version/revision guards and failed-write stable state | Adopt | Preserve and prove across the new workflow. | - |

## Delete And Retire Rule

The migration is incomplete while production depends on any rejected surface
in the disposition table. Each milestone's Delete section executes only its
assigned rows. Backend preview/Apply behavior belongs to M3; visually retained
preview/Apply chrome belongs to M6 and may not carry orchestration after M3.

## Temporary Compatibility Budget

Two temporary surfaces are allowed:

1. M4 may add one package-private `LegacySessionPlannerPublicationAdapter` that
   derives the existing view publications from the new workspace snapshot. It
   performs no reads or writes and is deleted in M6.
2. M1 may retain the current Session Generation `generate/load` API methods as
   deprecated delegates while the production caller moves. They receive no new
   caller and are deleted in M3.

Existing canonical generated-origin rows may be normalized by the owning
persistence adapter on read. That is durable data compatibility, not permission
for dual writes or a second origin model. No other bridge, shadow state,
parallel schema, nullable dependency, or dual-write path may cross a milestone.

## Dependency Order

```text
M0 Target Lock And Roadmap
  -> M1 Session Generation Draft/Commit
      -> M2 Concrete Encounter Batch Preparation
          -> M3 Prepare Session Orchestration And Persistence
              -> M4 Workspace Snapshot And Structured Projection
                  -> M5 Enforcement, Performance, And Legacy Deletion
                      -> M6 Compact Frontend And Owner Acceptance
```

## Chosen Migration Strategy

Use a backend-first replacement with one vertical production route at every
milestone. M1 makes Session Generation capable of drafting and committing its
own truth; M2 does the same for concrete Encounter batches; M3 replaces the
preparation orchestration only after both APIs exist; M4 consolidates reads and
publication on top of those delivered batch boundaries; M5 makes the new shape
enforceable and proves its performance; M6 then compacts a passive UI against
stable application state.

This order prevents frontend work from hardening the current preview model and
keeps every intermediate branch runnable. It also localizes rollback: before
M3 the accepted workflow still uses its old calls, while after M3 the new path
owns preparation behavior and the old workflow can be deleted. M4 changes only
how already-owned facts are assembled and published.

Rejected alternatives:

- compact the current UI first: this would preserve the slow projection and
  preview/apply seams behind cleaner chrome
- optimize point queries in place: this would leave abstract encounters,
  save/reload transport, and duplicate publications as permanent concepts
- merge Session Generation into Encounter: reward/audit truth and saved-roster
  truth have different ownership and lifecycles
- use a shared transaction, saga store, or event bus: local idempotent commits
  provide the required consistency with less infrastructure and fewer failure
  modes
- maintain old and new workflows in parallel until final cutover: that would
  create two behavior owners and invalidate production-route proof

## Verification Thesis

The replacement is accepted only when proof follows the production route from
one Generate intent to one published editable workspace. Unit proof may isolate
pure generation and Encounter selection policies, but cannot substitute for
cross-feature consistency, real SQLite adapters, bounded query counts, JavaFX
responsiveness, or owner-visible output. Every milestone refreshes whitespace,
`./gradlew check`, and desktop-install proof after its final diff. M5 owns the
stable benchmark and architecture gates; M6 additionally owns final owner
acceptance after the last UI diff.

## Current Migration Position

- Current foundation: M0 and M1 are merged. Session Generation now publishes
  the typed draft/commit/load/reward-read boundary, commits immutable semantic
  drafts idempotently, and uses separately owned bounded CPU and I/O execution.
- Current milestone: M2 replaces abstract generated Encounter slots with one
  concrete deterministic prepare-and-commit batch before planner orchestration
  changes.
- M0 closure: documentation whitespace, required `check`, and desktop install
  proof are green after the final owner-language diff.
- M1 closure: the Golden fixture uses two level-3 and two level-4 characters,
  adventure-day fraction `0.6`, three Encounters, and seed `179974`. Its final
  independent JUnit baselines recorded catalog load `0.212s`, pure engine
  `0.629s`, persistence commit plus canonical load `1.271s`, and structured
  reward batch read `0.320s`. Final `git diff --check`, focused production-route
  and architecture proof, required `check` (`4m 29s`), and desktop install
  (`14s`) are green after the last M1 code diff.

## Delivery Rules

Every milestone, including documentation-only M0, MUST:

1. finish its final diff with green `git diff --check`, `./gradlew check`, and
   `./gradlew installDesktopApp`
2. preserve a runnable production Session Planner
3. for M1 through M6, move a real production route toward the target rather
   than testing a parallel implementation
4. delete replaced code in the assigned milestone unless the compatibility
   budget names it
5. perform no destructive rewrite of real user data
6. keep JavaFX passive and foreign truth behind public owning APIs
7. record literal benchmark parameters and results for performance-changing
   milestones without turning this roadmap into a report archive
8. for milestones with behavior changes, leave owner-visible behavior ready to
   test

## M0: Target Lock And Roadmap

### Deliver

- remove preview/apply as target behavior and current-state prose from durable
  owner docs
- define one-click preparation, concrete Encounter rosters, structured rewards,
  one workspace snapshot, bounded execution, and performance acceptance
- align Session Planner, Session Generation, and Encounter ownership
- establish this roadmap as the sole migration and deletion owner

### Exit Gate

- durable requirements contain only observable behavior
- domain documents identify each write model and invariant once
- contracts define draft/commit, idempotency, batch reads, data compatibility,
  and error vocabulary
- architecture defines orchestration, execution, publication, quality targets,
  and rejected alternatives
- every rejected current surface has one deletion milestone
- final `git diff --check` is green
- final `./gradlew check` is green
- final `./gradlew installDesktopApp` is green

## M1: Session Generation Draft And Commit

### Deliver

- capture separate catalog-load, engine, persistence, and reward-read baselines
- publish typed `draft`, idempotent `commit`, `load`, and reward batch-read
  operations
- keep generation stages pure and run them on bounded CPU execution
- cache one validated immutable catalog snapshot per content identity
- add normalized run content fingerprint and canonical-row compatibility read
- expose structured reward detail without formatted-text dependence

### Exit Gate

- draft performs no SQLite write
- commit persists exactly the supplied semantic draft once
- equal retry succeeds and identity/content conflict fails closed
- canonical runs still load with their recorded engine/catalog meaning
- engine, persistence, and reward-read benchmarks are independently visible

### Retain Temporarily

- the current production `generate`/`load` delegates remain only for the caller
  that M3 replaces; M3 deletes them and their save-reload continuation

## M2: Concrete Encounter Batch Preparation

### Deliver

- publish Encounter prepare and commit operations for one generated intent batch
- load one union candidate snapshot for the complete batch
- deterministically create diverse concrete rosters and structured summaries
- persist the exact prepared batch atomically with idempotent origin
- batch-hydrate saved-plan summaries used by downstream planning

### Exit Gate

- every prepared Encounter has stable creature identities and positive
  quantities before any write
- no exact-XP or creature-detail query runs once per block or roster member
- any unresolvable intent returns no draft; any commit failure writes no plan
- equal retry returns the complete existing mapping
- the prepared summaries expose label, roster, count, adjusted XP, and
  difficulty

### Delete

- current abstract generated-plan spec and slot import
- first-match exact-XP selection policy and per-slot creature queries
- duplicate generated-origin write path

## M3: Prepare Session Orchestration And Persistence

### Deliver

- add one `prepareSession` use case with confirmation, fingerprint,
  cancellation, progress, and latest-wins behavior
- assemble and validate one complete `PreparedSessionDraft` in memory
- commit Session Generation and Encounter artifacts idempotently, then replace
  Session Planner references in one transaction
- migrate manual placeholders to manual loot notes without losing data

### Exit Gate

- one Generate intent reaches ready state without a second UI command
- stale, cancelled, invalid, or failed preparation changes no session
- successful preparation produces real saved Encounter rosters and typed reward
  references
- retry after either foreign or planner storage failure creates no duplicates
- existing canonical sessions and generated reward references reopen

### Delete

- backend preview and Apply commands, models, coordinator, generation-preview
  projection, and persistence assumptions
- UI auto-Apply dispatch and hidden second-command chaining
- deprecated Session Generation API delegates
- production generate/load save-reload continuation and generated-result
  equality checks used only as workflow transport

## M4: Workspace Snapshot And Structured Projection

### Deliver

- introduce `SessionPlannerWorkspaceSnapshot` and one application-owned
  assembler using the delivered Party, Encounter, Session Generation, and World
  Planner batch reads
- coalesce mutation and foreign-provider refresh into one latest-revision-wins
  publication
- batch-project structured generated rewards into the workspace
- introduce the single permitted legacy publication adapter if still needed

### Exit Gate

- all four visible planner regions render from one coherent revision
- one assembly performs one planner read and at most one batch read per foreign
  owner
- generated Encounter and reward detail is typed and no longer label-only
- query-count proof fails on per-scene, per-plan, reward, or creature reads
- stale assembly cannot replace a newer session revision

### Delete

- provider reads and context reconstruction from individual projections
- duplicate saved-plan, reward, and creature hydration inside one refresh
- backend generated `LootPlaceholder` and fallback-label projection when typed
  reward truth is available

## M5: Enforcement, Performance, And Legacy Deletion

### Deliver

- enforce JavaFX passivity, feature dependency direction, single workspace
  publication, and absence of retired preview or slot-import types
- add production-route consistency, cancellation, retry, query-bound, and
  reference-fixture performance proof
- remove remaining global-serial-lane use from the preparation path
- measure and optimize stage hotspots using the new diagnostics

### Exit Gate

- architecture gates mechanically reject every enforceable retired boundary
- bounded query proof is independent of scene, saved-plan, slot, and member
  cardinality
- warmed canonical three-Encounter fixture is within 2 seconds p95 over 20 runs
- JavaFX thread proof covers dispatch and immutable snapshot application only
- `./gradlew check` is green after the final backend deletion diff

### Delete

- compatibility constructors, duplicate APIs other than the M1 delegates,
  no-op routes, and global-serial preparation orchestration
- temporary backend metrics or probes that are not part of local diagnostics

## M6: Compact Frontend And Owner Acceptance

### Deliver

- render one compact preparation toolbar with progressive participant detail
- place saved-Encounter search and attach actions in the selected-scene
  inspector
- render structured reward cards and separate manual loot notes
- compact the state summary while retaining budget and selection context
- complete visual, interaction, generation-quality, and latency acceptance with
  the owner

### Exit Gate

- no nested preparation panel, redundant Generate card, permanent participant
  detail block, or full saved-plan control list remains
- the master-detail workflow retains edit, reorder, allocation, and selection
  behavior
- generated sessions visibly contain concrete rosters and structured loot
- all changed behavior has production-route proof, `./gradlew check` and desktop
  install are green, and the owner approves the complete feature

### Delete

- `LegacySessionPlannerPublicationAdapter`
- old controls, generation panel, preview/Apply chrome, generated
  loot-placeholder rendering, full saved-plan controls list, and duplicate state
  widgets
- this roadmap and its README link after the final migration merge

## Risks And Dependencies

- Encounter diversity is a policy concern, not only a query optimization. M2
  must prove deterministic alternatives and avoid accidental identical rosters
  when equivalent candidates exist.
- Existing canonical origin rows cannot be destructively rewritten. The
  Encounter adapter must normalize old and new origins behind one domain model.
- Foreign artifacts may exist without a Session Planner reference after a
  failed final write. They are immutable and idempotent; retry reuses them.
  Automatic deletion would be unsafe and is rejected.
- Catalog cold-load time can hide hot-path improvements. M1 and M5 report cold
  initialization separately from warmed preparation.
- The frontend change must not recreate provider orchestration while compacting
  layout. M6 consumes only the application snapshot and typed intents.

## Remaining Uncertainty

- The exact current query and stage-time baseline is not durable product truth;
  M1 measures it on the named fixture before optimization.
- Creature availability may make some role/CR intent combinations impossible.
  M2 must define and prove deterministic fallback quality without weakening the
  all-or-nothing batch result.
- Canonical databases may contain older generated origins in combinations not
  represented by fixtures. M2 inventories shapes through read-only migration
  tests before removing the old writer.
- The open master-detail frontend may merge before or during backend work. Its
  observable layout is adopted, but M6 rebases it onto the target workspace
  snapshot rather than retaining its internal models.

## References

- [Session Planner Owners](../README.md)
- [Session Generation Owners](../../sessiongeneration/README.md)
- [Encounter Owners](../../encounter/README.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
- [Documentation Placement](../../project/documentation.md)
