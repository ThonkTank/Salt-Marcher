Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for tactical
`specification/` role types in named domain modules.

# Domain Specification Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `specification/` role itself.

It answers four questions for every domain specification role:

- when the role MAY exist and contain specification types at all
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module topology, generic public-type
or forbidden-content rules, domain-layer-wide outer-layer independence, or
generic named-module and model-role communication boundaries that also
constrain `specification/`. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-specification-non-ceremonial-role-use` | Review-Owned | every specification role used in a named domain module | none | none | A named domain module may contain a `specification/` role only when it clarifies real domain behavior or contracts. The role must not be used for ceremonial tactical partitioning or as a generic helper bucket. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-specification-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/specification/` | Error Prone `DomainRoleShape` | `./gradlew compileJava` | Specification role types are interfaces or final classes, and every such type name ends with `Specification`. |

### Must Not Contain

No mechanically enforced forbidden-content invariant is owned by this document
alone today. Specification code is still constrained by the generic named-module
forbidden-content rules owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not mirror shared rules such as named-module
`published/**`-carrier bans, shared public-type constraints, or generic module
topology rows as role-local invariants.

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Specification code is still constrained by the generic named-module
and model-role communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate shared rows such as same-context
application-boundary bans, foreign-context bans, outbound-port bans, or
domain-layer outer-layer independence here.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
