Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Mechanical and review-owned enforcement coverage for cockpit
MVVM view architecture.

# View Enforcement Coverage

## Goal

This document maps the cockpit MVVM view rules from ADR 019 and ADR 022 to the
local gates that block violations.

## Enforced

- View Java sources may live only as direct files under
  `src/view/leftbartabs/*`, `src/view/statetabs/*`,
  `src/view/dropdowns/*`, or `src/view/slotcontent/<slot>/<entry>/`, owned by
  `build-harness`, jQAssistant `checkViewArchitecture`, ArchUnit
  `viewLayerMustUseModelsOrViewsPackages`, PMD architecture, and Error Prone
  `ViewRootDelegation`.
- `*ViewContribution` implementations are forbidden under the view layer;
  shell-facing entrypoints use `*Contribution`, owned by `build-harness`,
  jQAssistant, and ArchUnit `viewLayerMustNotUseViewContributionImplementations`.
- Active view roots contain their expected direct `*Contribution`,
  `*Binder`, `*ViewModel`, and passive `*View` files; slotcontent roots contain
  passive reusable views and optional slot-local view models or display models,
  owned by `build-harness`.
- Shell-facing contribution entrypoints implement the correct shell API and
  are discoverable only from allowed active roots, owned by `build-harness`,
  jQAssistant, and PMD entrypoint checks.
- Active roots and view models must not depend on bootstrap, data, shell host,
  or private domain internals, owned by ArchUnit
  `viewActiveRootsAndViewModelsMustNotReachBootstrapDataOrShellHost` and
  `viewActiveRootsAndViewModelsMustOnlyUseAllowedDomainBoundaries`.
- Passive `*View` files must not depend on shell, domain, data, bootstrap, or
  JavaFX-host composition details, owned by ArchUnit
  `passiveViewsMustNotReachContributionShellDomainDataOrBootstrap` and Error
  Prone view dependency checks.
- View models remain framework-independent where documented, own presentation
  state instead of shell registration, and avoid reflection bypasses and
  programmatic styling escape hatches, owned by Error Prone
  `ViewModelFrameworkIndependence`, `ViewReflectionBypass`, and
  `ViewProgrammaticStyling`.
- View package and slotcontent slices must stay cycle-free, owned by ArchUnit
  `viewComponentsMustStayCycleFree`.

## Source-Pattern Checks

PMD architecture source rules block stable forbidden strings and obvious
entrypoint misuse. They are useful for detecting prohibited imports or legacy
naming but do not prove visual quality, interaction correctness, or view-model
state semantics.

## Review-Owned

- whether binder wiring reflects the intended user workflow
- whether passive views expose a coherent, accessible JavaFX control structure
- whether view models preserve state across user actions correctly
- whether slotcontent naming communicates the reusable surface clearly
