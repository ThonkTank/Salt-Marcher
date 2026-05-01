Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Complete architecture-enforcement catalog for tactical
`event/` role types in named domain modules.

# Domain Event Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `event/` role itself.

It answers four questions for every domain event role:

- when the role MAY exist and contain event carriers at all
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module topology, generic public-type
shape or field-purity rules, generic named-module forbidden-content rules, or
generic named-module and model-role communication boundaries that also
constrain `event/`. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

Unified focused bundle entrypoint:

- `./gradlew checkDomainEventEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain Event-focused Error Prone and
  documentation-coverage checks through one root task. Canonical compile-side
  blocking behavior remains at `./gradlew compileJava`; the focused bundle
  proof route adds the role-owned documentation coverage check without pulling
  the broader architecture aggregates.

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-event-domain-meaningfulness` | Review-Owned | every event role used in a named domain module | none | none | A named domain module may contain an `event/` role only when it expresses meaningful domain events. The role must not be used for internal processing steps, technical callbacks, or ceremonial tactical partitioning. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-event-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/event/` | domain-event bundle Error Prone `DomainEventRoleShape` | `./gradlew compileJava` and `./gradlew checkDomainEventEnforcement` | Event role types are records whose simple names end with `Event`. |

### Must Not Contain

No mechanically enforced forbidden-content invariant is owned by this document
alone today. Event code is still constrained by the generic named-module
forbidden-content rules owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not mirror those shared rows as role-local invariants.

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Event code is still constrained by the generic named-module and
model-role communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those shared rows here.

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
