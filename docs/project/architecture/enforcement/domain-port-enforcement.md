Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for outbound
`port/` interfaces in named domain modules.

# Domain Port Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
outbound `port/` role itself.

It answers three questions for every domain outbound port:

- what the role MUST contain
- what the role MUST NOT contain
- which signature and abstraction boundaries the role itself MAY expose

This document does not own data-layer adapter implementation placement or
domain service/application orchestration semantics. Those live in the data and
neighboring domain owner docs.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-role-shape` | Enforced | every type under `src/domain/<context>/<named-module>/port/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Domain ports are interfaces whose names end with `Repository`, `Lookup`, `Catalog`, or `Search`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-no-implementations-inside-domain` | Enforced | every type under `src/domain/**` that implements a domain outbound port | Error Prone `DomainPortBoundary` | `./gradlew compileJava` | Outbound port implementations do not live inside `src/domain/**`. Implementations belong to outer adapters. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-ownership-and-signature-boundary` | Enforced | every public or protected signature on a domain outbound port | Error Prone `DomainPortBoundary` | `./gradlew compileJava` | Outbound ports remain abstract and infrastructure-free in their public signatures instead of leaking SQL, filesystem, network, transaction, persistence, or adapter lifecycle types. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-domain-language` | Review-Owned | every port name and method vocabulary under `port/` | none | none | A legal outbound port still speaks in domain language rather than storage or vendor vocabulary. |
| `domain-port-repository-write-orientation` | Review-Owned | every outbound port whose name ends with `Repository` | none | none | A legal `Repository` port is genuinely write-oriented rather than a read-only query hidden behind a permitted suffix. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
