Status: Active Target
Owner: Session Generation Feature
Last Reviewed: 2026-07-18
Source of Truth: Session Generation seams, pipeline, execution, and dependency
direction.

# Session Generation Architecture

## Purpose

Session Generation provides deterministic encounter-and-reward computation as
one UI-free capability. It must be independently testable, preserve the staged
reference behavior, expose structured loot, and avoid using SQLite round trips
as workflow transport.

## Stakeholders And Concerns

- Session Planner needs a complete deterministic value that can continue
  directly into preparation and can later be made durable idempotently.
- Encounter needs ordered structured intents without reward or persistence
  internals.
- Session Generation maintainers need pure stage seams, stable catalog meaning,
  and normalized immutable storage.
- Verification maintainers need independent engine, catalog, persistence, and
  reward-read measurements plus deterministic fixture replay.

This document owns execution, dependency direction, publication semantics, and
architecture quality targets. Observable result behavior belongs to
requirements; run truth belongs to the domain; API and storage semantics belong
to the contract.

## Target Topology

```text
features/sessiongeneration/api/
features/sessiongeneration/domain/
features/sessiongeneration/application/
features/sessiongeneration/adapter/resource/
features/sessiongeneration/adapter/sqlite/
features/sessiongeneration/SessionGenerationFeature
resources/sessiongeneration/
```

`SessionGenerationFeature` receives bounded CPU execution, I/O execution,
persistence, and local diagnostics from application composition. It publishes
one `SessionGenerationApi` and no JavaFX or shell contribution.

## Runtime

```text
Session Planner preparation
  -> SessionGenerationApi.draft
  -> cached immutable catalog snapshot
  -> pure staged GenerationEngine
  -> GeneratedRunDraft in memory
  -> SessionGenerationApi.commit
  -> one atomic normalized write
```

The successful draft continues directly into Encounter drafting and Session
Planner assembly. Commit adds durability once the full prepared session is
valid. It never requires a save, reload, and equality comparison in the hot
path.

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

The application layer validates API input, obtains one already-validated
catalog snapshot, invokes the engine on CPU execution, assigns stable run
identity and content fingerprint after hard audits, and maps the result. The
persistence adapter validates and writes the same semantic candidate; it does
not rerun generation rules.

## Catalog Lifecycle

One catalog artifact is validated and cached by `(catalogVersion,
catalogContentHash)`. Concurrent requests share the immutable snapshot. Artifact
loading runs once per version and never occurs inside a SQLite transaction.
A failed refresh cannot replace the last valid snapshot for an already pinned
version.

## Boundaries

- API uses JDK and feature-neutral async values only.
- Domain depends on no API, SQL, JavaFX, platform, or foreign feature.
- Application depends inward on domain and outward on feature-owned ports.
- Resource and SQLite adapters implement those ports and contain no generation
  policy.
- Composition is the only construction point.
- Session Generation does not call Session Planner, Party, Creatures, or
  Encounter.
- Concrete creature selection remains Encounter-owned.

Forbidden shortcuts include direct foreign database reads, Encounter
repositories, JavaFX controls, shell service lookup, mutable global catalog
state, JSON run persistence, opaque formatted-text output, and one monolithic
generator method hiding stage boundaries.

## Execution And Performance

Pure drafting runs on bounded CPU execution. Catalog and SQLite work run on I/O
execution. Transactions contain only validation against prepared rows and
database writes. Multiple independent generation drafts are not globally
serialized; caller cancellation stops avoidable stage work.

The application publishes stage duration and candidate cardinality diagnostics
without content. Stage benchmarks and the Session Planner end-to-end fixture
detect algorithmic regressions. Persistence round-trip tests remain separate
from engine benchmarks so slow I/O is not misdiagnosed as generation cost.

Measurable architecture targets are:

- `draft` performs zero SQLite operations and runs generation only on bounded
  CPU execution; catalog loading and all persistence run on I/O execution
- requests are not globally serialized; parallelism is bounded by the supplied
  executors and transactions contain no catalog load or generation search
- catalog validation happens at most once per catalog content identity before
  reuse of its immutable snapshot
- commit, load, and reward hydration use query families bounded by operation,
  never one query per encounter, treasure, item line, or packing row
- the Golden input is replayed as a deterministic engine fixture, while the
  shared warmed three-Encounter reference fixture records catalog, engine,
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
- Runs use normalized immutable persistence and idempotent content-checked
  commit so structured rewards and reproducibility survive one rendering.

Rejected alternatives:

- saving and reloading a run as in-process workflow transport
- a monolithic generator that hides stage values and audit boundaries
- JavaFX publication or a second generation UI
- a remote generator service, rules plugin framework, event bus, shared
  cross-feature transaction, or compensating deletion
- compatibility with unadopted proof-of-concept schemas or Java carriers

## Sources

- Readable pipeline evidence:
  `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- Preserved original:
  `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
- [Requirements](../requirements/requirements-session-generation.md)
- [Domain](../domain/domain-session-generation.md)
- [Contract](../contract/contract-session-generation.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
