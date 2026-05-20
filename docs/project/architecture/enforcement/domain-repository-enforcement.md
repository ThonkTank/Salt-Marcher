Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for domain-owned `Repository` collaboration in `src/domain/**`.

# Domain Repository Enforcement

## Goal

Architectural truth for `Repository` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical coverage for the target outbound
repository role and its specialized same-context `*PublishedStateRepository`
publication-sink subtype.

Technical diagnostic route:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-direct-file-placement` | Enforced | every Java type below `src/domain/<context>/model/<family>/repository/` | domain-repository bundle build-harness `DomainRepositoryTopologyRules` | `./gradlew checkDomainEnforcement` | Repository files stay as direct files under one model-family `repository/` bucket rather than being hidden in helper or adapter subpackages. |
| `domain-repository-role-shape` | Enforced | every domain type whose simple name ends with `Repository` and every Java type below `src/domain/<context>/model/<family>/repository/` | domain-repository bundle build-harness `DomainRepositoryTopologyRules` | `./gradlew checkDomainEnforcement` | Repository role files use the canonical `*Repository.java` form and may appear only in the canonical outbound bucket. |
| `domain-repository-outbound-trigger-ownership` | Review-Owned | every repository under `src/domain/**` | none | none | Normal repositories own outbound triggering of foreign domain work without collapsing into helpers, listeners, ports, or passive carriers. The specialized `*PublishedStateRepository` subtype owns same-context publication-sink intake only. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-no-src-data-type-leaks` | Review-Owned | every repository under `src/domain/**` | none | none | Repositories do not expose `src.data/**` types or foreign published carriers through same-context signatures or broader role concerns. Foreign published non-`*Model` carriers may be used internally when needed to call foreign root services. |
| `domain-repository-no-same-context-published-state-channel` | Enforced | every repository under `src/domain/**` | domain-repository bundle Error Prone `DomainRepositoryPublishedStateBoundary` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Generic repositories do not replace same-context `published/*Model` readback with `publish*` methods and are mechanically covered for exact/generic `Object` signature channels; ordinary `String`, `Optional`, `List`, `Set`, `Map`, or `.published.` data-access signatures are not blocked by this rule. The specialized `*PublishedStateRepository` suffix may expose only `void publish*` methods with at least one syntactically typed same-context internal payload from `model/<family>/model/**`, `model/<family>/usecase/**`, `model/<family>/repository/**`, or a repository-local nested publication record. For those `*PublishedStateRepository.publish*` methods, the strict syntactic payload proof rejects `Object`, raw `String`, Java collection/map/optional signatures, generic signatures containing those carriers, and `.published.` payloads. It does not prove that every accepted payload is the semantically correct publication record for the use case. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-repository-foreign-applicationservice-routing-only` | Enforced | every domain repository under `src/domain/**` | domain-repository bundle Error Prone `DomainRepositoryRoleBoundary` | `./gradlew checkDomainEnforcement` | Repositories do not reference forbidden domain roles, known outer-layer types, executable protocol types, or foreign published models. They may reference foreign root services and foreign published non-`*Model` command/result/value carriers needed for those outbound calls. This does not prove that each outbound call is semantically necessary or correctly named. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Spring Modulith Fundamentals](/home/aaron/Schreibtisch/projects/references/architecture-patterns/sessionplanner-gate-model/spring-modulith-fundamentals.md:1)
