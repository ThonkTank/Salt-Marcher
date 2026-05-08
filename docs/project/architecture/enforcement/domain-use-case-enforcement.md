Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for `UseCase` orchestration surfaces in `src/domain/**`.

# Domain UseCase Enforcement

## Goal

Architectural truth for `UseCase` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift.

It answers three questions for use-case orchestration:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

Unified focused bundle entrypoint:

- `./gradlew checkDomainUseCaseEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-direct-file-placement` | Enforced | every Java type under root `src/domain/<context>/application/` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainUseCaseEnforcement` | Root `application/` orchestration remains direct-file only and consists exclusively of `*UseCase.java` files. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-no-generic-bucket-names` | Enforced | every root `application/*UseCase.java` under `src/domain/**` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainUseCaseEnforcement` | Root use-case filenames do not collapse into generic `Operations`, `Helper`, `Adapter`, `Repository`, `Mapper`, or `Policy` buckets. |
| `domain-usecase-no-backend-port-contract-files` | Enforced | every Java type under root `src/domain/<context>/application/` | domain-usecase bundle build-harness `DomainUseCaseTopologyRules` | `./gradlew checkDomainUseCaseEnforcement` | Backend contract files such as `*Repository`, `*Lookup`, `*Catalog`, or `*Search` do not live in root `application/`. |
| `domain-usecase-no-same-context-published-dependencies` | Enforced | every top-level `application/**/*.java` compilation unit under `src/domain/<context>/application/` | domain-usecase bundle Error Prone `DomainApplicationNoSameContextPublishedDependency` | `./gradlew compileJava` and `./gradlew checkDomainUseCaseEnforcement` | Root internal orchestration files do not depend on their own same-context `published/**` carriers. Same-context command language stops at the root boundary, and feedback leaves through `published/*Model`. |
| `domain-usecase-no-policy-helper-prefix-source-pattern` | Source-Pattern Enforced | every non-public helper method in root `application/*UseCase.java` | domain-usecase bundle PMD `DomainUseCasePolicyRule` | `./gradlew checkDomainUseCaseEnforcement` | Root use-case helper methods do not use the configured policy-heavy prefixes `score`, `rank`, `choose`, `balance`, or `enforce`. |

### Communication Contract

No dedicated mechanically enforced communication invariant is owned by this
document alone today. Use-case orchestration is still constrained by the
generic domain-layer communication and outer-dependency boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-usecase-thin-orchestration-semantics` | Review-Owned | every `*UseCase.java` under `src/domain/**` | none | none | A mechanically legal use case still reads as exactly one work operation and orchestration step rather than a second tactical model layer or service dump. |
| `domain-usecase-collaborator-surface-discipline` | Review-Owned | every `*UseCase.java` under `src/domain/**` | none | none | A legal use case still limits direct collaborators to same-context models, helpers, repositories, ports, constants, and allowed foreign root boundaries. |
| `domain-usecase-no-hidden-business-policy` | Review-Owned | every `*UseCase.java` under `src/domain/**` | none | none | Real business policy has not been pushed into legal orchestration code simply because the current blockers do not catch it. |
| `domain-usecase-no-hidden-carrier-bypass-into-model` | Review-Owned | every use-case handoff into same-context internal model work | none | none | No legal type shape is being used to smuggle same-context or foreign `published/**` carriers into private model code. |
| `domain-usecase-helper-role-discipline` | Review-Owned | every helper or model-local collaborator used by `*UseCase.java` | none | none | Business policy has not been smuggled into helper-shaped collaborators just because root `application/` itself is now hard-cut to `*UseCase.java` only. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain Helper Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-helper-enforcement.md:1)
