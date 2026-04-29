Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`policy/` role types in named domain modules.

# Domain Policy Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `policy/` role itself.

It answers four questions for every domain policy role:

- when the role MAY exist and contain policy types at all
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module shape rules, generic
named-module forbidden-content rules, or generic named-module communication
boundaries that also constrain `policy/`. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-real-policy-behavior` | Review-Owned | every policy role used in a named domain module | none | none | A named domain module may contain a `policy/` role only when it carries real reusable domain policy. The role must not be used as a renamed procedural helper or generic helper bucket. |

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
this document does not duplicate shared rows such as same-context
application-boundary bans, foreign-context bans, outbound-port bans,
`published/**`-carrier bans, or domain-layer outer-layer independence here.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
