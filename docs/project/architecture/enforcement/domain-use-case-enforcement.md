Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Role-local enforcement inventory and focused verification
surface for direct `application/` orchestration surfaces and direct internal
boundary helpers in `src/domain/**`.

# Domain UseCase Enforcement

## Goal

Architectural truth for the `application/` role lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift for that role.

It answers three questions for every direct `application/` surface:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own root `ApplicationService` public-boundary shape,
`published/` carrier shape, outbound port role shape, generic domain-layer
forbidden-content rules, generic domain-layer communication boundaries, or
tactical model-role semantics. Those live in the Domain Layer Standard and
neighboring enforcement owners.

Unified focused bundle entrypoint:

- `./gradlew checkDomainUseCaseEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain UseCase-focused build-harness, Error Prone,
  PMD, and enforcement-documentation coverage checks through one root task.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-direct-file-placement` | Enforced | every Java type under `src/domain/<context>/application/` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainUseCaseEnforcement` | Domain application orchestration and narrow internal boundary helpers live only as direct `*UseCase.java`, `*BoundaryTranslator.java`, `*Projector.java`, `*RuntimeAccess.java`, or `*RuntimeAdapter.java` files under `application/`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-no-generic-bucket-names` | Enforced | every `application/*UseCase.java` under `src/domain/**` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainUseCaseEnforcement` | Use case filenames do not collapse into generic `Operations`, `Helper`, `Adapter`, `Repository`, `Mapper`, or `Policy` buckets. |
| `domain-usecase-no-backend-port-contract-files` | Enforced | every Java type under `src/domain/<context>/application/` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainUseCaseEnforcement` | Backend port contracts such as `*Repository`, `*Lookup`, `*Catalog`, or `*Search` do not live in `application/`. |
| `domain-usecase-no-same-context-published-dependencies` | Enforced | every top-level `application/**/*.java` compilation unit under `src/domain/<context>/application/` | domain-usecase bundle Error Prone `DomainApplicationNoSameContextPublishedDependency` | `./gradlew compileJava` and `./gradlew checkDomainUseCaseEnforcement` | Top-level internal application workflow files do not depend on their own same-context `published/**` carriers. Same-context command/query language stops at the root boundary, and same-context feedback leaves only through read-side `published/*Model` ownership. |
| `domain-usecase-no-policy-helper-prefix-source-pattern` | Source-Pattern Enforced | every non-public helper method in `application/*UseCase.java` | domain-usecase bundle PMD `DomainUseCasePolicyRule` | `./gradlew checkDomainUseCaseEnforcement` | Non-public helper methods do not use the configured policy-heavy prefixes `score`, `rank`, `choose`, `balance`, or `enforce`. |

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Use-case orchestration is still constrained by the generic
domain-layer communication and outer-dependency boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those shared rows here.

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-thin-orchestration-semantics` | Review-Owned | every `application/*UseCase.java` under `src/domain/**` | none | none | A mechanically legal use case still reads as one application orchestration step behind the root boundary rather than a second tactical model layer, facade root, or service dump. |
| `domain-usecase-collaborator-surface-discipline` | Review-Owned | every `application/*UseCase.java` under `src/domain/**` | none | none | A legal use case still limits direct collaborators to same-context named domain modules, same-context domain-owned outbound ports, and allowed foreign root `*ApplicationService` boundaries plus their foreign `published/**` carriers when cross-context orchestration is required. |
| `domain-usecase-no-hidden-business-policy` | Review-Owned | every `application/*UseCase.java` under `src/domain/**` | none | none | Real business policy has not been pushed into legal orchestration code simply because the current source-pattern blockers do not catch it. |
| `domain-usecase-no-hidden-carrier-bypass-into-model` | Review-Owned | every use case handoff from `application/*UseCase.java` into same-context named domain modules | none | none | No legal type shape is being used to pass same-context or foreign `published/**` carriers, view/data/shell types, or ad-hoc boundary DTOs through application orchestration into named domain modules. |
| `domain-usecase-helper-role-discipline` | Review-Owned | every non-`*UseCase.java` direct helper under `src/domain/<context>/application/` | none | none | Direct application-boundary helpers stay narrow and role-pure: internal translation, projection, or runtime adaptation only, without becoming same-context published-carrier owners, generic mapper dumps, second public boundaries, or hidden business-policy owners. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
