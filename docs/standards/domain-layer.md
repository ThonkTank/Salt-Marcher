Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Binding role-explicit domain-layer model, published language,
application-service boundary, tactical role packages, context roles, and
review-versus-enforcement expectations for `src/domain/**`.

# Domain Layer Standard

## Goal

SaltMarcher keeps `src/domain/**` as the application core. Domain contexts own
domain truth, topology, invariants, policies, aggregates, repositories, and
published language. They do not own presentation display models, render-layer
contracts, shell wiring, data-source mechanics, or UI translation policy.

The domain layer uses explicit tactical roles so structure is mechanically
checkable without treating every projection or shared render contract as a
domain context.

## Pattern Alignment

- `DDD` is the primary architecture model for `src/domain/**`.
- `Application Service` / Evans application layer govern the thin inbound
  backend boundary and use-case coordination.
- `Repository` keeps its DDD / EAA meaning as a domain-owned outbound contract
  over authored truth.
- `Clean Architecture`, `Onion`, and `Hexagonal` remain supporting boundary
  guides for inward dependencies and outer adapters.
- `CQRS` and read models are optional supporting patterns. They do not justify
  domain ownership of render projections or generic shared display contracts.

## Core Principles

- Each real domain context exposes exactly one callable client boundary:
  `<PascalContext>ApplicationService.java`.
- `published/` is the context's published language: commands, queries, results,
  IDs, statuses, snapshots, and other public boundary records, enums, and
  sealed carriers.
- `application/` contains use-case orchestration only. Classes are named
  `*UseCase`.
- Domain-concept modules contain role subpackages for tactical DDD
  concepts.
- Domain modules must not depend on same-context `published/` carriers.
  Translate carriers at the root or application boundary before entering the
  model.
- ViewModels own translation from domain facts into display models. Passive
  Views render ViewModel-owned state.
- Reusable render input belongs under `src/view/views/`, not `src/domain/**`.

## Domain Topology

The canonical domain layout is:

```text
src/domain/<context>/
  <PascalContext>ApplicationService.java
  published/
  application/
  <domain-module>/
    aggregate/
    entity/
    value/
    policy/
    repository/
    factory/
    service/
    event/
    specification/
```

Rules:

- `published/` and `application/` are the only technical buckets directly under
  a context root.
- Every other direct directory is a domain-concept module, such as
  `roster`, `map`, `generation`, or `catalog`.
- Domain-module Java files must live under an allowed role subpackage.
- Direct Java files under a named domain module are forbidden.
- The allowed role package names are exactly `aggregate`, `entity`, `value`,
  `policy`, `repository`, `factory`, `service`, `event`, and `specification`.
- `api/` packages are removed from domain. Use `published/` without
  compatibility aliases.

## Role Definitions

### `<PascalContext>ApplicationService.java`

The root application service is the only callable public backend boundary of
one domain context.

- accepts public commands and queries in domain language
- returns `published/` carriers
- delegates to `application/` use cases or directly to the model
- does not own business policy or instantiate infrastructure implementations

### `published/`

`published/` owns exported boundary carriers only.

- allowed: commands, queries, results, snapshots, IDs, statuses, enums, sealed
  carriers, and simple public boundary records
- forbidden: callable services, facades, repositories, ports, gateways,
  factories, locators, policy helpers, and invariant-owning objects
- public carriers describe domain facts, not render layers, canvas cells,
  styles, widget state, or display selections

### `application/`

`application/` owns use-case orchestration.

- classes are named `*UseCase`
- use cases load, delegate, save, call foreign application services when
  allowed, and map results
- generic `*Operations` coordinator buckets are migration debt where they remain
- business rules move into aggregates, entities, values, policies, factories,
  services, or specifications as appropriate

### Domain-Module Role Packages

- `aggregate/`: aggregate roots only; use final classes, not records or
  interfaces, for mutable or behavior-owning consistency boundaries.
- `entity/`: identity-bearing child entities; use final classes.
- `value/`: immutable value objects, enums, sealed abstractions, or final
  immutable classes.
- `policy/`: stateless domain policies and rules.
- `repository/`: domain-owned outbound repository contracts only; interfaces
  end with `Repository`.
- `factory/`: stateless creation logic that does not belong to one aggregate,
  entity, or value object.
- `service/`: stateless domain services for behavior that spans concepts
  without becoming orchestration.
- `event/`: domain events; records end with `Event`.
- `specification/`: named predicates or constraints that are reusable domain
  concepts.

## Context Roles

Every active domain context must state exactly one machine-readable
`Context Role:` marker in `DOMAIN.md`.

Current roles:

- `party`: `Context Role: Roster Truth Context`. Owns roster truth,
  membership, XP progression, rest cadence, and adventuring-day policy.
