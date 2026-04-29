Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`service/` role types in named domain modules.

# Domain Service Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `service/` role itself.

It answers three questions for every domain service role:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module shape rules, generic
named-module forbidden-content rules, or generic named-module communication
boundaries that also constrain `service/`. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/service/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Service role types are final classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-statelessness` | Enforced | every top-level type under `service/` | Error Prone `DomainServiceFactoryStatelessness` | `./gradlew compileJava` | Service role types do not declare instance fields and stay stateless. |

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Service code is still constrained by the generic named-module
communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those named-module or model-role rows here.

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-non-ceremonial-role-use` | Review-Owned | every service role used in a named domain module | none | none | A legal domain service is used only when it clarifies real domain behavior rather than serving as ceremonial tactical partitioning or a renamed procedural coordinator. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
