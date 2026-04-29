Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`policy/` role types in named domain modules.

# Domain Policy Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `policy/` role itself.

It answers three questions for every domain policy role:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module shape rules, generic
named-module forbidden-content rules, or generic named-module communication
boundaries that also constrain `policy/`. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/policy/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Policy role types are final classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-statelessness` | Enforced | every top-level type under `policy/` | Error Prone `DomainServiceFactoryStatelessness` | `./gradlew compileJava` | Policy role types do not declare instance fields and therefore cannot hide role-local state behind policy objects. |

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Policy code is still constrained by the generic named-module and
model-role communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those shared rows here.

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-real-policy-behavior` | Review-Owned | every policy role used in a named domain module | none | none | A legal policy role still represents real reusable domain policy rather than a renamed procedural helper. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
