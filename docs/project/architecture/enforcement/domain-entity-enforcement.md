Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Complete architecture-enforcement catalog for tactical
`entity/` role types in named domain modules.

# Domain Entity Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `entity/` role itself.

It answers four questions for every domain entity role:

- when the role MAY exist and contain entity types at all
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module topology, generic public type
shape constraints, generic named-module forbidden-content rules, or generic
named-module communication boundaries that also constrain `entity/`. Those
live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-entity-business-identity-and-lifecycle-semantics` | Review-Owned | every entity role used in a named domain module | none | none | A named domain module may contain an `entity/` role only when it expresses meaningful business identity and lifecycle behavior. The role must not be used for decorative tactical partitioning. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-entity-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/entity/` | domain-entity bundle Error Prone `DomainEntityRoleShape` | `./gradlew compileJava` and `./gradlew checkDomainEntityEnforcement` | Entity role types are records, sealed abstractions, or final classes. |

### Must Not Contain

No mechanically enforced forbidden-content invariant is owned by this document
alone today. Entity code is still constrained by the generic named-module
forbidden-content rules owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not mirror shared rules such as named-module
`published/**`-carrier bans, generic public-type field-mutation constraints,
or generic module-topology rows as entity-local invariants.

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Entity code is still constrained by the generic named-module and
model-role communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate shared rows such as same-context
application-boundary bans, foreign-context bans, outbound-port bans, or
domain-layer outer-layer independence here.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
