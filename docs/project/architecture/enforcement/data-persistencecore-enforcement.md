Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the shared
`src/data/persistencecore/**` infrastructure surface.

# Data Persistencecore Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for
`persistencecore/` itself.

It answers three questions for the shared infrastructure surface under
`src/data/persistencecore/**`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY use

This document does not own physical `sqlite/` or `model/` placement,
feature-root topology, non-root shell independence, feature-local adapter
contracts, or feature `*PersistenceSchema` ownership. Those stay in the
neighboring data enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-persistencecore-model-generic-schema-helper-semantics` | Review-Owned | every helper under `src/data/persistencecore/model/**` | none | none | `persistencecore/model` contains only generic source-schema helper shapes such as reusable table or column declarations, rather than feature-local schema meaning or a second source-model home. |
| `data-persistencecore-sqlite-generic-infrastructure-semantics` | Review-Owned | every helper under `src/data/persistencecore/sqlite/**` | none | none | `persistencecore/sqlite` contains only generic SQLite infrastructure such as reusable connection lifecycle or schema inspection support, rather than feature-local gateway workflows or schema ownership. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-persistencecore-no-feature-specific-data-dependencies` | Enforced | every dependency from `src/data/persistencecore/**` into `src/data/<feature>/**` | ArchUnit `persistencecoreMustStayIndependentFromFeatureSpecificDataPackages` | `./gradlew checkArchitecture` | `persistencecore/` does not depend on feature-specific data packages. |
| `data-persistencecore-no-domain-dependencies` | Enforced | every dependency from `src/data/persistencecore/**` into `src/domain/**` | ArchUnit `persistencecoreMustNotDependOnDomainTypes` | `./gradlew checkArchitecture` | `persistencecore/` does not depend on domain types. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-persistencecore-model-data-internal-consumer-boundary` | Review-Owned | every public helper under `src/data/persistencecore/model/**` | none | none | Generic schema helpers under `persistencecore/model` communicate only as internal data-layer support for source-schema declarations; they do not become a feature contract, domain carrier, or runtime registration seam. |
| `data-persistencecore-sqlite-data-internal-consumer-boundary` | Review-Owned | every public helper under `src/data/persistencecore/sqlite/**` | none | none | Generic SQLite helpers under `persistencecore/sqlite` communicate only as internal data-layer support for concrete source adapters; they do not become a public backend boundary, a domain port adapter, or a shell/runtime integration surface. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
- [Data Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-model-enforcement.md:1)
