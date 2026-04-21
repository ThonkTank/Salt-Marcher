Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Mechanical and review-owned enforcement coverage for data and
system architecture.

# Data And System Enforcement Coverage

## Goal

This document maps data-layer composition adapters, port adapters, source
adapters, source models, persistencecore, and adjacent system boundary rules to
local quality gates that actually block violations. It also names the remaining
review-owned rules so the enforcement set does not overclaim.

The canonical data-layer intent remains defined in the
[Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1).
The shared owner model, lifecycle, status vocabulary, and diagnostic contract
remain defined in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).

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
| `data-query-read-only-source-shape` | PMD `SaltMarcherDataLayerRoleRule`, Error Prone `DataAdapterRoleContract` | `./gradlew checkArchitecture` and `./gradlew compileJava` | Query adapters implement read-only lookup/catalog/search domain ports and do not expose public/protected mutation-prefixed methods visible to the source-pattern check. |
| `data-schema-ddl-placement` | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | Feature DDL string literals live in the owning `model/<Feature>PersistenceSchema.java` declaration or shared `persistencecore`, not scattered through feature helpers. |
| `data-schema-table-name-owned-by-schema` | build-harness `DataPersistenceRules` | `./gradlew checkArchitecture` | SQL string literals outside the schema reference schema-owned table names through constants rather than duplicating table-name literals. |
| `data-port-adapter-role-contract` | Error Prone `DataAdapterRoleContract` | `./gradlew compileJava` | Public concrete repository/query adapters implement matching own-feature domain ports, use repository ports only from `repository/` and read-only ports only from `query/`, and expose no public/protected adapter methods beyond matching port contracts, including inherited public/protected superclass methods. |
| `data-port-adapter-public-signature-boundary` | Error Prone `DataAdapterPublicSignatureLeak` | `./gradlew compileJava` | Public/protected repository/query adapter signatures, including inherited public/protected superclass methods, do not leak source-local `model/`, `gateway/`, or `persistencecore` types. |
| `data-port-adapter-gateway-collaborator-boundary` | Error Prone `DataAdapterGatewayCollaboratorBoundary` | `./gradlew compileJava` | Repository/query adapters depend on own-feature source-adapter facade types ending in `Gateway`, not internal source-mechanics collaborators under `gateway/`. |
| `data-gateway-public-signature-boundary` | Error Prone `DataGatewayReturnTypeBoundary` | `./gradlew compileJava` | Public/protected gateway APIs expose only own-feature source-model records or `java.lang`/`java.util` value and container types. |
| `data-gateway-domain-independence` | ArchUnit `dataGatewaysMustStayIndependentFromDomainTypes` | `./gradlew checkArchitecture` | Source adapters under `gateway/` do not depend on domain packages; domain or published translation stays outside gateways. |
| `data-outer-layer-independence` | ArchUnit `dataMustNotReachBootstrapOrPresentation` and `dataMustNotReachPresentationShellOrBootstrap` | `./gradlew checkArchitecture` | Data code stays independent from view and bootstrap, and non-root data buckets stay independent from shell. |
| `data-non-root-shell-independence` | ArchUnit `dataMustNotReachPresentationShellOrBootstrap` | `./gradlew checkArchitecture` | `repository/`, `query/`, `gateway/`, `model/`, `mapper/`, and `persistencecore/` do not depend on shell APIs. |
| `data-model-domain-independence` | ArchUnit `dataModelTypesMustStayIndependentFromDomainTypes` | `./gradlew checkArchitecture` | Source-model records and schema declarations do not depend on domain packages. |
| `data-persistencecore-generic-only` | ArchUnit `persistencecoreMustStayIndependentFromFeatureSpecificDataPackages` and `persistencecoreMustNotDependOnDomainTypes` | `./gradlew checkArchitecture` | `persistencecore/` does not depend on feature-specific data packages or domain types. |
| `data-foreign-feature-public-boundary` | ArchUnit `dataFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` | Data code reaches foreign domain features only through allowed public domain boundaries. |
| `data-foreign-private-data-bucket-isolation` | ArchUnit `dataFeaturesMustNotReachForeignPrivateDataBuckets` | `./gradlew checkArchitecture` | Data code does not reach foreign private data buckets. |
| `data-feature-cycles` | ArchUnit `dataFeaturesMustStayCycleFree` | `./gradlew checkArchitecture` | Data features and `persistencecore` do not form package-slice dependency cycles. |
| `data-enforcement-coverage-complete` | build-harness `DataEnforcementCoverageRules` | `./gradlew checkArchitecture` | This coverage document lists every required enforced data-layer rule with a mechanical owner and blocking Gradle entrypoint. |

