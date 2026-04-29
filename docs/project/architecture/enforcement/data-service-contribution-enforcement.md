Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the `*ServiceContribution`
runtime-composition role at data feature roots under `src/data/**`.

# Data ServiceContribution Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
data-layer `*ServiceContribution` role itself.

It answers three questions for every data-root `*ServiceContribution.java`:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY own

This document does not own feature-root placement, bootstrap discovery order,
broad data-layer-to-domain dependency policy, or repository/query/gateway/
model/mapper/persistencecore contracts. Those stay in
`data-layer-enforcement.md` and the neighboring bootstrap, layering, shell,
and data-role enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-service-contribution-discovery-entrypoint-shape` | Enforced | every data-root `*ServiceContribution.java` under `src/data/**` | PMD `DataEntrypointRule` | `./gradlew checkArchitecture` | A data service contribution keeps the documented role-local discovery shape: `<Feature>ServiceContribution.java` naming, `public final` class shape, public no-arg constructor, `shell.api.ServiceContribution` contract, and `register(ServiceRegistry.Builder)` entrypoint. |
| `data-service-contribution-stateless-public-surface` | Enforced | every data-root `*ServiceContribution.java` under `src/data/**` | PMD `DataEntrypointRule` | `./gradlew checkArchitecture` | A data service contribution stays stateless and exposes no extra public or protected surface beyond its discovery constructor and `register(ServiceRegistry.Builder)`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-service-contribution-no-source-mechanics` | Source-Pattern Enforced | every data-root `*ServiceContribution.java` under `src/data/**` | PMD `SaltMarcherDataLayerRoleRule` | `./gradlew checkArchitecture` | A data service contribution does not reference narrow concrete source APIs such as JDBC, file, HTTP-client, or filesystem packages. |
| `data-service-contribution-construction-purity` | Enforced | every data-root `*ServiceContribution.java` under `src/data/**` | Error Prone `DataServiceContributionConstructionPurity` | `./gradlew compileJava` | A data service contribution performs constructor wiring and runtime registration only; direct repository/query/gateway/model/mapper/schema method calls and direct source-mechanics calls stay behind adapters. |
| `data-service-contribution-no-hidden-business-or-runtime-workflow` | Review-Owned | every data-root `*ServiceContribution.java` under `src/data/**` | none | none | A mechanically legal composition root still does not hide business rules, persistence orchestration, mapping logic, source-query behavior, or a second backend workflow surface inside registration lambdas or factory assembly code. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-service-registry-root-only` | Enforced | every direct runtime service registration from `src/data/**` into `shell.api.ServiceRegistry.Builder` | Error Prone `ServiceRegistryRegistrationPlacement`, build-harness `SourceLayoutRules`, and PMD `DataEntrypointRule` | `./gradlew compileJava` and `./gradlew checkArchitecture` | Direct runtime service registration belongs only in `src/data/<feature>/<Feature>ServiceContribution.java`; non-root data buckets do not register services or create alternate shell runtime seams. |
| `data-service-contribution-shell-runtime-seam-subset` | Enforced | every direct shell dependency from a data-root `*ServiceContribution.java` under `src/data/**` | Error Prone `FeatureShellApiAllowlist` | `./gradlew compileJava` | A data service contribution communicates directly only through the documented shell runtime seam subset for the role: `shell.api.ServiceContribution` and `shell.api.ServiceRegistry`. It does not depend on `ShellRuntimeContext`, other shell API families, or shell host internals. |
| `data-service-contribution-same-feature-root-export` | Review-Owned | every runtime capability exported from a data-root `*ServiceContribution.java` under `src/data/**` | none | none | A data service contribution exports only same-feature root `*ApplicationService` capabilities and does not publish repositories, queries, gateways, mappers, model/schema types, or foreign-feature services as runtime capabilities. Current compile-side checks constrain parts of this for `register(...)`, but the full export invariant remains review-owned while `registerFactory(...)` exports are not covered end-to-end. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
