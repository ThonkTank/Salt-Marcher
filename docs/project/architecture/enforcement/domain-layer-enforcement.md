Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
Source of Truth: Complete architecture-enforcement catalog for cross-role
domain-layer topology, public boundary families, and domain-wide communication
boundaries in legacy and non-migrated `src/domain/**`.

# Domain Layer Enforcement

## Goal

Architectural truth for the domain layer lives only in the
[Domain Layer Standard](docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the layer-wide enforcement inventory, focused
verification surface, and current mechanical drift.

Migrated `src/features/**` packages are out of scope for this catalog. Their
architecture is review-owned under the
[Feature Runtime Architecture Standard](docs/project/architecture/patterns/feature-runtime.md:1)
until a later canonical owner names a specific gate.

It answers three questions for legacy and non-migrated `src/domain/**` as one
layer:

- which physical topology the layer currently blocks
- which broad structures the layer MUST NOT contain
- which external communication seams the layer currently proves or still only
  reviews

Technical diagnostic route:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-context-root-boundary-and-module-topology` | Enforced Elsewhere | every active domain context root under `src/domain/<context>/` | `domain-applicationservice-root-presence`; `domain-usecase-direct-file-placement`; `domain-layer-forbidden-top-level-domain-buckets` | `./gradlew checkDomainEnforcement` and `./gradlew checkDocumentationEnforcement` | Every active context exposes one or more direct root `*ApplicationService` files. Direct root buckets are limited to `published/`, `application/`, and `model/`, plus direct package-private service-composition root files. |
| `domain-layer-root-direct-file-role-allowlist` | Enforced | every direct Java file under `src/domain/<context>/` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | Direct root domain files are limited to `*ApplicationService.java`, `*ServiceContribution.java`, and package-private `*ServiceAssembly.java`, so root role checks cannot be bypassed by dropping foreign file shapes at context root. |
| `domain-layer-model-root-family-directories-only` | Enforced | every Java type or family directory below `src/domain/<context>/model/` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | The model root contains only lower-case family directories and no direct Java files. |
| `domain-layer-obsolete-model-role-marker` | Enforced | every Java type below obsolete `src/domain/<context>/model/<family>/model/**` role markers | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | Internal model files live under `model/<family>/` directly; the old nested `model/` role marker is blocked. |
| `domain-layer-model-role-package-name-allowlist` | Enforced | every non-model subordinate role package below a model family | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | Model-family non-model role packages are limited to `usecase`, `helper`, `constants`, `port`, and `repository`. |
| `domain-layer-model-role-direct-file-placement` | Enforced | every Java type below non-model role buckets in `src/domain/<context>/model/<family>/` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | Non-model role buckets stay direct-file only under `model/<family>/<role>/`. |
| `domain-layer-model-subtree-no-technical-buckets` | Enforced | every internal model Java type below `src/domain/<context>/model/<family>/` excluding direct `usecase/`, `helper/`, `constants/`, `port/`, and `repository/` role buckets | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | Direct family-root model files and semantic model subpackages stay semantic. Nested technical buckets such as `published`, `application`, `usecase`, `helper`, `constants`, `port`, `repository`, and rejected legacy role names are blocked inside the internal model subtree. |
| `domain-layer-source-identity-perimeter` | Enforced | every Java source under `src/domain/**` | domain-layer bundle Error Prone `DomainSourceTopologyPerimeter` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Domain package declarations match their source path and top-level type names match their source file names, so package-driven role checks cannot be bypassed by mismatched declarations. |
| `domain-layer-public-named-module-type-shape` | Enforced | every public type under a named domain module package in `src/domain/**` outside root `published/` and `application/` packages | domain-layer bundle Error Prone `DomainPublicConcreteTypeShape` | `./gradlew checkDomainEnforcement` | Public named-module domain types are records, enums, interfaces, final classes, or sealed abstractions, so public extension points are deliberate instead of accidental mutable class surfaces. |
| `domain-layer-public-named-module-field-purity` | Enforced | every public concrete type under a named domain module package in `src/domain/**` outside root `published/` and `application/` packages | domain-layer bundle Error Prone `DomainModuleFieldPurity` | `./gradlew checkDomainEnforcement` | Public concrete named-module domain types do not expose mutable instance fields or mutable public static fields; mutable state remains private/final instance state or immutable record state. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-forbidden-top-level-domain-buckets` | Enforced | every direct child bucket under `src/domain/<context>/` and every Java source below a forbidden root bucket | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | Domain context roots do not grow any bucket beside `published/`, `application/`, and `model/`. Named modules and legacy technical buckets at context root are illegal. |
| `domain-layer-reserved-role-suffix-perimeter` | Enforced | every domain type whose simple name ends with `ApplicationService`, `UseCase`, `Helper`, `Constants`, `Port`, or `Repository` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | Reserved target-role suffixes may appear only in their canonical buckets, so role-specific rules cannot be bypassed by moving or renaming files. |
| `domain-layer-legacy-role-suffix-rejection` | Enforced | every domain type whose simple name ends with a rejected legacy role or helper suffix | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkDomainEnforcement` | Legacy role/helper suffixes such as `*BoundaryTranslator`, `*Projector`, `*RuntimeAccess`, `*RuntimeAdapter`, `*Policy`, `*Service`, `*Factory`, `*Aggregate`, `*Entity`, and `*Specification` are forbidden. |
| `domain-layer-no-published-carrier-dependencies-inside-named-modules` | Enforced | every compilation unit under a named domain module | domain-layer bundle Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Named domain modules do not depend on same-context or foreign `published/**` carriers. Published language is translated at the boundary before control enters internal model work. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-public-boundary-families-only` | Enforced Elsewhere | every type or package under `src/domain/**` that acts as a layer-crossing public boundary or outbound seam | `domain-applicationservice-root-presence`; `domain-applicationservice-public-input-carriers`; `domain-applicationservice-command-no-direct-return`; `domain-applicationservice-public-boundary-signature-purity`; `domain-published-direct-file-placement`; `domain-published-carrier-shape`; `domain-published-read-model-handle-shape`; `domain-published-read-model-feedback-ownership`; `domain-repository-role-shape`; `domain-repository-foreign-applicationservice-routing-only`; `domain-port-role-shape`; `domain-port-ownership-and-signature-boundary` | `./gradlew compileJava`, `./gradlew checkDocumentationEnforcement`, and `./gradlew checkDomainEnforcement` | The layer blocks the root `*ApplicationService` family, `published/**`, inbound `Port`, and outbound `Repository` seams directly, and it rejects publisher-shaped or foreign-role bypasses outside those families. |
| `domain-layer-no-non-applicationservice-public-backend-boundary` | Enforced | every public direct root type under `src/domain/<context>/` | domain-layer bundle ArchUnit `publicBackendBoundariesBelowViewMustBeRootDomainApplicationServicesOrServiceContributions`; `domainServiceAssembliesMustOnlyDependOnAllowedAssemblyConcerns` | `./gradlew checkDomainEnforcement` | Direct public domain backend roots are limited to root `*ApplicationService` classes plus shell-discovered `*ServiceContribution` roots. Package-private `*ServiceAssembly` files are not callable backend boundaries, and service assemblies can depend only on same-context assembly/application/model/published roles and allowed foreign public domain seams. |
| `domain-layer-no-outer-layer-or-infrastructure-dependencies` | Enforced | every type under `src/domain/**` | domain-layer bundle ArchUnit `domainMustStayIndependentFromOuterLayers` and domain-layer bundle Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Domain code does not depend on `bootstrap/**`, `src/view/**`, `src/data/**`, JavaFX, SQL/JDBC, filesystem, network, JSON, transaction, persistence, or similar infrastructure surfaces. Direct service-composition roots may use only the narrow `shell.api.ServiceContribution` and `ServiceRegistry` seam. |
| `domain-layer-foreign-context-access-only-through-public-boundaries` | Enforced | every dependency from one domain context to another | domain-layer bundle ArchUnit `domainContextsMustOnlyUseForeignContextPublicBoundaries` | `./gradlew checkDomainEnforcement` | Cross-context access reaches foreign domain contexts only through foreign root `*ApplicationService` boundaries or foreign `published/**` carriers. |
| `domain-layer-foreign-context-explicit-dependencies` | Enforced | every dependency from one domain context to another | domain-layer bundle ArchUnit `domainContextsMustRespectMarkdownAllowedDependencies` | `./gradlew checkDomainEnforcement` | Cross-context dependencies must match the domain context map, mirroring Spring Modulith's explicit allowed-dependencies rule without importing Spring runtime into the application. |
| `domain-layer-context-dependency-graph-acyclic` | Enforced | every domain context dependency edge | domain-layer bundle ArchUnit `domainContextDependencyGraphMustBeAcyclic` | `./gradlew checkDomainEnforcement` | Domain context dependencies form an acyclic graph, mirroring Spring Modulith's module-cycle verification. |
| `domain-layer-internal-model-no-same-context-application-boundary-dependencies` | Enforced | every internal model type under `src/domain/<context>/model/<family>/`, excluding direct role buckets | domain-layer bundle ArchUnit `domainInternalModelMustNotReachSameContextApplicationBoundary` | `./gradlew checkDomainEnforcement` | Internal model code does not reach same-context root `ApplicationService` or root `application/**` boundary types directly. |
| `domain-layer-internal-model-no-port-or-repository-dependencies` | Enforced | every internal model type under `src/domain/<context>/model/<family>/`, excluding direct role buckets | domain-layer bundle ArchUnit `domainInternalModelMustNotDependOnPortsOrRepositories` | `./gradlew checkDomainEnforcement` | Internal model code does not depend directly on `Port` or `Repository` seams. |

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-core-business-ownership` | Review-Owned | all domain code across `src/domain/**` | none | none | The domain layer still owns business meaning, current work state, orchestration, published language, repositories, and ports rather than devolving into a technical pass-through zone. |
| `domain-layer-no-ui-translation-or-runtime-composition-ownership` | Review-Owned | all domain code across `src/domain/**` | none | none | A mechanically legal domain package still does not take ownership of UI translation, persistence mechanics, data-source records, source-adapter composition, or generic helper decomposition. Runtime service registration and same-context published-state assembly stay limited to direct context-root service-composition files. |
| `domain-layer-application-orchestration-only-outbound-calls` | Review-Owned | every outward collaboration initiated from `src/domain/**` | none | none | Outward communication leaves the domain core only from family `ApplicationService`, `UseCase`, or domain-owned `Repository` ownership rather than from arbitrary model internals. |
| `domain-layer-optional-role-package-necessity` | Review-Owned | every named domain module or model family that defines one or more optional subordinate role packages | none | none | Optional role packages are introduced only when they clarify real responsibility; the layer does not accumulate ceremonial splits. |
| `domain-layer-technical-vocabulary-rejection` | Review-Owned | all domain package and type naming across `src/domain/**` | none | none | A mechanically legal domain bucket or type name still uses domain language rather than broad technical convenience names. |

## References

- [Domain Layer Standard](docs/project/architecture/patterns/domain-layer.md:1)
- [Feature Runtime Architecture Standard](docs/project/architecture/patterns/feature-runtime.md:1)
- [Layering Architecture Standard](docs/project/architecture/patterns/layering-architecture.md:1)
- [Domain Context Enforcement](docs/project/architecture/enforcement/domain-context-enforcement.md:1)
- [Domain ApplicationService Enforcement](docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain UseCase Enforcement](docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Repository Enforcement](docs/project/architecture/enforcement/domain-repository-enforcement.md:1)
- [Domain Model Enforcement](docs/project/architecture/enforcement/domain-model-enforcement.md:1)
- [Domain Helper Enforcement](docs/project/architecture/enforcement/domain-helper-enforcement.md:1)
- [Domain Constants Enforcement](docs/project/architecture/enforcement/domain-constants-enforcement.md:1)
- [Spring Modulith Verification](references/architecture-patterns/sessionplanner-gate-model/spring-modulith-verification.md:1)
- [Spring Modulith Fundamentals](references/architecture-patterns/sessionplanner-gate-model/spring-modulith-fundamentals.md:1)
