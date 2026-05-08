Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-05
Source of Truth: Role-local enforcement inventory and focused verification
surface for tactical `policy/` role types in named domain modules.

# Domain Policy Enforcement

## Goal

Architectural truth for the tactical `policy/` role lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift for that role.

It answers four questions for every domain policy role:

- when the role MAY exist and contain policy types at all
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role itself MAY cross

This document does not own generic named-module shape rules, generic
named-module forbidden-content rules, or generic named-module communication
boundaries that also constrain `policy/`. Those live in the Domain Layer
Standard and
[Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1).

Unified focused bundle entrypoint:

- `./gradlew checkDomainPolicyEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain Policy-focused Error Prone, PMD, and
  documentation-coverage checks through one root task. Canonical compile-side
  blocking behavior remains at `./gradlew compileJava`; the focused bundle
  proof route adds the role-owned source-pattern and documentation coverage
  checks without pulling the broader architecture aggregates.

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-real-policy-behavior` | Review-Owned | every policy role used in a named domain module | none | none | A named domain module may contain a `policy/` role only when it carries real reusable domain policy. The role must not be used as a renamed procedural helper or generic helper bucket. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-role-shape` | Enforced | every top-level type under `src/domain/<context>/<named-module>/policy/` | domain-policy bundle Error Prone `DomainPolicyRoleShape` | `./gradlew compileJava` and `./gradlew checkDomainPolicyEnforcement` | Policy role types are final classes. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-policy-statelessness` | Enforced | every top-level type under `policy/` | domain-policy bundle Error Prone `DomainPolicyStatelessness` | `./gradlew compileJava` and `./gradlew checkDomainPolicyEnforcement` | Policy role types do not declare instance fields and therefore cannot hide role-local state behind policy objects. |
| `domain-policy-no-trivial-relay-wrapper-source-pattern` | Source-Pattern Enforced | every top-level type under `policy/` | domain-policy bundle PMD `CeremonialIndirectionRule` configured for the `policy/` blocker surface | `./gradlew pmdDomainPolicyEnforcement` and `./gradlew checkDomainPolicyEnforcement` | A policy role does not collapse into one-step delegated relay or renamed helper ceremony, even when null guards or `requireNonNull(...)` calls are present. |

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
