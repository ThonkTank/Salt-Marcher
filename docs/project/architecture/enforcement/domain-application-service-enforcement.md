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
carrier shape, outbound `port/` role semantics, or `DOMAIN.md` context
documentation. Those live in the neighboring owner docs.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-root-presence` | Enforced | every active domain context under `src/domain/**` | build-harness `DomainFeatureRules` and `SourceLayoutRules` | `./gradlew checkArchitecture` | Each active domain context exposes exactly one direct root boundary file named `<PascalContext>ApplicationService.java`. |
| `domain-applicationservice-class-shape` | Enforced | every direct root `*ApplicationService.java` under `src/domain/**` | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root application services are public final top-level classes. |
| `domain-applicationservice-public-api-carriers` | Enforced | every public root `ApplicationService` method | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Public root methods accept exactly one same-context published command or query carrier and return a same-context published result/value carrier. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-no-nested-contracts` | Enforced | every root `*ApplicationService.java` under `src/domain/**` | Error Prone `DomainApplicationServiceApiShape` | `./gradlew compileJava` | Root application services do not expose nested public or protected contract types. |
| `domain-applicationservice-no-direct-infrastructure-construction-source-pattern` | Source-Pattern Enforced | every root `*ApplicationService.java` under `src/domain/**` | PMD architecture `SaltMarcherSourcePolicyRule` | `./gradlew pmdArchitectureMain` and `./gradlew checkArchitecture` | Root application service source text does not directly construct or cache obvious infrastructure-style collaborators. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-constructor-composition-boundary` | Enforced | every public root `ApplicationService` constructor | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Root constructors expose only same-feature outbound ports or foreign root application services. |
| `domain-applicationservice-service-registry-export-shape` | Enforced | every data-root registration of a domain backend service | Error Prone `DomainServiceRegistryExportShape` | `./gradlew compileJava` | Data `*ServiceContribution` roots export only the same-feature root application service key instead of nested factories or internal domain types. |
| `domain-applicationservice-public-boundary-signature-purity` | Enforced | every public or protected root `ApplicationService` signature | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Public root signatures do not leak outer-layer, private domain, or foreign published types. |
| `domain-applicationservice-no-outer-layer-or-infrastructure-signatures` | Enforced | every root `*ApplicationService.java` under `src/domain/**` | Error Prone `DomainPublicBoundarySignaturePurity` and ArchUnit `domainMustStayIndependentFromOuterLayers` | `./gradlew compileJava` and `./gradlew checkArchitecture` | Root application services stay inside the application core instead of depending on view, data, shell, bootstrap, or infrastructure surfaces. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-applicationservice-thin-boundary-coordination` | Review-Owned | every root `*ApplicationService.java` under `src/domain/**` | none | none | A mechanically legal root boundary still stays thin coordination rather than hiding business policy or long-lived workflow state. |
| `domain-applicationservice-public-carrier-translation-quality` | Review-Owned | every root boundary translation between published carriers and model-facing collaborators | none | none | Public carrier translation really happens at the intended boundary and remains semantically minimal, not merely dependency-clean. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
