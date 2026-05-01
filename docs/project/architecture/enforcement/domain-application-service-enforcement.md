Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for root
`<PascalContext>ApplicationService` boundaries in `src/domain/**`.

# Domain ApplicationService Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the root
`<PascalContext>ApplicationService` role itself.

It answers three questions for every root application boundary:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own `application/*UseCase` internals, `published/`
carrier shape, outbound `port/` role semantics, `DOMAIN.md` context
documentation, data-root `ServiceRegistry` export shape, generic foreign-
context access policy, or layer-wide domain dependency bans. Those live in the
neighboring owner docs.

Unified focused bundle entrypoint:

- `./gradlew checkDomainApplicationServiceEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain ApplicationService-focused build-harness,
  Error Prone, PMD, and documentation-coverage checks through one root task.
  Canonical compile-side blocking behavior remains at `./gradlew compileJava`;
  the focused bundle proof route adds the role-owned topology, source-pattern,
  and documentation checks without pulling unrelated architecture bundles.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-root-presence` | Enforced | every active domain context under `src/domain/**` | domain-application-service bundle build-harness `DomainApplicationServiceTopologyRules` and `DomainApplicationServiceDocumentationRules` | `./gradlew checkArchitecture`, `./gradlew checkDocumentationEnforcement`, and `./gradlew checkDomainApplicationServiceEnforcement` | Each active domain context contains exactly one direct root boundary file named `<PascalContext>ApplicationService.java`. |
| `domain-applicationservice-class-shape` | Enforced | every top-level root `*ApplicationService` type under `src/domain/**` | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root application services are public final top-level classes. |
| `domain-applicationservice-public-input-carriers` | Enforced | every public or protected non-constructor root `ApplicationService` method | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root boundary methods accept exactly one same-context `published/**` carrier whose simple name ends with `Command` or `Query`. |
| `domain-applicationservice-public-return-carriers` | Enforced | every public or protected non-constructor root `ApplicationService` method | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root boundary methods return exactly one non-`void` same-context `published/**` carrier directly. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-no-nested-contracts` | Enforced | every root `*ApplicationService.java` under `src/domain/**` | domain-application-service bundle Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root application services do not expose nested public or protected contract types. |
| `domain-applicationservice-no-direct-infrastructure-construction-source-pattern` | Source-Pattern Enforced | every root `*ApplicationService.java` under `src/domain/**` | domain-application-service bundle PMD `DomainApplicationServiceSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkDomainApplicationServiceEnforcement` | Root application service source text does not directly instantiate or cache data-adapter or source-adapter infrastructure at the root boundary. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-constructor-composition-boundary` | Enforced | every public or protected root `ApplicationService` constructor | domain-application-service bundle Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root constructors communicate directly only with same-context outbound `port/` interfaces or foreign root `*ApplicationService` types. |
| `domain-applicationservice-public-boundary-signature-purity` | Enforced | every public or protected root `ApplicationService` boundary surface | domain-application-service bundle Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` and `./gradlew checkDomainApplicationServiceEnforcement` | Root public boundary surfaces do not communicate outer-layer types, same-context named-module types, same-context outbound ports on the callable surface, foreign domain internals, or foreign `published/**` carriers through signatures, public fields, thrown types, supertypes, or type bounds. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-public-carrier-translation-boundary` | Review-Owned | every handoff from a root `ApplicationService` into same-context `application/*UseCase` code or named domain modules | none | none | Same-context `published/**` carriers are translated at the root boundary before control enters same-context application orchestration or named domain modules. |
| `domain-applicationservice-no-runtime-composition-ownership` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | A mechanically legal root boundary still does not own shell registration, runtime service lookup, or any alternate runtime-composition seam. |
| `domain-applicationservice-no-business-policy-ownership` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | A mechanically legal root boundary still delegates business policy to same-context use cases and named domain modules rather than embedding rule-bearing domain logic at the root. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
