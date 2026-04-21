Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Binding data-layer adapter model, source-boundary roles,
runtime composition placement, and layer-specific enforcement status for
`src/data/**`.

# Data Layer Standard

## Goal

SaltMarcher uses `src/data/**` as the outer adapter zone for persistence,
imports, files, remote systems, and other concrete sources behind domain-owned
outbound ports. Data code adapts sources to the domain core; it does not own a
second business model, public backend layer, or policy language beside
`src/domain/**`.

## Pattern Alignment

- `Ports and Adapters` / `Hexagonal Architecture` govern the relationship
  between domain-owned outbound ports and technology-specific adapter
  implementations.
- Domain `port/` packages own outbound port interfaces. Write-model ports may
  be named `*Repository`; read-only lookup, catalog, or search ports may be
  named `*Lookup`, `*Catalog`, or `*Search`.
- Data package names are adapter implementation roles, not a second
  architecture model. They exist to keep source mechanics out of the domain.
- `repository/` is the current package for write-model port adapters.
- `query/` is the current package for read-only port adapters.
- `gateway/` is the current package for source adapters that confront concrete
  sources such as SQLite, files, imports, or remote APIs.
- `model/` is source-local schema and payload shape.
- `mapper/` is optional translation when source shape and domain or published
  shape are meaningfully different.
- SaltMarcher does not adopt `Active Record` because persistence mechanics must
  stay outside domain entities and aggregate roots.

## Minimal Concept Set

The standard data concepts are deliberately small:

| Concept | Meaning |
| --- | --- |
| Composition Adapter | The root that builds concrete adapters and registers the root domain application service. |
| Port Adapter | A concrete implementation of one domain port or a tightly related port group. |
| Source Adapter | Code that confronts one concrete source family such as SQLite, a file, an import format, or a remote API. |
| Source Model | Source-local records, payload DTOs, schema declarations, table names, and field names. |
| Mapper | Translation between source-local shapes and domain or published boundary shapes when that translation is non-trivial. |
| Shared Infrastructure | Generic technical helpers that do not know feature language. |

Fowler names such as Repository, Data Mapper, and Gateway remain useful
patterns. They are not mandatory sublayers. Use them only where they clarify
real source, mapping, or persistence complexity.

## Core Principles

- The data layer owns adaptation, not business meaning. Persistence mechanics,
  connection lifecycle, remote protocol details, schema readiness, and payload
  translation belong in `src/data/**`; business rules, invariants, and policy
  decisions do not.
- Domain-owned ports remain the stable outbound abstraction. `src/domain/**`
  defines port interfaces and published boundary types; `src/data/**`
  implements the ports.
- `repository/` implements authored write-model persistence ports when a
  repository-style adapter is the clearest current package.
- `query/` implements read-only lookup, search, and projection ports when a
  separate read adapter is needed.
- `gateway/` remains internal source-adapter code and must not become an
  exported API surface.
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
  `ShellRuntimeContext.services()`. It is a composition seam. Its current
  `src/data/<feature>/` placement allows concrete adapter assembly, but the
  role is runtime composition rather than persistence or source adaptation.

## Data Topology

The allowed physical data buckets remain:

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

- The bucket names above define placement and narrow adapter roles. They do not
  create additional business layers.
- `persistencecore/` is shared infrastructure, not an application-service
  boundary and not a generic dumping ground for feature helpers.
- New source-specific directories below `gateway/` require an explicit
  architecture decision before they become standard.

## Authored Flow

The canonical data flow is:

1. shell discovery loads one feature's `*ServiceContribution`
2. the contribution assembles and registers the same-feature root application
   service into the shell-owned backend service registry, `ServiceRegistry`
3. view Binders obtain that root application service through
   `ShellRuntimeContext.services()` as composition input for active roots
4. a data port adapter satisfies one same-feature domain-owned port
5. internal source adapters talk to SQLite, files, remote services, or other
   concrete sources
6. `mapper/` and `model/` keep source-local shapes from leaking into the
   domain core

Additional rules:

- `*ServiceContribution` is the only runtime composition root currently placed
  in a data feature.
- That registration root is not a public client-facing backend boundary.
- Data features must not require routine bootstrap edits or shell-owned
  feature-specific wiring.
- Cross-feature backend access should go through foreign public domain
  boundaries, not through direct imports of foreign private domain or data
  buckets.

## Role Definitions

### `<PascalFeatureName>ServiceContribution.java`

`<PascalFeatureName>ServiceContribution.java` is the runtime composition
adapter currently placed at the root of one data feature.

- Responsibilities:
  - build concrete port adapters and register the same-feature root domain
    application service into the shell-owned backend service registry
  - keep adapter and foreign-service wiring inside the composition root
  - keep feature discovery passive and generic
- Allowed behavior:
  - thin adapter composition
  - constructor wiring of repositories, query adapters, gateways, and
    factories
- Forbidden behavior:
  - business-rule ownership
  - feature-specific bootstrap coordination outside `register(...)`
  - source queries, mapping rules, schema rules, or persistence mechanics
  - acting as a long procedural composition layer

### `repository/`