## Adjacent System Boundary Rules

| Rule ID | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- |
| `system-bootstrap-shell-feature-independence` | ArchUnit `bootstrapMustStayOutsideFeatureCode`, `bootstrapMustOnlyUseAppShellFromShellHost`, `shellMustNotReachFeatureInteractorsDomainOrData`, and `shellApiMustStayIndependentFromHostAndFeatureLayers`; PMD `SaltMarcherSourcePolicyRule` | `./gradlew checkArchitecture` | Bootstrap and shell stay outside concrete feature implementation except for the allowed shell host composition point. |

## Source-Pattern Checks

PMD architecture source rules block stable source-shape smells rather than
semantic persistence behavior. Current PMD blockers cover obvious query mutation
prefixes, concrete source API tokens outside gateways, feature DDL literal
placement, and root entrypoint shape. They intentionally stop at source-pattern
evidence and do not prove query efficiency, transaction correctness, mapping
correctness, or that a legal composition root is semantically thin.

Error Prone signature rules are compiler-backed boundary checks. The
port-adapter rule proves public concrete repository/query adapters expose only
their own domain port operations, including inherited public/protected superclass
methods. The service-registration rule proves that data roots export only
same-feature root `*ApplicationService` keys. The gateway rule proves that
source-adapter public/protected APIs do not leak domain, published, shell, view,
bootstrap, foreign-data, or persistencecore types. These checks do not prove that
method bodies preserve invariants or that mapper logic is lossless.

ArchUnit dependency rules prove bytecode-visible dependency direction and cycle
freedom. The gateway/domain rule blocks direct source-adapter dependency on
domain packages; it does not prove that source access, migration, or row-repair
code is semantically free of business meaning.

The build-harness table-name blocker inspects Java string literals that look
like repository SQL using the repo's uppercase SQL keyword convention. It does
not treat prose such as exception messages as SQL evidence.

## Non-Blocking Or Rejected Heuristics

Broad scans for business policy, helper co-location, duplicate schema meaning,
or column-name literals remain review-owned. They produce low-signal results
because terms such as `id`, `name`, `level`, and `type` are legitimate across
many source models, and current schemas do not define stable column constants
for every field. Broad class-name scans for whether a legal `Gateway` facade is
useful also remain review-owned because the current useful boundary is a design
judgment, not a stable syntactic shape.

Static architecture tools can prove structure, dependencies, and public API
shape. They should not be stretched into semantic classifiers for business
meaning. Where a rule would need runtime fixtures, broad keyword inference, or a
large false-positive budget, it remains review-owned.

## Review-Owned

- whether SQL schemas and migrations express the domain persistence contract
- whether repository/query port adapters translate without losing invariants
- whether query adapters are semantically read-only when no stable public API or
  dependency violation exposes mutation
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

These remain review-owned because the available local tools would either need
runtime fixtures, brittle semantic inference, or broad text heuristics that
would produce low-signal results.

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/data-layer.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1)
- [Source References Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/source-references.md:1)
- [Error Prone Plugin Checks](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-enforcement-tools/error-prone-plugin-checks.md:1)
- [ArchUnit User Guide](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-enforcement-tools/archunit-user-guide.md:1)
- [PMD Writing Java Rules](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-enforcement-tools/pmd-writing-java-rules.md:1)
- [Gradle Custom Tasks](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/build-tooling/gradle-custom-tasks.md:1)
- [Hexagonal Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/architecture-patterns/cockburn-hexagonal-architecture.md:1)
- [Fowler Repository](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/persistence-patterns/fowler-repository.md:1)
- [Fowler Gateway](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/persistence-patterns/fowler-gateway.md:1)
- [Fowler Data Mapper](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/persistence-patterns/fowler-data-mapper.md:1)
- [Fowler Active Record](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/references/persistence-patterns/fowler-active-record.md:1)
