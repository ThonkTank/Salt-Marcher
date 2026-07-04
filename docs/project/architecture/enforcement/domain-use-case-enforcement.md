Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for `UseCase` orchestration surfaces in `src/domain/**`.

# Domain UseCase Enforcement

## Goal

Architectural truth for `UseCase` lives only in the
[Domain Layer Standard](docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift.

It answers three questions for use-case orchestration:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

Technical diagnostic route:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-direct-file-placement` | Enforced | every Java type under root `src/domain/<context>/application/` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainEnforcement` | Root `application/` orchestration remains direct-file only and consists exclusively of `*UseCase.java` files. |
| `domain-root-usecase-cross-model-family-justification` | Enforced | every root `application/*UseCase.java` under `src/domain/**` | domain-usecase bundle Error Prone `DomainRootUseCaseCrossModelFamilyBoundary` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root use-case placement is reserved for orchestration that touches at least two distinct same-context `model/<family>/...` families. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-no-generic-bucket-names` | Enforced | every root `application/*UseCase.java` under `src/domain/**` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainEnforcement` | Root use-case filenames do not collapse into generic `Operations`, `Helper`, `Adapter`, `Repository`, `Mapper`, or `Policy` buckets. |
| `domain-usecase-no-backend-port-contract-files` | Enforced | every Java type under root `src/domain/<context>/application/` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainEnforcement` | Backend contract files such as `*Repository`, `*Lookup`, `*Catalog`, or `*Search` do not live in root `application/`. |
| `domain-usecase-no-same-context-published-dependencies` | Enforced | every top-level `application/**/*.java` compilation unit under `src/domain/<context>/application/` | domain-usecase bundle Error Prone `DomainApplicationNoSameContextPublishedDependency` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root internal orchestration files do not depend on their own same-context `published/**` carriers. Same-context command language stops at the root boundary, and feedback leaves through `published/*Model`. |
| `domain-usecase-no-root-usecase-chains` | Enforced | every root `application/*UseCase.java` under `src/domain/**` | domain-usecase bundle Error Prone `DomainRootUseCaseNoRootUseCaseChains` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root use cases do not depend on other root use cases or their nested types; one-family work stays in model-family `usecase/`, and the root `ApplicationService` routes to the correct root operation directly. |
| `domain-usecase-no-policy-helper-prefix-source-pattern` | Review-Owned | every non-public helper method in root `application/*UseCase.java` | none | none | Root use-case helper methods should not hide policy-heavy work behind prefixes such as `score`, `rank`, `choose`, `balance`, or `enforce`, but no active PMD, Error Prone, ArchUnit, jQAssistant, or build-harness rule currently blocks this exact source-pattern claim. |
| `domain-usecase-collaborator-surface-discipline` | Enforced | every `*UseCase.java` under `src/domain/**` | domain-usecase bundle Error Prone `DomainUseCaseRoleBoundary` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Use cases depend only on same-context `Model`, model-family `UseCase`, `Helper`, `Constants`, `Port`, `Repository`, and foreign root `ApplicationService` boundaries. |

### Communication Contract

No dedicated mechanically enforced communication invariant is owned by this
document alone today. Use-case orchestration is still constrained by the
generic domain-layer communication and outer-dependency boundaries owned by
[Domain Layer Enforcement](docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-thin-orchestration-semantics` | Review-Owned | every `*UseCase.java` under `src/domain/**` | none | none | A mechanically legal use case still reads as exactly one work operation and orchestration step rather than a second tactical model layer or service dump. |
| `domain-usecase-no-hidden-business-policy` | Review-Owned | every `*UseCase.java` under `src/domain/**` | none | none | Real business policy has not been pushed into legal orchestration code simply because the current blockers do not catch it. |
| `domain-usecase-no-hidden-carrier-bypass-into-model` | Review-Owned | every use-case handoff into same-context internal model work | none | none | No legal type shape is being used to smuggle same-context or foreign `published/**` carriers into private model code. |
| `domain-usecase-helper-role-discipline` | Review-Owned | every helper or model-local collaborator used by `*UseCase.java` | none | none | Helper-shaped collaborators stay on explicit work steps instead of becoming hidden policy or context-lookup seams. |

## References

- [Domain Layer Standard](docs/project/architecture/patterns/domain-layer.md:1)
- [Domain ApplicationService Enforcement](docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain Layer Enforcement](docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain Helper Enforcement](docs/project/architecture/enforcement/domain-helper-enforcement.md:1)
- [Spring Modulith Verification](references/architecture-patterns/sessionplanner-gate-model/spring-modulith-verification.md:1)
