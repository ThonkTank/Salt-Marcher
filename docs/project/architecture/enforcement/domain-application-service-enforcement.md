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

- `./gradlew checkDomainApplicationServiceEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-root-presence` | Enforced | every active domain context under `src/domain/**` | domain-application-service bundle build-harness `DomainApplicationServiceTopologyRules` and `DomainApplicationServiceDocumentationRules` | `./gradlew checkArchitecture`, `./gradlew checkDocumentationEnforcement`, and `./gradlew checkDomainApplicationServiceEnforcement` | Each active domain context contains one or more direct root boundary files whose names end with `ApplicationService.java`, and every `Application Service:` marker declared in `DOMAIN.md` resolves to a real direct root file. |
| `domain-applicationservice-class-shape` | Enforced | every top-level root `*ApplicationService` type under `src/domain/**` | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root application services are public final top-level classes. |
| `domain-applicationservice-public-input-carriers` | Enforced | every public or protected non-constructor root `ApplicationService` method | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root boundary methods accept exactly one same-context `published/*Command` carrier. Same-context query/load/open/readback surfaces are not legal root methods. |
| `domain-applicationservice-command-no-direct-return` | Enforced | every public or protected non-constructor root `ApplicationService` method whose parameter carrier ends with `Command` | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root command methods return `void`; same-context feedback does not travel back as a direct root return value. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-no-nested-contracts` | Enforced | every root `*ApplicationService.java` under `src/domain/**` | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root application services do not expose nested public or protected contract types. |
| `domain-applicationservice-no-direct-infrastructure-construction-source-pattern` | Source-Pattern Enforced | every root `*ApplicationService.java` under `src/domain/**` | domain-application-service bundle PMD `DomainApplicationServiceSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkDomainApplicationServiceEnforcement` | Root application service source text does not directly instantiate or cache data-adapter or source-adapter infrastructure at the boundary. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-constructor-composition-boundary` | Review-Owned | every public or protected root `ApplicationService` constructor | none | none | A legal root constructor still stays family-local and thin. It does not become a hidden runtime-composition seam, cross-context repository seam, or alternate adapter assembly root. |
| `domain-applicationservice-public-boundary-signature-purity` | Enforced | every public or protected root `ApplicationService` boundary surface | domain-application-service bundle Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root public boundary surfaces do not communicate outer-layer types, same-context private model internals, foreign domain internals, or foreign `published/**` carriers through signatures, public fields, thrown types, supertypes, or type bounds. |
| `domain-applicationservice-public-carrier-translation-boundary` | Enforced Elsewhere | every handoff from a root `ApplicationService` into same-context top-level `application/**` code or named domain modules | domain-usecase bundle Error Prone `DomainApplicationNoSameContextPublishedDependency` and domain-layer bundle Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava`, `./gradlew checkDomainUseCaseEnforcement`, and `./gradlew checkDomainLayerEnforcement` | Same-context `published/**` carriers stop at the root boundary. Root services translate them before control enters internal application or model work. |

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-no-runtime-composition-ownership` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | A mechanically legal root boundary still does not own shell registration, runtime service lookup, or any alternate runtime-composition seam. |
| `domain-applicationservice-no-business-policy-ownership` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | A mechanically legal root boundary still behaves as family-scoped intent interpretation and routing only; business policy stays below the root. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Domain Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-repository-enforcement.md:1)
