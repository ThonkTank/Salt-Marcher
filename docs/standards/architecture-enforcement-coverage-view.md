Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Mechanical and review-owned enforcement coverage for cockpit
MVVM view architecture.

# View Enforcement Coverage

## Goal

This document maps the cockpit MVVM view rules from the
[Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
to the local gates that block violations.

The MVVM standard remains the source of architectural intent. This document
records only the current enforcement status, owner, blocking task, and limits of
the checks.

## Enforced Rules

| MVVM rule | Owner and blocking task | Mechanical rule IDs |
| --- | --- | --- |
| View Java sources live only under active roots or slotcontent roots, with package paths matching file paths. | `build-harness:check`, `architectureTest`, `pmdArchitectureMain`, `checkViewArchitecture`, `compileJava` | build-harness `view-layout`; ArchUnit `viewLayerMustUseModelsOrViewsPackages`; PMD `SaltMarcherSourcePolicyRule`; jQAssistant `saltmarcher:MvvmAllowedViewBuckets`; Error Prone `ViewRootDelegation` |
| Legacy component-local `View/`, `ViewModel/`, `assembly/`, view `api/`, `Model/`, `Controller/`, and `interactor/` topology is forbidden for active target code. | `build-harness:check`, `architectureTest`, `pmdArchitectureMain`, `checkViewArchitecture`, `compileJava` | build-harness `view-layout`; ArchUnit `viewLayerMustUseModelsOrViewsPackages`; PMD `SaltMarcherSourcePolicyRule`; jQAssistant `saltmarcher:MvvmNoLegacyBuckets`; Error Prone `ViewRootDelegation` |
| `leftbartabs` and `statetabs` roots define exactly one shell-discovered `*Contribution`, exactly one `*Binder`, and exactly one aggregate `*ViewModel`. | `build-harness:check` | build-harness `view-root-composition` |
| `dropdowns` roots define exactly one `*Binder`, exactly one aggregate `*ViewModel`, and zero or one `*Contribution`. | `build-harness:check` | build-harness `view-root-composition`, `view-dropdown-optional-contribution` |
| Active roots contain only `*Contribution`, `*Binder`, `*ViewModel`, and passive `*View` files; reusable `*DisplayModel` files belong in slotcontent. | `build-harness:check` | build-harness `view-root-file-role`, `view-active-root-no-display-model` |
| Slotcontent roots contain only passive `*View`, optional slot-local `*ViewModel`, and reusable `*DisplayModel` files; they must not define shell entrypoints or Binders. | `build-harness:check` | build-harness `view-slotcontent-root-shape`, `view-slotcontent-no-shell-entrypoints` |
| Shell-facing contribution entrypoints use `*Contribution`, implement `ShellContribution`, declare `registrationSpec()` and `bind(ShellRuntimeContext)`, and choose the contribution spec matching their area. | `pmdArchitectureMain`, `checkViewArchitecture`, `architectureTest` | PMD `SaltMarcherEntrypointRule`; jQAssistant `saltmarcher:MvvmRootOnlyViewContribution`; ArchUnit `viewLayerMustNotUseViewContributionImplementations` |
| Contributions stay shell-registration adapters: they may use only the contribution shell API subset, their co-located Binder, and ordinary non-infrastructure JDK support; they must not do service lookup. | `compileJava`, `checkViewArchitecture` | Error Prone `FeatureShellApiAllowlist`, `ViewModelFrameworkIndependence`; jQAssistant `saltmarcher:MvvmModelDependencies` |
| Binders own runtime assembly and may depend on shell API, same-root ViewModels and Views, reusable slotcontent, JavaFX `Node`, and root domain application services or `published` carriers. | `compileJava`, `checkViewArchitecture`, `architectureTest` | Error Prone `FeatureShellApiAllowlist`, `ViewModelFrameworkIndependence`; jQAssistant `saltmarcher:MvvmBinderUsesOwnModelAndSlotSurface`, `saltmarcher:MvvmModelDependencies`; ArchUnit `viewActiveRootsAndViewModelsMustOnlyUseAllowedDomainBoundaries` |
| Active-root ViewModels may use JavaFX beans/collections, same-root presentation models, root domain application services, and domain `published` carriers; slotcontent ViewModels may use only JavaFX beans/collections and domain `published` carriers from the domain side. | `compileJava`, `checkViewArchitecture`, `architectureTest` | Error Prone `ViewModelFrameworkIndependence`; jQAssistant `saltmarcher:MvvmViewModelDependencies`; ArchUnit `viewActiveRootsAndViewModelsMustOnlyUseAllowedDomainBoundaries` |
| ViewModels must not depend on shell APIs, concrete Views, data, bootstrap, shell host internals, private domain internals, scene graph APIs, infrastructure JDK types, or extra top-level presentation-state classes outside their owning root. | `compileJava`, `architectureTest`, `checkViewArchitecture` | Error Prone `ViewModelFrameworkIndependence`, `ViewModelOwnershipNaming`; ArchUnit `viewActiveRootsAndViewModelsMustNotReachBootstrapDataOrShellHost`; jQAssistant `saltmarcher:MvvmViewModelDependencies` |
| Passive Views may use JavaFX UI APIs and ordinary callback/property types, but not shell, domain, data, bootstrap, ApplicationService types, ViewModels outside allowed slotcontent support, or infrastructure JDK types. | `compileJava`, `architectureTest`, `checkViewArchitecture` | Error Prone `ViewRestrictedDependencies`; ArchUnit `passiveViewsMustNotReachContributionShellDomainDataOrBootstrap`; jQAssistant `saltmarcher:MvvmNoPrivateForeignComponentDependencies` |
| Passive View names identify their shell surface: left-bar roots use `*ControlsView`, `*MainView`, or `*StateView`; dropdowns use `*TopBarView`; state tabs use `*StateView`; slotcontent uses `*View`. | `pmdArchitectureMain`, `checkViewArchitecture`, `checkViewFxmlResources` | PMD `SaltMarcherEntrypointRule`; jQAssistant `saltmarcher:MvvmPanelViewName`; Gradle `CheckViewFxmlResourcesTask` |
| One top-level contribution, Binder, ViewModel, or passive View owns each corresponding source file. | `checkViewArchitecture` | jQAssistant `saltmarcher:MvvmOneModelPerFile`, `saltmarcher:MvvmOnePanelViewPerFile` |
| Optional FXML resources live under the MVVM view-resource tree, use passive View controllers matching their owning resource path, and avoid inline scripts. | `checkViewFxmlResources`, via `checkViewArchitecture` and `check` | Gradle `CheckViewFxmlResourcesTask` |
| Feature View code must publish details through shell-owned inspector/history APIs rather than direct `COCKPIT_DETAILS` slot content. | `compileJava`, shell runtime validation | Error Prone `ViewDetailsSlotBoundary`; shell host `ShellSlotValidator` |
| Reflective reach-through under `src/view/**` is forbidden. | `compileJava` | Error Prone `ViewReflectionBypass` |
| Programmatic style values and inline style strings are forbidden where centralized stylesheet policy can observe them. | `compileJava`, `pmdArchitectureMain`, `checkCentralizedStylesheets`, `checkDefinedStyleClassSelectors` | Error Prone `ViewProgrammaticStyling`; PMD `SaltMarcherSourcePolicyRule`; Gradle stylesheet selector tasks |
| View package and slotcontent slices stay cycle-free. | `architectureTest` | ArchUnit `viewComponentsMustStayCycleFree` |
| Shell host and shell API stay independent from concrete feature contributions, ViewModels, Views, domain services, and data adapters. | `architectureTest`, `pmdArchitectureMain` | ArchUnit `shellMustNotReachFeatureInteractorsDomainOrData`, `shellApiMustStayIndependentFromHostAndFeatureLayers`; PMD `SaltMarcherSourcePolicyRule` |
| Domain code stays independent from View, shell, JavaFX, and data implementation types. | `compileJava`, `architectureTest`, `pmdArchitectureMain` | Error Prone domain boundary checks; ArchUnit `domainMustStayIndependentFromOuterLayers`; PMD `SaltMarcherSourcePolicyRule` |

## Source-Pattern Checks

PMD architecture source rules block stable source-shape contracts and forbidden
strings such as legacy shell wiring types, inline `setStyle(...)`, contribution
method presence, and area-specific contribution spec selection.

These checks are useful when the rule is explicitly source-shaped. They do not
prove semantic placement quality, interaction correctness, visual quality,
accessibility, or ViewModel state semantics. If a rule needs resolved symbols,
public-signature precision, package dependency edges, or graph topology, the
primary owner must be Error Prone, ArchUnit, or jQAssistant rather than PMD.

## Non-Blocking Incubator Checks

The repository contains unregistered incubator Error Prone checkers named
`ViewPresentationDecisionLeak` and `ViewSnapshotMirroring`. They are not listed
in the Error Prone service file and are not enabled in `compileJava`.

Those checks intentionally remain non-blocking because their current signal is
method-name and branch-shape based. They may find interesting review leads, but
they are not precise enough to prove whether presentation decisions or snapshot
mirroring are architecturally wrong.

## Review-Owned Rules

- whether Binder wiring reflects the intended user workflow
- whether listener/subscription lifetimes are correct beyond mechanically
  obvious forbidden infrastructure use
- whether async work has correct loading, failure, cancellation, retry, and
  stale-result semantics
- whether passive Views expose coherent, accessible JavaFX control structures
- whether ViewModels preserve state across user actions correctly
- whether slotcontent naming communicates the reusable surface clearly
- whether active-root Views duplicate reusable slotcontent instead of wrapping or
  specializing it
- whether runtime state conceptually belongs under `statetabs` or a left-bar
  tab when the package shape alone is not enough evidence
- whether state-pane precedence behaves correctly at runtime beyond the
  mechanically checked slot and shell API shapes
