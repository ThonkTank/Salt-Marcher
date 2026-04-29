Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for direct
`application/*UseCase.java` orchestration surfaces in `src/domain/**`.

# Domain UseCase Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`application/*UseCase` role itself.

It answers three questions for every use case surface:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own root `ApplicationService` public-boundary shape,
`published/` carrier shape, outbound port role shape, or tactical model-role
semantics. Those live in the neighboring owner docs.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-direct-file-placement` | Enforced | every Java type under `src/domain/<context>/application/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Domain application orchestration lives as direct `*UseCase.java` files under `application/`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-no-generic-bucket-names` | Enforced | every `application/*UseCase.java` under `src/domain/**` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Use case filenames do not collapse into generic `Operations`, `Helper`, `Adapter`, `Repository`, `Mapper`, or `Policy` buckets. |
| `domain-usecase-no-backend-port-contract-files` | Enforced | every Java type under `src/domain/<context>/application/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Backend port contracts such as `*Repository`, `*Lookup`, `*Catalog`, or `*Search` do not live in `application/`. |
| `domain-usecase-no-same-context-published-dependencies` | Enforced | every compilation unit under `src/domain/<context>/application/` | Error Prone `DomainApplicationNoSameContextPublishedDependency` | `./gradlew compileJava` | Use cases do not depend on their own same-context `published/**` carriers. Same-context carrier translation stays at the root `ApplicationService` boundary. |
| `domain-usecase-no-policy-helper-prefix-source-pattern` | Source-Pattern Enforced | every non-public helper method in `application/*UseCase.java` | PMD architecture `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Non-public helper methods do not use the configured policy-heavy prefixes `score`, `rank`, `choose`, `balance`, or `enforce`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-foreign-context-access-only-through-public-boundaries` | Enforced | every dependency from `application/*UseCase.java` into a foreign domain context | ArchUnit `domainFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` | Cross-context use-case orchestration reaches foreign domains only through foreign root `*ApplicationService` boundaries and foreign `published/**` public carriers. |
| `domain-usecase-no-outer-layer-or-infrastructure-dependencies` | Enforced | every `application/*UseCase.java` under `src/domain/**` | Error Prone `DomainForbiddenInfrastructureDependency` and ArchUnit `domainMustStayIndependentFromOuterLayers` | `./gradlew compileJava` and `./gradlew checkArchitecture` | Use cases do not depend on view, data, shell, bootstrap, or infrastructure packages while coordinating domain work. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-thin-orchestration-semantics` | Review-Owned | every `application/*UseCase.java` under `src/domain/**` | none | none | A mechanically legal use case still reads as one application orchestration step behind the root boundary rather than a second tactical model layer, facade root, or service dump. |
| `domain-usecase-collaborator-surface-discipline` | Review-Owned | every `application/*UseCase.java` under `src/domain/**` | none | none | A legal use case still limits direct collaborators to same-context named domain modules, same-context domain-owned outbound ports, and allowed foreign root `*ApplicationService` boundaries plus their foreign `published/**` carriers when cross-context orchestration is required. |
| `domain-usecase-no-hidden-business-policy` | Review-Owned | every `application/*UseCase.java` under `src/domain/**` | none | none | Real business policy has not been pushed into legal orchestration code simply because the current source-pattern blockers do not catch it. |
| `domain-usecase-no-hidden-carrier-bypass-into-model` | Review-Owned | every use case handoff from `application/*UseCase.java` into same-context named domain modules | none | none | No legal type shape is being used to pass same-context or foreign `published/**` carriers, view/data/shell types, or ad-hoc boundary DTOs through application orchestration into named domain modules. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
