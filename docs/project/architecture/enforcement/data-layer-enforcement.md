Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Mechanical and review-owned enforcement coverage for the
canonical Data Layer Standard.

# Data Layer Enforcement

## Goal

This document maps data-layer composition adapters, port adapters, source
adapters, source models, and `persistencecore` rules to local quality gates
that actually block violations. It also names the remaining review-owned rules
so the enforcement set does not overclaim.

## Enforced Rule Matrix

| Rule ID | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- |
| `data-root-service-contribution-only` | build-harness `SourceLayoutRules`, PMD `SaltMarcherEntrypointRule`, Error Prone `FeatureShellApiAllowlist` | `./gradlew checkArchitecture` and `./gradlew compileJava` | Data feature roots expose only `<Feature>ServiceContribution.java` directly under `src/data/<feature>/`. |
| `data-feature-bucket-layout` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Feature data Java lives only under `repository/`, `query/`, `gateway/local`, `gateway/remote`, `model/`, or `mapper/`; `persistencecore` Java lives only under `sqlite/` or `model/`, with matching package paths. |
| `data-feature-composition-root-presence` | build-harness `DataPersistenceRules` | `./gradlew checkArchitecture` | Each current non-`persistencecore` data feature has exactly one composition adapter root. |
| `data-feature-schema-contract` | build-harness `DataPersistenceRules`, PMD `SaltMarcherEntrypointRule` | `./gradlew checkArchitecture` | Each current non-`persistencecore` data feature has exactly one `<Feature>PersistenceSchema.java` source-model schema declaration. |
| `data-service-contribution-shape` | PMD `SaltMarcherEntrypointRule`, Error Prone `ServiceRegistryRegistrationPlacement` and `DomainServiceRegistryExportShape` | `./gradlew checkArchitecture` and `./gradlew compileJava` | `*ServiceContribution` roots are public final no-arg contribution classes, expose only the allowed root entrypoint shape, stay stateless, and register through the shell-owned service registry from the allowed root. |
| `data-service-registry-root-only` | PMD `SaltMarcherSourcePolicyRule`, Error Prone `ServiceRegistryRegistrationPlacement` and `DomainServiceRegistryExportShape` | `./gradlew checkArchitecture` and `./gradlew compileJava` | Runtime service registration happens only from data composition roots and exports only same-feature root `*ApplicationService` domain boundary services. |
| `data-composition-no-source-mechanics` | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | Composition adapters do not reference narrow concrete source APIs such as JDBC, file, HTTP-client, or filesystem packages. |
| `data-port-adapter-no-source-mechanics` | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | `repository/` and `query/` port adapters do not reference narrow concrete source APIs directly. |
| `data-mapper-no-source-mechanics` | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | `mapper/` code does not reference narrow concrete source APIs directly. |
| `data-query-read-only-source-shape` | PMD `SaltMarcherDataLayerRoleRule`, Error Prone `DataAdapterRoleContract` and `DataQueryGatewayMutationBoundary` | `./gradlew checkArchitecture` and `./gradlew compileJava` | Query adapters implement read-only lookup/catalog/search domain ports, do not expose public/protected mutation-prefixed methods visible to the source-pattern check, and do not call mutation-prefixed own-feature gateway operations. |
| `data-schema-ddl-placement` | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | Feature DDL string literals live in the owning `model/<Feature>PersistenceSchema.java` declaration or shared `persistencecore`, not scattered through feature helpers. |
| `data-schema-table-name-owned-by-schema` | build-harness `DataPersistenceRules` | `./gradlew checkArchitecture` | SQL string literals outside the schema reference schema-owned table names through constants rather than duplicating table-name literals. |
| `data-port-adapter-role-contract` | Error Prone `DataAdapterRoleContract` | `./gradlew compileJava` | Public concrete repository/query adapters implement matching own-feature domain ports, use repository ports only from `repository/` and read-only ports only from `query/`, and expose no public/protected adapter methods beyond matching port contracts, including inherited public/protected superclass methods. |
| `data-port-adapter-public-signature-boundary` | Error Prone `DataAdapterPublicSignatureLeak` | `./gradlew compileJava` | Public/protected repository/query adapter signatures, including inherited public/protected superclass methods, do not leak source-local `model/`, `gateway/`, or `persistencecore` types. |
| `data-port-adapter-gateway-collaborator-boundary` | Error Prone `DataAdapterGatewayCollaboratorBoundary` | `./gradlew compileJava` | Repository/query adapters depend on own-feature source-adapter facade types ending in `Gateway`, not internal source-mechanics collaborators under `gateway/`. |
| `data-gateway-public-signature-boundary` | Error Prone `DataGatewayReturnTypeBoundary` | `./gradlew compileJava` | Public/protected gateway APIs expose only own-feature source-model records or `java.lang`/`java.util` value and container types. |
| `data-gateway-domain-independence` | ArchUnit `dataGatewaysMustStayIndependentFromDomainTypes` | `./gradlew checkArchitecture` | Source adapters under `gateway/` do not depend on domain packages; domain or published translation stays outside gateways. |
| `data-model-source-shape` | Error Prone `DataModelSourceShape` | `./gradlew compileJava` | Public source-model types stay records, enums, immutable final carriers, or final schema utilities, and expose only same-feature source models, schema infrastructure, or JDK value/container types. |
| `data-outer-layer-independence` | ArchUnit `dataMustNotReachBootstrapOrPresentation` and `dataMustNotReachPresentationShellOrBootstrap` | `./gradlew checkArchitecture` | Data code stays independent from view and bootstrap, and non-root data buckets stay independent from shell. |
| `data-non-root-shell-independence` | ArchUnit `dataMustNotReachPresentationShellOrBootstrap` | `./gradlew checkArchitecture` | `repository/`, `query/`, `gateway/`, `model/`, `mapper/`, and `persistencecore/` do not depend on shell APIs. |
| `data-model-domain-independence` | ArchUnit `dataModelTypesMustStayIndependentFromDomainTypes` | `./gradlew checkArchitecture` | Source-model records and schema declarations do not depend on domain packages. |
| `data-service-contribution-construction-purity` | Error Prone `DataServiceContributionConstructionPurity` | `./gradlew compileJava` | Data composition roots perform constructor wiring and service registration only; direct source-mechanics, repository/query, gateway, schema, or mapper method calls stay behind adapters. |
| `data-persistencecore-generic-only` | ArchUnit `persistencecoreMustStayIndependentFromFeatureSpecificDataPackages` and `persistencecoreMustNotDependOnDomainTypes` | `./gradlew checkArchitecture` | `persistencecore/` does not depend on feature-specific data packages or domain types. |
| `data-foreign-feature-public-boundary` | ArchUnit `dataFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` | Data code reaches foreign domain features only through allowed public domain boundaries. |
| `data-foreign-private-data-bucket-isolation` | ArchUnit `dataFeaturesMustNotReachForeignPrivateDataBuckets` | `./gradlew checkArchitecture` | Data code does not reach foreign private data buckets. |
| `data-feature-cycles` | ArchUnit `dataFeaturesMustStayCycleFree` | `./gradlew checkArchitecture` | Data features and `persistencecore` do not form package-slice dependency cycles. |
| `data-enforcement-coverage-complete` | build-harness `DataEnforcementCoverageRules` | `./gradlew checkArchitecture` | This enforcement document lists every required enforced data-layer rule with a mechanical owner and blocking Gradle entrypoint, and classifies every required data-layer rule group as enforced, enforced elsewhere, or review-owned. |

