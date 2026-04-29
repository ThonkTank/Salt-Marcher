Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`event/` role types in named domain modules.

# Domain Event Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `event/` role itself.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-event-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/event/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Event role types are records whose simple names end with `Event`. |
| `domain-event-public-concrete-type-shape` | Enforced | every public concrete event type | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public event types satisfy the project shape constraints for concrete domain types. |
| `domain-event-field-purity` | Enforced | every public event type | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public event types do not expose mutable field state. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-event-no-published-carriers` | Enforced | every compilation unit under `event/` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Event code does not depend on same-context or foreign `published/**` carriers. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-event-no-same-context-application-boundary` | Enforced | every dependency from `event/` to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Event code does not depend on its own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-event-no-foreign-context-dependencies` | Enforced | every dependency from `event/` to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Event code does not reach foreign domain contexts directly. |
| `domain-event-no-outbound-port-dependencies` | Enforced | every dependency from `event/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Event code does not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-event-domain-meaningfulness` | Review-Owned | every event role used in a named domain module | none | none | A legal event role still names a meaningful domain event rather than an internal processing step or technical callback. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
