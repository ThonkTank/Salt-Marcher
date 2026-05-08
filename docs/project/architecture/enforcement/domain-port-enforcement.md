Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Role-local enforcement inventory and focused verification
surface for outbound `port/` interfaces in named domain modules.

# Domain Port Enforcement

## Goal

Architectural truth for the outbound `port/` role lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift for that role.

It answers four questions for every domain outbound port:

- when the role MAY contain one outbound port family rather than another
- what the role MUST contain
- what the role MUST NOT contain
- which signature and abstraction boundaries the role itself MAY expose

This document does not own generic named-module topology, generic optional
role-package necessity, published-carrier bans, or generic named-module
communication rules such as same-context application-boundary dependencies and
foreign-context dependencies. Those live in the Domain Layer Standard, the
layer-wide domain enforcement catalog, and neighboring role docs.

This document also does not own positive data-layer adapter placement
semantics. It owns only the negative domain-side prohibition that outbound
port implementations must not live inside `src/domain/**`.

Unified focused bundle entrypoint:

- `./gradlew checkDomainPortEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain Port-focused Error Prone and
  documentation-coverage checks through one root task. Canonical compile-side
  blocking behavior remains at `./gradlew compileJava`; the focused bundle
  proof route adds the role-owned documentation coverage check without
  pulling the broader architecture aggregates.

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-repository-write-orientation` | Review-Owned | every outbound port whose name ends with `Repository` | none | none | A named domain module may contain a `*Repository` port only when that port is genuinely a write-oriented persistence boundary rather than a read-only query hidden behind a permitted suffix. |
| `domain-port-read-port-placement` | Review-Owned | every domain outbound port whose name ends with `Lookup`, `Catalog`, or `Search` | none | none | A named domain module may contain `*Lookup`, `*Catalog`, and `*Search` types only as outbound port interfaces under `src/domain/<context>/<named-module>/port/`; these suffixes do not justify a second domain package role or non-port contract family. |
| `domain-port-read-port-read-only-orientation` | Review-Owned | every outbound port whose name ends with `Lookup`, `Catalog`, or `Search` | none | none | A named domain module may contain a `*Lookup`, `*Catalog`, or `*Search` port only when that port stays read-only lookup, catalog, search, paging, or projection language rather than becoming a mutation seam, policy helper, or generic convenience contract. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/port/` | domain-port bundle Error Prone `DomainPortRoleShape` | `./gradlew compileJava` and `./gradlew checkDomainPortEnforcement` | Domain ports are interfaces whose names end with `Repository`, `Lookup`, `Catalog`, or `Search`. |
| `domain-port-repository-placement` | Enforced | every type under `src/domain/**` whose simple name ends with `Repository` | domain-port bundle Error Prone `DomainPortBoundary` | `./gradlew compileJava` and `./gradlew checkDomainPortEnforcement` | Domain `*Repository` types are outbound port interfaces under `src/domain/<context>/<named-module>/port/`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-no-implementations-inside-domain` | Enforced | every type under `src/domain/**` that implements a domain outbound port | domain-port bundle Error Prone `DomainPortBoundary` | `./gradlew compileJava` and `./gradlew checkDomainPortEnforcement` | Outbound port implementations do not live inside `src/domain/**`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-ownership-and-signature-boundary` | Enforced | every public or protected boundary surface on a domain outbound port | domain-port bundle Error Prone `DomainPortBoundary` | `./gradlew compileJava` and `./gradlew checkDomainPortEnforcement` | Outbound ports communicate only through domain-owned abstraction seams: they do not leak outer-layer or infrastructure types through `extends` clauses, public/protected fields, method signatures, thrown types, or type bounds. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-domain-language` | Review-Owned | every port name and method vocabulary under `port/` | none | none | A legal outbound port still speaks in domain language and domain-owned carrier or value vocabulary rather than storage, vendor, or source-local terminology. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
