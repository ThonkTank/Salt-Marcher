Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Binding data-layer architecture model, role boundaries,
adapter responsibilities, and layer-specific enforcement status for `src/data/**`.

# Data Layer Standard

## Goal

SaltMarcher uses a strict data-layer model so `src/data/**` owns persistence
and external-system adaptation behind domain-owned contracts, with one explicit
registration root, one internal source-adapter boundary, and no business-rule
ownership leaking out of `src/domain/**`.

## Pattern Alignment

- `Ports and Adapters` / `Hexagonal Architecture` govern the relationship
  between domain-owned contracts and technology-specific adapter
  implementations.
- `Repository` keeps its DDD / Enterprise Application Architecture meaning:
  the domain owns repository contracts for the write model; the data layer
  implements them.
- `Read Model` is the preferred term for domain-owned read-only lookup and
  projection contracts. Those contracts belong in the owning named domain
  module; they are not tied to a mandatory domain `query/` package or the
  thin `application/` coordination package.
- `Data Mapper` governs translation between source-local records and domain or
  boundary types.
- `Gateway` governs internal concrete-source adapters below the exported data
  boundary.
- SaltMarcher does not adopt `Active Record` as its target model because
  persistence mechanics must stay outside domain entities and aggregate roots.

## Core Principles

- The data layer owns adaptation, not business meaning. Persistence mechanics,
  connection lifecycle, remote protocol details, schema readiness, and payload
  translation belong in `src/data/**`; business rules, invariants, and policy
  decisions do not.
- Domain-owned contracts remain the stable backend abstraction. `src/domain/**`
  defines repository contracts, projection contracts, and boundary types;
  `src/data/**` implements them.
- `repository/` implements write-model persistence contracts.
- `query/` implements exported read-model ports.
- `gateway/` remains internal and must not become an exported API surface.
- Source-local shapes stay source-local. Table records, remote payload DTOs,
  schema declarations, and source-specific helper types live in `model/` or
  other internal data buckets, not in domain packages.
- One write model remains authored once. The data layer may persist,
  retrieve, project, and migrate authored state, but it must not invent a
  competing home for business rules or presentation policy.
- Shared infrastructure is allowed only when it stays generic. Reusable
  connection factories, schema helpers, or transport utilities may live in
  `src/data/persistencecore/`, but feature-specific adapters and contracts must
  stay in their owning feature.
- The shell-owned runtime capability registration path uses
  `ServiceContribution`, `ServiceRegistry`, and
  `ShellRuntimeContext.services()`. It is a composition seam, not a second
  public backend layer inside the shell.

## Data Topology

The allowed data buckets remain:

```text
src/data/
  <feature>/
    <PascalFeatureName>ServiceContribution.java
    repository/
    query/
    gateway/
      local/
      remote/
    model/
    mapper/
  persistencecore/
```

Additional rules:

- The bucket names above define both placement and semantic role.
- `persistencecore/` is shared infrastructure, not an application-service
  boundary and not a generic dumping ground for feature helpers.
- New source-specific directories below `gateway/` require an explicit
  architecture decision before they become standard.

## Authored Flow

The canonical data flow is:

1. shell discovery loads one feature's `*ServiceContribution`
2. the contribution registers typed backend capabilities and
   application-service factories into the shell-owned backend service
   registry, `ServiceRegistry`
3. view `assembly/` code reaches those capabilities through
   `ShellRuntimeContext.services()` only as composition input, or through an
   application-service factory that was already assembled at the boundary
4. a data `repository/` or `query/` implementation satisfies one
   domain-owned contract
5. internal `gateway/` adapters talk to SQLite, files, remote services, or
   other concrete sources
6. `mapper/` and `model/` keep source-local shapes from leaking into the
   domain core

Additional rules:

- `*ServiceContribution` is the only public registration root of a data
  feature.
- That registration root is not a public client-facing backend boundary.
- Data features must not require routine bootstrap edits or shell-owned
  feature-specific wiring.
- Cross-feature backend access should go through foreign public domain
  boundaries, not through direct imports of foreign private domain or data
  buckets.

## Role Definitions

### `<PascalFeatureName>ServiceContribution.java`

`<PascalFeatureName>ServiceContribution.java` is the root registration
entrypoint and runtime-capability registration boundary of one data feature.

