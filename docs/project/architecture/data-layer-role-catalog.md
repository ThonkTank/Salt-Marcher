Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Detailed adapter-role catalog, example mappings, and
verification notes for the data layer standard.

# Data Layer Role Catalog

## Purpose

This subordinate standard defines the detailed adapter-role contracts and
verification notes beneath the umbrella
[Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/data-layer.md:1).

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
  - repository implementations are not the home for read-only lookup, search,
    or projection ports

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
  - no feature-specific port contracts, feature records, or feature behavior
  - no public application capability registration
  - infrastructure here must stay generic enough to serve multiple owning
    features without becoming a hidden feature slice

## Current Repo Examples

- Composition adapters: [PartyServiceContribution](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/PartyServiceContribution.java:1)
  and [CreaturesServiceContribution](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/CreaturesServiceContribution.java:1)
- Port adapters: [SqlitePartyRosterRepository](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/repository/SqlitePartyRosterRepository.java:1)
  and [SqliteCreatureCatalogQueryAdapter](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/creatures/query/SqliteCreatureCatalogQueryAdapter.java:1)
- Source adapters and shared infrastructure: [SqlitePartyLocalGateway](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/party/gateway/local/SqlitePartyLocalGateway.java:1)
  and [AbstractSqliteConnectionFactory](/home/aaron/Schreibtisch/projects/SaltMarcher/src/data/persistencecore/sqlite/AbstractSqliteConnectionFactory.java:1)

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

The canonical owner model, rule-status vocabulary, and blocking-task mapping
live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1).
The per-surface rule-status matrix lives in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1).
The data/system enforcement matrix lives in the
[Data And System Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-data-system.md:1).

Current mechanical ownership:

- `build-harness` owns data bucket placement, data-root placement,
  `ServiceContribution` root placement, package path alignment,
  schema-entrypoint presence, schema-owned SQL table-name references, and the
  required data-enforcement coverage matrix
- `PMD architecture` owns source-level `*ServiceContribution` contracts,
  AST-visible public/protected mutation-method bans in `query/`, concrete
  source API bans in composition adapters, repositories, queries, and mappers,
  and AST-visible feature DDL string literal placement
- `Error Prone` owns shell API allowlists, service-registry registration
  placement, data-root same-feature root `*ApplicationService` export shape,
  adapter role contracts including inherited public/protected superclass
  methods, public signature leak bans, and source-adapter public/protected
  signature boundaries. Current source-adapter public/protected signatures may
  expose only own-feature source-model records plus `java.lang` and `java.util`
  value or container types. It also owns source-model public shape, query
  adapter calls to mutation-shaped gateway APIs, and composition-root
  construction purity
- `ArchUnit` owns dependency direction, foreign-domain-public-boundary-only
  access, data feature cycle freedom, private-data bucket isolation,
  `gateway/` and `model/` independence from domain packages, and generic-only
  `persistencecore/`

Current review-owned rules cover residual semantic thinness of composition
roots after legal constructor wiring, business-rule exclusion, mapper
translation purity, whether legal source facades are useful boundaries,
source-helper co-location beyond `gateway/local` and `gateway/remote`,
source-local column and field-name centralization, and semantic duplicate
schema truth.

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/data-layer.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Data And System Enforcement Coverage](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-data-system.md:1)
