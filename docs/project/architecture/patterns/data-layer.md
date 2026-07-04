Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
Source of Truth: Binding data-layer adapter model, source-boundary roles,
runtime composition placement, and data-layer topology for `src/data/**`.

# Data Layer Standard

## Goal

SaltMarcher uses `src/data/**` as the legacy and non-migrated outer adapter
zone for persistence, imports, files, remote systems, and other concrete sources
behind domain-owned repositories. Data code adapts sources to the domain core;
it does not own a second business model, public backend layer, or policy
language beside `src/domain/**`.

Migrated `src/features/**` persistence seams belong to the
[Feature Runtime Architecture Standard](docs/project/architecture/patterns/feature-runtime.md:1)
after the feature-runtime layering-enforcement transition for that source root
lands.

## Pattern Alignment

- `Ports and Adapters` / `Hexagonal Architecture` govern the relationship
  between domain-owned repository abstractions and technology-specific adapter
  implementations
- the target domain model uses `Repository` as the outbound domain role for
  foreign domain writes and layered data access. Data code satisfies only the
  source-backed part of those abstractions without leaking `src.data/**` types
  back into the domain layer
- data package names are adapter implementation roles, not a second
  architecture model. They exist to keep source mechanics out of the domain
- `repository/` is the current package for write-model port adapters
- `query/` is the current package for read-only port adapters
- `gateway/` is the current package for source adapters that confront concrete
  sources such as SQLite, files, imports, or remote APIs
- `model/` is source-local schema and payload shape
- `mapper/` is optional translation when source shape and domain or published
  shape are meaningfully different
- SaltMarcher does not adopt `Active Record` because persistence mechanics must
  stay outside domain entities and aggregate roots

## Minimal Concept Set

The standard data concepts are deliberately small:

| Concept | Meaning |
| --- | --- |
| Composition Adapter | The root that builds concrete source adapters and registers source-backed capabilities needed by domain services. |
| Port Adapter | A concrete implementation of one domain port or a tightly related port group. |
| Source Adapter | Code that confronts one concrete source family such as SQLite, a file, an import format, or a remote API. |
| Source Model | Source-local records, payload DTOs, schema declarations, table names, and field names. |
| Mapper | Translation between source-local shapes and domain or published boundary shapes when that translation is non-trivial. |
| Shared Infrastructure | Generic technical helpers that do not know feature language. |

Fowler names such as Repository, Data Mapper, and Gateway remain useful
patterns. They are not mandatory sublayers. Use them only where they clarify
real source, mapping, or persistence complexity.

## Core Principles

- the data layer owns legacy and non-migrated adaptation, not business meaning.
  Persistence mechanics, connection lifecycle, remote protocol details, schema
  readiness, and payload translation belong in `src/data/**` for those flows;
  business rules, invariants, and policy decisions do not
- domain-owned repository abstractions remain the stable outbound abstraction
  toward concrete sources. `src/domain/**` defines those abstractions and the
  internal return types they use; `src/data/**` implements them
- `repository/` implements authored write-model persistence ports when a
  repository-style adapter is the clearest current package
- `query/` implements read-only lookup, search, and projection ports when a
  separate read adapter is needed
- `gateway/` remains internal source-adapter code and must not become an
  exported API surface
- source-local shapes stay source-local. Table records, remote payload DTOs,
  schema declarations, and source-specific helper types live in `model/` or
  other internal data buckets, not in domain packages
- one write model remains authored once. The data layer may persist, retrieve,
  project, and migrate authored state, but it must not invent a competing home
  for business rules or presentation policy
- shared infrastructure is allowed only when it stays generic. Reusable
  connection factories, schema helpers, or transport utilities may live in
  `src/data/persistencecore/`, but feature-specific adapters and contracts must
  stay in their owning feature
- the shell-owned runtime capability registration path uses
  `ServiceContribution`, `ServiceRegistry`, and
  `ShellRuntimeContext.services()`. Data uses that seam only when concrete
  source or persistence adapters must be registered. Same-context domain
  application-service and published-model assembly belongs to
  `src/domain/<context>/<Context>ServiceContribution.java`.

## Role Boundaries

### `<PascalFeatureName>ServiceContribution.java`

The service contribution is the source-adapter runtime composition root for one
data feature.