- Responsibilities:
  - build and register exported backend capabilities into the shell-owned
    backend service registry
  - register application-service factories that depend on those capabilities
  - keep feature discovery passive and generic
- Allowed behavior:
  - thin adapter composition
  - constructor wiring of repositories, query adapters, gateways, and
    factories
- Forbidden behavior:
  - business-rule ownership
  - feature-specific bootstrap coordination outside `register(...)`
  - acting as a long procedural composition layer

### `repository/`

`repository/` owns data-layer implementations of domain-owned repository
contracts for the write model.

- Responsibilities:
  - implement domain-owned repository contracts in technology-aware but
    domain-safe terms
  - persist and reload the write model
  - coordinate mappers and internal gateways
- Rules:
  - repository implementations stay in `src/data/**`; contracts stay in
    `src/domain/**`
  - repository implementations must not become a second home for domain policy
  - repository implementations are not the home for read-only projection ports

### `query/`

`query/` owns data-layer implementations of domain-owned read-model or
projection contracts.

- Responsibilities:
  - implement read-only search, lookup, paging, and projection contracts
  - present the exported read boundary of the feature
  - coordinate mappers and internal gateways
- Rules:
  - query implementations stay in `src/data/**`; contracts stay in
    `src/domain/**`
  - query implementations must stay read-only and must not become write-model
    mutation boundaries

### `gateway/local/` and `gateway/remote/`

`gateway/` owns concrete source adapters.

- Responsibilities:
  - manage connection, transaction, transport, schema-readiness, request, and
    response mechanics for one source family
  - encapsulate source-specific queries, commands, and low-level helpers
  - keep concrete technology details out of repository and query
    implementations
- Rules:
  - gateways are internal collaborators of the data feature, not public
    application boundaries
  - source-specific helper classes should stay co-located under the same
    gateway package
  - gateways should return source-local records or tightly scoped raw results,
    not domain or exported API types directly

### `model/`

`model/` owns source-local schema declarations and data shapes.

- Responsibilities:
  - define canonical in-code persistence schemas
  - hold records, rows, payload DTOs, and other source-local carrier types
  - centralize source-local field names and table ownership
- Rules:
  - `model/` types are data-source shapes, not domain entities
  - source-local schema truth must not be scattered across unrelated helpers

### `mapper/`

`mapper/` owns translation between source-local shapes and domain or boundary
types.

- Responsibilities:
  - map records, rows, or payloads into domain and API-facing results
  - map canonical aggregates or snapshots back into source-local shapes for
    persistence
- Rules:
  - mappers translate; they do not own business rules
  - normalization or validation with domain meaning belongs in `src/domain/**`
    even when the mapper is the first place to notice malformed data

### `persistencecore/`

`persistencecore/` owns shared persistence infrastructure reused by multiple
features.

- Responsibilities:
  - provide generic connection lifecycle helpers
  - provide generic schema or transport support reused by multiple features
- Rules:
  - no feature-specific repository contracts, feature records, or feature
    behavior
  - no public application capability registration
  - infrastructure here must stay generic enough to serve multiple owning
    features without becoming a hidden feature slice

## Current Repo Examples

- Positive root-registration examples:
  [PartyServiceContribution](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/PartyServiceContribution.java:1)
  and
  [CreaturesServiceContribution](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/CreaturesServiceContribution.java:1)
  keep service discovery at one thin feature root.
- Positive exported-adapter examples:
  [SqlitePartyRosterRepository](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/repository/SqlitePartyRosterRepository.java:1)
  and
  [SqliteCreatureCatalogQueryAdapter](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/query/SqliteCreatureCatalogQueryAdapter.java:1)
  illustrate the split between write-model repositories and exported
  read-model adapters.
- Positive gateway example:
  [SqlitePartyLocalGateway](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/gateway/local/SqlitePartyLocalGateway.java:1)
  owns connection and schema-readiness mechanics instead of pushing them into
  an exported adapter root.
- Positive shared-infrastructure example:
  [AbstractSqliteConnectionFactory](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/persistencecore/sqlite/AbstractSqliteConnectionFactory.java:1)
  is reusable persistence infrastructure without becoming an
  application-service boundary.
- Migration-debt example:
  [DungeonMapStore](/home/aaron/Schreibtisch/projects/SaltMarcher/src/domain/dungeon/application/DungeonMapStore.java:1)
  is a domain-owned in-memory repository used as a transitional implementation,
  not the target data-layer shape for long-lived persistence-backed features.

