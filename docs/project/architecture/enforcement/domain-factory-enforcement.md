Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-05
Source of Truth: Complete architecture-enforcement catalog for tactical
`factory/` role types in named domain modules.

# Domain Factory Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
tactical `factory/` role itself.

It answers three questions for every domain factory role:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module shape rules, generic
named-module forbidden-content rules, or generic named-module communication
boundaries that also constrain `factory/`. Those live in
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

Unified focused bundle entrypoint:

- `./gradlew checkDomainFactoryEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain Factory-focused Error Prone, PMD, and
  documentation-coverage checks through one root task. Canonical compile-side
  blocking behavior remains at `./gradlew compileJava`; the focused bundle
  proof route adds the role-owned source-pattern and documentation coverage
  checks without pulling the broader architecture aggregates.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-factory-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/factory/` | domain-factory bundle Error Prone `DomainFactoryRoleShape` | `./gradlew compileJava` and `./gradlew checkDomainFactoryEnforcement` | Factory role types are final classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-factory-statelessness` | Enforced | every top-level type under `factory/` | domain-factory bundle Error Prone `DomainFactoryStatelessness` | `./gradlew compileJava` and `./gradlew checkDomainFactoryEnforcement` | Factory role types do not declare instance fields and stay stateless. |
| `domain-factory-no-trivial-construction-wrapper-source-pattern` | Source-Pattern Enforced | every top-level type under `factory/` | domain-factory bundle PMD `DomainFactoryNoCeremonialIndirectionRule` | `./gradlew pmdDomainFactoryEnforcement` and `./gradlew checkDomainFactoryEnforcement` | A factory role does not survive only as one-step constructor or collaborator wrapper ceremony, even when null guards or `requireNonNull(...)` calls are present. |

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Factory code is still constrained by the generic named-module and
model-role communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those named-module or model-role rows here.

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-factory-real-construction-boundary` | Review-Owned | every factory role used in a named domain module | none | none | Beyond the narrowly blocked trivial wrapper forms above, a legal factory role still owns meaningful construction logic rather than serving as naming ceremony around direct constructors. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
