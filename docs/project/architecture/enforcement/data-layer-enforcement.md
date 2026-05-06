Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for cross-role
data-layer topology and layer-wide communication boundaries in `src/data/**`.

# Data Layer Enforcement

## Goal

This document owns the mechanically enforced and review-owned invariants of the
data layer itself rather than one specific data role.

It answers three questions for `src/data/**` as one layer:

- which physical topology every data feature MUST use
- which broad layer-wide structures the data layer MUST NOT contain
- which communication seams the data layer as a whole MAY use

Role-local contracts for `*ServiceContribution`, `repository/`, `query/`,
`gateway/`, `model/`, `mapper/`, and `persistencecore/` live in the dedicated
neighboring enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-root-service-contribution-only` | Enforced | every data feature root under `src/data/<feature>/` | data-layer bundle build-harness `DataLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDataLayerEnforcement` | Data feature roots expose only `<Feature>ServiceContribution.java` directly under `src/data/<feature>/`. |
| `data-feature-bucket-layout` | Enforced | every active Java source below `src/data/**` | data-layer bundle build-harness `DataLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDataLayerEnforcement` | When a data feature uses `repository/`, `query/`, `gateway/local`, `gateway/remote`, `model/`, or `mapper/`, its Java lives only in those documented buckets; `persistencecore` Java lives only under `sqlite/` or `model/`, with matching package paths. |
| `data-feature-composition-root-presence` | Enforced | every current non-`persistencecore` data feature | data-layer bundle build-harness `DataLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDataLayerEnforcement` | Each current non-`persistencecore` data feature has exactly one composition-adapter root. |
| `data-layer-adapter-zone-ownership` | Review-Owned | all data code across `src/data/**` | none | none | The data layer remains SaltMarcher's outbound adapter zone: it owns concrete adapters, source mechanics, persistence and transport integration, source-local translation, and root runtime-composition assembly rather than acting as a convenience dump or a second home for feature business meaning. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-outer-layer-independence` | Enforced | every dependency from `src/data/**` into outer layers | data-layer bundle ArchUnit `dataMustNotReachBootstrapOrPresentation` and `dataMustNotReachPresentationShellOrBootstrap` | `./gradlew checkArchitecture` and `./gradlew checkDataLayerEnforcement` | Data code stays independent from view and bootstrap, and non-root data buckets stay independent from shell. |
| `data-non-root-shell-independence` | Enforced | every dependency from non-root data buckets into shell APIs | data-layer bundle ArchUnit `dataMustNotReachPresentationShellOrBootstrap` | `./gradlew checkArchitecture` and `./gradlew checkDataLayerEnforcement` | `repository/`, `query/`, `gateway/`, `model/`, `mapper/`, and `persistencecore/` do not depend on shell APIs. |
| `data-foreign-feature-public-boundary` | Enforced | every dependency from one data feature into another feature's domain code | data-layer bundle ArchUnit `dataFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` and `./gradlew checkDataLayerEnforcement` | Data code reaches foreign domain features only through allowed public domain boundaries. |
| `data-foreign-private-data-bucket-isolation` | Enforced | every dependency from one data feature into another feature's private data buckets | data-layer bundle ArchUnit `dataFeaturesMustNotReachForeignPrivateDataBuckets` | `./gradlew checkArchitecture` and `./gradlew checkDataLayerEnforcement` | Data code does not reach foreign private data buckets. |
| `data-feature-cycles` | Enforced | all data features and `persistencecore` slices | data-layer bundle ArchUnit `dataFeaturesMustStayCycleFree` | `./gradlew checkArchitecture` and `./gradlew checkDataLayerEnforcement` | Data features and `persistencecore` do not form package-slice dependency cycles. |
| `data-layer-no-business-policy-or-second-model` | Review-Owned | all data code across `src/data/**` | none | none | A mechanically legal data feature still stays an adapter zone rather than growing a second business model, a competing policy language, or a presentation-policy home beside `src/domain/**`. |
| `data-layer-no-public-backend-boundary` | Review-Owned | every public callable or runtime-exported backend surface below `src/view/**` that originates in `src/data/**` | none | none | The data layer does not become its own public backend layer. Data-originated backend capabilities remain limited to same-feature root-domain `*ApplicationService` command services plus same-feature `published/*Model` readback services and do not expose repositories, queries, gateways, mappers, source models, or persistence helpers as client-facing boundaries. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-service-registry-root-only` | Enforced | every direct runtime service registration from `src/data/**` into `shell.api.ServiceRegistry.Builder` | data-layer bundle Error Prone `ServiceRegistryRegistrationPlacement` and data-layer bundle build-harness `DataLayerTopologyRules` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDataLayerEnforcement` | Direct runtime service registration belongs only in `src/data/<feature>/<Feature>ServiceContribution.java`; non-root data buckets do not register services or create alternate shell runtime seams. |
| `data-layer-shell-runtime-seam-only-through-root-service-registration` | Enforced Elsewhere | every direct dependency from `src/data/**` into `shell/**` | `data-service-registry-root-only`, `data-service-contribution-shell-runtime-seam-subset`, and `data-non-root-shell-independence` | `./gradlew compileJava` and `./gradlew checkArchitecture` | The data layer reaches the shell only through root `*ServiceContribution` registration seams. Non-root data buckets do not depend on shell APIs, and root composition depends only on `shell.api.ServiceContribution` and `shell.api.ServiceRegistry`. |
| `data-layer-domain-source-dependencies-only-through-own-feature-ports-and-foreign-public-boundaries` | Enforced Elsewhere | every direct source-code dependency from `src/data/**` into `src/domain/**` | `data-service-contribution-register-export-shape`, `data-repository-role-contract`, `data-query-role-contract`, `data-gateway-domain-independence`, and `data-foreign-feature-public-boundary` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDataGatewayEnforcement` | Same-feature domain dependencies from the data layer occur only as root `*ApplicationService` export assembly or own-feature outbound-port implementations, and foreign domain dependencies reach only documented public domain boundaries. |
| `data-layer-root-runtime-export-surface-only` | Review-Owned | every runtime capability exported from `src/data/**` into the shell-owned service registry | none | none | Runtime export from the data layer remains limited to same-feature root `*ApplicationService` command capabilities and same-feature `published/*Model` readback capabilities. The layer does not publish repositories, queries, gateways, mappers, source models, persistence helpers, or foreign-feature services as runtime-accessible backend surfaces. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)
- [Data Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-repository-enforcement.md:1)
- [Data Query Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-query-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
- [Data Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-model-enforcement.md:1)
- [Data Mapper Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-mapper-enforcement.md:1)
- [Data Persistencecore Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-persistencecore-enforcement.md:1)
