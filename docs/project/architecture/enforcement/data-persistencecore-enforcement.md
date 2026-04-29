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
feature-root topology, non-root shell independence, layer-wide cycle freedom,
foreign-feature boundaries, feature-local adapter contracts, or feature
`*PersistenceSchema` ownership. Those stay in the neighboring data
enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-persistencecore-model-generic-schema-helper-semantics` | Review-Owned | every helper under `src/data/persistencecore/model/**` | none | none | `persistencecore/model` contains only generic source-schema helper shapes such as reusable table or column declarations for feature-owned `model/<Feature>PersistenceSchema.java` declarations, rather than feature-local schema declarations or a second source-model home. |
| `data-persistencecore-sqlite-generic-infrastructure-semantics` | Review-Owned | every helper under `src/data/persistencecore/sqlite/**` | none | none | `persistencecore/sqlite` contains only generic SQLite infrastructure such as reusable connection lifecycle or schema inspection support for feature-local `gateway/local/**` adapters, rather than feature-local source adapters, schema ownership, or runtime composition. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-persistencecore-no-feature-specific-data-dependencies` | Enforced | every dependency from `src/data/persistencecore/**` into `src/data/<feature>/**` | ArchUnit `persistencecoreMustStayIndependentFromFeatureSpecificDataPackages` | `./gradlew checkArchitecture` | `persistencecore/` does not depend on feature-specific data packages. |
| `data-persistencecore-no-domain-dependencies` | Enforced | every dependency from `src/data/persistencecore/**` into `src/domain/**` | ArchUnit `persistencecoreMustNotDependOnDomainTypes` | `./gradlew checkArchitecture` | `persistencecore/` does not depend on domain types. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-persistencecore-model-data-internal-consumer-boundary` | Review-Owned | every public helper under `src/data/persistencecore/model/**` | none | none | Generic schema helpers under `persistencecore/model` communicate only with feature-owned `model/<Feature>PersistenceSchema.java` declarations as shared source-schema support; they do not become a feature-local schema declaration surface or an exported feature contract. |
| `data-persistencecore-sqlite-data-internal-consumer-boundary` | Review-Owned | every public helper under `src/data/persistencecore/sqlite/**` | none | none | Generic SQLite helpers under `persistencecore/sqlite` communicate only with feature-local `gateway/local/**` source adapters as shared SQLite support; they do not become feature-owned gateway facades, schema declarations, or runtime-composition seams. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
- [Data Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-model-enforcement.md:1)
