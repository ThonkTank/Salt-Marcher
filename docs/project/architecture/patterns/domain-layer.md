Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Binding Hexagonal Architecture model, domain-core concepts,
published language, application-service boundary, outbound port ownership, and
domain-layer topology for `src/domain/**`.

# Domain Layer Standard

## Goal

SaltMarcher treats `src/domain/**` as the application core in a Hexagonal
Architecture. Domain code owns business meaning, invariants, policy, use-case
coordination, published language, and outbound port interfaces. It does not own
UI translation, shell registration, persistence mechanics, data-source records,
runtime service composition, SQL, filesystem, network, or framework concerns.

Hexagonal Architecture is the one boundary model. DDD vocabulary is optional
tactical modelling language inside the core. Fowler persistence patterns and
data-layer adapter roles are implementation tools outside the core, not
additional domain-layer taxonomies.

## Pattern Alignment

- `Hexagonal Architecture` / `Ports and Adapters` is the canonical model for
  `src/domain/**`
- `ApplicationService` is the inbound callable boundary of one domain context
- `application/` owns direct `*UseCase` orchestration plus narrow internal
  boundary helpers for translation, projection, and runtime adaptation behind
  that boundary
- `port/` contains outbound port interfaces owned by the domain core
- outbound ports are implemented outside `src/domain/**`; adapter placement is
  defined by the data-layer standard, not by this document
- `DDD` names tactical modelling roles only when they clarify real domain
  behaviour. It does not require every context to contain every role
- `Repository` is allowed only as a write-oriented outbound port interface
  name, such as `PartyRosterRepository`, placed under a domain module's
  `port/` package. It is not a domain package role

## Minimal Concept Set

The standard domain concepts are deliberately small:

| Concept | Meaning |
| --- | --- |
| Context | The owning business language and decision boundary, such as `party`, `dungeon`, or `creatures`. |
| Application Boundary | The root `<PascalContext>ApplicationService.java` callable from the view layer or allowed foreign contexts. |
| Use Case | Application coordination behind the root boundary. |
| Domain Model | Business objects, facts, rules, invariants, and policies owned by the context. |
| Port | A domain-owned outbound need expressed in business language. |
| Published Contract | Public commands, queries, results, IDs, statuses, snapshots, and read-only boundary handles exposed to outer layers. |

Other names are subordinate. `aggregate`, `entity`, `value`, `policy`,
`factory`, `service`, `event`, and `specification` are optional tactical roles
inside a domain module. `repository`, `query`, `gateway`, `mapper`, `model`,
`schema`, `record`, and `adapter` are not domain concepts.

## Core Principles

- each real domain context exposes exactly one public callable backend
  boundary: `<PascalContext>ApplicationService.java`
- `published/` is exported published language: commands, queries, results,
  ids, statuses, snapshots, and read-only boundary handles when a context must
  expose observable current state without leaking private model internals;
  such boundary handles may appear as same-context `published/*Model` types
  that outer layers observe only through read-side methods like `current()`
  and `subscribe(...)`
- `application/` contains direct `*UseCase.java` files plus direct internal
  `*BoundaryTranslator.java`, `*Projector.java`, `*RuntimeAccess.java`, and
  `*RuntimeAdapter.java` helper files
- named domain modules use role subpackages only as needed. The only outbound
  role package is `port/`
- a domain port expresses what the core needs from outside. It must not expose
  SQL rows, source-local records, JavaFX, shell APIs, filesystem paths,
  network clients, transaction objects, or adapter lifecycle
- named domain modules must not depend on any `src.domain.*.published.*`
  carrier, same-context or foreign. Published language is translated at the
  root/application boundary before control enters the model. Narrow
  translation or projection helpers may live directly in `application/`
- domain code may call outward only through domain-owned outbound ports or
  allowed foreign root application services from application orchestration
- domain code must not depend on `bootstrap`, `shell.*`, `src.view.*`,
  `src.data.*`, JavaFX, SQL, filesystem, network, or registration/runtime
  composition APIs

## Boundary Contracts

### `<PascalContext>ApplicationService.java`

The root application service is the only public callable backend boundary of
one domain context.

- it is a public final top-level class named
  `<PascalContext>ApplicationService`
- it accepts same-context `published/` command or query carriers
- it returns same-context `published/` carriers
- it translates public carriers before control enters application use cases or
  named domain modules, directly or through internal application-boundary
  helpers in `application/`
- it does not own shell registration, runtime service lookup, data adapter
  construction, or business policy

### `published/`

`published/` owns exported boundary carriers only.

- allowed: commands, queries, results, snapshots, ids, statuses, enums,
  sealed carrier abstractions, simple public boundary records, and read-only
  same-context `*Model` handles for observable current domain state
- forbidden: callable services, facades, repositories, ports, gateways,
  factories, locators, policy helpers, or invariant-owning objects
- public carriers describe domain facts, not render layers, widget state,
  canvas cells, or storage DTOs

### `port/`

`port/` owns outbound interfaces required by the domain core.

- write-model persistence ports may end with `Repository`
- read-only lookup, catalog, or search ports may end with `Lookup`,
  `Catalog`, or `Search`
- ports use domain language and domain-owned carrier or value types
- implementations belong outside `src/domain/**`

## Domain Topology

The canonical physical domain layout is:

