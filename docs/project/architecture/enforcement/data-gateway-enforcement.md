Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-01
Source of Truth: Complete invariant catalog for the internal `gateway/`
source-adapter role in data features under `src/data/**`.

# Data Gateway Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`gateway/` role itself.

It answers three questions for every gateway surface under
`src/data/**/gateway/`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY expose

This document does not own feature-root topology, `gateway/local` or
`gateway/remote` placement, runtime service registration or export seams,
repository/query port contracts, source-model ownership, or broad layer-wide
dependency rules. Those stay in the neighboring data and layering enforcement
documents.

Unified focused bundle entrypoint:

- `./gradlew checkDataEnforcement --rerun-tasks --console=plain`
  runs the currently active Data Gateway-focused Error Prone, ArchUnit, and
  enforcement-documentation coverage checks through one root task. Canonical
  compile-side blocking behavior remains at `./gradlew compileJava`; the
  focused bundle proof route adds the role-owned ArchUnit and documentation
  coverage checks without pulling the broader architecture aggregates.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-gateway-source-adapter-mechanics-ownership` | Review-Owned | every gateway facade or helper under `src/data/**/gateway/local/**` or `src/data/**/gateway/remote/**` | none | none | `gateway/` code owns concrete source-facing mechanics such as connection or transport lifecycle, schema readiness, source queries or writes, and source-specific helper collaboration. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-gateway-no-generic-infrastructure-business-policy-or-runtime-composition` | Review-Owned | every gateway facade or helper under `src/data/**/gateway/local/**` or `src/data/**/gateway/remote/**` | none | none | `gateway/` code does not become generic shared infrastructure, business policy, or runtime composition code; those responsibilities stay in `persistencecore/`, the domain layer, or the data-root `*ServiceContribution`. |
| `data-gateway-domain-independence` | Enforced | every dependency from `src/data/**/gateway/**` into domain packages | data-gateway bundle ArchUnit `DataGatewayArchitectureTest` | `./gradlew checkArchitecture` and `./gradlew checkDataEnforcement` | Source adapters under `gateway/` do not depend on `src/domain/**` types. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-gateway-public-signature-boundary` | Enforced | every public/protected gateway type or member signature | data-gateway bundle Error Prone `DataGatewayReturnTypeBoundary` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | Public/protected gateway classes and members expose only same-feature source-model types or `java.lang`/`java.util` value and container types across `extends`/`implements`, type bounds, record components, public/protected fields, constructors, methods, and throws clauses. |
| `data-gateway-internal-data-collaborator-boundary` | Review-Owned | every direct gateway facade seam or gateway-local helper seam under `src/data/**/gateway/local/**` or `src/data/**/gateway/remote/**` | none | none | Gateway seams communicate only as same-feature internal data collaboration points for repository/query adapters or gateway-local helpers; they do not define domain port contracts, shell/runtime seams, or an independent public backend boundary. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)
- [Data Model Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-model-enforcement.md:1)