- it builds concrete source-backed adapters and registers source-backed
  capabilities needed by the owning domain context
- it keeps feature discovery passive and generic
- it does not assemble same-context domain application services or published
  models
- it does not own business rules, mapping rules, or source queries

### `<PascalFeatureName>ServiceAssembly.java`

The service assembly is an optional package-local collaborator for a large
service contribution.

- it is constructed only by the same-feature `*ServiceContribution`
- it owns constructor wiring and `ServiceRegistry` registration grouping only
- it does not implement `ServiceContribution`
- it does not own business rules, persistence mechanics, source queries,
  mapping rules, public backend APIs, domain service assembly, or reusable
  factories

### `repository/`

- owns write-model port adapters
- persists and reloads authored state through domain-owned ports
- must not become a second home for domain policy

### `query/`

- owns read-only lookup, search, paging, and projection adapters
- must stay read-only and must not become a write boundary

### `gateway/`

- owns concrete source adapters such as SQLite, file, import, or remote API
  mechanics
- is internal to the data feature, not a public application boundary

### `model/`

- owns source-local schema declarations and source-local carrier shapes
- does not own domain entities or published domain language

### `mapper/`

- owns translation between source-local shapes and domain or published
  boundary shapes when that translation is non-trivial
- translates only; it does not own business rules

## Data Topology

The allowed physical data buckets remain:

```text
src/data/
  <feature>/
    <PascalFeatureName>ServiceContribution.java
    <PascalFeatureName>ServiceAssembly.java
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

- the bucket names above define placement and narrow adapter roles. They do not
  create additional business layers
- `persistencecore/` is shared infrastructure, not an application-service
  boundary and not a generic dumping ground for feature helpers
- new source-specific directories below `gateway/` require an explicit
  architecture decision before they become standard

## Authored Flow

The canonical data flow is:

1. shell discovery loads data source-adapter `*ServiceContribution` roots and
   domain service `*ServiceContribution` roots
2. data contributions register source-backed adapters when needed
3. domain contributions assemble and register same-context root application
   services and published models into `ServiceRegistry`
4. view Binders obtain those root application services through
   `ShellRuntimeContext.services()` as composition input for active roots
5. a data port adapter satisfies one same-feature domain-owned source port
6. internal source adapters talk to SQLite, files, remote services, or other
   concrete sources
7. repository or query adapters return only domain-owned internal
   domain/application types
8. `mapper/` and `model/` keep source-local shapes from leaking into the
   domain core

Additional rules:

- `*ServiceContribution` is the only runtime composition discovery root
  currently placed in a data feature; an optional same-feature
  `*ServiceAssembly` may decompose that root's registration wiring but must not
  become discoverable on its own
- lazy published-state domain service/model initialization belongs inside the
  same-context domain `*ServiceAssembly`, not in data
- that registration root is not a public client-facing backend boundary
- data features must not require routine bootstrap edits or shell-owned
  feature-specific wiring
- cross-feature backend access should go through foreign public domain
  boundaries, not through direct imports of foreign private domain or data
  buckets

## References

- [Architecture Overview](docs/project/architecture/overview.md:1)
- [Layering Architecture Standard](docs/project/architecture/patterns/layering-architecture.md:1)
- [Bootstrap Standard](docs/project/architecture/patterns/bootstrap.md:1)
- [Domain Layer Standard](docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Enforcement](docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data ServiceContribution Enforcement](docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)
- [Data Repository Enforcement](docs/project/architecture/enforcement/data-repository-enforcement.md:1)
- [Data Query Enforcement](docs/project/architecture/enforcement/data-query-enforcement.md:1)
- [Data Gateway Enforcement](docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
- [Data Model Enforcement](docs/project/architecture/enforcement/data-model-enforcement.md:1)
- [Data Mapper Enforcement](docs/project/architecture/enforcement/data-mapper-enforcement.md:1)
- [Data Persistencecore Enforcement](docs/project/architecture/enforcement/data-persistencecore-enforcement.md:1)
- [Quality Platforms Standard](docs/project/verification/quality-platforms.md:1)
- [Modular Monolith ProcessingModule Example](references/architecture-patterns/sessionplanner-gate-model/modular-monolith-processing-module.md:1)
- [Spring Modulith Verification](references/architecture-patterns/sessionplanner-gate-model/spring-modulith-verification.md:1)