```text
src/domain/<context>/
  <PascalContext>ApplicationService.java
  published/
  application/
    *UseCase.java
    *BoundaryTranslator.java
    *Projector.java
    *RuntimeAccess.java
    *RuntimeAdapter.java
  <domain-module>/
    aggregate/
    entity/
    value/
    policy/
    port/
    factory/
    service/
    event/
    specification/
```

Rules:

- `published/` and `application/` are the only technical buckets directly
  under a context root
- every other direct directory is a domain-concept module, such as `roster`,
  `map`, `generation`, or `catalog`
- domain-module Java files must live under an allowed role subpackage
- direct Java files under a named domain module are forbidden
- the allowed role package names are exactly `aggregate`, `entity`, `value`,
  `policy`, `port`, `factory`, `service`, `event`, and `specification`
- domain `repository/`, `query/`, `gateway/`, `adapter/`, `model/`,
  `mapper/`, `schema/`, `record/`, and `api/` technical buckets are forbidden
  as direct context buckets or role packages

This layout is an enforcement shape, not a required concept inventory. A domain
module should contain only the role packages that represent real behaviour or
contracts in that module. Do not create empty or ceremonial role packages to
make a context look more "DDD".

## Context Roles

- `party`: `Context Role: Party Character State Context`. Owns roster truth,
  membership, XP progression, rest cadence, adventuring-day policy, and
  character-specific runtime travel state.
- `creatures`: `Context Role: Reference Catalog Context`. Exports imported
  creature catalog lookup language and reference profiles. It does not own
  encounter ranking, choice, or creature lifecycle truth.
- `encounter`: `Context Role: Roster Truth Context`. Owns saved
  encounter-plan roster truth while consuming party, creatures, and
  encounter-table published language for encounter-generation policy.
- `encountertable`: `Context Role: Reference Catalog Context`. Publishes
  authored encounter-table membership as read-only generator input without
  owning creature truth, table mutation policy, or encounter-generation
  policy.
- `dungeon`: `Context Role: Authored World-Space Context`. Owns authored
  dungeon world-space truth, map topology, rooms or spaces, connections,
  stable identity, and map mutation rules.
- `dungeoneditor`: `Context Role: Generation Policy Context`. Owns transient
  runtime editor-session composition derived from `dungeon` public boundaries
  without owning authored map persistence.
- `travel`: `Context Role: Generation Policy Context`. Owns transient runtime
  travel-session composition derived from dungeon and party public boundaries
  without owning authored map persistence or party roster truth.
- `sessionplanner`: `Context Role: Generation Policy Context`. Owns transient
  session-planning policy and runtime orchestration derived from party and
  encounter public boundaries without owning persistence truth.

## Context Relationships

- `party`: `Party Character State Context`; publishes roster, membership, XP,
  rest cadence, adventuring-day facts, and character travel position facts to
  downstream contexts.
- `creatures`: `Reference Catalog Context`; publishes imported creature catalog
  lookup facts and encounter-candidate reference profiles to downstream policy
  contexts.
- `encounter`: `Roster Truth Context`; consumes `party`, `creatures`, and
  `encountertable` through their root application services and `published/`
  carriers and owns saved encounter-plan roster truth.
- `encountertable`: `Reference Catalog Context`; consumes creature persistence
  snapshots through its data source adapter and publishes table summaries and
  weighted candidate rows through its root application service.
- `dungeon`: `Authored World-Space Context`; owns authored world-space truth
  independently of party, creatures, and encounter. Party-aware runtime
  travel-session composition lives in `travel`, and runtime editor-session
  composition lives in `dungeoneditor`, not in `dungeon`.
- `dungeoneditor`: `Generation Policy Context`; consumes `dungeon` through its
  root application service and `published/` carriers to build one transient
  runtime editor workspace for selection, tool policy, preview state, overlay
  state, projection level, and pointer interpretation.
- `travel`: `Generation Policy Context`; consumes `party` and `dungeon`
  through their root application services and `published/` carriers to build
  one transient runtime travel workspace for dungeon traversal, overlay
  state, projection level, and overworld fallback handling.
- `sessionplanner`: `Generation Policy Context`; consumes `party` and
  `encounter` through their root application services and `published/`
  carriers to build one transient planning workspace for encounter order, rest
  placement, and open loot placeholders.

## Domain Document Contract

Every `DOMAIN.md` remains a binding feature-local model contract, not a
free-form note.

Each active context must include:

- `## Context Role`
- exactly one `Context Role: ...` marker
- exactly one `Context Name: <PascalContext>` marker
- `## Published Language`
- `## Application Boundary`
- `## Ubiquitous Language`

Contexts with authored truth must also include:

- `## Aggregate Model`
- `## Commands And Invariants`
- `## Consistency Model`
- at least one `Aggregate Root: <TypeName>` marker

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain Context Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-context-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Aggregate Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-aggregate-enforcement.md:1)
- [Domain Entity Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-entity-enforcement.md:1)
- [Domain Value Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-value-enforcement.md:1)
- [Domain Policy Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-policy-enforcement.md:1)
- [Domain Factory Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-factory-enforcement.md:1)
- [Domain Service Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-service-enforcement.md:1)
- [Domain Event Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-event-enforcement.md:1)
- [Domain Specification Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-specification-enforcement.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
