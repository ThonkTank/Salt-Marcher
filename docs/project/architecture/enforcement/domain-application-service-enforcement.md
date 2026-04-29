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
documentation, data-root `ServiceRegistry` export shape, or layer-wide domain
dependency bans. Those live in the neighboring owner docs.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-root-presence` | Enforced | every active domain context under `src/domain/**` | build-harness `SourceLayoutRules` and `documentation-enforcement` bundle `DomainDocumentationRules` | `./gradlew checkArchitecture` and `./gradlew checkDocumentationEnforcement` | Each active domain context exposes exactly one direct root boundary file named `<PascalContext>ApplicationService.java`. |
| `domain-applicationservice-class-shape` | Enforced | every top-level root `*ApplicationService` type under `src/domain/**` | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root application services are public final top-level classes. |
| `domain-applicationservice-public-input-carriers` | Enforced | every public or protected non-constructor root `ApplicationService` method | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root boundary methods accept exactly one same-context `published/**` carrier whose simple name ends with `Command` or `Query`. |
| `domain-applicationservice-public-return-carriers` | Enforced | every public or protected non-constructor root `ApplicationService` method | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root boundary methods return one non-`void` same-context `published/**` carrier directly. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-no-nested-contracts` | Enforced | every root `*ApplicationService.java` under `src/domain/**` | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root application services do not expose nested public or protected contract types. |
| `domain-applicationservice-no-direct-infrastructure-construction-source-pattern` | Source-Pattern Enforced | every root `*ApplicationService.java` under `src/domain/**` | PMD architecture `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Root application service source text does not directly instantiate or cache data port-adapter or source-adapter infrastructure. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-constructor-composition-boundary` | Enforced | every public root `ApplicationService` constructor | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Root constructors expose only same-feature outbound ports or foreign root application services. |
| `domain-applicationservice-public-boundary-signature-purity` | Enforced | every public or protected root `ApplicationService` boundary surface | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Root public boundary surfaces do not leak outer-layer types, private same-context domain types, or foreign `published/**` carriers through signatures, public fields, thrown types, supertypes, or type bounds. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-public-carrier-translation-boundary` | Review-Owned | every handoff from a root `ApplicationService` into same-context `application/*UseCase` code or named domain modules | none | none | Same-context `published/**` carriers are translated at the root boundary before control enters application orchestration or named domain modules. |
| `domain-applicationservice-no-runtime-composition-ownership` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | A mechanically legal root boundary still does not own shell registration or runtime service lookup. |
| `domain-applicationservice-no-business-policy-ownership` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | A mechanically legal root boundary still delegates business policy to use cases and named domain modules rather than embedding rule-bearing domain logic at the root. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
