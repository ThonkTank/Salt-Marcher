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

This document does not own feature-root placement, layer-wide service-
registration placement, bootstrap discovery order, broad data-layer-to-domain
dependency policy, or repository/query/gateway/model/mapper/persistencecore
contracts. Those stay in
`data-layer-enforcement.md` and the neighboring bootstrap, layering, shell,
and data-role enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkDataEnforcement --rerun-tasks --console=plain`
  runs the currently active Data ServiceContribution-focused Error Prone and
  bundle-local documentation-coverage checks through one root task.
  Canonical compile-side blocking behavior remains at `./gradlew compileJava`;
  the focused bundle proof route adds the role-owned compile and coverage
  checks without pulling unrelated data-owner bundles.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-service-contribution-discovery-entrypoint-shape` | Review-Owned | every data-root `*ServiceContribution.java` under `src/data/**` | none | none | A data service contribution keeps the documented role-local discovery shape: `<Feature>ServiceContribution.java` naming, `public final` class shape, public no-arg constructor, `shell.api.ServiceContribution` contract, and `register(ServiceRegistry.Builder)` entrypoint. |
| `data-service-contribution-stateless-public-surface` | Review-Owned | every data-root `*ServiceContribution.java` under `src/data/**` | none | none | A data service contribution stays stateless and exposes no extra public or protected surface beyond its discovery constructor and `register(ServiceRegistry.Builder)`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-service-contribution-no-source-mechanics` | Review-Owned | every data-root `*ServiceContribution.java` under `src/data/**` | none | none | A data service contribution does not reference narrow concrete source APIs such as JDBC, file, HTTP-client, or filesystem packages. |
| `data-service-contribution-construction-purity` | Enforced | every data-root `*ServiceContribution.java` under `src/data/**` | data-service-contribution bundle Error Prone `DataServiceContributionConstructionPurity` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | A data service contribution performs constructor wiring and runtime registration only; direct repository/query/gateway/model/mapper/schema method calls and direct source-mechanics calls stay behind adapters. |
| `data-service-contribution-no-hidden-business-or-runtime-workflow` | Review-Owned | every data-root `*ServiceContribution.java` under `src/data/**` | none | none | A mechanically legal composition root still does not hide business rules, persistence orchestration, mapping logic, source-query behavior, or a second backend workflow surface inside registration lambdas or factory assembly code. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-service-contribution-shell-runtime-seam-subset` | Enforced | every direct shell dependency from a data-root `*ServiceContribution.java` under `src/data/**` | data-service-contribution bundle Error Prone `DataServiceContributionShellApiAllowlist` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | A data service contribution communicates directly only through the documented shell runtime seam subset for the role: `shell.api.ServiceContribution` and `shell.api.ServiceRegistry`. It does not depend on `ShellRuntimeContext`, other shell API families, or shell host internals. |
| `data-service-contribution-register-export-shape` | Enforced | every direct `shell.api.ServiceRegistry.Builder.register(...)` export from a data-root `*ServiceContribution.java` under `src/data/**` | data-service-contribution bundle Error Prone `DataServiceContributionRegisterExportShape` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | A data service contribution exports direct `register(...)` capabilities only as same-feature root domain `*ApplicationService` command services or same-feature `published/*Model` readback services. It does not export repositories, queries, gateways, mappers, model/schema types, or foreign-feature services through that direct registration path. |
| `data-service-contribution-factory-export-shape` | Enforced | every runtime capability exported through `shell.api.ServiceRegistry.Builder.registerFactory(...)` from a data-root `*ServiceContribution.java` under `src/data/**` | data-service-contribution bundle Error Prone `DataServiceContributionRegisterExportShape` | `./gradlew compileJava` and `./gradlew checkDataEnforcement` | A data service contribution keeps the same root-boundary export rule for `registerFactory(...)`: exported capability keys stay same-feature root `*ApplicationService` command services or same-feature `published/*Model` readback services and do not become repository, query, gateway, mapper, model/schema, or foreign-feature runtime surfaces. |
| `data-service-contribution-composition-collaborator-assembly-only` | Review-Owned | every same-feature collaborator that a data-root `*ServiceContribution.java` constructs or wires directly | none | none | A data service contribution may assemble same-feature concrete adapters, ports, and helper collaborators only as composition input for root application-service registration. It does not turn those collaborators into a second direct runtime boundary or a reusable public service surface of the role itself. |

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
