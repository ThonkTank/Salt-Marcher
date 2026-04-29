Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`service/` role types in named domain modules.

# Domain Service Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `service/` role itself.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/service/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Service role types are final classes. |
| `domain-service-public-concrete-type-shape` | Enforced | every public concrete service type | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public service types satisfy the project shape constraints for concrete domain types. |
| `domain-service-field-purity` | Enforced | every public service type | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public service types do not expose mutable field state. |
| `domain-service-statelessness` | Enforced | every top-level type under `service/` | Error Prone `DomainServiceFactoryStatelessness` | `./gradlew compileJava` | Service role types do not declare instance fields and stay stateless. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-no-published-carriers` | Enforced | every compilation unit under `service/` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Service code does not depend on same-context or foreign `published/**` carriers. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-no-same-context-application-boundary` | Enforced | every dependency from `service/` to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Service code does not depend on its own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-service-no-foreign-context-dependencies` | Enforced | every dependency from `service/` to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Service code does not reach foreign domain contexts directly. |
| `domain-service-no-outbound-port-dependencies` | Enforced | every dependency from `service/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Service code does not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-real-cross-concept-behavior` | Review-Owned | every service role used in a named domain module | none | none | A legal domain service still represents real cross-concept business behavior rather than procedural coordination that belongs elsewhere. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
