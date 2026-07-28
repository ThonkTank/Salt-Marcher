# Session Generation Architecture

Status: Active Godot architecture with implemented generation and preparation path
Owner: Session Generation
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose

Session Generation provides deterministic encounter-and-reward computation as
one UI-free capability. It must remain independently usable, preserve the staged
reference behavior, expose structured loot, and avoid using SQLite round trips
as workflow transport.

## Stakeholders And Concerns

- Session Planner needs a complete deterministic value that can continue
  directly into preparation and can later be made durable idempotently.
- Encounter needs ordered structured intents without reward or persistence
  internals.
- Session Generation maintainers need pure stage seams, stable catalog meaning,
  and normalized immutable storage.

This document owns execution, dependency direction, publication semantics, and
architecture quality targets. Observable result behavior belongs to
requirements; run truth belongs to the domain; API and storage semantics belong
to the contract.

## Current Native Topology

```text
godot/src/features/sessiongeneration/
  session_generation_catalog.gd
  session_generation_engine.gd
  session_generation_reward_policy.gd
  session_generation_run_knowledge.gd
  session_generation_run_command_controller.gd
godot/src/features/sessionplanner/
  session_preparation_policy.gd
  session_preparation_coordinator.gd
resources/sessiongeneration/
```

The Session Generation files remain UI-free. Session Planner owns the
cross-owner coordinator and the only visible controls. Feature-neutral Campaign
and Shared-Definition mechanisms provide storage and current creature facts;
composition supplies the runtime writer. No JavaFX or second generation route
is published.

## Runtime

```text
Session Planner preparation
  -> SessionGenerationEngine + SessionGenerationRewardPolicy on one worker
  -> cached immutable catalog snapshot
  -> complete generated run and prepared Encounter batch in memory
  -> immutable Session Generation Campaign-partition commit
  -> idempotent Encounter batch Campaign-partition commit
  -> revision-checked Session replacement Campaign-partition commit
```

The complete draft continues directly into Encounter resolution and Session
Planner assembly. The three owner commits are deliberately ordered rather than
placed in a cross-owner transaction. A cancellation or final stale Session may
leave valid immutable run/Encounter artifacts; retry reuses them by content
identity and no compensation deletes foreign truth.

## Publication Semantics

The API publishes only complete immutable operation results. `draft` publishes
either one complete `GeneratedRunDraft` or one typed failure; no stage result or
partially populated reward collection crosses the boundary. `commit` publishes
the durable identity for exactly the submitted semantic draft. `load` and
reward batch reads publish immutable typed values with stable request ordering.

Session Generation publishes no view state and initiates no consumer refresh.
The calling application owns cancellation and whether a late result is still
eligible for use. Cancellation prevents avoidable remaining work but never
turns a partial stage value into a public success.

## Pipeline

The engine retains pure typed stage seams for session context, encounter target
allocation, candidate construction and selection, treasure planning, loot
resolution, packing, output, and audits. Each stage consumes immutable values
and returns immutable values. The engine performs no API mapping, persistence,
resource loading, clock access, diagnostics, or foreign-feature call.

The Session Planner coordinator validates the exact session revision and Party
snapshot, obtains one validated catalog and one complete Creature snapshot,
invokes the pure policies on a worker, then submits already-validated owner
candidates through the serial Campaign writer. Persistence validation never
reruns generation rules.

## Catalog Lifecycle

One catalog artifact is validated and cached by `(catalogVersion,
catalogContentHash)`. Concurrent requests share the immutable snapshot. Artifact
loading runs once per content identity and never occurs inside a Campaign
commit.
A failed refresh cannot replace the last valid snapshot for an already pinned
version.

## Boundaries

- Pure generation code depends on no Node, file path, clock, UI, Campaign
  writer, or foreign owner.
- The run owner validates its complete versioned document and content identity.
- The Session Planner coordinator alone reads foreign snapshots and sequences
  owner publications.
- Composition is the only construction point.
- Session Generation does not call Session Planner, Party, Creatures, or
  Encounter.
- Concrete creature selection remains Encounter-owned.

Forbidden shortcuts include direct foreign owner mutation, Java/SQLite reads,
JavaFX controls, shell service lookup, mutable unversioned catalog state,
opaque formatted-text-only output, and one monolithic generator method hiding
stage boundaries.

## Execution And Performance

Pure drafting and file snapshot reads run on one bounded worker per visible
preparation. Only confirmed owner publications enter the shared serial Campaign
writer. Caller cancellation stops avoidable stages and never publishes a
partial Session.

The application publishes stage duration and candidate cardinality diagnostics
without content. Separate engine and I/O measurements prevent slow persistence
from being misdiagnosed as generation cost.

Measurable architecture targets are:

- drafting performs zero Campaign writes and never opens SQLite; catalog
  loading and generation search stay outside Campaign commits
- the visible coordinator admits one active preparation and exposes explicit
  cancellation and stage progress
- catalog validation happens at most once per catalog content identity before
  reuse of its immutable snapshot
- commit, load, and reward hydration use complete owner partitions and one
  ordered reward batch, never one file read per treasure, item, or packing row
- the Golden input produces the same deterministic engine result, while the
  shared warmed three-Encounter reference workload records catalog, engine,
  commit, and reward-read stages separately and remains inside the Session
  Planner 2-second p95 end-to-end target over 20 runs

## Durable Decisions And Rejected Alternatives

Chosen decisions:

- Session Generation remains a separate UI-free feature because deterministic
  reward truth, catalog identity, audits, and immutable run history have one
  lifecycle.
- The engine uses pure typed stages so parity and performance are attributable
  to named computation boundaries.
- Draft and commit are separate operations so a complete prepared session can
  be validated before a run becomes durable.
- Runs use structured immutable file persistence and idempotent content-checked
  commit so rewards and reproducibility survive restart and rendering.

Rejected alternatives:

- saving and reloading a run as in-process workflow transport
- a monolithic generator that hides stage values and audit boundaries
- JavaFX publication or a second generation UI
- a remote generator service, rules plugin framework, event bus, shared
  cross-feature transaction, or compensating deletion
- compatibility with unadopted proof-of-concept schemas or Java carriers

## Sources

- [Requirements](../requirements/requirements-session-generation.md)
- [Domain](../domain/domain-session-generation.md)
- [Contract](../contract/contract-session-generation.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
