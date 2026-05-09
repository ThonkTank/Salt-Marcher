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
only the global layer model and names where proof currently lives.

Focused bundle entrypoint:

- `./gradlew checkLayeringArchitectureEnforcement --console=plain` runs the
  currently active layering-topology, passive-carrier mirror, and bundle-local
  documentation-coverage checks. `checkArchitecture`, `check`, and `build`
  include the same proof surface transitively, and the neighboring `Enforced
  Elsewhere` rows below stay in their owner-specific bundles.
- `./gradlew checkLayeringIndirectionEnforcement --console=plain` runs the
  focused jQAssistant blockers for substantive tactical roles whose
  indirection shape the older single-class PMD source-pattern checks can miss
  when the relay is spread across owner-local helper methods or extends into a
  deeper same-scope relay-only chain. `checkArchitecture`, `check`, `build`,
  and staged `production-handoff` now consume this blocker transitively.
- `./gradlew checkLayeringIndirectionRelayCandidates --console=plain` runs the
  report-only jQAssistant thin relay-stack diagnostic from the same focused
  Layering Indirection owner for review of deeper thin-orchestration relay
  chains.
- `./gradlew checkLayeringSprawlCandidates --console=plain` runs the
  report-only jQAssistant role-hub, cross-feature, and public-boundary
  breadth diagnostics for broader architecture sprawl that sits beyond the
  sharper relay-only blocker surface.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-repository-active-java-root-allowlist` | Enforced | every active Java source root in the repository | `layering-architecture-enforcement` bundle build-harness `LayeringArchitectureTopologyRules` | `./gradlew checkLayeringArchitectureEnforcement` and `./gradlew checkArchitecture` | Active Java sources live only under `bootstrap/`, `shell/`, `src/`, `test/`, `tools/`, or legacy `salt-marcher/`. |
| `layering-repository-src-direct-child-allowlist` | Enforced | every non-empty direct child bucket under `src/` | `layering-architecture-enforcement` bundle build-harness `LayeringArchitectureTopologyRules` | `./gradlew checkLayeringArchitectureEnforcement` and `./gradlew checkArchitecture` | `src/` contains only `view/`, `domain/`, and `data/` as active direct layer roots. |
| `layering-repository-included-build-taxonomy` | Enforced | every included Gradle build in the repository | `layering-architecture-enforcement` bundle build-harness `LayeringArchitectureTopologyRules` | `./gradlew checkLayeringArchitectureEnforcement` and `./gradlew checkArchitecture` | Included builds stay under `tools/gradle/` or `tools/quality/` rather than creating hidden architecture roots elsewhere. |
| `layering-intentional-cross-layer-public-boundary-set` | Enforced Elsewhere | every type that acts as a public layer-crossing boundary or registration root | shell `shell-api-public-surface-allowlist`; view `view-layer-contribution-count`, `view-layer-binder-count`, `view-contribution-discovery-entrypoint-shape`, and `view-binder-dependency-boundary`; domain `domain-applicationservice-root-presence`, `domain-published-direct-file-placement`, `domain-port-role-shape`, and `domain-port-ownership-and-signature-boundary`; data `data-root-service-contribution-only` and `data-service-contribution-discovery-entrypoint-shape` | see neighboring owner docs and their listed entrypoints | The global layer model contains only the documented public cross-layer boundary families: `shell/api/**`, shell runtime composition surfaces, view `*Contribution` roots, view `*Binder` roots, root domain `*ApplicationService` boundaries, root domain `published/**` carriers, the current domain repository or legacy port seam documented by the domain owner, and data `*ServiceContribution` registration roots. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-no-extra-active-layer-roots` | Enforced | every active Java source root or non-empty `src/` direct child | `layering-architecture-enforcement` bundle build-harness `LayeringArchitectureTopologyRules` | `./gradlew checkLayeringArchitectureEnforcement` and `./gradlew checkArchitecture` | The repository does not grow extra active layer roots or extra `src/` children beside the documented layer topology. |
| `layering-no-undocumented-cross-layer-public-extension-points` | Review-Owned | every new public type or registration seam that would let one layer reach another | none | none | The system does not grow new public backend, shell, or registration extension points outside the documented cross-layer boundary set. Existing shell, view, domain, and data blockers constrain parts of that surface, but not the full repository-wide extension-point claim as one hard gate. |
| `layering-no-passive-carrier-shape-mirror-inside-feature-root` | Enforced | every passive `record` or `enum` carrier under one active `src/` feature root | `layering-architecture-enforcement` bundle build-harness `LayeringPassiveCarrierMirrorRules` | `./gradlew checkLayeringArchitectureEnforcement` and `./gradlew checkArchitecture` | One active feature root does not keep multiple passive `record`/`enum` carriers with the same recursive shape under different names or buckets. |
| `layering-no-direct-view-data-dependency` | Enforced Elsewhere | every dependency from `src/view/**` into `src/data/**` | Error Prone `PassiveViewDependencyBoundaries`, `ViewContributionModelDependencyBoundary`, `ViewContentModelDependencyBoundary`, `ViewIntentHandlerDependencyBoundary`, and `ViewBinderDependencyBoundary` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewEnforcement` | View-layer code does not bypass the domain core by depending directly on data-layer implementation code. |
| `layering-no-direct-view-domain-connection-outside-documented-seams` | Enforced Elsewhere | every direct connection between `src/view/**` and `src/domain/**` | view `view-binder-dependency-boundary`, `view-binder-domain-public-boundary-surface`, `view-binder-no-legacy-intenthandler-write-sink-injection`, `view-intenthandler-root-applicationservice-boundary-surface`, `view-intenthandler-no-non-applicationservice-domain-dependencies`, `view-viewinputevent-view-origin-and-intenthandler-target-only`, `view-contributionmodel-read-side-only-direct-boundary`, and `view-contentmodel-read-side-only-direct-boundary` | see neighboring owner docs and their listed entrypoints | The allowed view/domain seam is owned only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1) and the neighboring view-role enforcement documents. This row records the current blocker surface for that contract. |
| `layering-no-non-applicationservice-public-backend-boundary-below-view` | Review-Owned | every public callable backend surface below `src/view/**` | none | none | Below the view layer, the only intended public backend boundary is a root domain `*ApplicationService`; current domain and data blockers constrain parts of that expectation, but they do not prove the absence of every alternate public backend entrypoint as one hard gate. |
| `layering-no-outer-format-object-leak-inward` | Review-Owned | every boundary translation from shell, view, data, or source-facing code into inner layers | none | none | JavaFX scene-graph types, shell host classes, SQL rows, gateway records, and similar outer-format carriers do not leak inward across layer boundaries. |
| `layering-no-domain-service-pass-through-wrapper` | Enforced | every legacy domain `service/**` tactical owner under `src/domain/**` | `layering-indirection` bundle jQAssistant `saltmarcher:DomainServiceRelayOnlyRole` and `saltmarcher:DomainServiceRelayChainDepth` | `./gradlew checkLayeringIndirectionEnforcement` and `./gradlew checkArchitecture` | Domain `service/**` tactical owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains. |
| `layering-no-domain-policy-pass-through-wrapper` | Enforced | every legacy domain `policy/**` tactical owner under `src/domain/**` | `layering-indirection` bundle jQAssistant `saltmarcher:DomainPolicyRelayOnlyRole` and `saltmarcher:DomainPolicyRelayChainDepth` | `./gradlew checkLayeringIndirectionEnforcement` and `./gradlew checkArchitecture` | Domain `policy/**` tactical owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains. |
| `layering-no-domain-factory-pass-through-wrapper` | Enforced | every legacy domain `factory/**` tactical owner under `src/domain/**` | `layering-indirection` bundle jQAssistant `saltmarcher:DomainFactoryRelayOnlyRole` and `saltmarcher:DomainFactoryRelayChainDepth` | `./gradlew checkLayeringIndirectionEnforcement` and `./gradlew checkArchitecture` | Domain `factory/**` tactical owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains. |
| `layering-no-domain-port-pass-through-wrapper` | Enforced | every domain `port/**` listener owner under `src/domain/**` whose concrete methods collapse into one foreign owner | `layering-indirection` bundle jQAssistant `saltmarcher:DomainPortRelayOnlyRole` and `saltmarcher:DomainPortRelayChainDepth` | `./gradlew checkLayeringIndirectionEnforcement` and `./gradlew checkArchitecture` | Domain `port/**` listener owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains. |
| `layering-no-domain-repository-pass-through-wrapper` | Enforced | every domain `*Repository` owner under `src/domain/**`, including current repository owners that still live under `port/**` | `layering-indirection` bundle jQAssistant `saltmarcher:DomainRepositoryRelayOnlyRole` and `saltmarcher:DomainRepositoryRelayChainDepth` | `./gradlew checkLayeringIndirectionEnforcement` and `./gradlew checkArchitecture` | Domain repository owners do not survive only as single-target relay wrappers or deeper same-scope relay-only chains, even while topology migration still leaves some of them under `port/**`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-source-code-dependencies-point-inward` | Enforced Elsewhere | every source-code dependency that crosses a layer boundary | bootstrap-layer bundle ArchUnit `bootstrapMustStayOutsideFeatureCode`, `shellApiMustStayIndependentFromHostAndFeatureLayers`, `domainMustStayIndependentFromOuterLayers`, and `dataMustNotReachBootstrapOrPresentation`; neighboring view-role dependency-boundary rules | `./gradlew compileJava`, `./gradlew checkArchitecture`, `./gradlew checkBootstrapLayerEnforcement`, and `./gradlew checkViewEnforcement` | Cross-layer source-code dependencies point inward toward the application core and shell public contracts rather than outward into concrete outer-layer implementation details. |
| `layering-runtime-controlflow-reversal-only-through-documented-seams` | Review-Owned | every case where runtime control flow returns from an inner layer to an outer one | none | none | Reverse control flow uses only documented public carriers, shell contracts, or inner-owned interfaces rather than hidden outer-owned callback protocols. |
| `layering-bootstrap-registration-order-and-generic-discovery-path` | Review-Owned | every feature registration path from startup into runtime layer composition | none | none | Cross-layer startup composition follows the documented path: bootstrap discovers data `*ServiceContribution` roots, populates the shared `ServiceRegistry`, constructs the shell, and then discovers view `*Contribution` roots without feature-specific bootstrap registries. Current blockers constrain pieces of that path, but not the whole sequencing and genericity claim as one hard gate. |
| `layering-view-domain-write-and-readback-seams-only` | Enforced Elsewhere | every cross-layer write or readback path between the view and domain layers | view `view-binder-no-legacy-intenthandler-write-sink-injection`, `view-intenthandler-root-applicationservice-boundary-surface`, `view-binder-domain-public-boundary-surface`, `view-contributionmodel-read-side-only-direct-boundary`, and `view-contentmodel-read-side-only-direct-boundary` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewEnforcement` | The write/readback contract between view and domain is owned only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1) and the neighboring view-role enforcement documents. This row inventories the current blocker surface for that contract. |
| `layering-no-third-presentation-state-mutation-route` | Review-Owned | every path that can mutate presentation state in an active view unit | none | none | Presentation-state mutation rules are owned only by the [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1). This row keeps the repository-wide review claim that no extra cross-layer mutation route appears outside that owner. |
| `layering-data-reaches-domain-only-through-public-boundaries-and-repositories` | Enforced Elsewhere | every dependency or registration seam from `src/data/**` into `src/domain/**` | data `data-service-registry-root-only`, `data-service-contribution-register-export-shape`, `data-repository-role-contract`, `data-query-role-contract`, and `data-gateway-domain-independence`; domain `domain-layer-foreign-context-access-only-through-public-boundaries` and `domain-repository-role-shape` | `./gradlew compileJava`, `./gradlew checkArchitecture`, `./gradlew checkDataGatewayEnforcement`, and `./gradlew checkDomainRepositoryEnforcement` | The data layer reaches the domain core only through the documented domain-owned outbound repository seam and the root `*ApplicationService` registration/export seams. |

## Candidate

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `layering-explicit-cross-layer-public-boundary-diagnostic` | Candidate | every future change that adds or removes one documented cross-layer boundary family | none | none | The architecture stack could emit a dedicated blocker when a boundary family disappears or a new one appears, instead of inferring that drift from several neighboring owner docs. |
| `layering-thin-role-relay-stack-diagnostic` | Candidate | every root `*ApplicationService`, `application/*UseCase`, `*Binder`, `*IntentHandler`, and `*ServiceContribution` surface that relays through at least one deeper relay-only owner | none | none | Thin adapter and orchestration roles that currently form a multi-hop relay stack are reported for review without turning intentional thinness itself into a blocker. |
| `layering-role-hub-sprawl-candidate` | Candidate | every root `*ApplicationService`, `application/*UseCase`, domain `repository/**`, domain `port/**`, `*Binder`, `*IntentHandler`, and `*ServiceContribution` role | none | none | Role-bearing tactical owners that fan out into too many foreign production owners or foreign feature scopes are reported for review before they harden into coordination hubs. |
| `layering-cross-feature-sprawl-candidate` | Candidate | every compiled `src/domain/<context>/**` or `src/data/<feature>/**` production type that contributes to broad acyclic foreign-feature coupling | none | none | Domain and data feature scopes that couple too broadly across foreign feature scopes are reported even when the graph has not yet become cyclic. |
| `layering-public-boundary-breadth-candidate` | Candidate | every public root `*ApplicationService` and public data `*ServiceContribution` type | none | none | Broad public backend or runtime registration roots with too many collaborators or too wide a callable surface are reported for review before they become hard-to-split coordination shells. |

`./gradlew checkLayeringIndirectionRelayCandidates --console=plain` runs the
report-only jQAssistant diagnostic `saltmarcher:ThinRelayStackCandidate`.
`./gradlew checkLayeringSprawlCandidates --console=plain` complements that
relay-focused diagnostic with broader role-aware graph candidates; it does not
replace existing cycle blockers, PMD smell rules such as
`LawOfDemeter`, `GodClass`, and `CouplingBetweenObjects`, or CKJM hotspot
reporting.

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
