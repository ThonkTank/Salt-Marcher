Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-01
Source of Truth: Complete invariant catalog for the `repository/` write-port
adapter role in data features under `src/data/**`.

# Data Repository Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`repository/` role itself.

It answers three questions for every concrete repository adapter under
`src/data/**/repository/`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY use

This document does not own feature-root topology, query-role read semantics,
gateway source-model shape, or source-model ownership. Those stay in the
neighboring data enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkDataEnforcement --rerun-tasks --console=plain`
  runs the currently active Data Repository-focused Error Prone, PMD, and
  documentation-coverage checks through one root task. Canonical compile-side
  and architecture-aggregate blocking behavior remains at
  `./gradlew compileJava` and `./gradlew checkArchitecture`; the focused
  bundle proof route keeps the repository-role checks colocated without
  pulling the broader architecture bundles.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-repository-role-contract` | Enforced | every public concrete adapter under `src/data/**/repository/` | data-repository bundle Error Prone `DataRepositoryRoleContract` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | Public concrete repository adapters implement a matching own-feature write-oriented domain port contract. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-repository-no-public-non-adapter-boundary-types` | Enforced | every public type under `src/data/**/repository/` that is not a public concrete adapter | data-repository bundle Error Prone `DataRepositoryRoleContract` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | `repository/` does not declare public contracts or carriers of its own; public boundary types there are concrete port adapters, while contracts and carriers stay in the owning domain port or published boundary. |
| `data-repository-no-source-mechanics` | Source-Pattern Enforced | every Java type under `src/data/**/repository/` | data-repository bundle PMD `DataRepositorySourceMechanicsRule` | `./gradlew checkArchitecture` and `./gradlew checkDataEnforcement` | Repository adapters do not reference narrow concrete source APIs directly. |
| `data-repository-write-model-role-semantics` | Review-Owned | every repository adapter under `src/data/**/repository/` | none | none | A mechanically legal repository adapter is genuinely a write-model persistence boundary rather than a read-only query, policy helper, or generic data convenience wrapper. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-repository-public-port-surface-only` | Enforced | every public concrete repository adapter under `src/data/**/repository/` | data-repository bundle Error Prone `DataRepositoryRoleContract` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | Public/protected repository adapter methods, including inherited public/protected superclass methods, are limited to the matching own-feature write-oriented domain port contracts. |
| `data-repository-public-signature-boundary` | Enforced | every public/protected repository adapter API | data-repository bundle Error Prone `DataRepositoryPublicSignatureBoundary` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | Public/protected repository adapter signatures, including inherited public/protected superclass methods, do not leak source-local `model/`, `gateway/`, or `persistencecore` types. |
| `data-repository-gateway-collaborator-boundary` | Enforced | every repository adapter dependency into its own feature gateway code | data-repository bundle Error Prone `DataRepositoryGatewayCollaboratorBoundary` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | Repository adapters depend on own-feature source-adapter facade types ending in `Gateway`, not internal source-mechanics collaborators under `gateway/`. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
