Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
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
view, domain, and data enforcement documents. This file catalogs only the
global layer model and names where proof currently lives.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-repository-active-java-root-allowlist` | Enforced | every active Java source root in the repository | build-harness `RepositoryTopologyRules` | `./gradlew checkArchitecture` | Active Java sources live only under `bootstrap/`, `shell/`, `src/`, `test/`, `tools/`, or legacy `salt-marcher/`. |
| `layering-repository-src-direct-child-allowlist` | Enforced | every non-empty direct child bucket under `src/` | build-harness `RepositoryTopologyRules` | `./gradlew checkArchitecture` | `src/` contains only `view/`, `domain/`, and `data/` as active direct layer roots. |
| `layering-repository-included-build-taxonomy` | Enforced | every included Gradle build in the repository | build-harness `RepositoryTopologyRules` | `./gradlew checkArchitecture` | Included builds stay under `tools/gradle/` or `tools/quality/` rather than creating hidden architecture roots elsewhere. |
| `layering-intentional-cross-layer-public-boundary-set` | Enforced Elsewhere | every type that acts as a public layer-crossing boundary or registration root | shell `shell-api-public-surface-allowlist`; view `view-layer-contribution-count`, `view-layer-binder-count`, `view-contribution-discovery-entrypoint-shape`, and `view-binder-dependency-boundary`; domain `domain-applicationservice-root-presence`, `domain-published-direct-file-placement`, `domain-port-role-shape`, and `domain-port-ownership-and-signature-boundary`; data `data-root-service-contribution-only` and `data-service-contribution-shape` | see neighboring owner docs and their listed entrypoints | The global layer model contains only the documented public cross-layer boundary families: `shell/api/**`, shell runtime composition surfaces, view `*Contribution` roots, view `*Binder` roots, root domain `*ApplicationService` boundaries, root domain `published/**` carriers, domain-owned outbound ports, and data `*ServiceContribution` registration roots. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-no-extra-active-layer-roots` | Enforced | every active Java source root or non-empty `src/` direct child | build-harness `RepositoryTopologyRules` | `./gradlew checkArchitecture` | The repository does not grow extra active layer roots or extra `src/` children beside the documented layer topology. |
| `layering-no-undocumented-cross-layer-public-extension-points` | Enforced Elsewhere | every new public type or registration seam that would let one layer reach another | shell `shell-api-public-surface-allowlist`; view `view-layer-contribution-count`, `view-layer-binder-count`, `view-contribution-shell-public-contract-and-local-binder-only`, and `view-binder-dependency-boundary`; domain `domain-applicationservice-public-boundary-signature-purity`; data `data-service-registry-root-only` and `data-source-adapter-no-public-capabilities` | see neighboring owner docs and their listed entrypoints | The system does not grow new public backend, shell, or registration extension points outside the documented cross-layer boundary set. |
| `layering-no-direct-view-data-dependency` | Enforced Elsewhere | every dependency from `src/view/**` into `src/data/**` | Error Prone `PassiveViewDependencyBoundaries`, `ViewContributionModelDependencyBoundary`, `ViewContentModelDependencyBoundary`, `ViewIntentHandlerDependencyBoundary`, and `ViewBinderDependencyBoundary`; ArchUnit `passiveViewsMustNotReachShellDomainDataOrBootstrap`, `contributionModelsMustStayShellDataAndServiceFree`, `contentModelsMustStayShellDataAndServiceFree`, `intentHandlersMustStayShellDomainAndDataFree`, and `bindersMustNotReachDataOrShellHost` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` | View-layer code does not bypass the domain core by depending directly on data-layer implementation code. |
| `layering-no-direct-view-domain-connection-outside-documented-seams` | Enforced Elsewhere | every direct connection between `src/view/**` and `src/domain/**` | view `view-binder-dependency-boundary`, `view-binder-publishedevent-sink-injection-only`, `view-intenthandler-no-direct-backend-communication`, `view-viewinputevent-view-origin-and-intenthandler-target-only`, `view-publishedevent-binder-installed-same-root-consumer-sink-only`, `view-contributionmodel-read-side-only-direct-boundary`, and `view-contentmodel-read-side-only-direct-boundary` | see neighboring owner docs and their listed entrypoints | View/domain connections occur only through the documented Binder-owned write seam to root `*ApplicationService` boundaries and the Binder-owned readback seam from root-domain `published/**` facts. |
| `layering-no-non-applicationservice-public-backend-boundary-below-view` | Enforced Elsewhere | every public callable backend surface below `src/view/**` | domain `domain-applicationservice-root-presence`, `domain-applicationservice-public-api-carriers`, and `domain-applicationservice-service-registry-export-shape`; data `data-service-registry-root-only` | `./gradlew compileJava` and `./gradlew checkArchitecture` | Below the view layer, the only public backend boundary is a root domain `*ApplicationService`; data and inner implementation packages do not expose alternate public backend entrypoints. |
| `layering-no-outer-format-object-leak-inward` | Review-Owned | every boundary translation from shell, view, data, or source-facing code into inner layers | none | none | JavaFX scene-graph types, shell host classes, SQL rows, gateway records, and similar outer-format carriers do not leak inward across layer boundaries. |
| `layering-no-adjacent-layer-pass-through-wrapper` | Review-Owned | every legal dependency-clean wrapper placed only to mirror adjacent layers | none | none | The layering topology does not retain ceremony-only pass-through abstractions whose only purpose is diagram symmetry rather than a real boundary responsibility. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-source-code-dependencies-point-inward` | Enforced Elsewhere | every source-code dependency that crosses a layer boundary | ArchUnit `bootstrapMustStayOutsideFeatureCode`, `shellApiMustStayIndependentFromHostAndFeatureLayers`, `domainMustStayIndependentFromOuterLayers`, and `dataMustNotReachBootstrapOrPresentation`; neighboring view-role dependency-boundary rules | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` | Cross-layer source-code dependencies point inward toward the application core and shell public contracts rather than outward into concrete outer-layer implementation details. |
| `layering-runtime-controlflow-reversal-only-through-documented-seams` | Review-Owned | every case where runtime control flow returns from an inner layer to an outer one | none | none | Reverse control flow uses only documented public carriers, shell contracts, or inner-owned interfaces rather than hidden outer-owned callback protocols. |
| `layering-bootstrap-registration-order-and-generic-discovery-path` | Review-Owned | every feature registration path from startup into runtime layer composition | none | none | Cross-layer startup composition follows the documented path: bootstrap discovers data `*ServiceContribution` roots, populates the shared `ServiceRegistry`, constructs the shell, and then discovers view `*Contribution` roots without feature-specific bootstrap registries. Current blockers constrain pieces of that path, but not the whole sequencing and genericity claim as one hard gate. |
| `layering-view-domain-write-and-readback-seams-only` | Enforced Elsewhere | every cross-layer write or readback path between the view and domain layers | view `view-binder-publishedevent-sink-injection-only`, `view-intenthandler-publishedevent-consumer-sink-contract`, `view-publishedevent-intenthandler-only-production-and-publication`, `view-publishedevent-binder-installed-same-root-consumer-sink-only`, `view-contributionmodel-read-side-only-direct-boundary`, and `view-contentmodel-read-side-only-direct-boundary` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewArchitecture` | Domain writes cross the view/domain boundary only as `IntentHandler -> PublishedEvent -> Binder sink -> ApplicationService`, and readback crosses only as root-domain `published/**` facts delivered by Binder-owned readback wiring into view models. |
| `layering-no-third-presentation-state-mutation-route` | Review-Owned | every path that can mutate presentation state in an active view unit | none | none | Presentation state changes only through the documented local presentation cycle or the documented domain-write cycle; no third cross-layer mutation route is introduced. |
| `layering-data-reaches-domain-only-through-public-boundaries-and-ports` | Enforced Elsewhere | every dependency or registration seam from `src/data/**` into `src/domain/**` | data `data-port-adapter-role-contract`, `data-service-registry-root-only`, `data-gateway-domain-independence`; domain `domain-applicationservice-constructor-composition-boundary` and `domain-layer-foreign-context-access-only-through-public-boundaries` | `./gradlew compileJava` and `./gradlew checkArchitecture` | The data layer reaches the domain core only through domain-owned outbound ports and the documented root `*ApplicationService` registration/export seams. |

## Candidate

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-explicit-cross-layer-public-boundary-diagnostic` | Candidate | every future change that adds or removes one documented cross-layer boundary family | none | none | The architecture stack could emit a dedicated blocker when a boundary family disappears or a new one appears, instead of inferring that drift from several neighboring owner docs. |

## References

- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Bootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-enforcement.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
