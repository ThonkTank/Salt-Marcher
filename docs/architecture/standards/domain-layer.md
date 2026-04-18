Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Binding DDD-primary domain-layer model, bounded-context
structure, aggregate rules, and review-versus-enforcement expectations for
`src/domain/**`.

# Domain Layer Standard

## Goal

SaltMarcher treats each `src/domain/<feature>/` slice primarily as one DDD
bounded context that owns business meaning, invariants, aggregates, domain
services, domain events, and domain-owned contracts behind one thin
application-service boundary.

## Pattern Alignment

- `DDD` is the primary architecture model for `src/domain/**`.
- `Application Service` / Evans application layer govern the thin public
  backend boundary and use-case coordination.
- `Repository` keeps its DDD / EAA meaning as a domain-owned contract over
  authored truth.
- `Clean Architecture`, `Onion`, and `Hexagonal` are supporting boundary
  guides only. They govern inward dependencies and outer adapters, but they do
  not define the canonical physical structure inside a bounded context.
- `CQRS` and read models are optional supporting patterns, not the default
  shape of a domain feature.

## Core Principles

- The domain layer is the single authored home for business rules and domain
  language.
- Object-centred and aggregate-centred modelling is the default. Put behavior
  on the entity, value object, aggregate, or domain service that owns the
  concept.
- `application/` stays thin. It coordinates tasks and delegates work to the
  model.
- Modules are part of the model. Physical structure under
  `src/domain/<feature>/` must primarily follow domain concepts, conceptual
  contours, and the ubiquitous language rather than technical role buckets.
- Repositories and other domain-owned contracts belong to the owning domain
  module, not to a mandatory root-level concern bucket.
- Supporting read models are allowed only where the domain really is
  projection-oriented or where a bounded supporting context intentionally owns
  exported projections without owning the underlying write-model policy.

## Domain Topology

The canonical domain layout is:

```text
src/domain/
  <feature>/
    <PascalFeatureName>ApplicationService.java
    api/
    application/
    <domain-module>/
    <domain-module>/
```

Rules:

- `api/` is the exported boundary-carrier surface.
- `application/` is the thin application layer.
- Every additional directory under the feature root must be a named domain
  module expressed in the ubiquitous language of that bounded context.
- Domain modules may contain entities, value objects, aggregates, repository
  contracts, domain services, factories, domain events, and other tactical DDD
  building blocks as needed by that concept.
- Top-level role buckets such as `entity/`, `valueobject/`, `service/`,
  `repository/`, and `query/` are legacy migration debt under the current repo
  state. They are not the canonical target model.
- `services/` remains forbidden.

## Interaction Flow

The canonical domain interaction flow is:

1. view or assembly code calls one feature's `*ApplicationService`
2. the application layer coordinates the use case
3. mutation enters the owning aggregate root
4. domain-owned contracts are satisfied by outer adapters
5. results leave the feature as intentional `api/` carriers

Additional rules:

- The root `*ApplicationService` is the only public client-facing backend
  boundary below the view layer.
- Domain-owned contracts are inner backend ports, not alternate client
  boundaries.
- Root application services must not instantiate infrastructure
  implementations directly or hide global mutable adapter state.
- Cross-feature access below the view layer goes only through foreign
  application services and foreign `api/` carriers.

## Role Definitions

### `<PascalFeatureName>ApplicationService.java`

The root application service is the public backend boundary of one bounded
context.

- Responsibilities:
  - accept commands and queries in domain terms
  - expose stable public operations and results
  - delegate into the application layer or directly into the model
- Allowed behavior:
  - thin orchestration
  - boundary defaulting and carrier shaping
  - workflow coordination that does not own domain policy
- Forbidden behavior:
  - becoming a transaction script home
  - owning business rules that belong on aggregates, entities, value objects,
    or domain services
  - acting as a composition root for infrastructure

### `application/`

`application/` owns thin application-layer coordination.

- Responsibilities:
  - sequence work across aggregates and domain-owned contracts
  - coordinate one use case or a small coherent family of use cases
  - assemble exported carriers from already-owned domain behavior
- Rules:
  - application code directs expressive domain objects; it does not replace
    them
  - if a rule naturally belongs to one domain object or aggregate, move it
    there

### `api/`

`api/` owns exported boundary carriers only.

- Responsibilities:
  - define commands, queries, results, snapshots, and shared boundary types
  - keep foreign consumers off domain internals
- Rules:
  - `api/` types are carriers, not invariant owners
  - do not move domain policy into `api/` to keep model types artificially
    thin

### Named Domain Modules

A named domain module is the canonical home for a cohesive set of concepts
within one bounded context.

- Responsibilities:
  - hold the model elements that belong to one high-level domain concept
  - give the structure names that become part of the ubiquitous language
  - keep related invariants, policies, and contracts close together
- Allowed contents:
  - entities and aggregate roots
  - value objects
  - domain services
  - repository contracts
  - domain events
  - factories and specifications
