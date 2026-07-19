Status: Active Target
Owner: Session Planner Feature
Last Reviewed: 2026-07-19
Source of Truth: Session Planner structure, preparation orchestration,
publication, concurrency, and quality decisions.

# Session Planner Architecture

## Objective

The target supports one responsive preparation command that publishes concrete
Encounter rosters, structured rewards, and one coherent editable workspace
revision. Persistence is durable truth rather than in-process transport, and
latency stays bounded by provider family rather than saved or generated row
count.

## Stakeholders And Concerns

- Game masters need one responsive action, coherent progress, and one complete
  editable result.
- Session Planner maintainers need one orchestration owner, explicit foreign
  seams, and no persistence transport hidden in the workflow.
- Session Generation, Encounter, Party, and World Planner maintainers need their
  truth accessed only through their public APIs.
- Verification maintainers need observable revision behavior, fixed query
  families, stage timing, and one reproducible reference fixture.

This document owns structural and quality decisions for preparation and
workspace publication. Product outcomes belong to requirements, write-model
truth to domain documents, and payload or persistence semantics to contracts.

## Target Topology

```text
features/sessionplanner/api/
features/sessionplanner/domain/
features/sessionplanner/application/
features/sessionplanner/adapter/sqlite/
features/sessionplanner/adapter/javafx/
features/sessionplanner/SessionPlannerFeature
```

Session Planner remains one feature in the local modular monolith. It receives
`PartyApi`, `EncounterApi`, `SessionGenerationApi`, and `WorldPlannerApi`
explicitly from application composition. It exposes `SessionPlannerApi`, one
workspace snapshot publication, prepared-scene publication, and passive shell
contributions.

## One Workspace State

`SessionPlannerWorkspaceSnapshot` is the sole view-facing planner state. One
revision contains:

- session catalog and current session
- resolved participant summaries and budget
- ordered scene summaries and selected-scene detail
- linked Encounter summaries and structured generated rewards
- the selected-scene saved-plan search request epoch and typed transient state
- preparation status and stage progress
- display-safe missing-reference and failure states

`SessionPlannerWorkspaceAssembler` loads one planner snapshot, collects foreign
IDs, performs one batch read per owning feature, and joins immutable results in
memory. The JavaFX adapter renders that revision and dispatches typed intents;
it performs no provider calls, persistence, orchestration, or independent
projection refresh.

Publication is latest-revision-wins. One authored mutation or foreign-provider
revision schedules at most one coalesced assembly. Scene, participant, controls,
and state-panel views do not subscribe to separate planner projections.

The reusable selected-scene inspector carries the published source Session
revision into scene and manual-note drafts. Dirty scene and keyed note editors
survive same-scene publications, including focus and caret. A control rebases its
guard only while authoritative text still equals its loaded baseline; conflicting
truth preserves the older guard so the next save rejects as stale. Matching
coherent publication alone clears a submitted draft.

Catalog switching sends at most one typed select command. When a scene draft is
dirty, that command carries the guarded source edit; the authored lane saves it
and switches the pointer without publishing an intermediate source workspace.

Saved-plan search follows the same single-writer rule. JavaFX dispatches a
typed query and only renders the search state inside
`SessionPlannerWorkspaceSnapshot`; it does not filter cached plans. The
publication coordinator owns the query epoch, publishes searching and terminal
states, and accepts a completion only when the captured session identity,
source revision, and selected scene still match. Underlength input is resolved
locally with zero provider calls. Valid search hydrates the union of at most
eight returned hit identities and the already-linked plan identities in one
Encounter summary batch, then restores exact result order in memory.

## Publication Semantics

The application publishes one immutable workspace value at a time. Each value
contains the source `SessionRevision`, one monotonically increasing publication
revision, and the preparation status that applies to that source revision.
Assembly begins from a captured planner snapshot; foreign results are joined
only if that capture is still current. Completion from a stale capture is
discarded and cannot overwrite a newer publication.

An in-progress or failed preparation updates status around the last stable
authored workspace. Only a successful final Session Planner commit may publish
new authored prepared content. JavaFX applies a complete immutable value in one
dispatch and never combines sections from different revisions.

## Prepare Session Use Case

```text
JavaFX Generate intent
  -> SessionPlannerApi.prepareSession(command)
  -> capture plan revision + generation inputs + preparation identity
  -> SessionGenerationApi.draft(request)
  -> EncounterApi.prepareGeneratedBatch(batch)
  -> validate PreparedSessionDraft
  -> commit generation run || commit Encounter plan batch
  -> replace SessionPlan references
  -> assemble and publish one workspace revision
```

The two foreign commits may run concurrently after complete in-memory
validation. Session Planner commits only after both succeed. The preparation
identity is derived from session identity, source revision, normalized inputs,
and seed; Session Generation and Encounter retain it with their content
fingerprints. A planner write failure therefore leaves reusable immutable
foreign artifacts rather than triggering compensating deletion.

Preparation never uses persistence as message transport. The generated draft
and concrete Encounter roster drafts remain typed in-memory values until the
commit stage. Session Generation validates again at its write boundary;
Encounter validates the full concrete batch before its transaction.

## Responsibility Boundaries

Session Planner owns:

- the user command, replacement confirmation, captured fingerprint, progress,
  cancellation, orchestration, and final planner mutation
- planner-owned session and workspace state
- translating foreign results into planner references

Session Generation owns:

