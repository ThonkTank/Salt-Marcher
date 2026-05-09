Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Binding domain-layer pattern, role ownership, communication
seams, context map, and topology for `src/domain/**`.

# Domain Layer Standard

## Goal

SaltMarcher treats `src/domain/**` as the application core. Domain code owns
business meaning, current work state, workflow orchestration, published domain
language, and the cross-context coordination seams below the view layer. It
does not own UI translation, shell registration, persistence mechanics,
data-source records, runtime service composition, SQL, filesystem, network, or
framework concerns.

This document is the sole architectural source of truth for `src/domain/**`.
The repo-owned `tools/quality/skills/domain-layer/SKILL.md` operationalizes
this standard for agent work. Domain enforcement documents under
`docs/project/architecture/enforcement/` may inventory gates, candidate rows,
review-owned rows, and current mechanical drift, but they must not redefine
the pattern or become a second architecture owner.

## Current State And Target State

Current state:

- active production code still contains legacy named-module tactical packages
  such as `aggregate/`, `entity/`, `policy/`, `service/`, and outbound
  `port/` interfaces
- active mechanical blockers still cover parts of that legacy shape
- some contexts still expose only one root `*ApplicationService`

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

Until production migration catches up, enforcement documents MUST state any
remaining drift literally instead of silently reintroducing the old model as a
second truth.

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

The domain topology is closed to the role family above. Any other role name,
role suffix, or role directory form is unzulässig.

## Core Principles

- a context exposes one or more direct root `*ApplicationService.java` files
- each `ApplicationService` belongs to one decision family and stays thin
- each public root method accepts exactly one same-context
  `published/*Command` carrier and returns `void`
- each root method routes to exactly one focused `UseCase`
- each `UseCase` owns one work operation only and contains orchestration, not
  embedded business-policy logic
- `Helper` code receives all required context through parameters and must not
  look up current model state, repositories, ports, or published handles by
  itself
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
- domain code does not depend on `bootstrap/**`, `shell/**`, `src/view/**`,
  `src/data/**`, JavaFX, SQL, filesystem, network, or runtime composition APIs

## Canonical Flows

### View Write

`IntentHandler -> family ApplicationService -> one UseCase -> Model ->
Published`

### Cross-Domain Write

`own Repository -> foreign ApplicationService -> foreign UseCase -> foreign
Model -> foreign Published -> own Port -> own UseCase -> own Model -> own
Published`

### Data Roundtrip

`own Repository -> layered data adapter -> internal domain/application return
types -> own UseCase -> own Model -> own Published`

## Role Contracts

### `*ApplicationService.java`

- direct root file under `src/domain/<context>/`
- named `<Context><Family>ApplicationService.java`
- `public final` top-level class
- interprets inbound command only where domain decision context is missing on
  the view side
- delegates to exactly one focused `UseCase`
- does not own business policy, model mutation details, publication ownership,
  shell registration, runtime service lookup, or adapter construction

### `UseCase`

- owns exactly one work operation such as moving one corridor, saving one
  encounter, or adding one creature
- orchestrates reads, writes, repository calls, port-triggered follow-up work,
  and helper invocation
- may construct, load, edit, and persist `Model`
- does not hide business-policy logic that belongs in `Helper` or subordinate
  model roles

### `Helper`

- pure explicit work step such as a calculation, validation, derivation, or
  deterministic construction
- receives every needed value as input
- may depend on `Constants` and local pure support types only
- must not inspect current `Model`, subscribe to `Published`, invoke
  `Repository`, or talk to `Port`

### `Constants`

- immutable shared domain constants only
- no current-state access
- no lifecycle, listeners, or infrastructure knowledge

### `Model`

- owns internal dynamic work state such as current encounter plans, loaded
  maps, active editor session state, or authored aggregates
- is created, read, and edited by `UseCase`
- lives under `model/<family>/model/`, where a family MAY add deeper semantic
  subpackages for subordinate models of that same family
- state change is the source that updates outward `Published`

### `published/`

`published/` owns exported boundary language only.

- allowed: commands, ids, statuses, enums, passive records, sealed carrier
  abstractions, and same-context `*Model` publication handles
- same-context `published/*Model` exposes public readback through `current()`
  and `subscribe(...)` only
- non-`*Model` published carriers stay passive and thinner than the internal
  working state behind them
- any other role or active object shape outside the allowed published carrier
  families is unzulässig

### `Port`

- domain-internal inbound listener on foreign `published/*Model`
- listens through `current()` and `subscribe(...)`
- converts foreign published change intake into same-context `UseCase` work
- does not own foreign mutation triggers or data-source access