`repository/` owns write-model port adapters.

- Responsibilities:
  - implement domain-owned write-model ports in technology-aware but
    domain-safe terms
  - persist and reload the write model
  - coordinate mappers and internal gateways
- Rules:
  - repository implementations stay in `src/data/**`; port interfaces stay in
    `src/domain/<feature>/<module>/port/`
  - repository implementations must not become a second home for domain policy
  - repository implementations are not the home for read-only lookup,
    search, or projection ports

### `query/`

`query/` owns read-only port adapters.

- Responsibilities:
  - implement read-only search, lookup, paging, and projection ports
  - keep read-side source access outside the domain core
  - coordinate mappers and internal gateways
- Rules:
  - query implementations stay in `src/data/**`; port interfaces stay in
    `src/domain/<feature>/<module>/port/`
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
    not domain or exported published types directly

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

`mapper/` owns translation between source-local shapes and domain or published
boundary types when translation is complex enough to deserve a named
collaborator.

- Responsibilities:
  - map records, rows, or payloads into domain and published-facing results
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
  - no feature-specific port contracts, feature records, or feature
    behavior
  - no public application capability registration
  - infrastructure here must stay generic enough to serve multiple owning
    features without becoming a hidden feature slice

## Current Repo Examples

- Composition adapters: [PartyServiceContribution](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/PartyServiceContribution.java:1)
  and [CreaturesServiceContribution](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/CreaturesServiceContribution.java:1).
- Port adapters: [SqlitePartyRosterRepository](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/repository/SqlitePartyRosterRepository.java:1)
  and [SqliteCreatureCatalogQueryAdapter](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/query/SqliteCreatureCatalogQueryAdapter.java:1).
- Source adapters and shared infrastructure: [SqlitePartyLocalGateway](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/gateway/local/SqlitePartyLocalGateway.java:1)
  and [AbstractSqliteConnectionFactory](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/persistencecore/sqlite/AbstractSqliteConnectionFactory.java:1).

Examples illustrate current state and migration direction. They do not replace
this document as the rule source.

## Forbidden Patterns

- business rules, invariants, or ranking policy implemented in `src/data/**`
- `View` or shell code importing private data buckets directly
- direct bootstrap or shell wiring to concrete source adapters instead of
  registration through `*ServiceContribution`
- domain entities or aggregates owning SQL, remote protocol, or schema logic
- source adapters registered as public application capabilities instead of
  staying behind port adapters; any future typed feature-factory export needs
  an explicit architecture decision and matching enforcement
- feature-specific helpers placed in `persistencecore/`
- cross-feature dependencies on foreign private data buckets
- duplicate schema truth spread across unrelated stores, migrators, and string
  constants

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping live in the [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
The per-surface rule-status matrix lives in the [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).
The data/system enforcement matrix lives in the [Data And System Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage-data-system.md:1).

Current mechanical ownership:

- `build-harness` owns data bucket placement, data-root placement,
  `ServiceContribution` root placement, package path alignment,
  schema-entrypoint presence, schema-owned SQL table-name references, and the
  required data-enforcement coverage matrix.
- `PMD architecture` owns source-level `*ServiceContribution` contracts, obvious
  mutation-method bans in `query/`, concrete source API bans in composition
  adapters, repositories, queries, and mappers, and feature DDL literal
  placement.
- `Error Prone` owns shell API allowlists, service-registry registration
  placement, data-root same-feature root `*ApplicationService` export shape,
  adapter role contracts including inherited public/protected superclass
  methods, public signature leak bans, and source-adapter public/protected
  signature boundaries. Current source-adapter public/protected signatures may
  expose only own-feature source-model records plus `java.lang` and `java.util`
  value or container types.
- `ArchUnit` owns dependency direction, foreign-domain-public-boundary-only
  access, data feature cycle freedom, private-data bucket isolation,
  `gateway/` and `model/` independence from domain packages, and generic-only
  `persistencecore/`.

Current review-owned rules cover semantic thinness of composition roots,
business-rule exclusion, mapper translation purity, whether legal source
facades are useful boundaries, source-helper co-location beyond `gateway/local`
and `gateway/remote`, source-local column and field-name centralization, and
semantic duplicate schema truth. Current public service-registry exports are
limited to the same-feature root `*ApplicationService`; alternate typed
feature-factory exports are not part of the current enforced model. Port adapter
package and role placement, public
adapter surface shape, source-adapter public/protected signature privacy,
source-adapter dependency independence from domain, source-local model
independence from domain, generic-only `persistencecore/`, and SQL table-name
literal ownership are mechanical. The data/system coverage document names the
individual rule IDs, mechanical owners, and blocking entrypoints.

The source-pattern blockers intentionally stop at stable Java source/API shape.
They are useful for concrete source API leakage, obvious query mutations,
same-feature root `*ApplicationService` registration shape, and source-local
gateway signatures. They are not evidence for persistence semantics such as
transaction correctness, query performance, migration safety, or
invariant-preserving mapper behavior.

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
- [ADR 024: Domain And Data Concept Simplification](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/024-domain-data-concept-simplification.md:1)
