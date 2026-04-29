Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`specification/` role types in named domain modules.

# Domain Specification Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `specification/` role itself.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-specification-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/specification/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Specification role types are interfaces or final classes whose names end with `Specification`. |
| `domain-specification-public-concrete-type-shape` | Enforced | every public concrete specification type | Error Prone `DomainPublicConcreteTypeShape` | `./gradlew compileJava` | Public specification types satisfy the project shape constraints for concrete domain types. |
| `domain-specification-field-purity` | Enforced | every public specification type | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public specification types do not expose mutable field state. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-specification-no-published-carriers` | Enforced | every compilation unit under `specification/` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Specification code does not depend on same-context or foreign `published/**` carriers. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-specification-no-same-context-application-boundary` | Enforced | every dependency from `specification/` to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Specification code does not depend on its own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-specification-no-foreign-context-dependencies` | Enforced | every dependency from `specification/` to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Specification code does not reach foreign domain contexts directly. |
| `domain-specification-no-outbound-port-dependencies` | Enforced | every dependency from `specification/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Specification code does not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-specification-real-domain-predicate-semantics` | Review-Owned | every specification role used in a named domain module | none | none | A legal specification role still expresses a meaningful domain predicate instead of merely wrapping a utility boolean helper. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
