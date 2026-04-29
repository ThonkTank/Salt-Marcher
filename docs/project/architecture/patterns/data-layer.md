Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Binding data-layer adapter model, source-boundary roles,
runtime composition placement, and data-layer topology for `src/data/**`.

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
  implementations
- domain `port/` packages own outbound port interfaces. Write-model ports may
  be named `*Repository`; read-only lookup, catalog, or search ports may be
  named `*Lookup`, `*Catalog`, or `*Search`
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

- the data layer owns adaptation, not business meaning. Persistence mechanics,
  connection lifecycle, remote protocol details, schema readiness, and payload
  translation belong in `src/data/**`; business rules, invariants, and policy
  decisions do not
- domain-owned ports remain the stable outbound abstraction. `src/domain/**`
  defines port interfaces and published boundary types; `src/data/**`
  implements the ports
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
  `ShellRuntimeContext.services()`. It is a composition seam. Its current
  `src/data/<feature>/` placement allows concrete adapter assembly, but the
  role is runtime composition rather than persistence or source adaptation

## Role Boundaries

### `<PascalFeatureName>ServiceContribution.java`

The service contribution is the runtime composition adapter currently placed at
the root of one data feature.

- it builds concrete port adapters and registers the same-feature root domain
  application service into the shell-owned service registry
- it keeps feature discovery passive and generic
- it does not own business rules, persistence mechanics, mapping rules, or
  source queries

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
  in a data feature
- that registration root is not a public client-facing backend boundary
- data features must not require routine bootstrap edits or shell-owned
  feature-specific wiring
- cross-feature backend access should go through foreign public domain
  boundaries, not through direct imports of foreign private domain or data
  buckets

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)
- [Data Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-repository-enforcement.md:1)
- [Data Query Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-query-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
- [Data Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-model-enforcement.md:1)
- [Data Mapper Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-mapper-enforcement.md:1)
- [Data Persistencecore Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-persistencecore-enforcement.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
