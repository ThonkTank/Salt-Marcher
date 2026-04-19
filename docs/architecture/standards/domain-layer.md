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
  `services/`, `repository/`, and `query/` are forbidden under the target
  model.

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

The required machine-readable marker is exactly one of:

- `Context Type: Policy-Owning Bounded Context`
- `Context Type: Supporting Read-Model Context`

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

## Tactical Object Shape

Professional DDD object structure is explicit in SaltMarcher rather than
implicit review taste.

- Aggregate roots own externally visible state transitions and consistency
  checks for their transactional boundary. Application use cases load, delegate
  to the aggregate, save, and map results.
- Entities own stable identity plus state-coupled behavior. Child entities do
  not become alternate external mutation entrypoints for an aggregate.
- Value objects are identity-free immutable records or final classes. They own
  value-local validation, normalization, or rejection at construction/factory
  time unless a use-case boundary intentionally converts invalid user input into
  an exported failure result first.
- Domain services and factories are allowed only for behavior that does not
  naturally belong to one aggregate, entity, or value object. They must be
  stateless and named in the ubiquitous language.
- `api/` types are boundary carriers. Named domain modules must not depend on
  same-feature API command, query, result, draft, snapshot, page, detail,
  options, or payload carriers as invariant inputs. Translate those carriers at
  the root or application boundary before entering the model.
- Read-model helper objects may stay projection-oriented only inside a
  supporting read-model context or inside explicitly derived-state code. When a
  projection starts ranking, validating, balancing, or choosing policy, promote
  the context or module into the richer policy-owning model.

## Domain Document Contract

Every `DOMAIN.md` remains a binding feature-local model contract, not a
free-form note.

Policy-owning bounded contexts must include non-empty sections named exactly:

- `## Aggregate Model`
- `## Commands And Invariants`
- `## Consistency Model`
- `## Ubiquitous Language`

They must also declare either:

- `Aggregate Root: <TypeName>` for at least one existing aggregate-root type in
  a named domain module, or
- `Write Model: None` plus a non-empty `## Ephemeral Policy Rationale` when
  the context owns runtime policy but no persisted write model.

Supporting read-model contexts must include non-empty sections named exactly:

- `## Read-Model Boundary`
- `## Promotion Triggers`

The system-wide context map lives in the architecture overview. Each domain
feature must appear there with its role and integration relationship to the
other bounded contexts.

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
  - `domain-top-level-role-bucket-ban` via `build-harness`
    (`./gradlew :build-harness:check`): top-level technical role buckets such
    as `entity/`, `valueobject/`, `repository/`, `query/`, `service/`, and
    `services/` are forbidden
  - `domain-module-name-shape` via `build-harness`
    (`./gradlew :build-harness:check`): named domain modules must use
    lower-case package directory names matching `[a-z][a-z0-9_]*`; together
    with the role-bucket ban this enforces that only `api/`, `application/`,
    and named domain modules are valid direct domain buckets
  - `domain-api-no-backend-port-contracts` via `build-harness`
    (`./gradlew :build-harness:check`): backend port contracts such as
    `*Repository` and `*Port` belong in named domain modules rather than
    exported `api/`
  - `domain-application-no-backend-port-contracts` via `build-harness`
    (`./gradlew :build-harness:check`): backend port contracts such as
    `*Repository` and `*Port` belong in named domain modules rather than the
    thin use-case coordination package
  - `domain-context-document-presence`,
    `domain-context-shape-declared`, and
    `domain-supporting-context-rationale` via `build-harness`
    (`./gradlew :build-harness:check`): every domain feature needs exactly one
    `Context Type: ...` marker in `DOMAIN.md`, and supporting read-model
    contexts need a non-empty `## Read-Model Boundary` section
  - `domain-context-map-complete` via `build-harness`
    (`./gradlew :build-harness:check`): every `src/domain/<feature>` appears in
    the overview's `## Domain Context Map`
  - `domain-policy-context-required-sections` via `build-harness`
    (`./gradlew :build-harness:check`): policy-owning `DOMAIN.md` files define
    aggregate model, commands and invariants, consistency model, and ubiquitous
    language sections
  - `domain-aggregate-marker-shape` via `build-harness`
    (`./gradlew :build-harness:check`): policy-owning contexts declare an
    existing aggregate root in a named domain module, or explicitly declare
    `Write Model: None` with an ephemeral-policy rationale
  - `domain-supporting-context-promotion-triggers` via `build-harness`
    (`./gradlew :build-harness:check`): supporting read-model contexts declare
    promotion triggers
  - `domain-outer-layer-independence` via `ArchUnit`
    (`./gradlew architectureTest`)
  - `domain-foreign-feature-public-seams-only` via `ArchUnit`
    (`./gradlew architectureTest`)
  - `domain-feature-cycle-freedom` via `ArchUnit`
    (`./gradlew architectureTest`)
  - `domain-framework-and-infra-leakage` via `PMD architecture`
    (`./gradlew pmdArchitectureMain`)
  - `domain-root-no-direct-infra-composition` via `PMD architecture`
    (`./gradlew pmdArchitectureMain`)
  - `domain-public-boundary-no-private-or-outer-signature-leaks` via
    `Error Prone` (`./gradlew compileJava`): public operational members on
    root application services and public `api/` signatures must stay free of
    outer-layer types, foreign private domain types, and same-feature internal
    domain-module types
  - `domain-root-constructor-port-composition` via `Error Prone`
    (`./gradlew compileJava`): public/protected root application-service
    constructors are composition seams and may accept same-feature
    domain-owned port interfaces and public domain boundaries, but they must
    not expose outer-layer types, foreign private domain types, or same-feature
    concrete application and model collaborators
  - `domain-module-no-api-carrier-dependency` via `Error Prone`
    (`./gradlew compileJava`): named domain modules may not depend on
    same-feature API command, query, result, draft, snapshot, page, detail,
    options, or payload carriers
  - `domain-public-concrete-type-shape` via `Error Prone`
    (`./gradlew compileJava`): public concrete named-module domain types must
    be records, enums, final classes, or sealed abstractions
  - `domain-module-field-purity` via `Error Prone`
    (`./gradlew compileJava`): public concrete named-module domain types must
    not expose non-final instance fields or mutable public static fields
  - `domain-subpackage-cycle-freedom` via `ArchUnit`
    (`./gradlew architectureTest`): direct subpackages under each domain
    feature, including named modules, must stay cycle-free

