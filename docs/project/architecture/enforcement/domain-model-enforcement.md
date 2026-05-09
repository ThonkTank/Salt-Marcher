Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for internal `Model` ownership in `src/domain/**`.

# Domain Model Enforcement

## Goal

Architectural truth for `Model` lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical coverage for the internal model
tree.

Unified focused bundle entrypoint:

- `./gradlew checkDomainModelEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-dynamic-state-ownership` | Review-Owned | every model family under `src/domain/**` | none | none | Models own the dynamic internal work state of the context. |
| `domain-model-tree-placement` | Enforced | every internal model subtree under `src/domain/<context>/model/<family>/model/` | domain-model bundle build-harness `DomainModelTopologyRules` | `./gradlew checkDomainModelEnforcement` | Internal model types live under the dedicated `model/<family>/model/` subtree rather than being scattered across helper or orchestration buckets. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-no-outer-layer-dependencies` | Enforced Elsewhere | every model family under `src/domain/**` | domain-layer bundle ArchUnit `domainMustStayIndependentFromOuterLayers` and domain-layer bundle Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDomainLayerEnforcement` | Internal model code does not depend on outer-layer types or concrete data adapters. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-published-derivation-ownership` | Review-Owned | every same-context published state path | none | none | Model change is the source that updates same-context `Published` state. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
