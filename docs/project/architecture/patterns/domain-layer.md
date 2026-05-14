Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Binding domain-layer pattern, role ownership, communication seams, context map, and topology for `src/domain/**`.

# Domain Layer Standard

## Goal

SaltMarcher treats `src/domain/**` as the application core. Domain code owns
business meaning, current work state, workflow orchestration, published domain
language, cross-context coordination seams, and same-context backend service
assembly below the view layer. It does not own UI translation, persistence
mechanics, data-source records, SQL, filesystem, network, or framework
concerns. Runtime service composition is legal only in direct context-root
`*ServiceContribution` and optional `*ServiceAssembly` files.

This document is the sole architectural source of truth for `src/domain/**`.
The repo-owned `tools/quality/skills/domain-layer/SKILL.md` operationalizes
this standard for agent work. Domain enforcement documents under
`docs/project/architecture/enforcement/` may inventory gates, candidate rows,
review-owned rows, and current mechanical drift, but they must not redefine
the pattern or become a second architecture owner.

## Current State And Target State

Current state: production still contains some legacy tactical packages and blockers that cover that migration shape. Enforcement documents must describe
remaining drift literally instead of making it the target architecture.

Target state:

- one context MAY expose one or more direct root `*ApplicationService` files,
  one per decision family
- `ApplicationService` interprets inbound intent only when the view-side
  `IntentHandler` lacks domain decision context, then routes to exactly one
  focused `UseCase`
- `UseCase` owns exactly one work operation and orchestration only
- `Helper` owns pure explicit work steps and reads no current context
- `Constants` owns immutable shared constants
- `Model` owns internal dynamic work state
- `Published` is the only outward communication seam
- `Port` is the inbound domain-internal listener role for foreign published
  state
- `Repository` is the outbound domain role for foreign domain writes and
  layered data access
- `ServiceContribution` is the direct context-root runtime discovery role for
  registering same-context domain services
- `ServiceAssembly` is the optional direct context-root constructor-wiring
  collaborator for one same-context `ServiceContribution`

## Role Family

The closed architectural role family is:

| Role | Meaning |
| --- | --- |
| `ApplicationService` | Family-scoped public backend boundary below the view layer. |
| `UseCase` | One concrete work operation and its orchestration. |
| `Helper` | Pure explicit work step with all context supplied as input. |
| `Constants` | Immutable shared constants used by helpers or models. |
| `Model` | Internal dynamic work-state owner. |
| `Published` | Outward communication surface for commands and observable state. |
| `Port` | Inbound listener on foreign published state. |
| `Repository` | Outbound trigger for foreign domain work and layered data access. |
| `ServiceContribution` | Context-root runtime discovery and registration role. |
| `ServiceAssembly` | Optional context-root constructor-wiring collaborator. |

Any topology outside this closed role family is illegal.

## Core Principles

- a context exposes one or more direct root `*ApplicationService.java` files
- each `ApplicationService` belongs to one decision family and stays thin
- each public root method accepts exactly one same-context
  `published/*Command` carrier and returns `void`
- each root method routes to exactly one focused `UseCase`
- each `UseCase` owns one work operation only and contains orchestration, not
  embedded business-policy logic
- `Helper` code receives all required context through parameters and must not
  own current context, repositories, ports, use cases, published handles, or
  callback protocols by itself
- `Constants` contains only static immutable domain-owned constants
- `Model` owns mutable internal state; changing model state is what changes the
  outward `Published` view of that state
- same-context outward readback or feedback does not travel back as a direct
  `ApplicationService` return value; it is observed through same-context
  `published/*Model`
- foreign-domain writes are initiated through same-context `Repository`
  ownership, not by scattering foreign `ApplicationService` knowledge through
  arbitrary use cases
- foreign-domain publications are consumed through same-context `Port`
  listeners, not by polling foreign internals
- domain code does not depend on `bootstrap/**`, `src/view/**`, `src/data/**`,
  JavaFX, SQL, filesystem, network, or runtime composition APIs outside the
  narrow direct-root `ServiceContribution`/`ServiceAssembly` exception

## Canonical Flows

### View Write

`IntentHandler -> family ApplicationService -> one UseCase -> Model ->
Published`

### Cross-Domain Write

`own Repository -> foreign ApplicationService -> foreign UseCase -> foreign
Model -> foreign Published -> own Port -> own UseCase -> own Model -> own
Published`

### Backend Registration

`bootstrap discovery -> context ServiceContribution -> context ServiceAssembly
-> family ApplicationService / published Model registration`

