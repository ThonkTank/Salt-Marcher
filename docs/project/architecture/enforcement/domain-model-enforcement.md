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

Technical diagnostic route:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-dynamic-state-ownership` | Enforced | every internal model type under `src/domain/<context>/model/<family>/`, excluding direct `usecase/`, `helper/`, `constants/`, `port/`, and `repository/` role buckets | domain-model bundle Error Prone `DomainModelRoleBoundary` | `./gradlew checkDomainEnforcement` | Model types reference only same-context internal model types, same-context `constants/**`, passive platform types, and their own nested types; class-shaped models are final and non-abstract. Executable protocol types are mechanically blocked on the model contract surface such as fields, method or constructor signatures, throws, and type bounds. After that contract surface is scanned, method-body executable protocol references are not treated as model collaborators by this gate; this allows local implementation mechanics such as collection lambdas, streams, or local callbacks. The gate does not prove that every method-body callback is non-escaping; reviewer judgment owns that semantic check. This does not prove the semantic adequacy of the state they own. |
| `domain-model-tree-placement` | Enforced | every direct family-root model file or semantic internal model subpackage under `src/domain/<context>/model/<family>/`, excluding allowed role buckets | domain-model bundle build-harness `DomainModelTopologyRules` | `./gradlew checkDomainEnforcement` | Internal model types live in the family root or semantic family subpackages rather than being scattered across helper or orchestration buckets. |
| `domain-model-state-semantic-adequacy` | Review-Owned | every internal model type under `src/domain/<context>/model/<family>/`, excluding direct role buckets | none | none | A mechanically legal model still owns meaningful current work state instead of becoming a passive bag, hidden helper, or misplaced policy surface. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-no-outer-layer-dependencies` | Enforced Elsewhere | every model family under `src/domain/**` | domain-layer bundle ArchUnit `domainMustStayIndependentFromOuterLayers` and domain-layer bundle Error Prone `DomainForbiddenInfrastructureDependency` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Internal model code does not depend on outer-layer types or concrete data adapters. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-model-published-derivation-ownership` | Review-Owned | every same-context published state path | none | none | Same-context feedback does not bypass Published ownership through publisher-shaped roots, direct published returns, or same-context published leaks into internal orchestration. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
