Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-09
Source of Truth: Complete architecture-enforcement catalog for repository-wide
layer topology, intentional cross-layer public boundaries, and the allowed
inter-layer communication contract.

# Layering Architecture Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
project-wide layering topology rather than one specific layer or role.

It answers three questions for SaltMarcher as one layered system:

- what the project-wide layering topology MUST contain
- what that topology MUST NOT contain
- which communication seams MAY and MUST NOT cross layer boundaries

Layer-local or role-local contracts stay in the neighboring bootstrap, shell,
view, domain, and data enforcement documents. Internal `src/view/**` role
truth stays only in the
[View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
and the neighboring `view-*.md` enforcement documents. This file catalogs
only the global layer model and names where mechanical coverage currently lives.

Technical diagnostic route:

- `./gradlew checkLayeringEnforcement --console=plain` runs the
  currently active layering-topology, passive-carrier mirror, and bundle-local
  documentation-coverage checks. `checkLayeringEnforcement`, `check`, and `build`
  include the same mechanical surface transitively, and the neighboring `Enforced
  Elsewhere` rows below stay in their owner-specific bundles.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-repository-active-java-root-allowlist` | Enforced | every active Java source root in the repository | `layering-architecture-enforcement` bundle build-harness `LayeringArchitectureTopologyRules` | `./gradlew checkLayeringEnforcement` | Active Java sources live only under `bootstrap/`, `shell/`, `src/`, `test/`, `tools/`, or legacy `salt-marcher/`. |
| `layering-repository-src-direct-child-allowlist` | Enforced | every non-empty direct child bucket under `src/` | `layering-architecture-enforcement` bundle build-harness `LayeringArchitectureTopologyRules` | `./gradlew checkLayeringEnforcement` | `src/` contains only `view/`, `domain/`, and `data/` as active direct layer roots. |
| `layering-repository-included-build-taxonomy` | Enforced | every included Gradle build in the repository | `layering-architecture-enforcement` bundle build-harness `LayeringArchitectureTopologyRules` | `./gradlew checkLayeringEnforcement` | Included builds stay under `tools/gradle/` or `tools/quality/` rather than creating hidden architecture roots elsewhere. |
| `layering-intentional-cross-layer-public-boundary-set` | Enforced Elsewhere | every type that acts as a public layer-crossing boundary or registration root | shell `shell-api-public-surface-allowlist`; view `view-layer-contribution-count`, `view-layer-binder-count`, `view-contribution-discovery-entrypoint-shape`, and `view-binder-dependency-boundary`; domain `domain-applicationservice-root-presence`, `domain-published-direct-file-placement`, `domain-port-role-shape`, and `domain-port-ownership-and-signature-boundary`; data `data-root-service-contribution-only` and `data-service-contribution-discovery-entrypoint-shape` | see neighboring owner docs and their listed entrypoints | The global layer model contains only the documented public cross-layer boundary families: `shell/api/**`, shell runtime composition surfaces, view `*Contribution` roots, view `*Binder` roots, root domain `*ApplicationService` boundaries, root domain `published/**` carriers, the current domain repository or legacy port seam documented by the domain owner, domain root `*ServiceAssembly`/`*ServiceContribution` registration seams into `shell/api/ServiceRegistry` or `shell/api/ServiceContribution`, and data `*ServiceContribution` registration roots. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-no-extra-active-layer-roots` | Enforced | every active Java source root or non-empty `src/` direct child | `layering-architecture-enforcement` bundle build-harness `LayeringArchitectureTopologyRules` | `./gradlew checkLayeringEnforcement` | The repository does not grow extra active layer roots or extra `src/` children beside the documented layer topology. |
| `layering-no-undocumented-cross-layer-public-extension-points` | Review-Owned | every new public type or registration seam that would let one layer reach another | none | none | The system does not grow new public backend, shell, or registration extension points outside the documented cross-layer boundary set. Existing shell, view, domain, and data blockers constrain parts of that surface, but not the full repository-wide extension-point claim as one hard gate. |
| `layering-no-passive-carrier-shape-mirror-inside-feature-root` | Enforced | every passive `record` or `enum` carrier under one active `src/` feature root, excluding top-level root boundary `*Command` records whose semantics are owned by their `*ApplicationService` entrypoint and excluding records/enums with authored methods, constructors, fields, invariants, or domain behavior | `layering-architecture-enforcement` bundle build-harness `LayeringPassiveCarrierMirrorRules` | `./gradlew checkLayeringEnforcement` | One active feature root does not keep multiple passive non-command `record`/`enum` carriers with the same recursive shape under different names or buckets. Internal behavior-owning domain values are not rejected merely because their field shape resembles a published carrier; if they are actively owning behavior or invariants, review their responsibility rather than treating them as passive mirror payloads. Workflow-specific command carriers may share a passive payload shape when the workflow is explicit in the application-service method rather than encoded inside the carrier. |
| `layering-no-direct-view-data-dependency` | Enforced Elsewhere | every dependency from `src/view/**` into `src/data/**` | Error Prone `PassiveViewInteractionBoundary`, `ViewContributionModelDependencyBoundary`, `ViewContentModelDependencyBoundary`, `ViewIntentHandlerDependencyBoundary`, and `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | View-layer code does not bypass the domain core by depending directly on data-layer implementation code. |
| `layering-no-direct-view-domain-connection-outside-documented-seams` | Enforced Elsewhere | every direct connection between `src/view/**` and `src/domain/**` | view `view-binder-dependency-boundary`, `view-binder-domain-public-boundary-surface`, `view-binder-no-legacy-intenthandler-write-sink-injection`, `view-intenthandler-root-applicationservice-boundary-surface`, `view-intenthandler-no-non-applicationservice-domain-dependencies`, `view-viewinputevent-view-origin-and-intenthandler-target-only`, `view-contributionmodel-read-side-only-direct-boundary`, and `view-contentmodel-read-side-only-direct-boundary` | see neighboring owner docs and their listed entrypoints | The allowed view/domain seam is owned only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1) and the neighboring view-role enforcement documents. This row records the current blocker surface for that contract. |
| `layering-no-non-applicationservice-public-backend-boundary-below-view` | Enforced Elsewhere | every domain-originated public callable backend root under `src/domain/<context>/`; excludes data-originated source-adapter implementation types and data runtime-registration roots | domain `domain-layer-no-non-applicationservice-public-backend-boundary` | `./gradlew checkDomainEnforcement` | Below the view layer, domain-originated public backend roots are root `*ApplicationService` classes only. Domain `*ServiceContribution`/`*ServiceAssembly` are registration exceptions, and this row does not claim that every public `src/data/**` adapter type is itself blocked as a backend boundary. Data-originated public backend and runtime-export adequacy remains owned by data-layer review rows unless a data owner names a concrete blocker. |
| `layering-no-outer-format-object-leak-inward` | Review-Owned | every boundary translation from shell, view, data, or source-facing code into inner layers | none | none | JavaFX scene-graph types, shell host classes, SQL rows, gateway records, and similar outer-format carriers do not leak inward across layer boundaries. Existing source-dependency blockers constrain direct outer-type imports into the domain core, but semantic translation adequacy remains review-owned. |
| `layering-no-domain-service-pass-through-wrapper` | Review-Owned | every legacy domain `service/**` tactical owner under `src/domain/**` | none | none | Domain `service/**` tactical owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains. The jQAssistant thin-role relay blocker covers current thin orchestration-role stacks; substantive service-wrapper adequacy remains review-owned. |
| `layering-no-domain-policy-pass-through-wrapper` | Review-Owned | every legacy domain `policy/**` tactical owner under `src/domain/**` | none | none | Domain `policy/**` tactical owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains. |
| `layering-no-domain-factory-pass-through-wrapper` | Review-Owned | every legacy domain `factory/**` tactical owner under `src/domain/**` | none | none | Domain `factory/**` tactical owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains. |
| `layering-no-domain-port-pass-through-wrapper` | Review-Owned | every domain `port/**` listener owner under `src/domain/**` whose concrete methods collapse into one foreign owner | none | none | Domain `port/**` listener owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains. |
| `layering-no-domain-repository-pass-through-wrapper` | Review-Owned | every domain `*Repository` owner under `src/domain/**`, including current repository owners that still live under `port/**` | none | none | Domain repository owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains, even while topology migration still leaves some of them under `port/**`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-source-code-dependencies-point-inward` | Enforced Elsewhere | every source-code dependency that crosses a layer boundary | bootstrap-layer bundle ArchUnit `bootstrapMustStayOutsideFeatureCode`, `shellApiMustStayIndependentFromHostAndFeatureLayers`, `domainMustStayIndependentFromOuterLayers`, and `dataMustNotReachBootstrapOrPresentation`; neighboring view-role dependency-boundary rules | `./gradlew compileJava`, `./gradlew checkBootstrapEnforcement`, and `./gradlew checkViewEnforcement` | Cross-layer source-code dependencies point inward toward the application core and shell public contracts rather than outward into concrete outer-layer implementation details. |
| `layering-runtime-controlflow-reversal-only-through-documented-seams` | Review-Owned | every case where runtime control flow returns from an inner layer to an outer one | none | none | Reverse control flow uses only documented public carriers, shell contracts, or inner-owned interfaces rather than hidden outer-owned callback protocols. Current domain and view blockers reject several executable callback and outward-sink shapes, but end-to-end runtime inversion adequacy remains review-owned. |
| `layering-bootstrap-registration-order-and-generic-discovery-path` | Review-Owned | every feature registration path from startup into runtime layer composition | none | none | Cross-layer startup composition follows the documented path: bootstrap discovers data `*ServiceContribution` roots, populates the shared `ServiceRegistry`, constructs the shell, and then discovers view `*Contribution` roots without feature-specific bootstrap registries. Current blockers constrain pieces of that path, but not the whole sequencing and genericity claim as one hard gate. |
| `layering-view-domain-write-and-readback-seams-only` | Enforced Elsewhere | every cross-layer write or readback path between the view and domain layers | view `view-binder-no-legacy-intenthandler-write-sink-injection`, `view-intenthandler-root-applicationservice-boundary-surface`, `view-binder-domain-public-boundary-surface`, `view-contributionmodel-read-side-only-direct-boundary`, and `view-contentmodel-read-side-only-direct-boundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | The write/readback contract between view and domain is owned only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1) and the neighboring view-role enforcement documents. This row inventories the current blocker surface for that contract. |
| `layering-no-third-presentation-state-mutation-route` | Review-Owned | every path that can mutate presentation state in an active view unit | none | none | Presentation-state mutation rules are owned only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1). This remains a repository-wide review claim: View-layer jQAssistant dependency-cycle diagnostics may provide review evidence, but they do not mechanically prove or disprove the mutation-route rule in v1. |
| `layering-data-reaches-domain-only-through-public-boundaries-and-repositories` | Enforced Elsewhere | every dependency or registration seam from `src/data/**` into `src/domain/**` | data `data-service-registry-root-only`, `data-service-contribution-register-export-shape`, `data-repository-role-contract`, `data-query-role-contract`, and `data-gateway-domain-independence`; domain `domain-layer-foreign-context-access-only-through-public-boundaries` and `domain-repository-role-shape` | `./gradlew compileJava`, `./gradlew checkDataEnforcement`, and `./gradlew checkDomainEnforcement` | The data layer reaches the domain core only through documented source-backed domain port or repository adapter seams. Runtime registration of root `*ApplicationService` and `published/*Model` services belongs to domain service-composition roots. |

## Graph Rules

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-explicit-cross-layer-public-boundary-diagnostic` | Enforced | compiled cross-layer dependency edges in the selected forbidden direction families: domain to outer layers, view to data, data to bootstrap/view, shell to feature or bootstrap layers, and bootstrap to feature layers; root domain `*ServiceAssembly` dependencies on `shell/api/ServiceRegistry` and root domain `*ServiceContribution` dependencies on `shell/api/ServiceRegistry` or `shell/api/ServiceContribution` are excluded registration seams | layering-architecture bundle jQAssistant `LayeringCrossLayerPublicBoundaryDependency` | `./gradlew checkLayeringEnforcement` | Cross-layer source dependencies stay on the documented inward-facing boundary families instead of opening hidden direct layer shortcuts. |
| `layering-thin-role-relay-stack-diagnostic` | Enforced | root domain `*ApplicationService`, domain `application/*UseCase`, view `*Binder`, view `*IntentHandler`, and data `*ServiceContribution` surfaces with a direct dependency edge into another thin role family, excluding same-feature `ApplicationService` to `UseCase`, same-feature `Binder` to `IntentHandler`, and the documented view-to-`ApplicationService` feature seams `catalog` to `creatures`/`encounter`/`encountertable`, `encounter` to `encounter`/`creatures`, `hexmap` to `hex`, `adventuringday` to `party`, and `dungeoneditor`/`dungeontravel`/`travel` to `dungeon` | layering-architecture bundle jQAssistant `LayeringThinRoleRelayStackDiagnostic` | `./gradlew checkLayeringEnforcement` | Thin adapter and orchestration roles do not form direct multi-role relay stacks outside the documented relay seams. |
| `layering-role-hub-sprawl` | Candidate | root domain `*ApplicationService`, domain `application/*UseCase`, domain `repository/**`, domain `port/**`, view `*Binder`, view `*IntentHandler`, and data `*ServiceContribution` roles | layering-architecture bundle jQAssistant `LayeringRoleHubSprawlCandidate` | `./gradlew checkLayeringEnforcement` non-blocking diagnostic group | Role-bearing tactical owners that fan out into twelve or more distinct role-bearing production collaborators are surfaced for cleanup review, but the row is not a blocker without a sharper owner rule. |
| `layering-cross-feature-sprawl` | Candidate | every compiled `src/domain/<context>/**` or `src/data/<feature>/**` production type that depends on foreign domain/data feature scopes | layering-architecture bundle jQAssistant `LayeringCrossFeatureSprawlCandidate` | `./gradlew checkLayeringEnforcement` non-blocking diagnostic group | Domain and data types that couple to four or more foreign domain/data feature scopes are surfaced for cleanup review, but the row is not a blocker without a sharper owner rule. |
| `layering-public-boundary-breadth` | Candidate | every public root domain `*ApplicationService` and public data `*ServiceContribution` type | layering-architecture bundle jQAssistant `LayeringPublicBoundaryBreadthCandidate` | `./gradlew checkLayeringEnforcement` non-blocking diagnostic group | Broad backend and runtime registration roots with eighteen or more distinct production collaborators are surfaced for cleanup review, but the row is not a blocker without a sharper owner rule. |

The relay-chain blocker and sprawl candidates in this file are owned by
jQAssistant because they query compiled dependency graphs across role and
feature relationships. The sprawl candidates are selected in the same route only
as non-blocking diagnostics; their detailed rows are read from
`build/reports/jqassistant/layeringArchitecture/jqassistant-report.xml` after
`./gradlew checkLayeringEnforcement`. They are not promoted to blockers until an owner
defines a sharper forbidden shape. The `layering-thin-role-relay-stack-diagnostic`
identifier remains stable for existing reports, but it is blocking when selected
through the `saltmarcher:layering-architecture-enforcement` group. View-layer cycle queries are intentionally
not listed here as layering blockers; they live in the view-layer bundle as
non-blocking diagnostics until the View owner defines a precise forbidden
dependency-cycle level. Error Prone, ArchUnit, and the build-harness stack
remain the owners for compiler-local symbol rules, objective dependency and
cycle blockers, and source-tree topology rules.

## References

- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Bootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-enforcement.md:1)
- [Bootstrap AppBootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-app-bootstrap-enforcement.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell AppShell Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [Shell RuntimeContext Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-runtime-context-enforcement.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data ServiceContribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-service-contribution-enforcement.md:1)
- [Data Repository Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-repository-enforcement.md:1)
- [Data Query Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-query-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
