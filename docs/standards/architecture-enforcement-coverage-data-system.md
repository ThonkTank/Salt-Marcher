Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Mechanical and review-owned enforcement coverage for data and
system architecture.

# Data And System Enforcement Coverage

## Goal

This document maps data-layer composition adapters, port adapters, source
adapters, source models, persistencecore, and system-layer rules to their local
quality gates.

## Enforced Rules

| Data/system rule | Owner and blocking task | Mechanical rule IDs |
| --- | --- | --- |
| Data feature roots may expose only `<Feature>ServiceContribution.java` directly under `src/data/<feature>/`. | `build-harness:check`, `pmdArchitectureMain`, `compileJava` | build-harness `data-layout`; PMD `SaltMarcherEntrypointRule`; Error Prone `FeatureShellApiAllowlist` |
| Feature data implementation may live only under `repository/`, `query/`, `gateway/local`, `gateway/remote`, `model/`, or `mapper/`; persistencecore may live only under `sqlite/` or `model/`. | `build-harness:check` | build-harness `data-layout`, `package-path-match` |
| Each non-persistencecore data feature exposes exactly one composition root and exactly one persistence schema declaration. | `build-harness:check` | build-harness `persistence-root-entrypoint`, `persistence-schema-contract` |
| `*ServiceContribution` roots are public final no-arg contribution classes, expose only the allowed public entrypoint shape, register a same-feature service, and stay stateless. | `pmdArchitectureMain`, `compileJava` | PMD `SaltMarcherEntrypointRule`; Error Prone `ServiceRegistryRegistrationPlacement` |
| Data roots may register only same-feature domain boundary services; service-registry registration may happen only from the allowed root. | `pmdArchitectureMain`, `compileJava` | PMD `SaltMarcherSourcePolicyRule`; Error Prone `ServiceRegistryRegistrationPlacement` |
| Composition adapters, repository/query port adapters, and mappers do not own concrete source API mechanics; query adapters do not expose obvious mutation method prefixes; feature DDL literals live in the schema. | `pmdArchitectureMain` | PMD `SaltMarcherDataLayerRoleRule` |
| Schema-owned SQL table names are declared by the feature persistence schema, and SQL table references outside that schema must reference schema constants rather than duplicate table-name literals. | `build-harness:check` | build-harness `data-schema-table-name-owned-by-schema` |
| Repository and query adapters implement matching own-feature domain ports. | `compileJava` | Error Prone `DataAdapterRoleContract` |
| Repository and query public signatures do not leak source-local `model/`, `gateway/`, or `persistencecore/` types. | `compileJava` | Error Prone `DataAdapterPublicSignatureLeak` |
| Port adapters depend on source-adapter facades ending in `Gateway`, not internal source mechanics. | `compileJava` | Error Prone `DataAdapterGatewayCollaboratorBoundary` |
| Gateway public/protected return types stay source-local or JDK-level. | `compileJava` | Error Prone `DataGatewayReturnTypeBoundary` |
| Data code stays independent from view, bootstrap, and shell; non-root data does not depend on shell; data models stay independent from domain; persistencecore stays generic. | `architectureTest` | ArchUnit data-layer rules |
| Data code may use foreign features only through allowed public domain boundaries and must not reach foreign private data buckets. | `architectureTest` | ArchUnit `dataFeaturesMustOnlyUseForeignFeatureApis`, `dataFeaturesMustNotReachForeignPrivateDataBuckets` |
| Data features and persistencecore stay cycle-free. | `architectureTest` | ArchUnit `dataFeaturesMustStayCycleFree` |
| Bootstrap and shell stay outside feature implementation except for the allowed shell host composition point. | `architectureTest`, `pmdArchitectureMain` | ArchUnit `bootstrapMustStayOutsideFeatureCode`, `bootstrapMustOnlyUseAppShellFromShellHost`, `shellMustNotReachFeatureInteractorsDomainOrData`, `shellApiMustStayIndependentFromHostAndFeatureLayers`; PMD `SaltMarcherSourcePolicyRule` |

## Source-Pattern Checks

PMD architecture source rules block stable source-shape smells rather than
semantic persistence behavior. Current PMD blockers cover obvious query mutation
prefixes, concrete source API tokens outside gateways, and feature DDL literal
placement. They do not prove query efficiency, transaction correctness, or
mapping correctness.

The build-harness table-name blocker inspects Java string literals that look
like repository SQL using the repo's uppercase SQL keyword convention. It does
not treat prose such as exception messages as SQL evidence.

## Non-Blocking Or Rejected Heuristics

Broad scans for business policy, duplicate schema meaning, or column-name
literals remain review-owned. They produce low-signal results because terms
such as `id`, `name`, `level`, and `type` are legitimate across many source
models, and current schemas do not define stable column constants for every
field.

## Review-Owned

- whether SQL schemas and migrations express the domain persistence contract
- whether repository/query port adapters translate without losing invariants
- whether source-adapter error handling and transaction boundaries are adequate
- whether a source adapter facade ending in `Gateway` is a useful boundary or
  just naming ceremony
- whether persistencecore abstractions remain small enough for the project
- whether composition roots stay semantically thin after legal wiring
- whether mapper normalization has crossed into domain policy
