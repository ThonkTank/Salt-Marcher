Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-01
Source of Truth: Complete invariant catalog for source-local `model/`
schemas, carriers, and model-owned source names in data features under
`src/data/**`.

# Data Model Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
source-local `model/` role itself: source-local schema declarations,
source-local carrier shapes, and source-local names that the role chooses to
publish for internal data collaboration.

It answers three questions for every source model surface under
`src/data/**/model/`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY expose or own

This document does not own feature-root topology, repository/query/gateway
adapter contracts, layer-wide data communication rules, shell/runtime seams,
foreign-feature public-boundary rules, or `persistencecore/` genericity.
Those stay in the neighboring data enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkDataModelEnforcement --rerun-tasks --console=plain`
  runs the currently active Data Model-focused Error Prone, PMD, ArchUnit,
  build-harness topology, and enforcement-documentation coverage checks
  through one root task. Canonical compile-side blocking behavior remains at
  `./gradlew compileJava`; the focused bundle proof route adds the role-owned
  PMD, topology, ArchUnit, and documentation coverage checks without pulling
  the broader architecture aggregates.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-feature-schema-contract` | Enforced | every current non-`persistencecore` data feature that exports persistence-backed source state | data-model bundle build-harness `DataModelTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDataModelEnforcement` | Each current non-`persistencecore` data feature owns exactly one `<Feature>PersistenceSchema.java` declaration in `model/`. |
| `data-schema-ddl-placement` | Source-Pattern Enforced | every feature-owned DDL string literal outside `src/data/persistencecore/**` | data-model bundle PMD `DataModelSchemaDdlPlacementRule` | `./gradlew checkArchitecture` and `./gradlew checkDataModelEnforcement` | Feature-owned DDL literals live in the owning `model/<Feature>PersistenceSchema.java` declaration instead of repositories, queries, gateways, mappers, or other feature helpers. This rule does not claim anything about generic helpers under `src/data/persistencecore/**`. |
| `data-model-source-shape` | Enforced | every public/protected source-model type under `src/data/**/model/` outside `src/data/persistencecore/**` | data-model bundle Error Prone `DataModelSourceShape` | `./gradlew compileJava` and `./gradlew checkDataModelEnforcement` | Public/protected source-model types stay records, enums, immutable final carriers, or final schema utilities rather than arbitrary mutable, inheritance-heavy, or behavior-owning adapter classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-model-domain-independence` | Enforced | every dependency from `src/data/**/model/` into `src/domain/**` | data-model bundle ArchUnit `DataModelArchitectureTest` | `./gradlew checkArchitecture` and `./gradlew checkDataModelEnforcement` | Source-model records and schema declarations do not depend on domain packages. |
| `data-model-source-local-not-renamed-domain-entities` | Review-Owned | every source-model record or schema utility under `src/data/**/model/` outside `src/data/persistencecore/**` | none | none | A mechanically legal source-model carrier is still source-local schema or payload shape rather than a renamed domain entity, aggregate, domain published carrier, or application-facing contract with persistence details grafted on. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-model-public-signature-boundary` | Enforced | every public/protected source-model API under `src/data/**/model/` outside `src/data/persistencecore/**` | data-model bundle Error Prone `DataModelSourceShape` | `./gradlew compileJava` and `./gradlew checkDataModelEnforcement` | Public/protected source-model APIs expose only same-feature source-model types plus `java.lang` and `java.util` value/container types. `*PersistenceSchema` utilities may additionally expose shared `src/data/persistencecore/model/**` schema helpers. |
| `data-schema-table-name-owned-by-schema` | Enforced | every SQL string literal outside one feature's schema declaration | data-model bundle build-harness `DataModelTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDataModelEnforcement` | Same-feature data code outside the schema communicates with model-owned table names through schema-owned constants rather than duplicating table-name literals. |
| `data-model-field-name-centralization` | Review-Owned | every extracted source-local field-name, column-name, or payload-key constant under `src/data/**/model/` | none | none | When `model/` publishes source-local names, those names communicate only as same-feature internal data collaboration seams for schemas, repositories, queries, gateways, or mappers. The owning `model/` surface remains the single communication point for those spellings instead of scattering competing copies across data code or turning them into domain, shell/runtime, or public backend contracts. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
- [Data Persistencecore Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-persistencecore-enforcement.md:1)
