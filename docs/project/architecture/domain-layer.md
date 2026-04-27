Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Binding Hexagonal Architecture model, domain-core concepts,
published language, application-service boundary, outbound port ownership, and
domain-layer topology for `src/domain/**`.

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
  `src/domain/**`
- `ApplicationService` is the inbound callable boundary of one domain context
- `application/*UseCase` files orchestrate one use case behind that boundary
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
  expose observable current state without leaking private model internals
- `application/` contains direct `*UseCase.java` files only
- named domain modules use role subpackages only as needed. The only outbound
  role package is `port/`
- a domain port expresses what the core needs from outside. It must not expose
  SQL rows, source-local records, JavaFX, shell APIs, filesystem paths,
  network clients, transaction objects, or adapter lifecycle
- named domain modules must not depend on any `src.domain.*.published.*`
  carrier, same-context or foreign. Published language is translated at the
  root/application boundary before control enters the model
- domain code may call outward only through domain-owned outbound ports or
  allowed foreign root application services from application orchestration
- domain code must not depend on `bootstrap`, `shell.*`, `src.view.*`,
  `src.data.*`, JavaFX, SQL, filesystem, network, or registration/runtime
  composition APIs

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

## Detailed Role Catalog

Detailed boundary terms, communication rules, context markers, domain document
contract, forbidden-pattern detail, and verification-note detail live in
[Domain Layer Role Catalog](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer-role-catalog.md:1).

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Domain Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-domain.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [System Layer Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/system-layer-architecture.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/data-layer.md:1)
- [Domain Layer Role Catalog](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/domain-layer-role-catalog.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [ADR 024: Domain And Data Concept Simplification](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-024-domain-data-concept-simplification.md:1)
