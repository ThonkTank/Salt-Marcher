Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the `query/` read-port adapter
role in data features under `src/data/**`.

# Data Query Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`query/` role itself.

It answers three questions for every concrete query adapter under
`src/data/**/query/`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY use

This document does not own feature-root topology, repository write semantics,
layer-wide shell/view/bootstrap isolation, foreign-feature data boundaries,
gateway-owned source-adapter boundaries, or source-model ownership. Those stay
in the neighboring data enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-query-role-contract` | Enforced | every public concrete adapter under `src/data/**/query/` | Error Prone `DataAdapterRoleContract` | `./gradlew compileJava` | Public concrete query adapters implement matching own-feature read-only domain ports whose names end in `Lookup`, `Catalog`, or `Search`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-query-no-source-mechanics` | Source-Pattern Enforced | every Java type under `src/data/**/query/` | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | Query adapters do not reference narrow concrete source APIs directly. |
| `data-query-no-public-non-adapter-boundary-types` | Enforced | every public type under `src/data/**/query/` that is not a public concrete adapter | Error Prone `DataAdapterRoleContract` | `./gradlew compileJava` | `query/` does not declare public contracts or carriers of its own; public boundary types there are concrete port adapters, while contracts and carriers stay in the owning domain port or published boundary. |
| `data-query-read-only-source-shape` | Enforced | every public/protected method declaration or own-feature gateway call under `src/data/**/query/` | PMD `SaltMarcherDataLayerRoleRule` and Error Prone `DataQueryGatewayMutationBoundary` | `./gradlew checkArchitecture` and `./gradlew compileJava` | Query adapters stay mechanically read-only: they do not expose mutation-shaped public/protected methods and do not call mutation-shaped operations on own-feature gateway types. |
| `data-query-read-only-role-semantics` | Review-Owned | every query adapter under `src/data/**/query/` | none | none | A mechanically legal query adapter still remains a read-only lookup, search, paging, or projection adapter rather than a write boundary, policy helper, or generic data convenience wrapper. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-query-public-port-surface-only` | Enforced | every public concrete query adapter under `src/data/**/query/` | Error Prone `DataAdapterRoleContract` | `./gradlew compileJava` | Public/protected query adapter methods, including inherited public/protected superclass methods, are limited to the matching own-feature read-only domain port contracts. |
| `data-query-public-signature-boundary` | Enforced | every public/protected query adapter API | Error Prone `DataAdapterPublicSignatureLeak` | `./gradlew compileJava` | Public/protected query adapter signatures, including inherited public/protected superclass methods, do not leak source-local `model/`, `gateway/`, or `persistencecore` types. |
| `data-query-gateway-collaborator-boundary` | Enforced | every query adapter dependency into its own feature gateway code | Error Prone `DataAdapterGatewayCollaboratorBoundary` | `./gradlew compileJava` | Query adapters depend on own-feature source-adapter facade types ending in `Gateway`, not internal source-mechanics collaborators under `gateway/`. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
