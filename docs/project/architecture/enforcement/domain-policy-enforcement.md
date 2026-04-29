Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`policy/` role types in named domain modules.

# Domain Policy Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `policy/` role itself.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/policy/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Policy role types are final classes. |
| `domain-policy-public-concrete-type-shape` | Enforced | every public concrete policy type | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public policy types satisfy the project shape constraints for concrete domain types. |
| `domain-policy-field-purity` | Enforced | every public policy type | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public policy types do not expose mutable field state. |
| `domain-policy-statelessness` | Enforced | every top-level type under `policy/` | Error Prone `DomainServiceFactoryStatelessness` | `./gradlew compileJava` | Policy role types do not declare instance fields and stay stateless. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-no-published-carriers` | Enforced | every compilation unit under `policy/` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Policy code does not depend on same-context or foreign `published/**` carriers. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-no-same-context-application-boundary` | Enforced | every dependency from `policy/` to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Policy code does not depend on its own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-policy-no-foreign-context-dependencies` | Enforced | every dependency from `policy/` to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Policy code does not reach foreign domain contexts directly. |
| `domain-policy-no-outbound-port-dependencies` | Enforced | every dependency from `policy/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Policy code does not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-real-policy-behavior` | Review-Owned | every policy role used in a named domain module | none | none | A legal policy role still represents real reusable domain policy rather than a renamed procedural helper. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
