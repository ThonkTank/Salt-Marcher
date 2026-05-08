Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Complete architecture-enforcement catalog for cross-role
domain-layer topology, public boundary families, and domain-wide communication
boundaries in `src/domain/**`.

# Domain Layer Enforcement

## Goal

Architectural truth for the domain layer lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the layer-wide enforcement inventory, focused
verification surface, and current mechanical drift.

It answers three questions for `src/domain/**` as one layer:

- which physical topology the layer currently blocks
- which broad structures the layer MUST NOT contain
- which external communication seams the layer currently proves or still only
  reviews

Unified focused bundle entrypoint:

- `./gradlew checkDomainLayerEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-context-root-boundary-and-module-topology` | Enforced Elsewhere | every active domain context root under `src/domain/<context>/` | `domain-applicationservice-root-presence`; `domain-usecase-direct-file-placement`; `domain-layer-forbidden-top-level-domain-buckets` | `./gradlew checkArchitecture`, `./gradlew checkDomainApplicationServiceEnforcement`, `./gradlew checkDocumentationEnforcement`, and `./gradlew checkDomainLayerEnforcement` | Every active context exposes one or more direct root `*ApplicationService` files. Direct root buckets are limited to `published/`, `application/`, and `model/`. |
| `domain-layer-root-direct-file-role-allowlist` | Enforced | every direct Java file under `src/domain/<context>/` | domain-layer bundle build-harness `DomainLayerTopologyRules` and domain-layer bundle Error Prone `DomainSourceTopologyPerimeter` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDomainLayerEnforcement` | Direct root domain files are limited to `*ApplicationService.java`, so root role checks cannot be bypassed by dropping foreign file shapes at context root. |
| `domain-layer-model-root-family-directories-only` | Enforced | every Java type or family directory below `src/domain/<context>/model/` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | The model root contains only lower-case family directories and no direct Java files. |
| `domain-layer-model-family-role-subpackage-required` | Enforced | every Java type below `src/domain/<context>/model/<family>/` outside `model/<family>/model/**` direct descendants | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Model families do not keep direct Java files at family root. Domain Java below those roots lives under one explicit role package. |
| `domain-layer-model-role-package-name-allowlist` | Enforced | every subordinate role package below a model family | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Model-family role packages are limited to `model`, `usecase`, `helper`, `constants`, `port`, and `repository`. |
| `domain-layer-model-role-direct-file-placement` | Enforced | every Java type below non-model role buckets in `src/domain/<context>/model/<family>/` | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Non-model role buckets stay direct-file only under `model/<family>/<role>/`. |
| `domain-layer-model-subtree-no-technical-buckets` | Enforced | every Java type below `src/domain/<context>/model/<family>/model/**` | domain-layer bundle build-harness `DomainLayerTopologyRules` and domain-layer bundle Error Prone `DomainSourceTopologyPerimeter` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDomainLayerEnforcement` | The internal model subtree stays semantic. Nested technical buckets such as `published`, `application`, `usecase`, `helper`, `constants`, `port`, `repository`, and rejected legacy role names are blocked there. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-forbidden-top-level-domain-buckets` | Enforced | every direct child bucket under `src/domain/<context>/` and every Java source below a forbidden root bucket | domain-layer bundle build-harness `DomainLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Domain context roots do not grow any bucket beside `published/`, `application/`, and `model/`. Named modules and legacy technical buckets at context root are illegal. |
| `domain-layer-reserved-role-suffix-perimeter` | Enforced | every domain type whose simple name ends with `ApplicationService`, `UseCase`, `Helper`, `Constants`, `Port`, or `Repository` | domain-layer bundle build-harness `DomainLayerTopologyRules` and domain-layer bundle Error Prone `DomainSourceTopologyPerimeter` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDomainLayerEnforcement` | Reserved target-role suffixes may appear only in their canonical buckets, so role-specific rules cannot be bypassed by moving or renaming files. |
| `domain-layer-legacy-role-suffix-rejection` | Enforced | every domain type whose simple name ends with a rejected legacy role or helper suffix | domain-layer bundle build-harness `DomainLayerTopologyRules` and domain-layer bundle Error Prone `DomainSourceTopologyPerimeter` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDomainLayerEnforcement` | Legacy role/helper suffixes such as `*BoundaryTranslator`, `*Projector`, `*RuntimeAccess`, `*RuntimeAdapter`, `*Policy`, `*Service`, `*Factory`, `*Aggregate`, `*Entity`, and `*Specification` are forbidden. |
| `domain-layer-no-published-carrier-dependencies-inside-named-modules` | Enforced | every compilation unit under a named domain module | domain-layer bundle Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` and `./gradlew checkDomainLayerEnforcement` | Named domain modules do not depend on same-context or foreign `published/**` carriers. Published language is translated at the boundary before control enters internal model work. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-public-boundary-families-only` | Enforced Elsewhere | every type or package under `src/domain/**` that acts as a layer-crossing public boundary or outbound seam | `domain-applicationservice-root-presence`; `domain-applicationservice-public-input-carriers`; `domain-applicationservice-command-no-direct-return`; `domain-published-direct-file-placement`; `domain-published-carrier-shape`; `domain-published-read-model-handle-shape`; `domain-port-role-shape`; `domain-port-ownership-and-signature-boundary` | `./gradlew compileJava`, `./gradlew checkArchitecture`, `./gradlew checkDomainApplicationServiceEnforcement`, `./gradlew checkDocumentationEnforcement`, and `./gradlew checkDomainPortEnforcement` | The layer blocks the root `*ApplicationService` family and `published/**` directly. The target repository/port split is still only partly enforced because the focused port bundle continues to inventory the legacy outbound `port/` interface surface. |
| `domain-layer-no-outer-layer-or-infrastructure-dependencies` | Enforced | every type under `src/domain/**` | domain-layer bundle ArchUnit `domainMustStayIndependentFromOuterLayers` and domain-layer bundle Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew checkArchitecture`, `./gradlew compileJava`, and `./gradlew checkDomainLayerEnforcement` | Domain code does not depend on `bootstrap/**`, `shell/**`, `src/view/**`, `src/data/**`, JavaFX, SQL/JDBC, filesystem, network, JSON, transaction, persistence, or similar infrastructure surfaces. |
| `domain-layer-foreign-context-access-only-through-public-boundaries` | Enforced | every dependency from one domain context to another | domain-layer bundle ArchUnit `domainFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Cross-context access reaches foreign domain contexts only through foreign root `*ApplicationService` boundaries or foreign `published/**` carriers. |
| `domain-layer-named-module-no-same-context-application-boundary-dependencies` | Enforced | every dependency from a still-existing legacy named domain module to its own context root or root `application/` | domain-layer bundle ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Legacy named domain modules do not depend on their own root `ApplicationService` or root `application/` orchestration boundary while those forbidden modules still exist in production. |
| `domain-layer-named-module-no-foreign-context-dependencies` | Enforced | every dependency from a still-existing legacy named domain module to a foreign domain context | domain-layer bundle ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Legacy named domain modules do not reach foreign domain contexts directly while those forbidden modules still exist in production. |
| `domain-layer-model-role-no-outbound-port-dependencies` | Enforced | every dependency from still-existing legacy subordinate model roles such as `aggregate/`, `entity/`, `value/`, `policy/`, `factory/`, `service/`, `event/`, or `specification/` to a legacy outbound `port/` interface | domain-layer bundle ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` and `./gradlew checkDomainLayerEnforcement` | Legacy subordinate model roles do not directly depend on legacy outbound `port/` interfaces while the repository/port migration is still in progress. |

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-layer-core-business-ownership` | Review-Owned | all domain code across `src/domain/**` | none | none | The domain layer still owns business meaning, current work state, orchestration, published language, repositories, and ports rather than devolving into a technical pass-through zone. |
| `domain-layer-no-ui-translation-or-runtime-composition-ownership` | Review-Owned | all domain code across `src/domain/**` | none | none | A mechanically legal domain package still does not take ownership of UI translation, shell registration, persistence mechanics, data-source records, or runtime composition. |
| `domain-layer-application-orchestration-only-outbound-calls` | Review-Owned | every outward collaboration initiated from `src/domain/**` | none | none | Outward communication leaves the domain core only from family `ApplicationService`, `UseCase`, or domain-owned `Repository` ownership rather than from arbitrary model internals. |
| `domain-layer-optional-role-package-necessity` | Review-Owned | every named domain module or model family that defines one or more optional subordinate role packages | none | none | Optional role packages are introduced only when they clarify real responsibility; the layer does not accumulate ceremonial splits. |
| `domain-layer-technical-vocabulary-rejection` | Review-Owned | all domain package and type naming across `src/domain/**` | none | none | A mechanically legal domain bucket or type name still uses domain language rather than broad technical convenience names. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Domain Context Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-context-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-repository-enforcement.md:1)
- [Domain Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-model-enforcement.md:1)
- [Domain Helper Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-helper-enforcement.md:1)
- [Domain Constants Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-constants-enforcement.md:1)
