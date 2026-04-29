Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`entity/` role types in named domain modules.

# Domain Entity Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `entity/` role itself.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-entity-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/entity/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Entity role types are records, sealed abstractions, or final classes. |
| `domain-entity-public-concrete-type-shape` | Enforced | every public concrete entity type | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public entity types satisfy the project shape constraints for concrete domain types. |
| `domain-entity-field-purity` | Enforced | every public entity type | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public entity types do not expose mutable field state. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-entity-no-published-carriers` | Enforced | every compilation unit under `entity/` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Entity code does not depend on same-context or foreign `published/**` carriers. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-entity-no-same-context-application-boundary` | Enforced | every dependency from `entity/` to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Entity code does not depend on its own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-entity-no-foreign-context-dependencies` | Enforced | every dependency from `entity/` to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Entity code does not reach foreign domain contexts directly. |
| `domain-entity-no-outbound-port-dependencies` | Enforced | every dependency from `entity/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Entity code does not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-entity-business-identity-and-lifecycle-semantics` | Review-Owned | every entity role used in a named domain module | none | none | A legal entity role still represents meaningful business identity and lifecycle behavior rather than decorative type partitioning. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
