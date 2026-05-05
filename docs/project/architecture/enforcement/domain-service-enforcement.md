Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-05
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

Unified focused bundle entrypoint:

- `./gradlew checkDomainServiceEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain Service-focused Error Prone, PMD, and
  documentation-coverage checks through one root task. Canonical compile-side
  blocking behavior remains at `./gradlew compileJava`; the focused bundle
  proof route adds the role-owned source-pattern and documentation coverage
  checks without pulling the broader architecture aggregates.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/service/` | domain-service bundle Error Prone `DomainServiceRoleShape` | `./gradlew compileJava` and `./gradlew checkDomainServiceEnforcement` | Service role types are final classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-statelessness` | Enforced | every top-level type under `service/` | domain-service bundle Error Prone `DomainServiceStatelessness` | `./gradlew compileJava` and `./gradlew checkDomainServiceEnforcement` | Service role types do not declare instance fields and stay stateless. |
| `domain-service-no-trivial-relay-wrapper-source-pattern` | Source-Pattern Enforced | every top-level type under `service/` | domain-service bundle PMD `CeremonialIndirectionRule` configured for the `service/` blocker surface | `./gradlew pmdDomainServiceEnforcement` and `./gradlew checkDomainServiceEnforcement` | A service role does not consist only of constructor wrappers or one-step delegated relay methods, even when null guards or `requireNonNull(...)` calls are present. |

### Communication Contract

No mechanically enforced communication invariant is owned by this document
alone today. Service code is still constrained by the generic named-module
communication boundaries owned by
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1);
this document does not duplicate those named-module or model-role rows here.

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-service-non-ceremonial-role-use` | Review-Owned | every service role used in a named domain module | none | none | Beyond the narrowly blocked trivial relay forms above, a legal domain service is used only when it clarifies real domain behavior rather than serving as ceremonial tactical partitioning or a renamed procedural coordinator. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