### `Repository`

- domain-owned outbound collaborator
- may trigger foreign family `ApplicationService` calls
- may perform layered data access through outer adapters
- returns only same-context internal domain/application types; never `src.data`
  types or foreign published carriers
- does not own long-lived current state; that remains in `Model`

## Domain Topology

Target topology:

```text
src/domain/<context>/
  <Context><Family>ApplicationService.java
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
- nested subpackages inside `model/<family>/model/**` stay semantic; any
  role-owned or otherwise technical bucket there is illegal
- `usecase/`, `helper/`, `constants/`, `port/`, and `repository/` are the
  only non-model subordinate role buckets under a model family
- non-model role buckets stay direct-file only
- direct root Java files under `src/domain/<context>/` are limited to
  `*ApplicationService.java`
- direct Java files under named model families are forbidden; Java files belong
  in an explicit role package
- reserved role suffixes are path-owned: `*ApplicationService`, `*UseCase`,
  `*Helper`, `*Constants`, `*Port`, and `*Repository` may appear only in their
  canonical buckets
- any other role-indicating suffix or directory form is illegal

## Current Mechanical Drift

The active blockers now prove the target root/model topology and reserved role
suffix placement, but production migration still lags behind that target.

- `checkDomainApplicationServiceEnforcement` now allows one or more direct root
  `*ApplicationService` files and validates `DOMAIN.md`-declared root services
- `checkDomainLayerEnforcement` now hard-cuts root buckets, direct root
  `*ApplicationService` file ownership, model-family role buckets, model
  subtree technical-bucket rejection, direct-file placement, and reserved role
  suffix ownership
- `compileJava` now blocks path/package/file-shape drift for domain sources
  through a dedicated closed-topology perimeter checker instead of leaving role
  renames and moves to build-harness scanning alone
- `checkDomainUseCaseEnforcement` now hard-cuts root `application/` to direct
  `*UseCase.java` files only
- focused `Port`, `Repository`, `Model`, `Helper`, and `Constants` bundles now
  block the canonical target buckets and role file forms; deeper purity and
  communication semantics remain review-owned where the neighboring owner docs
  say so

## Context Roles

- `party`: `Context Role: Party Character State Context`. Owns roster truth,
  membership, XP progression, rest cadence, adventuring-day policy, and
  character-specific runtime travel state.
- `creatures`: `Context Role: Reference Catalog Context`. Exports imported
  creature catalog lookup language and reference profiles. It does not own
  encounter ranking, choice, or creature lifecycle truth.
- `encounter`: `Context Role: Roster Truth Context`. Owns saved encounter-plan
  roster truth while consuming party, creatures, and encounter-table published
  language for encounter-generation policy.
- `encountertable`: `Context Role: Reference Catalog Context`. Publishes
  authored encounter-table membership as read-only generator input without
  owning creature truth, table mutation policy, or encounter-generation
  policy.
- `dungeon`: `Context Role: Authored World-Space Context`. Owns authored
  dungeon world-space truth, map topology, spaces, connections, stable
  identity, and mutation rules.
- `dungeoneditor`: `Context Role: Generation Policy Context`. Owns transient
  runtime editor-session composition derived from `dungeon` public boundaries
  without owning authored map persistence.
- `travel`: `Context Role: Generation Policy Context`. Owns transient runtime
  travel-session composition derived from dungeon and party public boundaries
  without owning authored map persistence or party roster truth.
- `sessionplanner`: `Context Role: Roster Truth Context`. Owns authored
  session-planning truth for participant references, encounter allocations,
  rest placement, placeholders, and selection state while consuming party and
  encounter public boundaries.

## Context Relationships

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

## Domain Document Contract

Every active `src/domain/<context>/DOMAIN.md` remains a binding context
contract.

Each active context MUST include:

- `## Context Role`
- `Context Name: <PascalContext>`
- one or more `Application Service: <TypeName>` markers in
  `## Application Boundary`
- `## Published Language`
- `## Application Boundary`
- `## Ubiquitous Language`

Authored contexts MUST additionally include:

- `## Aggregate Model`
- `## Commands And Invariants`
- `## Consistency Model`

Generation-policy contexts MUST additionally include:

- `## Commands And Invariants`
- `## Consistency Model`

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-repository-enforcement.md:1)
- [Domain Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-model-enforcement.md:1)
- [Domain Helper Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-helper-enforcement.md:1)
- [Domain Constants Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-constants-enforcement.md:1)