## Role Contracts

### `*ApplicationService.java`

- direct root file under `src/domain/<context>/`
- named `<Context><Family>ApplicationService.java`
- `public final` top-level class
- interprets inbound command only where domain decision context is missing on
  the view side
- delegates to exactly one focused `UseCase`
- may collaborate only with same-context `UseCase` ownership and same-context
  non-`*Model` published command carriers
- does not own business policy, model mutation details, publication ownership,
  repositories, ports, helpers, shell registration, runtime service lookup,
  callback protocols, or adapter construction

### `UseCase`

- owns exactly one work operation such as moving one corridor, saving one
  encounter, or adding one creature
- orchestrates reads, writes, repository calls, port-triggered follow-up work,
  and helper invocation
- direct root `application/*UseCase` is reserved for orchestration across at
  least two same-context `model/<family>/...` families; one-family work
  belongs under that family's `model/<family>/usecase/`
- direct root `application/*UseCase` files must not depend on other root
  `application/*UseCase` files or their nested types
- may construct, load, edit, and persist `Model`
- may collaborate only with same-context `Model`, model-family `UseCase`,
  `Helper`, `Constants`, `Port`, `Repository`, and foreign root `ApplicationService`
- does not hide business-policy logic that belongs in `Helper` or subordinate
  model roles, and it does not absorb published, root-boundary, callback, or
  infrastructure concerns

### `Helper`

- pure explicit work step such as a calculation, validation, derivation, or
  deterministic construction
- receives every needed value as input
- may depend only on same-context `Model` input types, same-context
  `Constants`, and passive platform types
- must not inspect current `Model`, subscribe to `Published`, invoke
  `Repository`, talk to `Port`, invoke `UseCase`, or own callback/protocol
  seams

### `Constants`

- immutable shared domain constants only
- no current-state access
- depends only on same-context `Constants` and passive platform types
- no lifecycle, listeners, callbacks, runtime composition, or infrastructure
  knowledge

### `Model`

- owns internal dynamic work state such as current encounter plans, loaded
  maps, active editor session state, or authored aggregates
- is created, read, and edited by `UseCase`
- lives under `model/<family>/model/`, where a family MAY add deeper semantic
  subpackages for subordinate models of that same family
- may depend only on same-context `Model`, same-context `Constants`, and
  passive platform types
- must not own repositories, ports, root boundaries, published handles,
  callback protocols, or foreign domain seams
- state change is the source that updates outward `Published`

### `published/`

`published/` owns exported boundary language only.

- allowed: commands, ids, statuses, enums, passive records, sealed carrier
  abstractions, and same-context `*Model` publication handles
- same-context `published/*Model` exposes public readback through `current()`
  and `subscribe(...)` only
- non-`*Model` published carriers stay passive and thinner than the internal
  working state behind them
- forbidden: services, helpers, repositories, ports, gateways, factories, or
  invariant-owning active objects

### `Port`

- domain-internal inbound listener on foreign `published/*Model`
- listens through `current()` and `subscribe(...)`
- converts foreign published change intake into same-context `UseCase` work
- may depend only on foreign `published/**`, same-context `UseCase`,
  same-context `Model`, same-context `Constants`, and passive platform types
- does not own foreign mutation triggers, repositories, same-context
  `Published`, callback relays, or data-source access

### `Repository`

- domain-owned outbound collaborator
- may trigger foreign family `ApplicationService` calls
- may construct foreign published non-`*Model` command/result/value carriers
  needed by those foreign root services
- may perform layered data access through outer adapters
- returns only same-context internal domain/application types; never `src.data`
  types or foreign published carriers
- may depend only on foreign root `ApplicationService`, same-context `Model`,
  foreign published non-`*Model` command/result/value carriers, same-context
  `Constants`, same-context repository-local types, and passive platform types
- does not own long-lived current state, published handles, port intake, or
  callback/listener seams; that remains in `Model`

### `*ServiceContribution.java`

- direct root file under `src/domain/<context>/`
- named `<Context>ServiceContribution.java`
- `public final` top-level class with a public no-arg constructor
- implements `shell.api.ServiceContribution` as the narrow bootstrap discovery
  seam
- registers same-context domain root services and same-context published-model
  handles into `ServiceRegistry`
- does not own business policy, persistence mechanics, source queries, mapping
  rules, or reusable factories

### `*ServiceAssembly.java`

