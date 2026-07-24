Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-24
Source of Truth: Target source shape, dependency direction, and
architecture-significant quality constraints for the SaltMarcher desktop app.

# Source Architecture

## Purpose And Concerns

This specification serves maintainers changing features, persistence, the
JavaFX shell, and application startup. It answers where behavior belongs, how
features collaborate, and which boundaries protect UI responsiveness, local
data, and diagnosability.

SaltMarcher remains one local JavaFX desktop process and one Gradle application.
Local persistence has one installation-owned store for the Campaign registry
and reusable definitions plus one physically separate store per Campaign. Only
one Campaign runtime is active in the shell at a time. The target is a modular
monolith, not a distributed system or a set of Gradle subprojects.

## Target Shape

```text
app/       explicit application composition and lifecycle
shell/     passive JavaFX host and shell contracts
platform/  execution, persistence, diagnostics, and state mechanisms
features/  capability-driven feature roles and required adapters
resources/ static resources and centralized application styling
docs/      durable product, domain, contract, architecture, and proof truth
tools/     retained build and development tooling
```

Feature roles follow owned behavior rather than a mandatory folder template. A
feature publishes `api` only for capabilities consumed outside its
implementation, owns `domain` only for business truth and invariants, and owns
`application` only for use-case orchestration. A feature with stored truth owns
an `adapter/sqlite`; a feature with JavaFX presentation owns an
`adapter/javafx`; bundled read-only reference data belongs in an
`adapter/resource`; explicit remote protocol integration belongs in an
`adapter/http`. Empty role packages are forbidden. Dungeon remains one
feature and publishes separate Authored, Editor, and Travel APIs.

## Permanent Boundaries

- `app` MUST compose platform services, feature entry points, and shell
  contributions explicitly and deterministically. It may depend on every
  target root but MUST NOT own feature behavior or long-lived feature state.
- `app` MUST give the installation lifetime and each active Campaign runtime
  separate persistence and execution lifecycles. One installation-owned
  activation coordinator serializes Campaign changes and owns the activation
  generation, durable active-Campaign pointer, and runtime admission fence.
- `shell` MUST remain independent from feature implementations. Features may
  use `shell.api` contracts; the shell receives already constructed
  contributions and MUST NOT locate feature services. Shell internals may use
  feature-neutral platform mechanisms; `shell.api` contracts remain free of
  platform implementation types.
- `platform` MUST contain only feature-neutral mechanisms. It MUST NOT import
  `app`, `shell`, or feature code. Its capability packages are
  `platform.execution`, `platform.persistence`, `platform.diagnostics`,
  `platform.state`, and `platform.ui`; new catch-all packages are forbidden.
  Passive map camera, viewport, layered-canvas, cache, and technical pointer
  mechanisms live in `platform.ui.mapcanvas`; they do not form a Maps feature
  or own adopter coordinates and behavior.
- A feature MUST expose cross-feature capabilities only from its `api` package.
  Application, JavaFX adapter, and composition code may consume foreign APIs;
  no consumer may import another feature's domain, application, adapters, or
  composition entry point.
- Feature domain roles MUST remain independent from `platform`. Observable API
  contracts may use feature-neutral state and UI-dispatch contracts.
  Application code may use execution, state, UI-dispatch, and diagnostics
  contracts; SQLite adapters may use persistence and diagnostics; JavaFX
  adapters may use UI contracts; HTTP adapters may use diagnostics; feature composition may wire any platform
  capability.
- Feature API calls that can touch persistence or files MUST be non-blocking.
  JavaFX state changes MUST be dispatched explicitly to the UI thread.
- Published feature state MUST be immutable and revisioned. A late asynchronous
  result MUST NOT overwrite newer state.
- Feature SQLite adapters own their stored truth and migration steps. Reusable
  definitions and the Campaign registry use the installation store;
  Campaign-owned truth uses only that Campaign's store. Cross-store references
  use stable logical identities and MUST NOT depend on cross-database foreign
  keys or duplicate mutable Campaign truth. Shared connection, integrity,
  backup, and recovery mechanisms belong to `platform`. JDBC and SQLite driver
  APIs are allowed only in feature SQLite adapters and `platform.persistence`.
