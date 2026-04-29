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
| `data-root-service-contribution-only` | Enforced | every data feature root under `src/data/<feature>/` | build-harness `SourceLayoutRules`, PMD `SaltMarcherEntrypointRule`, and Error Prone `FeatureShellApiAllowlist` | `./gradlew checkArchitecture` and `./gradlew compileJava` | Data feature roots expose only `<Feature>ServiceContribution.java` directly under `src/data/<feature>/`. |
| `data-feature-bucket-layout` | Enforced | every active Java source below `src/data/**` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | When a data feature uses `repository/`, `query/`, `gateway/local`, `gateway/remote`, `model/`, or `mapper/`, its Java lives only in those documented buckets; `persistencecore` Java lives only under `sqlite/` or `model/`, with matching package paths. |
| `data-feature-composition-root-presence` | Enforced | every current non-`persistencecore` data feature | build-harness `DataPersistenceRules` | `./gradlew checkArchitecture` | Each current non-`persistencecore` data feature has exactly one composition-adapter root. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-outer-layer-independence` | Enforced | every dependency from `src/data/**` into outer layers | ArchUnit `dataMustNotReachBootstrapOrPresentation` and `dataMustNotReachPresentationShellOrBootstrap` | `./gradlew checkArchitecture` | Data code stays independent from view and bootstrap, and non-root data buckets stay independent from shell. |
| `data-non-root-shell-independence` | Enforced | every dependency from non-root data buckets into shell APIs | ArchUnit `dataMustNotReachPresentationShellOrBootstrap` | `./gradlew checkArchitecture` | `repository/`, `query/`, `gateway/`, `model/`, `mapper/`, and `persistencecore/` do not depend on shell APIs. |
| `data-foreign-feature-public-boundary` | Enforced | every dependency from one data feature into another feature's domain code | ArchUnit `dataFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` | Data code reaches foreign domain features only through allowed public domain boundaries. |
| `data-foreign-private-data-bucket-isolation` | Enforced | every dependency from one data feature into another feature's private data buckets | ArchUnit `dataFeaturesMustNotReachForeignPrivateDataBuckets` | `./gradlew checkArchitecture` | Data code does not reach foreign private data buckets. |
| `data-feature-cycles` | Enforced | all data features and `persistencecore` slices | ArchUnit `dataFeaturesMustStayCycleFree` | `./gradlew checkArchitecture` | Data features and `persistencecore` do not form package-slice dependency cycles. |
| `data-layer-no-business-policy-or-second-model` | Review-Owned | all data code across `src/data/**` | none | none | A mechanically legal data feature still stays an adapter zone rather than growing a second business model, a competing policy language, or a presentation-policy home beside `src/domain/**`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-layer-domain-access-only-through-public-boundaries-and-ports` | Enforced Elsewhere | every dependency or registration seam from `src/data/**` into `src/domain/**` | `data-service-registry-root-only`, `data-repository-role-contract`, `data-query-role-contract`, `data-gateway-domain-independence`, and `data-foreign-feature-public-boundary` | `./gradlew compileJava` and `./gradlew checkArchitecture` | The data layer reaches same-feature domain code only through domain-owned outbound ports and the documented root `*ApplicationService` registration/export seam, and reaches foreign domain contexts only through documented public domain boundaries. |

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