## Documented Data Rule Coverage Inventory

| Data Rule Group | Status | Coverage |
| --- | --- | --- |
| `data-adapter-zone-purpose` | Enforced | Covered by `data-port-adapter-role-contract`, `data-port-adapter-public-signature-boundary`, `data-gateway-domain-independence`, `data-model-domain-independence`, and `data-outer-layer-independence`. |
| `data-ports-domain-owned` | Enforced | Covered by `data-port-adapter-role-contract`; domain-side port ownership is also covered by the domain `domain-port-boundary` rule. |
| `data-role-bucket-placement` | Enforced | Covered by `data-root-service-contribution-only`, `data-feature-bucket-layout`, `data-feature-composition-root-presence`, and `data-feature-schema-contract`. |
| `data-active-record-rejected` | Enforced Elsewhere | Covered by domain infrastructure-dependency and domain outer-layer independence rules; domain entities and aggregates cannot own persistence source dependencies. |
| `data-source-mechanics-owned-by-gateway` | Enforced | Covered by `data-composition-no-source-mechanics`, `data-port-adapter-no-source-mechanics`, `data-mapper-no-source-mechanics`, `data-port-adapter-gateway-collaborator-boundary`, and `data-gateway-public-signature-boundary`. |
| `data-source-local-shapes-owned-by-model` | Enforced | Covered by `data-feature-schema-contract`, `data-model-source-shape`, `data-schema-table-name-owned-by-schema`, `data-port-adapter-public-signature-boundary`, and `data-model-domain-independence`. |
| `data-source-field-name-centralization` | Review-Owned | Table-name ownership is enforced by `data-schema-table-name-owned-by-schema`; broader column, payload-field, and source-local field-name centralization remains review-owned until the schema model has an accepted constant convention that can support precise checks. |
| `data-single-write-model` | Review-Owned | The current gates can block duplicate source table-name literals and obvious boundary leaks, but cannot prove semantic authored-state ownership. |
| `data-runtime-composition-root` | Enforced | Covered by `data-service-contribution-shape`, `data-service-contribution-construction-purity`, `data-service-registry-root-only`, and `data-root-service-contribution-only`. |
| `data-bootstrap-shell-no-source-wiring` | Enforced Elsewhere | Covered by shell and layering enforcement for root registration placement and bootstrap/shell feature-independence. |
| `data-cross-feature-boundary` | Enforced | Covered by `data-foreign-feature-public-boundary`, `data-foreign-private-data-bucket-isolation`, and `data-feature-cycles`. |
| `data-service-contribution-thinness` | Review-Owned | The gates prove root shape, statelessness, registration placement, construction-only purity, and concrete source API absence; whether the legal adapter graph is still too much procedural assembly remains review-owned. |
| `data-repository-write-model-role` | Enforced | Covered by `data-port-adapter-role-contract`, `data-port-adapter-no-source-mechanics`, and `data-port-adapter-public-signature-boundary`; whether a write port is semantically needed remains review-owned. |
| `data-query-read-only-role` | Enforced | Covered by `data-query-read-only-source-shape`, `data-port-adapter-role-contract`, and `data-port-adapter-public-signature-boundary`; semantic read-only behavior remains review-owned. |
| `data-gateway-internal-source-adapter` | Enforced | Covered by `data-feature-bucket-layout`, `data-gateway-public-signature-boundary`, `data-gateway-domain-independence`, and `data-non-root-shell-independence`. |
| `data-model-schema-source-local` | Enforced | Covered by `data-feature-schema-contract`, `data-model-source-shape`, `data-model-domain-independence`, `data-schema-ddl-placement`, and `data-schema-table-name-owned-by-schema`; whether records are merely renamed domain entities remains review-owned. |
| `data-mapper-translation-only` | Review-Owned | Current gates block concrete source API leakage from mappers, but cannot prove mapping losslessness or absence of domain validation/policy. |
| `data-persistencecore-generic-only-rule` | Enforced | Covered by `data-persistencecore-generic-only` and `data-non-root-shell-independence`; abstraction size and usefulness remain review-owned. |
| `data-pattern-vocabulary-optional` | Review-Owned | Current gates do not require a Fowler-pattern concept inventory. They enforce legal placement when code exists; whether a Repository, Data Mapper, or Gateway abstraction clarifies a specific source remains design review. |
| `data-gateway-helper-co-location` | Review-Owned | `data-feature-bucket-layout` enforces `gateway/local` and `gateway/remote` placement; finer helper grouping inside one source family remains review-owned because useful co-location is contextual. |
| `data-persistencecore-semantic-genericity` | Review-Owned | `data-persistencecore-generic-only` blocks feature-specific data and domain dependencies; whether a dependency-clean helper is still too feature-shaped, broad, or ceremonial remains review-owned. |
| `data-forbidden-business-policy` | Review-Owned | Stable dependency, signature, and source-token evidence is enforced where it exists; business-rule ownership without those shapes remains review-owned. |
| `data-view-shell-private-data-access` | Enforced Elsewhere | Covered by view and shell dependency rules that ban view/shell access to data implementation packages. |
| `data-domain-no-source-mechanics` | Enforced Elsewhere | Covered by domain forbidden-infrastructure dependency and domain outer-layer independence rules. |
| `data-source-adapter-no-public-capabilities` | Enforced | Covered by `data-service-registry-root-only` and `data-gateway-public-signature-boundary`; future non-application-service feature factories would require a separate ADR and blocker. |
| `data-duplicate-schema-truth` | Review-Owned | Table-name literal duplication is enforced by `data-schema-table-name-owned-by-schema`; broader schema-meaning duplication remains review-owned. |

