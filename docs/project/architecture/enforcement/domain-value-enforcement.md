Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`value/` role types in named domain modules.

# Domain Value Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `value/` role itself.

It answers three questions for every domain value role:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross

This document does not own generic named-module topology, public concrete type
shape rules that do not add a value-specific constraint, or domain-layer-wide
outer-layer independence. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-top-level-type-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/value/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Value role types are records, enums, sealed abstractions, or final classes. |
| `domain-value-field-purity` | Enforced | every public value type | Error Prone `DomainModuleFieldPurity` | `./gradlew compileJava` | Public value types do not expose mutable instance fields or mutable public static fields. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-no-non-private-or-non-final-instance-state` | Enforced | every final class-shaped value type under `value/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Final value classes do not declare non-private or non-final instance fields. Class-shaped values keep instance state private and final. |
| `domain-value-no-published-carriers` | Enforced | every compilation unit under `value/` | Error Prone `DomainModuleNoPublishedCarrierDependency` | `./gradlew compileJava` | Value code does not depend on same-context or foreign `published/**` carriers. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-no-same-context-application-boundary` | Enforced | every dependency from `value/` to its own context root or `application/` | ArchUnit `domainNamedModulesMustNotReachSameContextApplicationBoundary` | `./gradlew checkArchitecture` | Value code does not depend on its own root `ApplicationService` or `application/` orchestration boundary. |
| `domain-value-no-foreign-context-dependencies` | Enforced | every dependency from `value/` to a foreign domain context | ArchUnit `domainNamedModulesMustNotReachForeignDomainContexts` | `./gradlew checkArchitecture` | Value code does not reach foreign domain contexts directly. |
| `domain-value-no-outbound-port-dependencies` | Enforced | every dependency from `value/` to a `port/` role | ArchUnit `domainModelRolesMustNotDependOnOutboundPorts` | `./gradlew checkArchitecture` | Value code does not depend directly on outbound ports. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-value-semantic-immutability` | Review-Owned | every value role used in a named domain module | none | none | A structurally legal value type still represents immutable value semantics rather than a disguised entity, service helper, or mutable state owner. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
