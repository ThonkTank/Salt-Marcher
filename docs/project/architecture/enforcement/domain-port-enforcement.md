Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for the current `port/` blocker family in `src/domain/**`.

# Domain Port Enforcement

## Goal

Architectural truth for the target `Port` role lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
That target role is an inbound domain-internal listener on foreign published
state.

Current mechanical drift:

- the active `checkDomainPortEnforcement` bundle still inventories and blocks
  the legacy outbound `port/` interface family
- until production migration replaces that legacy shape, this document records
  the live blocker surface literally instead of pretending the target port role
  is already enforced

Unified focused bundle entrypoint:

- `./gradlew checkDomainPortEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-repository-write-orientation` | Review-Owned | every legacy outbound port whose name ends with `Repository` | none | none | A legacy `*Repository` port should remain genuinely write-oriented while the repository/port migration is still in progress. |
| `domain-port-read-port-placement` | Review-Owned | every legacy outbound port whose name ends with `Lookup`, `Catalog`, or `Search` | none | none | Legacy `*Lookup`, `*Catalog`, and `*Search` types should remain read-oriented interface contracts only while they still live under the old outbound `port/` shape. |
| `domain-port-read-port-read-only-orientation` | Review-Owned | every legacy outbound port whose name ends with `Lookup`, `Catalog`, or `Search` | none | none | Legacy read-port suffixes should remain read-only and must not quietly become mutation seams or generic helper contracts. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/port/` | domain-port bundle Error Prone `DomainPortRoleShape` | `./gradlew compileJava` and `./gradlew checkDomainPortEnforcement` | The current blocker still expects legacy outbound `port/` contracts to be interfaces whose names end with `Repository`, `Lookup`, `Catalog`, or `Search`. |
| `domain-port-repository-placement` | Enforced | every type under `src/domain/**` whose simple name ends with `Repository` | domain-port bundle Error Prone `DomainPortBoundary` | `./gradlew compileJava` and `./gradlew checkDomainPortEnforcement` | The current blocker still expects domain `*Repository` contracts to live under a named module `port/` package as legacy outbound interfaces. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-no-implementations-inside-domain` | Enforced | every type under `src/domain/**` that implements a legacy outbound port | domain-port bundle Error Prone `DomainPortBoundary` | `./gradlew compileJava` and `./gradlew checkDomainPortEnforcement` | Legacy outbound port implementations do not live inside `src/domain/**`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-ownership-and-signature-boundary` | Enforced | every public or protected boundary surface on a legacy outbound domain port | domain-port bundle Error Prone `DomainPortBoundary` | `./gradlew compileJava` and `./gradlew checkDomainPortEnforcement` | The current blocker keeps legacy outbound port signatures free of outer-layer or infrastructure types while the target inbound-listener `Port` role is still migrating. |

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-domain-language` | Review-Owned | every target or legacy port name and method vocabulary | none | none | A legal port-related surface still speaks in domain language rather than storage, vendor, or source-local terminology. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-repository-enforcement.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