## Review-Owned

- whether SQL schemas and migrations express the domain persistence contract
- whether repository/query port adapters translate without losing invariants
- whether query adapters are semantically read-only when no stable public API,
  gateway-call, or dependency violation exposes mutation
- whether source-adapter error handling and transaction boundaries are adequate
- whether a source adapter facade ending in `Gateway` is a useful boundary or
  just naming ceremony
- whether source-specific helper classes are co-located with the right source
  adapter family beyond the enforced `gateway/local` and `gateway/remote`
  package placement
- whether persistencecore abstractions remain small enough for the project
- whether composition roots stay semantically thin after legal wiring
- whether mappers translate rather than owning domain validation, normalization,
  ranking, or policy
- whether data code owns business rules, invariants, ranking policy, or
  presentation policy in shapes that do not create stable dependency, signature,
  or forbidden-token evidence
- whether source-local model records are source shapes rather than renamed
  domain entities
- whether column and field-name constants would reduce real duplication instead
  of introducing broad low-signal literal scans
- whether semantic duplicate schema truth exists across stores, migrators, and
  source-model declarations beyond table-name literals

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/layering-architecture-enforcement.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Error Prone Plugin Checks](/home/aaron/Schreibtisch/projects/references/architecture-enforcement-tools/error-prone-plugin-checks.md:1)
- [ArchUnit User Guide](/home/aaron/Schreibtisch/projects/references/architecture-enforcement-tools/archunit-user-guide.md:1)
- [PMD Writing Java Rules](/home/aaron/Schreibtisch/projects/references/architecture-enforcement-tools/pmd-writing-java-rules.md:1)
