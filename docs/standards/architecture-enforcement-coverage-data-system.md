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
| `*ServiceContribution` roots are public final no-arg contribution classes, expose only the allowed public entrypoint shape, register a same-feature root `*ApplicationService`, and stay stateless. | `pmdArchitectureMain`, `compileJava` | PMD `SaltMarcherEntrypointRule`; Error Prone `ServiceRegistryRegistrationPlacement`, `DomainServiceRegistryExportShape` |
| Data roots may register only same-feature root `*ApplicationService` domain boundary services; service-registry registration may happen only from the allowed root. | `pmdArchitectureMain`, `compileJava` | PMD `SaltMarcherSourcePolicyRule`; Error Prone `ServiceRegistryRegistrationPlacement`, `DomainServiceRegistryExportShape` |
| Composition adapters, repository/query port adapters, and mappers do not own concrete source API mechanics; query adapters do not expose obvious mutation method prefixes; feature DDL literals live in the schema. | `pmdArchitectureMain` | PMD `SaltMarcherDataLayerRoleRule` |
| Schema-owned SQL table names are declared by the feature persistence schema, and SQL table references outside that schema must reference schema constants rather than duplicate table-name literals. | `build-harness:check` | build-harness `data-schema-table-name-owned-by-schema` |
| Repository and query adapters implement matching own-feature domain ports, use repository ports only from `repository/` and read-only lookup/catalog/search ports only from `query/`, and expose no public/protected adapter methods beyond those declared by the matching port contracts. | `compileJava` | Error Prone `DataAdapterRoleContract` |
| Repository and query public signatures do not leak source-local `model/`, `gateway/`, or `persistencecore/` types. | `compileJava` | Error Prone `DataAdapterPublicSignatureLeak` |
| Port adapters depend on source-adapter facades ending in `Gateway`, not internal source mechanics. | `compileJava` | Error Prone `DataAdapterGatewayCollaboratorBoundary` |
| Gateway public/protected signatures stay source-local or JDK-level: return types, parameters, thrown types, public/protected fields, record components, constructor parameters, supertype clauses, and type bounds may expose only own-feature `model/` records or `java.lang`/`java.util` value and container types. | `compileJava` | Error Prone `DataGatewayReturnTypeBoundary` |
| Source adapters under `gateway/` do not depend on domain packages. Gateways return source-local records or raw source/JDK values and leave domain or published-shape translation to port adapters and mappers. | `architectureTest` | ArchUnit `dataGatewaysMustStayIndependentFromDomainTypes` |
| Data code stays independent from view, bootstrap, and shell; non-root data does not depend on shell; data models stay independent from domain; persistencecore stays generic. | `architectureTest` | ArchUnit data-layer rules |
| Data code may use foreign features only through allowed public domain boundaries and must not reach foreign private data buckets. | `architectureTest` | ArchUnit `dataFeaturesMustOnlyUseForeignFeatureApis`, `dataFeaturesMustNotReachForeignPrivateDataBuckets` |
| Data features and persistencecore stay cycle-free. | `architectureTest` | ArchUnit `dataFeaturesMustStayCycleFree` |
| Bootstrap and shell stay outside feature implementation except for the allowed shell host composition point. | `architectureTest`, `pmdArchitectureMain` | ArchUnit `bootstrapMustStayOutsideFeatureCode`, `bootstrapMustOnlyUseAppShellFromShellHost`, `shellMustNotReachFeatureInteractorsDomainOrData`, `shellApiMustStayIndependentFromHostAndFeatureLayers`; PMD `SaltMarcherSourcePolicyRule` |

## Source-Pattern Checks

PMD architecture source rules block stable source-shape smells rather than
semantic persistence behavior. Current PMD blockers cover obvious query mutation
prefixes, concrete source API tokens outside gateways, feature DDL literal
placement, and root entrypoint shape. They do not prove query efficiency,
transaction correctness, mapping correctness, or that a legal composition root
is semantically thin.

Error Prone signature rules are AST/type-based boundary checks. They are meant
to catch stable Java API shape violations, not semantic adapter quality. The
port-adapter rule proves that public concrete repository/query adapters expose
only their own domain port operations, the service-registration rule proves that
data roots export only same-feature root `*ApplicationService` keys, and the
gateway rule proves that source-adapter public/protected APIs do not leak
domain, published, shell, view, bootstrap, foreign-data, or persistencecore
types. They do not prove that method bodies preserve invariants or that mapper
logic is lossless.

ArchUnit dependency rules prove bytecode-visible dependency direction. The
gateway/domain rule blocks direct source-adapter dependency on domain packages;
it does not prove that source access, migration, or row-repair code is
semantically free of business meaning.

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

## Review-Owned

- whether SQL schemas and migrations express the domain persistence contract
- whether repository/query port adapters translate without losing invariants
- whether source-adapter error handling and transaction boundaries are adequate
- whether a source adapter facade ending in `Gateway` is a useful boundary or
  just naming ceremony
- whether source-specific helper classes are co-located with the right source
  adapter family beyond the enforced `gateway/local` and `gateway/remote`
  package placement
- whether persistencecore abstractions remain small enough for the project
- whether composition roots stay semantically thin after legal wiring
- whether mapper normalization has crossed into domain policy
- whether column and field-name constants would reduce real duplication instead
  of introducing broad low-signal literal scans
