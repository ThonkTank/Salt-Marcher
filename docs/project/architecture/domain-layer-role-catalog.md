Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Detailed role catalog, communication rules, context markers,
and verification notes for the domain layer standard.

# Domain Layer Role Catalog

## Purpose

This subordinate standard defines the detailed role catalog and context-level
contracts that sit under the umbrella
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1).

## Boundary Terms

### `<PascalContext>ApplicationService.java`

The root application service is the only public callable backend boundary of
one domain context.

- is a public final top-level class named `<PascalContext>ApplicationService`
- accepts same-context `published/` command/query carriers whose type names end
  in `Command` or `Query`
- exposes public operations as exactly one command/query parameter and one
  same-context published return carrier
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

- allowed: commands, queries, results, snapshots, ids, statuses, enums, sealed
  carrier abstractions, and simple public boundary records
- public top-level carriers are public records, enums, or sealed abstractions
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
| View Binder | Root `<Context>ApplicationService` | public methods using `published/` carriers | Binder owns outward calls, published-carrier intake, and translation into Binder-supplied facts for the view surface. |
| View Binder | `*PresentationModel` | Binder-supplied facts, signals, and local support values | `PresentationModel` owns projection logic and bindable presentation state, but not domain-boundary access. |
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

Mechanical type-shape rules keep those role packages concrete:

- aggregate roots are classes or records; aggregate classes are final
- entities are records, sealed abstractions, or final classes
- values are records, enums, sealed abstractions, or final immutable classes
- policies, factories, and services are final stateless classes
- ports are interfaces ending `Repository`, `Lookup`, `Catalog`, or `Search`
- events are records ending `Event`
- specifications are final classes or interfaces ending `Specification`
- public concrete named-module domain types are records, enums, final classes,
  interfaces, or sealed abstractions

These role names are local modelling aids. They must not override the
hexagonal boundary: source access still goes through `port/`, public
translation still happens at the root/application boundary, and
persistence/source mechanics still belong outside `src/domain/**`.

## Context Roles

Every active domain context must state exactly one machine-readable
`Context Role:` marker and exactly one machine-readable `Context Name:`
marker in `DOMAIN.md`. `Context Name:` is the canonical PascalCase token for
root service, data contribution, and schema file names when the directory name
is not already a simple PascalCase spelling.

Current roles:

- `party`: `Context Role: Party Character State Context`. Owns roster truth,
  membership, XP progression, rest cadence, adventuring-day policy, and
  character-specific runtime travel state.
- `creatures`: `Context Role: Reference Catalog Context`. Exports imported
  creature catalog lookup language and reference profiles. It does not own
  encounter ranking, choice, or creature lifecycle truth.
- `encounter`: `Context Role: Roster Truth Context`. Owns saved
  encounter-plan roster truth, while also consuming party, creatures, and
  encounter-table reference data through their application services and
  published language for runtime encounter-generation policy.
- `encountertable`: `Context Role: Reference Catalog Context`. Publishes
  authored encounter-table membership as read-only generator input without
  owning creature truth, table mutation policy, or encounter-generation policy.
- `dungeon`: `Context Role: Authored World-Space Context`. Owns authored
  dungeon world-space truth, map topology, rooms/spaces, connections, stable
  identity, and map mutation rules.

Retired shared map packages are not domain contexts. Shared map render input
belongs in the view layer; domain dungeon map/world facts belong to
`dungeon/published`.

## Context Relationships

The domain contexts relate through root application-service boundaries and
published language, not through private model imports.

- `party`: Party Character State Context. Publishes roster, membership, XP,
  rest cadence, adventuring-day facts, and character travel position facts to
  downstream contexts.
- `creatures`: Reference Catalog Context. Publishes imported creature catalog
  lookup facts and encounter-candidate reference profiles to downstream policy
  contexts.
- `encounter`: Roster Truth Context. Consumes `party`, `creatures`, and
  `encountertable` through their root application services and `published/`
  carriers for generation, and owns saved encounter-plan roster truth.
- `encountertable`: Reference Catalog Context. Consumes creature persistence
  snapshots through its data source adapter, then publishes table summaries and
  weighted candidate rows through its root application service.
- `dungeon`: Authored World-Space Context. Owns authored world-space truth
  independently of party, creatures, and encounter. Views may combine dungeon
  facts with presentation state, but that composition is not a domain
  relationship.

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
- `## Commands And Invariants` and `## Consistency Model`
- `Aggregate Root: <TypeName>` for at least one aggregate-root type

Policy contexts without persisted authored truth must include:

- `## Commands And Invariants`
- `## Consistency Model`
- `Write Model: None`
- `## Ephemeral Policy Rationale`

The domain-layer standard owns the system-wide context-role list. Feature
documents own local model detail and must not redefine system-wide topology.

## Forbidden Patterns

- business rules implemented in `view` or `data`
- additional callable client boundaries beside the root
  `<Context>ApplicationService`
- domain `api/`, `repository/`, `query/`, `gateway/`, `adapter/`, `model/`,
  `mapper/`, `schema/`, or `record/` technical packages
- `published/` services, facades, repositories, ports, gateways, factories, or
  policy helpers
- named domain modules importing any `src.domain.*.published.*` carrier
- direct Java files under named domain modules
- role package names outside the allowed role set
- named domain modules whose direct directory names do not use lower-case
  package tokens matching `[a-z][a-z0-9_]*`
- passive aggregates or entities whose behavior lives mainly in use cases
- JavaBean-style public/protected `void set*` mutation methods in named modules
- `application/` as a generic business-logic dump
- domain code referencing outer-layer or infrastructure types directly instead
  of domain-owned outbound ports
- render projections, canvas models, styles, or display selections as domain
  published language
- `src/domain/mapcore/**`

## Verification Notes

The canonical owner model for mechanical checks lives in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1).
The domain-specific rule matrix lives in
[Domain Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-domain.md:1).

Mechanical enforcement is split by evidence quality:

- `build-harness` owns repository shape, machine-readable documentation
  markers, context coverage, and coverage-document completeness
- `Error Prone` owns Java type-shape, signature-purity, carrier, port, and
  role-shape rules, including compiler-resolved infrastructure dependency bans
- `ArchUnit` owns dependency direction, foreign-boundary access, and cycle
  rules
- `PMD architecture` owns narrow source-pattern blockers only. It is useful for
  obvious forbidden package-token and smell patterns, but it is not semantic
  proof that behavior sits in the right domain role

Review still owns modelling judgements that cannot be cleanly inferred without
low-signal heuristics: whether use cases and root application services are thin
coordination rather than hidden business policy, ports use domain language,
domain services represent real cross-concept behavior, published language is
stable and passive, and aggregates/entities/values own the behavior their names
imply.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Domain Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-domain.md:1)