Candidate mechanical checks:

- `domain-application-no-policy-helper-methods` via PMD source policy:
  application use cases should not grow private helpers named like domain
  policy (`validate`, `normalize`, `mutate`, `react`, `score`, `rank`,
  `calculate`) unless the helper is clearly boundary mapping or query
  normalization.
- `domain-no-setter-style-mutation` via PMD source policy: domain mutation
  operations should be named as domain commands rather than JavaBean setters;
  documented aggregate commands such as `setMembership` remain acceptable.

Review-owned rules:

- object-centred placement quality
- named-module cohesion and ubiquitous-language naming beyond package shape
- application-layer thinness beyond direct infrastructure-composition patterns
- `api/` carrier-only discipline beyond the enforced same-feature
  command/query/result/draft/snapshot/page/detail/options/payload carrier ban
- whether business rules have semantically leaked into `view` or `data`
- aggregate-root-only mutation semantics
- whether true invariants are modelled inside one aggregate
- whether aggregate boundaries are small and conceptually coherent
- reference-by-identity and eventual-consistency choices across aggregate
  boundaries
- broad mutable object graphs across aggregates
- one-aggregate-per-transaction as a modelling judgment
- whether a supporting read-model context is actually justified
- whether a declared context classification is substantively correct

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/repository-structure.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/architecture-enforcement-harness.md:1)
- [ADR 013: DDD-Primary Domain-Layer Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/013-domain-layer-ddd-primary-model.md:1)
- [ADR 014: Strict Domain-Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/014-strict-domain-layer-enforcement.md:1)
- [Fowler: Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/fowler-domain-model.md:1)
- [Fowler: Anemic Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/fowler-anemic-domain-model.md:1)
- [Fowler: Service Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/application-layer/fowler-service-layer.md:1)
- [Microsoft: DDD-Oriented Microservice](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-patterns/microsoft-ddd-oriented-microservice.md:1)
- [Microsoft: Microservice Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/microsoft-microservice-domain-model.md:1)
- [Evans: DDD Reference](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/evans-ddd-reference.pdf:1)
- [Vernon: Effective Aggregate Design Part I](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/vernon-effective-aggregate-design-part-1.pdf:1)
- [Vernon: Effective Aggregate Design Part II](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/domain-driven-design/vernon-effective-aggregate-design-part-2.pdf:1)