- deterministic encounter intents, reward generation, audits, catalog
  identity, immutable generation-run persistence, and typed reward reads

Encounter owns:

- one batch creature-candidate snapshot, concrete roster selection, encounter
  math, saved-plan validation, and atomic idempotent plan persistence

Party and World Planner own their facts. No feature imports another feature's
implementation package or repository.

## Execution And Cancellation

- the JavaFX dispatcher only captures intents and applies completed immutable
  snapshots
- pure generation and Encounter draft construction run on bounded CPU work
- resource and SQLite work run on I/O execution; database transactions remain
  short and contain no generation search
- no global serial lane encloses the whole preparation workflow
- each request has a cancellation token and captured fingerprint
- a newer request, session switch, or relevant authored revision cancels or
  invalidates older work
- late completion may contribute diagnostics but cannot publish or commit
  against a stale fingerprint
- `saving` remains cancellable while the two immutable, idempotent foreign
  commits finish; cancellation retains those artifacts and skips the Planner
  write without compensation
- after both foreign commits and command assembly, the coordinator rechecks the
  current Session identity and revision, then enters one synchronized final
  Planner-commit point of no return immediately before `commitPreparedSession`
- entering that boundary atomically verifies the attempt is still latest,
  marks it non-cancellable, and republishes the same attempt and Session as
  `saving` with cancellation disabled; failure to enter skips the Planner store
- cancellation after that boundary is a strict no-op and cannot suppress the
  Planner store's `ready`, `invalid`, or `failed` outcome; newer-attempt and
  authored invalidation rules remain authoritative

Stage timings record stable request identity, stage, duration, candidate count,
and query count only. Diagnostics exclude authored text, creature payloads,
generated item text, SQL, and local paths.

## Compact JavaFX Composition

The accepted master-detail timeline remains. The controls adapter renders one
horizontal preparation toolbar with progressive disclosure for participant
detail. Saved-plan search belongs to the selected-scene inspector. The Generate
button and progress share the toolbar; there is no separate preparation card or
Apply control. Generated rewards use structured cards, while manual loot notes
use a separate presentation type.

## Performance Model

The hot path has bounded service calls:

- one Party resolution read
- one immutable Session Generation catalog snapshot per catalog version
- one Encounter candidate batch read for all generated intents
- one generation-run transaction and one Encounter-plan batch transaction
- one Session Planner replacement transaction
- one batch workspace assembly after commit

It forbids per-slot creature queries, per-creature detail reads, loading every
saved Encounter plan to render controls, repeated full Session catalogs during
one assembly, save-then-reload equality checks, and independent projection
fan-out.

Measurable architecture targets are:

- Generate dispatch and immutable snapshot application are the only
  preparation work allowed on the JavaFX thread; in-progress publication is
  eligible for the next pulse.
- one workspace assembly performs one planner read and at most one batch read
  each from Party, Encounter, Session Generation, and World Planner, independent
  of scene, saved-plan, reward, slot, and roster-member cardinality
- ordinary workspace assembly never reads the global Encounter saved-plan
  catalog. Search reads one bounded root statement and publishes at most eight
  hits; Encounter summary hydration uses a fixed six-statement temp-relation
  read independent of result and roster cardinality
- Session Generation reward hydration uses one connection-scoped temporary
  request relation and five actual statement executions for non-empty batches,
  independent of 1, 401, or 800 reward references; caller order, duplicates,
  and missing identities are reconstructed in memory
- the warmed reference fixture is two level-3 and two level-4 participants,
  `0.6` adventure days, and three encounters over 20 runs; the complete editable
  publication must satisfy the 2-second p95 product target
- catalog initialization, migration, and cold caches are measured separately;
  each CPU, foreign-read, commit, assembly, and JavaFX-apply stage records its
  own duration and query count

## Durable Decisions And Rejected Alternatives

Chosen decisions:

- `prepareSession` is the sole preparation use case; it validates one complete
  typed in-memory preparation before durable commits.
- The master-detail workspace renders one revisioned workspace snapshot.
- Encounter preparation produces concrete rosters from one batch candidate
  boundary; abstract slots are not a planner result.
- Generated reward truth remains in Session Generation and is batch-projected
  into Session Planner through stable references.
- Revision guards, idempotent foreign commits, and one final optimistic planner
  commit provide retry safety without shared storage ownership.

Rejected alternatives:

- backend preview/apply and save/reload workflow transport
- multiple independently refreshed planner projections
- copied foreign reward, creature, Party, or World Planner truth
- a shared cross-feature transaction, workflow database, saga store, or event
  bus
- a remote generator service, dynamic rules plugin system, or second generation
  UI

## Enforcement And Proof

Architecture enforcement rejects JavaFX orchestration, foreign implementation
imports, repositories crossing APIs, Session Generation JavaFX code, and
planner persistence of foreign detail. Production-route proof owns stale-result
rejection, idempotent retry, all-or-nothing replacement, structured reward
projection, concrete Encounter rosters, bounded query counts, responsiveness,
and the warmed reference-fixture threshold.

## References

- [Requirements](../requirements/requirements-session-planner.md)
- [Domain](../domain/domain-session-planner.md)
- [Persistence Contract](../contract/contract-session-planner-persistence.md)
- [Session Generation Architecture](../../sessiongeneration/architecture/architecture-session-generation.md)
- [Encounter Generated Preparation](../../encounter/contract/contract-encounter-generated-import.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
