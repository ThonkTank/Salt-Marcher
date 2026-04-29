Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`aggregate/` role types in named domain modules.

# Domain Aggregate Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `aggregate/` role itself.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-aggregate-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/aggregate/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Aggregate role types are classes or records, and class-shaped aggregate roots are final. |
| `domain-aggregate-public-concrete-type-shape` | Enforced | every public concrete aggregate type | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public aggregate types satisfy the project shape constraints for concrete domain types. |
| `domain-aggregate-field-purity` | Enforced | every public aggregate type | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public aggregate types do not expose mutable field state. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-aggregate-no-published-carriers` | Enforced | every compilation unit under `aggregate/` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Aggregate code does not depend on same-context or foreign `published/**` carriers. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-aggregate-no-same-context-application-boundary` | Enforced | every dependency from `aggregate/` to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Aggregate code does not depend on its own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-aggregate-no-foreign-context-dependencies` | Enforced | every dependency from `aggregate/` to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Aggregate code does not reach foreign domain contexts directly. |
| `domain-aggregate-no-outbound-port-dependencies` | Enforced | every dependency from `aggregate/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Aggregate code does not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-aggregate-rich-consistency-boundary` | Review-Owned | every aggregate role used in a named domain module | none | none | A legal aggregate role still represents a meaningful consistency boundary rather than ceremonial DDD labeling. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