These examples illustrate current state and migration direction. They do not
replace this document as the rule source.

## Forbidden Patterns

- business rules, invariants, or ranking policy implemented in `src/data/**`
- `View` or shell code importing private data buckets directly
- direct bootstrap or shell wiring to concrete gateways instead of
  registration through `*ServiceContribution`
- domain entities or aggregates owning SQL, remote protocol, or schema logic
- gateways registered as public application capabilities instead of through
  repository, query, or typed feature factories
- feature-specific helpers placed in `persistencecore/`
- cross-feature dependencies on foreign private data buckets
- duplicate schema truth spread across unrelated stores, migrators, and string
  constants

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping live in the [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
The per-surface rule-status matrix lives in the [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

Current mechanical ownership:

- `build-harness` owns allowed data buckets, data-root placement, service-root
  presence, the current stricter schema-entrypoint presence blocker below
  `src/data/**`, `ServiceContribution` root placement, and exact table-name
  literal ownership by the feature persistence schema.
- `PMD architecture` owns source-level root contracts for
  `*ServiceContribution`, including naming, `public final`, public no-arg
  constructor, required interface, `register(ServiceRegistry.Builder)`, no
  instance fields, no extra public/protected members, and own-feature
  domain-boundary-only registration into `ServiceRegistry`.
  It also owns the mechanically stable source-level subset of data-role
  discipline: obvious mutation-method bans in `query/`, concrete source API
  bans in `repository/`, `query/`, and `mapper/`, and feature DDL literal
  placement in `model/<Feature>PersistenceSchema.java` or generic
  `persistencecore/` infrastructure.
- `Error Prone` owns the shell API allowlist on data
  `*ServiceContribution` roots, direct service-registry registration placement,
  public/protected gateway return-type bans outside JDK values/containers and
  same-feature `model/` records, and public/protected repository/query
  signature bans on leaking internal `model/`, `gateway/`, or
  `persistencecore` infrastructure types, including constructors.
  It also owns the compiler-precise adapter role-contract check that keeps
  `repository/` adapters on repository contracts and `query/` adapters on
  read-model or query contracts, prevents public data-owned contract/carrier
  types in adapter buckets, requires public concrete adapters to satisfy an
  own-feature domain-owned role contract, keeps exported domain port
  implementations out of other data buckets, and keeps exported adapters
  dependent on own-feature gateway facade types rather than concrete gateway
  mechanics such as stores, migrators, table managers, or connection factories.
- `ArchUnit` owns data dependence bans on `src.view`, `shell`, and
  `bootstrap`, foreign-domain-public-boundary-only access from internal data
  packages, cycle freedom across data features, cross-feature dependency bans
  on foreign private data buckets, `model/` independence from domain packages,
  and `persistencecore/` structural independence from feature-specific data
  packages and domain packages.

Current `Review-Only` rules in this standard:

- semantic thin `*ServiceContribution` registration roots beyond the encoded
  stateless/root-contract checks
- `repository/` and `query/` as the only exported domain-port adapter roles in
  the stronger semantic sense beyond the mechanically encoded contract-role
  split, public contract-placement check, contract-presence check, adapter
  placement check, and gateway-facade collaborator check
- gateway internals staying private to the owning data feature in the stronger
  semantic sense beyond Java-visible signatures and direct exported-adapter
  collaborator references
- business-rule exclusion from `src/data/**`
- mapper translation purity beyond concrete source API bans
- `model/` types being truly source-local data shapes rather than domain
  entities beyond dependency and signature-leak checks
- the semantic remainder of generic-only discipline for `persistencecore/`
- duplicate schema truth staying out of scattered helpers and string constants
  beyond exact table-name duplicate detection and the mechanically stable
  feature-DDL placement rule

Current build-harness scope is slightly stricter than the intent wording in
this standard:

- the standard speaks about one schema declaration per
  persistence-exporting feature
- the current checker effectively requires one schema declaration for every
  current non-`persistencecore` data feature

Treat that stricter behavior as the operative blocker until the harness learns
to distinguish remote-only or otherwise non-persistence-exporting data slices.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/domain-layer.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [ADR 002: Passive Shell With Generic Feature Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 008: Top-Level Repository Taxonomy](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/008-top-level-repository-taxonomy.md:1)
- [ADR 010: Data-Layer Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/010-data-layer-architecture-model.md:1)