- Rules:
  - module names must describe domain concepts, not technical roles
  - prefer colocation by concept over cross-cutting role directories
  - split modules when cohesion drops or the ubiquitous language reveals a
    clearer contour

## Context Types

Every feature must state its domain shape explicitly in `DOMAIN.md`.

### Default: Policy-Owning Bounded Context

This is the default expectation for a domain feature.

- The context owns business rules, invariants, and authored truth of its own.
- It uses aggregates, entities, value objects, and domain services where
  needed.
- Encounter balancing, party mutation, dungeon editing, and similar behavior
  belong here.

### Explicit Exception: Supporting Read-Model Context

A feature may instead be a supporting read-model context only when that is
truly its job.

- It owns exported projections, lookup carriers, and query coordination.
- It does not own the write-model policy of the underlying business truth.
- The `DOMAIN.md` must say why this is a supporting context instead of a
  policy-owning one.
- As soon as the feature starts to rank, validate, balance, choose, or define
  policy of its own, it must be remodelled as a policy-owning bounded context.

## Aggregate Rules

- Aggregate roots are the only external mutation entrypoints for their
  transactional consistency boundary.
- Model true invariants inside one aggregate; do not cluster for compositional
  convenience.
- Prefer small aggregates.
- Reference other aggregates by identity by default.
- One aggregate instance modified per transaction is the default modelling
  rule.
- Use eventual consistency outside the aggregate boundary unless a true
  invariant requires immediate consistency.

## Forbidden Patterns

- business rules implemented in `view` or `data`
- passive aggregates or entities whose behavior lives mainly in application
  coordinators
- `application/` as a generic business-logic dump
- modules named after technical roles instead of domain concepts
- broad mutable object graphs across aggregates
- mandatory root-level `entity/`, `service/`, `valueobject/`, `repository/`,
  or `query/` buckets presented as the DDD target model
- treating every projection-oriented context as proof that CQRS must be the
  default domain shape

## Verification Notes

The canonical owner model for mechanical checks lives in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1).

Current mechanical ownership:

- `Enforced`
  - `domain-root-presence` via `build-harness`
    (`./gradlew :build-harness:check`)
  - `domain-structural-allowlist` via `build-harness`
    (`./gradlew :build-harness:check`):
    `api/`, `application/`, named domain modules, and explicitly tolerated
    legacy root role buckets are structurally allowed; `services/` remains
    forbidden
  - `domain-outer-layer-independence` via `ArchUnit`
    (`./gradlew architectureTest`)
  - `domain-foreign-feature-public-seams-only` via `ArchUnit`
    (`./gradlew architectureTest`)
  - `domain-framework-and-infra-leakage` via `PMD architecture`
    (`./gradlew pmdArchitectureMain`)
  - `domain-root-no-direct-infra-composition` via `PMD architecture`
    (`./gradlew pmdArchitectureMain`)
- `Candidate`
  - `domain-ddd-target-topology-only`: the harness still tolerates legacy root
    role buckets as migration debt, but they are not the target model. The
    preferred future owner remains `build-harness`
    (`./gradlew :build-harness:check`).
- `Enforced`
  - `domain-public-boundary-no-outer-or-foreign-private-signature-leaks` via
    `Error Prone` (`./gradlew compileJava`): public domain boundary signatures
    must stay free of outer-layer types and foreign private domain types
- `Candidate`
  - `domain-public-boundary-same-feature-internal-carrier-purity`: same-feature
    internal domain types should eventually disappear from public backend
    boundary signatures once the remaining migration debt is retired. The
    canonical status for that stricter rule lives in the harness system-layer
    section.

Review-owned rules:

- object-centred placement quality
- named-module cohesion and ubiquitous-language naming
- aggregate-root-only mutation semantics
- one-aggregate-per-transaction as a modelling judgment
- whether a supporting read-model context is actually justified
- whether a feature states and justifies its context classification in
  `DOMAIN.md`, because documentation artifacts are outside the current harness
  scope

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1)
- [ADR 013: DDD-Primary Domain-Layer Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/013-domain-layer-ddd-primary-model.md:1)
- [Fowler: Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/fowler-domain-model.md:1)
- [Fowler: Anemic Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/fowler-anemic-domain-model.md:1)
- [Fowler: Service Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/application-layer/fowler-service-layer.md:1)
- [Microsoft: DDD-Oriented Microservice](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-patterns/microsoft-ddd-oriented-microservice.md:1)
- [Microsoft: Microservice Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/microsoft-microservice-domain-model.md:1)
- [Evans: DDD Reference](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/evans-ddd-reference.pdf:1)
- [Vernon: Effective Aggregate Design Part I](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/vernon-effective-aggregate-design-part-1.pdf:1)
- [Vernon: Effective Aggregate Design Part II](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/vernon-effective-aggregate-design-part-2.pdf:1)