- Technical diagnostics MUST remain local and MUST NOT record feature payloads,
  secrets, or user-authored content.

The global compact travel context is owned by a feature-neutral Travel
capability. It consumes Party position plus Dungeon and Hex API readbacks,
publishes one immutable `TravelContextSnapshot`, and owns the single global
`Reise` state contribution. Dungeon and Hex retain their movement semantics and
detailed workspaces; `app` only composes these APIs.

Internal Java types have no compatibility obligation while all consumers move
atomically in one green slice. Persisted data and observable behavior retain
their contract and requirement owners.

## Campaign Runtime Boundary

An installation runtime owns shared reference capabilities, the Campaign
registry, and a lifecycle/import coordinator. The coordinator owns bounded
validation, staging, identity remapping, and atomic promotion of a complete
Campaign package including its store and assets; feature owners retain their
payload truth. Existing shared definitions and Campaigns remain unchanged
until all required import choices and validation have succeeded.

A Campaign runtime owns the Campaign-scoped feature components, their execution
lanes, their SQLite lifecycle, and their bound shell contributions. Core
readiness means preservation plus the required survivor journeys have valid
semantic state, can open and render safely, and have a writable transactional
persistence boundary. Candidate preparation MUST use a non-payload rollback
probe and MUST NOT create, alter, or delete user-authored truth merely to test
readiness. The exact next durable feature mutation is release-qualified through
the same production composition and persistence route against a disposable
Campaign, then exercised normally only after visible activation. An optional or
supporting capability that fails readiness starts explicitly disabled or
degraded and does not block the core shell. Runtime closure is idempotent and
rejects later work.

Campaign activation is one serialized state transition:

1. prepare a core-ready candidate without admitting Campaign mutations;
2. close admission for the current runtime and drain every accepted mutation;
3. durably commit the target Campaign and a new activation generation in the
   installation registry; this commit is the linearization and crash-truth
   point;
4. publish the candidate's whole Campaign shell root and admit its generation;
5. close the detached runtime and its resources.

Application and persistence boundaries reject a revoked runtime generation
before commit. Failure before the registry commit reopens the unchanged prior
runtime. Failure after that commit never reopens prior mutation authority: the
coordinator keeps the UI in an explicit switching/recovery state and rolls
forward to the durably selected Campaign. Restart follows the same durable
selection.

Campaign switching replaces the whole Campaign shell root. The shell does not
discover services, retain contributions from an inactive runtime, or coordinate
state copying between runtimes. Retrofitting selector columns into today's
mixed global store, shadow snapshots, and dual live graphs are not accepted as
compatibility bridges for this migration; a future owner-scoped store design
may use internal discriminators only with independent isolation proof.

## Delivery State

Temporary repository state, verification scope, and the next deletion boundary
live only in feature-owned `docs/<feature>/delivery/` documents routed from the
feature README. They do not modify this target.

The target-package ArchUnit rules are mechanically enforced by
`architectureTest` and `check`.

## Rationale

Vertical ownership keeps one behavior change local to its feature. Explicit
composition makes dependencies visible to the compiler. Physical Campaign
store separation gives switching, recovery, and export a Campaign-sized
containment boundary while the lifecycle coordinator preserves cross-store
consistency. Non-blocking I/O keeps the JavaFX event thread responsive.
Versioned persistence and local diagnostics make failures recoverable without
transmitting user data.

Generic classpath discovery, a shell-owned service locator, horizontal
domain/view/data roots, and package-form compatibility were rejected because
they hide dependencies, fragment ownership, and make safe migration harder.

## References

- [Feature Boundary Standard](patterns/feature-boundaries.md)
- [Application Composition Standard](patterns/application-composition.md)
- [Shell Layer Standard](patterns/shell-layer.md)
- [Styling Standard](patterns/styling.md)
- [Verification Core Architecture](verification-core.md)
- [Documentation Standard](../documentation.md)
