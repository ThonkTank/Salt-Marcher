Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for source-local `model/`
schemas, carriers, and model-owned names in data features under `src/data/**`.

# Data Model Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
source-local `model/` role itself.

It answers three questions for every source model surface under
`src/data/**/model/`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY expose or own

This document does not own feature-root topology, repository/query/gateway
adapter contracts, layer-wide data communication rules, or
`persistencecore/` genericity. Those stay in the neighboring data enforcement
documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-feature-schema-contract` | Enforced | every current non-`persistencecore` data feature | build-harness `DataPersistenceRules` | `./gradlew checkArchitecture` | Each current non-`persistencecore` data feature owns exactly one `<Feature>PersistenceSchema.java` declaration in `model/`. |
| `data-schema-ddl-placement` | Source-Pattern Enforced | every feature-owned DDL string literal | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | Feature schema DDL lives in the owning `model/<Feature>PersistenceSchema.java` declaration or shared `persistencecore/`, not in repositories, queries, gateways, mappers, or feature helpers. |
| `data-model-source-shape` | Enforced | every public/protected source-model type under `src/data/**/model/` | Error Prone `DataModelSourceShape` | `./gradlew compileJava` | Public/protected source-model types stay records, enums, immutable final carriers, or final schema utilities rather than arbitrary mutable or inheritance-heavy adapter classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-model-domain-independence` | Enforced | every dependency from `src/data/**/model/` into domain packages | ArchUnit `dataModelTypesMustStayIndependentFromDomainTypes` | `./gradlew checkArchitecture` | Source-model records and schema declarations do not depend on domain packages. |
| `data-model-source-local-not-renamed-domain-entities` | Review-Owned | every source-model record or schema utility under `src/data/**/model/` | none | none | A mechanically legal source-model carrier is still source-local schema or payload shape rather than a renamed domain entity, aggregate, or published-language type with persistence details grafted on. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-model-public-signature-boundary` | Enforced | every public/protected source-model API under `src/data/**/model/` | Error Prone `DataModelSourceShape` | `./gradlew compileJava` | Public/protected source-model APIs expose only same-feature source models, schema infrastructure from own-feature `model/` or shared `persistencecore/model/`, or JDK value/container types. |
| `data-schema-table-name-owned-by-schema` | Enforced | every SQL string literal outside one feature's schema declaration | build-harness `DataPersistenceRules` | `./gradlew checkArchitecture` | SQL string literals outside the schema communicate with the source model through schema-owned table-name constants rather than duplicating table-name literals. |
| `data-model-field-name-centralization` | Review-Owned | every extracted source-local field-name, column-name, or payload-key constant under `src/data/**/model/` | none | none | When source-local names are extracted into constants, the owning `model/` surface remains the single communication point for those names instead of scattering competing spellings across data code. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
- [Data Persistencecore Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-persistencecore-enforcement.md:1)