- optional direct root file under `src/domain/<context>/`
- named `<Context>ServiceAssembly.java`
- package-private constructor-wiring collaborator used only by the same-context
  `ServiceContribution`
- may require foreign public domain services and published models from
  `ServiceRegistry` to construct same-context repositories, ports, use cases,
  application services, and published models
- does not implement `ServiceContribution` and does not own business policy,
  persistence mechanics, source queries, mapping rules, public backend APIs, or
  reusable factories

## Domain Topology

Target topology:

```text
src/domain/<context>/
  <Context><Family>ApplicationService.java
  <Context>ServiceContribution.java
  <Context>ServiceAssembly.java
  published/
  application/
    *UseCase.java
  model/
    <family>/
      model/
      usecase/
      helper/
      constants/
      port/
      repository/
```

Rules:

- direct root technical buckets are `published/`, `application/`, and `model/`
- no named domain modules remain at context root; any other direct child
  bucket is illegal
- `application/` is reserved for root-level cross-model orchestration use
  cases; model-local operations live under `model/<family>/usecase/`
- `model/` is the primary home of context-owned dynamic state
- `model/<family>/model/` is the internal model subtree; it MAY contain direct
  model files or deeper semantic subpackages for subordinate models of the
  same family
- nested subpackages inside `model/<family>/model/**` stay semantic; technical
  buckets such as `published`, `application`, `usecase`, `helper`,
  `constants`, `port`, `repository`, and rejected legacy role names are
  illegal there
- `usecase/`, `helper/`, `constants/`, `port/`, and `repository/` are the
  only non-model subordinate role buckets under a model family
- non-model role buckets stay direct-file only
- direct root Java files under `src/domain/<context>/` are limited to
  `*ApplicationService.java`, `*ServiceContribution.java`, and optional
  `*ServiceAssembly.java`
- direct Java files under named model families are forbidden; Java files belong
  in an explicit role package
- reserved role suffixes are path-owned: `*ApplicationService`, `*UseCase`,
  `*Helper`, `*Constants`, `*Port`, and `*Repository` may appear only in their
  canonical buckets
- legacy suffixes such as `*BoundaryTranslator`, `*Projector`,
  `*RuntimeAccess`, `*RuntimeAdapter`, `*Policy`, `*Service`, `*Factory`,
  `*Aggregate`, `*Entity`, and `*Specification` are forbidden

## Context Roles

- `party`: Party Character State Context.
- `creatures`: Reference Catalog Context.
- `encounter`: Roster Truth Context.
- `encountertable`: Reference Catalog Context.
- `dungeon`: Authored World-Space Context.
- `dungeoneditor`: Generation Policy Context.
- `travel`: Generation Policy Context.
- `sessionplanner`: Roster Truth Context.

## Context Relationships <!-- mechanical-domain-dependencies: encounter=creatures,encountertable,party; dungeoneditor=dungeon; travel=dungeon,party; sessionplanner=encounter,party -->

- `party`: `Party Character State Context`; publishes roster, membership, XP,
  rest cadence, adventuring-day facts, and character travel-position facts to
  downstream contexts.
- `creatures`: `Reference Catalog Context`; publishes imported creature-catalog
  lookup facts and encounter-candidate reference profiles to downstream policy
  contexts.
- `encounter`: `Roster Truth Context`; uses repositories to trigger allowed
  foreign party, creatures, and encounter-table workflows and consumes their
  published state through own ports where continued orchestration is required.
- `encountertable`: `Reference Catalog Context`; consumes creature persistence
  snapshots through layered data access and publishes table summaries and
  weighted candidate rows.
- `dungeon`: `Authored World-Space Context`; owns authored world-space truth
  independently of party, creatures, and encounter. Runtime travel composition
  belongs in `travel`, and runtime editor composition belongs in
  `dungeoneditor`.
- `dungeoneditor`: `Generation Policy Context`; consumes `dungeon` published
  state through own ports to build one transient runtime editor workspace for
  selection, tool policy, preview state, overlay state, projection level, and
  pointer interpretation.
- `travel`: `Generation Policy Context`; consumes `party` and `dungeon`
  published state through own ports to build one transient runtime travel
  workspace for traversal, overlay state, projection level, and overworld
  fallback handling.
- `sessionplanner`: `Roster Truth Context`; consumes `party` and `encounter`
  published state through own ports to persist one session plan for participant
  references, encounter order, allocations, rest placement, placeholders, and
  selected encounter context.

## References

- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain Context Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-context-enforcement.md:1)