- `creatures`: `Context Role: Reference Catalog Context`. Exports imported
  creature catalog lookup language and reference profiles. It does not own
  encounter ranking, choice, or creature lifecycle truth.
- `encounter`: `Context Role: Generation Policy Context`. Consumes party and
  creatures through their application services and published language, then
  owns runtime encounter-generation policy.
- `dungeon`: `Context Role: Authored World-Space Context`. Owns authored
  dungeon world-space truth, map topology, rooms/spaces, connections, stable
  identity, and map mutation rules.

`mapcore` is not a domain context. Shared map render input belongs in the view
layer; domain dungeon map/world facts belong to `dungeon/published`.

## Context Relationships

The domain contexts relate through application-service boundaries and
published language, not through private model imports.

- `party`: Roster Truth Context. Publishes roster, membership, XP, rest
  cadence, and adventuring-day facts to downstream contexts.
- `creatures`: Reference Catalog Context. Publishes imported creature catalog
  lookup facts and encounter-candidate reference profiles to downstream policy
  contexts.
- `encounter`: Generation Policy Context. Consumes `party` and `creatures`
  through their root application services and `published/` carriers, then owns
  generation policy.
- `dungeon`: Authored World-Space Context. Owns authored world-space truth
  independently of party, creatures, and encounter. Views may combine dungeon
  facts with presentation state, but that composition is not a domain
  relationship.

Reusable map display input belongs to `src/view/views`; no domain context owns
shared render payloads.

## Interaction Flow

The canonical domain interaction flow is:

1. ViewModel calls one context's root `*ApplicationService`.
2. The root service translates `published/` carriers into application/model
   inputs.
3. A `*UseCase` coordinates the task.
4. Mutation enters the owning aggregate root when the context has a write
   model.
5. Domain-owned repository contracts are satisfied by outer data adapters.
6. Results leave as intentional `published/` carriers.
7. ViewModels translate domain facts into presentation display models.

Cross-context access below the view layer goes only through foreign root
application services and foreign `published/` carriers.

## Domain Document Contract

Every `DOMAIN.md` remains a binding feature-local model contract, not a
free-form note.

Each active context must include:

- `## Context Role`
- exactly one `Context Role: ...` marker
- `## Published Language`
- `## Application Boundary`
- `## Ubiquitous Language`

Contexts with authored truth must also include:

- `## Aggregate Model`
- `## Commands And Invariants`
- `## Consistency Model`
- `Aggregate Root: <TypeName>` for at least one aggregate-root type

Policy contexts without persisted authored truth must include:

- `Write Model: None`
- `## Ephemeral Policy Rationale`

The domain-layer standard owns the system-wide context-role list. Feature
documents own local model detail and must not redefine system-wide topology.

## Forbidden Patterns

- business rules implemented in `view` or `data`
- additional callable client boundaries beside the root
  `<Context>ApplicationService`
- domain `api/` packages or compatibility aliases
- `published/` services, facades, repositories, ports, gateways, factories, or
  policy helpers
- named domain modules importing same-context `published/` carriers
- direct Java files under named domain modules
- role package names outside the allowed DDD role set
- passive aggregates or entities whose behavior lives mainly in use cases
- `application/` as a generic business-logic dump
- render projections, canvas models, styles, or display selections as domain
  published language
- `src/domain/mapcore/**`

## Verification Notes

The canonical owner model for mechanical checks lives in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).

Required enforced rules:

- `build-harness` owns root application-service presence, `published/` and
  `application/` placement, domain `api/` removal, role subpackage topology,
  allowed role names, direct-file bans under domain modules, `Context Role:`
  document markers, context-role coverage, and the blocking absence of
  `src/domain/mapcore`.
- `Error Prone` owns public boundary signature purity, published-carrier shape,
  same-context published dependency bans for domain modules, and role-shape
  checks for aggregate, entity, value, repository, policy, factory, service,
  event, and specification packages.
- `PMD architecture` owns source-level domain leakage bans and obvious
  application-layer policy-helper smells.
- `ArchUnit` owns domain independence from shell, view, data, JavaFX, SQL,
  filesystem, network, framework leakage, and package cycle freedom.

Review-owned rules include object-centred placement, module cohesion,
ubiquitous-language quality, aggregate boundary quality, true invariant
placement, and whether a published snapshot describes domain facts rather
than presentation input.

## References

- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [ADR 021: Domain Layer Role Reset](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/021-domain-layer-role-reset.md:1)
- [Fowler: Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/fowler-domain-model.md:1)
- [Fowler: Anemic Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/fowler-anemic-domain-model.md:1)
- [Fowler: Service Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/application-layer/fowler-service-layer.md:1)
- [Microsoft: DDD-Oriented Microservice](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-patterns/microsoft-ddd-oriented-microservice.md:1)
- [Evans: DDD Reference](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/evans-ddd-reference.pdf:1)
