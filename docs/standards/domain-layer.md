Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Binding Hexagonal Architecture model, domain-core concepts,
published language, application-service boundary, outbound port ownership,
context ownership markers, and review-versus-enforcement expectations for
`src/domain/**`.

# Domain Layer Standard

## Goal

SaltMarcher treats `src/domain/**` as the application core in a Hexagonal
Architecture. Domain code owns business meaning, invariants, policy, use-case
coordination, published language, and outbound port interfaces. It does not own
UI translation, shell registration, persistence mechanics, data-source records,
runtime composition, SQL, filesystem, network, or framework concerns.

Hexagonal Architecture is the one boundary model. DDD vocabulary is optional
tactical modelling language inside the core. Fowler persistence patterns and
data-layer adapter roles are implementation tools outside the core, not
additional domain-layer taxonomies.

## Pattern Alignment

- `Hexagonal Architecture` / `Ports and Adapters` is the canonical model for
  `src/domain/**`.
- `ApplicationService` is the inbound callable boundary of one domain context.
- `application/*UseCase` files orchestrate one use case behind that boundary.
- `port/` contains outbound port interfaces owned by the domain core.
- Outbound ports are implemented outside `src/domain/**`; adapter placement is
  defined by the data-layer standard, not by this document.
- `DDD` names tactical modelling roles only when they clarify real domain
  behaviour. It does not require every context to contain every role.
- `Repository` is allowed only as a write-oriented outbound port interface
  name, such as `PartyRosterRepository`, placed under a domain module's
  `port/` package. It is not a domain package role.

## Minimal Concept Set

The standard domain concepts are deliberately small:

| Concept | Meaning |
| --- | --- |
| Context | The owning business language and decision boundary, such as `party`, `dungeon`, or `creatures`. |
| Application Boundary | The root `<PascalContext>ApplicationService.java` callable from the view layer or allowed foreign contexts. |
| Use Case | Application coordination behind the root boundary. |
| Domain Model | Business objects, facts, rules, invariants, and policies owned by the context. |
| Port | A domain-owned outbound need expressed in business language. |
| Published Contract | Carrier-only public commands, queries, results, IDs, statuses, and snapshots. |

Other names are subordinate. `aggregate`, `entity`, `value`, `policy`,
`factory`, `service`, `event`, and `specification` are optional tactical roles
inside a domain module. `repository`, `query`, `gateway`, `mapper`, `model`,
`schema`, `record`, and `adapter` are not domain concepts.

## Core Principles

- Each real domain context exposes exactly one public callable backend
  boundary: `<PascalContext>ApplicationService.java`.
- `published/` is exported published language: commands, queries, results,
  IDs, statuses, snapshots, and other public boundary carriers.
- `application/` contains direct `*UseCase.java` files only.
- Named domain modules use role subpackages only as needed. The only outbound
  role package is `port/`.
- A domain port expresses what the core needs from outside. It must not expose
  SQL rows, source-local records, JavaFX, shell APIs, filesystem paths,
  network clients, transaction objects, or adapter lifecycle.
- Named domain modules must not depend on any `src.domain.*.published.*`
  carrier, same-context or foreign. Published language is translated at the
  root/application boundary before control enters the model.
- Domain code may call outward only through domain-owned outbound ports or
  allowed foreign root application services from application orchestration.
- Domain code must not depend on `bootstrap`, `shell.*`, `src.view.*`,
  `src.data.*`, JavaFX, SQL, filesystem, network, or registration/runtime
  composition APIs.

## Domain Topology

The canonical physical domain layout is:

```text
src/domain/<context>/
  <PascalContext>ApplicationService.java
  published/
  application/
    *UseCase.java
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

- `published/` and `application/` are the only technical buckets directly under
  a context root.
- Every other direct directory is a domain-concept module, such as `roster`,
  `map`, `generation`, or `catalog`.
- Domain-module Java files must live under an allowed role subpackage.
- Direct Java files under a named domain module are forbidden.
- The allowed role package names are exactly `aggregate`, `entity`, `value`,
  `policy`, `port`, `factory`, `service`, `event`, and `specification`.
- Domain `repository/`, `query/`, `gateway/`, `adapter/`,
  `model/`, `mapper/`, and `api/` role buckets are forbidden.

This layout is an enforcement shape, not a required concept inventory. A domain
module should contain only the role packages that represent real behaviour or
contracts in that module. Do not create empty or ceremonial role packages to
make a context look more "DDD".

## Boundary Terms

### `<PascalContext>ApplicationService.java`

The root application service is the only public callable backend boundary of
one domain context.

- accepts same-context `published/` command/query carriers whose type names end
  in `Command` or `Query`
- returns same-context `published/` carriers
- translates public input before entering application use cases or the model
- translates application/model output back to published carriers
- may receive same-feature domain port interfaces by constructor
- may receive documented foreign root application services by constructor when
  the context coordinates foreign public boundaries
- does not own shell registration, data adapter construction, business policy,
  or runtime service lookup

### `application/*UseCase.java`

A use case coordinates one application action behind the root boundary.

- loads through outbound ports when external state is required
- invokes aggregates, values, policies, factories, specifications, or domain
  services for business behavior
- persists authored write-model changes through outbound ports
- may call allowed foreign root application services when cross-context
  published language is the intended integration seam
- does not become a generic `Operations`, helper, adapter, repository, mapper,
  or policy dump

### `domain-module/service`

A domain service is stateless domain behavior that spans multiple concepts and
does not naturally belong on one aggregate, entity, value, policy, factory, or
specification.

- contains domain behavior, not orchestration
- uses domain objects and values as inputs
- must not load, save, register, query infrastructure, or translate
  published/data/view carriers

### `published/`

`published/` owns exported boundary carriers only.

- allowed: commands, queries, results, snapshots, IDs, statuses, enums, sealed
  carrier abstractions, and simple public boundary records
- forbidden: callable services, facades, repositories, ports, gateways,
  factories, locators, policy helpers, and invariant-owning objects
- public carriers describe domain facts, not render layers, canvas cells,
  styles, widget state, display selections, data rows, or storage DTOs

### `port/`

`port/` owns outbound interfaces required by the domain core.

- write-model persistence ports may end with `Repository`
- read-only lookup, catalog, or search ports may end with `Lookup`, `Catalog`,
  or `Search`
- ports use domain language and domain-owned carrier/value types
- ports are not storage records, not data APIs, not shell services, and not
  registration contracts
- implementations belong outside the domain layer

## Communication Matrix

| From | To | Allowed Contract | Translation Rule |
| --- | --- | --- | --- |
| Active-root ViewModel | Root `<Context>ApplicationService` | public methods using `published/` carriers | ViewModel owns presentation translation before/after the call. |
| Root ApplicationService | `application/*UseCase` | application inputs, domain values, same-feature ports | Root translates public `published/` input before delegation. |
| Application use case | Named domain modules | aggregates, entities, values, policies, factories, services, specifications | Use case must not pass `published/`, view, data, shell, or framework carriers into modules. |
| Application use case | Foreign root ApplicationService | foreign public methods and foreign `published/` carriers | Boundary translates foreign published results before entering named modules. |
| Domain core | Outside world | same-feature outbound `port/` interfaces | Implementations live outside domain; domain imports only the port interface. |

## Optional Tactical Role Packages

- `aggregate/`: aggregate roots and consistency boundaries.
- `entity/`: identity-bearing child entities.
- `value/`: immutable values, enums, sealed abstractions, and fact records.
- `policy/`: stateless domain rules and decisions.
- `port/`: outbound interfaces required by the core.
- `factory/`: stateless creation logic that does not belong to one aggregate,
  entity, or value.
- `service/`: stateless domain behavior spanning concepts.
- `event/`: domain events; records end with `Event`.
- `specification/`: named reusable predicates or constraints.

These role names are local modelling aids. They must not override the hexagonal
boundary: source access still goes through `port/`, public translation still
happens at the root/application boundary, and persistence/source mechanics still
belong outside `src/domain/**`.

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

Retired shared map packages are not domain contexts. Shared map render input
belongs in the view layer; domain dungeon map/world facts belong to
`dungeon/published`.

## Context Relationships

The domain contexts relate through root application-service boundaries and
published language, not through private model imports.

- `party`: Roster Truth Context. Publishes roster, membership, XP, rest cadence, and
  adventuring-day facts to downstream contexts.
- `creatures`: Reference Catalog Context. Publishes imported creature catalog lookup facts and
  encounter-candidate reference profiles to downstream policy contexts.
- `encounter`: Generation Policy Context. Consumes `party` and `creatures` through their root
  application services and `published/` carriers, then owns generation policy.
- `dungeon`: Authored World-Space Context. Owns authored world-space truth independently of party,
  creatures, and encounter. Views may combine dungeon facts with presentation
  state, but that composition is not a domain relationship.

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
- domain `api/`, `repository/`, `query/`, `gateway/`,
  `adapter/`, `model/`, or `mapper/` role packages
- `published/` services, facades, repositories, ports, gateways, factories, or
  policy helpers
- named domain modules importing any `src.domain.*.published.*` carrier
- direct Java files under named domain modules
- role package names outside the allowed role set
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
  `application/` placement, `application/*UseCase.java` naming, domain `api/`
  removal, role subpackage topology, allowed role names, direct-file bans under
  domain modules, callable-contract bans in `published/`, `Context Role:`
  document markers, required `DOMAIN.md` sections, authored aggregate-root
  markers, generation-policy `Write Model: None` declarations, context-role and
  context-relationship coverage, and the blocking absence of
  `src/domain/mapcore`.
- `Error Prone` owns root `ApplicationService` public command/query/result
  carrier signatures, public/final root service shape, public nested-contract
  bans on root application services, root-only domain service registry exports,
  public boundary signature purity, root constructor composition, same-context
  `application/` to `published/` dependency bans, published-carrier visibility
  and shape, all published-carrier dependency bans for named domain modules,
  outbound-port implementation placement, infrastructure-free port signatures,
  and role-shape checks for aggregate, entity, value, port, policy, factory,
  service, event, and specification packages.
- `PMD architecture` owns source-level domain leakage bans and obvious
  application-layer policy-helper smells.
- `ArchUnit` owns domain independence from shell, view, data, JavaFX, SQL,
  source-local infrastructure, foreign private domain internals, named-module
  foreign-context access, named-module same-context root/application access,
  model-role outbound-port access, and feature cycles.

Review-owned rules:

- whether use cases are thin orchestration rather than hidden policy
- whether ports are stated in domain language rather than data-source terms
- whether domain services are real cross-concept domain behavior rather than
  procedural coordinators
- whether published language is stable enough for ViewModels and foreign
  application services
- whether published language avoids presentation, widget, storage, or
  transport vocabulary beyond what simple suffix and package checks can prove
- whether aggregates/entities/values own the behavior their names imply

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Domain Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage-domain.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/system-layer-architecture.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [ADR 024: Domain And Data Concept Simplification](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/024-domain-data-concept-simplification.md:1)
