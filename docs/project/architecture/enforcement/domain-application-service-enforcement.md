Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for root family `*ApplicationService` boundaries in `src/domain/**`.

# Domain ApplicationService Enforcement

## Goal

Architectural truth for `ApplicationService` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift.

It answers three questions for every root application boundary:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

Unified focused bundle entrypoint:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-root-presence` | Enforced | every active domain context under `src/domain/**` | domain-application-service bundle build-harness `DomainApplicationServiceTopologyRules` and `DomainApplicationServiceDocumentationRules` | `./gradlew checkDocumentationEnforcement` and `./gradlew checkDomainEnforcement` | Each active domain context contains one or more direct root boundary files whose names end with `ApplicationService.java`, and every `Application Service:` marker declared in `DOMAIN.md` resolves to a real direct root file. |
| `domain-applicationservice-class-shape` | Enforced | every top-level root `*ApplicationService` type under `src/domain/**` | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root application services are public final top-level classes. |
| `domain-applicationservice-public-input-carriers` | Enforced | every public or protected non-constructor root `ApplicationService` method | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root boundary methods accept exactly one same-context `published/*Command` carrier. Same-context query/load/open/readback surfaces are not legal root methods. |
| `domain-applicationservice-command-no-direct-return` | Enforced | every public or protected non-constructor root `ApplicationService` method whose parameter carrier ends with `Command` | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root command methods return `void`; same-context feedback does not travel back as a direct root return value. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-no-nested-contracts` | Enforced | every root `*ApplicationService.java` under `src/domain/**` | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root application services do not expose nested public or protected contract types. |
| `domain-applicationservice-role-reference-boundary` | Enforced | every root `*ApplicationService.java` under `src/domain/**` | domain-application-service bundle Error Prone `DomainApplicationServiceRoleBoundary` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root services reference only same-context root or model-local `*UseCase` types and same-context `published/*Command` carriers. A same-context `published/*Command` carrier is legal only as the single direct parameter of a public or protected root method, where that same method may null-check the parameter and read its accessors to translate the boundary command into UseCase arguments. A private static one-argument `to*` or `from*` boundary adapter MAY accept one direct same-context `published/*Command` carrier only to flatten that carrier into UseCase-owned input; the adapter return type, local variables, generic parameters, nested type uses, and body are still checked as root-boundary code. The carrier object itself is otherwise illegal as a field, constructor parameter, private/package method parameter, return type, local cache, class/interface generic argument, type-variable bound, supertype generic argument, class-literal/type-use, or argument passed deeper into UseCase/helper/factory work. Foreign root services, ports, repositories, models, helpers, callbacks, and outer-layer types are not legal root-service references. |
| `domain-applicationservice-thin-router-one-usecase-call` | Enforced | every public root `ApplicationService` command method | domain-application-service bundle Error Prone `DomainApplicationServiceThinRouter` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Each public root command method calls exactly one same-context `UseCase` method. Branching may choose command data, but it must not become a multi-operation use-case dispatcher. |
| `domain-applicationservice-no-model-mutation-translation` | Enforced | every root `*ApplicationService.java` under `src/domain/**` | domain-application-service bundle Error Prone `DomainApplicationServiceThinRouter` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root application services do not reference same-context model, repository, or `published/*Model` concerns directly and do not call model mutation owners such as `*Ops` or `*Logic` from the boundary. |
| `domain-applicationservice-no-direct-infrastructure-construction-source-pattern` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | Root application service source text does not directly instantiate or cache data-adapter or source-adapter infrastructure at the boundary. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-constructor-composition-boundary` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | Root ApplicationService code stays family-local and thin. It does not become a hidden runtime-composition seam, repository seam, helper seam, or alternate adapter assembly root. |
| `domain-applicationservice-public-boundary-signature-purity` | Enforced | every public or protected root `ApplicationService` boundary surface | domain-application-service bundle Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Root public boundary surfaces do not communicate outer-layer types, same-context private model internals, foreign domain internals, or foreign `published/**` carriers through public fields, methods, supertypes, or type bounds. Root constructor role references are owned by `DomainApplicationServiceRoleBoundary`, not by a second signature-checker allowlist. |
| `domain-applicationservice-public-carrier-translation-boundary` | Enforced Elsewhere | every handoff from a root `ApplicationService` into same-context top-level `application/**` code or named domain modules | domain-usecase bundle Error Prone `DomainApplicationNoSameContextPublishedDependency` and domain-layer bundle Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava`, `./gradlew checkDomainEnforcement`, and `./gradlew checkDomainEnforcement` | Same-context `published/**` carriers stop at the root boundary. Root services translate them before control enters internal application or model work. |

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-no-runtime-composition-ownership` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | A mechanically legal root boundary does not own shell registration, runtime service lookup, repositories, ports, callback protocols, or any alternate runtime-composition seam. |
| `domain-applicationservice-no-business-policy-ownership` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | Root boundaries behave as family-scoped intent interpretation and routing only; business policy stays below the root. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-repository-enforcement.md:1)
- [Spring Modulith Verification](/home/aaron/Schreibtisch/projects/references/architecture-patterns/sessionplanner-gate-model/spring-modulith-verification.md:1)
- [eShopOnContainers Command Handler Example](/home/aaron/Schreibtisch/projects/references/architecture-patterns/sessionplanner-gate-model/eshop-create-order-command-handler.md:1)
- [Modular Monolith Command Handler Example](/home/aaron/Schreibtisch/projects/references/architecture-patterns/sessionplanner-gate-model/modular-monolith-create-meeting-command-handler.md:1)
