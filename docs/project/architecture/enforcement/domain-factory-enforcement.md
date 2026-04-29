Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`factory/` role types in named domain modules.

# Domain Factory Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `factory/` role itself.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-factory-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/factory/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Factory role types are final classes. |
| `domain-factory-public-concrete-type-shape` | Enforced | every public concrete factory type | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public factory types satisfy the project shape constraints for concrete domain types. |
| `domain-factory-field-purity` | Enforced | every public factory type | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public factory types do not expose mutable field state. |
| `domain-factory-statelessness` | Enforced | every top-level type under `factory/` | Error Prone `DomainServiceFactoryStatelessness` | `./gradlew compileJava` | Factory role types do not declare instance fields and stay stateless. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-factory-no-published-carriers` | Enforced | every compilation unit under `factory/` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Factory code does not depend on same-context or foreign `published/**` carriers. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-factory-no-same-context-application-boundary` | Enforced | every dependency from `factory/` to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Factory code does not depend on its own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-factory-no-foreign-context-dependencies` | Enforced | every dependency from `factory/` to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Factory code does not reach foreign domain contexts directly. |
| `domain-factory-no-outbound-port-dependencies` | Enforced | every dependency from `factory/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Factory code does not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-factory-real-construction-boundary` | Review-Owned | every factory role used in a named domain module | none | none | A legal factory role still owns meaningful construction logic rather than serving as naming ceremony around direct constructors. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
