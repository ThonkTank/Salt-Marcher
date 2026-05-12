Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for inbound `Port` listener ownership in `src/domain/**`.

# Domain Port Enforcement

## Goal

Architectural truth for `Port` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical coverage for the target inbound
listener role.

Unified focused bundle entrypoint:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-direct-file-placement` | Enforced | every Java type below `src/domain/<context>/model/<family>/port/` | domain-port bundle build-harness `DomainPortTopologyRules` | `./gradlew checkDomainEnforcement` | Port files stay as direct files under one model-family `port/` bucket rather than growing helper subpackages or leaking back to context root. |
| `domain-port-role-shape` | Enforced | every domain type whose simple name ends with `Port` and every Java type below `src/domain/<context>/model/<family>/port/` | domain-port bundle build-harness `DomainPortTopologyRules` | `./gradlew checkDomainEnforcement` | Port role files use the canonical `*Port.java` form and may appear only in the canonical inbound-listener bucket. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-no-foreign-mutation-or-data-seam` | Review-Owned | every `*Port.java` under `src/domain/**` | none | none | A legal port does not become a hidden foreign-mutation trigger, data-source seam, or adapter host. Foreign writes belong to `Repository`; `Port` remains intake-only. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-ownership-and-signature-boundary` | Enforced | every `*Port.java` under `src/domain/**` | domain-port bundle Error Prone `DomainPortRoleBoundary` | `./gradlew checkDomainEnforcement` | Ports do not reference forbidden domain roles, known outer-layer types, or executable protocol types. This does not prove that the port vocabulary or follow-up workflow is semantically right. |
| `domain-port-published-listener-boundary` | Review-Owned | every `Port` collaboration surface | none | none | Ports listen only to foreign `published/**` state and turn those updates into same-context `UseCase` work. |

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-port-domain-language` | Review-Owned | every target or legacy port name and method vocabulary | none | none | A legal port-related surface still speaks in domain language rather than storage, vendor, or source-local terminology. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
- [Domain Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-repository-enforcement.md:1)
