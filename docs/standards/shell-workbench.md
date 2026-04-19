Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Shell workbench role vocabulary, fixed shell-facing
contracts, lifecycle expectations, dependency rules, and forbidden shell
composition patterns.

# Passive Workbench Shell Standard

## Goal

SaltMarcher uses a passive workbench shell.

The shell exposes a fixed set of typed workbench surfaces and shell-scoped
services. Features contribute navigable parts, toolbar items, and auxiliary
panel content into those shell-owned surfaces without importing the concrete
shell host or turning bootstrap into a feature registry.

The vocabulary is intentionally based on established composite-application and
workbench patterns:

- Prism contributes shell and declarative contribution-point vocabulary.
- Eclipse contributes workbench, part, and activation lifecycle vocabulary.
- IntelliJ and VS Code contribute declarative contributions, on-demand
  realization, and scoped runtime-service vocabulary.

SaltMarcher does not copy any of those frameworks wholesale. The binding model
for this repository is the workbench contract defined in this document.

## Workbench Role Model

### `AppShell`

`AppShell` is the workbench host root.

It owns:

- navigation and contribution activation
- top-bar composition
- workspace composition
- inspector/details hosting
- runtime-state hosting
- activation and deactivation calls
- layout persistence such as divider restoration

It must stay generic. It must not own feature or business logic.

### `ShellContributionSpec`, `ShellTabSpec`, `ShellTopBarSpec`, and `ShellRuntimeStateSpec`

These types are pure registration metadata.

They define identity, ordering, navigation grouping, tab mode, and other shell
registration facts. `ShellTabSpec` may additionally carry a feature-owned
navigation-graphic supplier so the feature can provide its own navigation icon
at registration time without exposing a shared shell icon helper.

They must not become a home for feature logic, runtime state, runtime-
capability lookup, or prebuilt scene-graph construction.

### `ShellViewContribution`

`ShellViewContribution` is the stateless contribution root for one shell-facing
feature entrypoint.

Responsibilities:

- expose passive registration metadata through `registrationSpec()`
- delegate into the owning feature's `assembly/` boundary through
  `createScreen(runtimeContext)`

Rules:

- contribution classes stay thin and stateless
- long-lived runtime state must not be stored on contribution instances
- root entrypoints own registration and delegation only
- routine slice wiring, service lookup, and shell-facing adaptation belong in
  the owning component's `assembly/` bucket

### `ShellScreen`

`ShellScreen` is the current Java API name for the prepared contribution
content returned by `ShellViewContribution`.

Architecturally:

- `ShellTabSpec` contributions return a navigable workbench part
- `ShellTopBarSpec` contributions return global toolbar content
- `ShellRuntimeStateSpec` contributions return auxiliary panel content

The type name `ShellScreen` is therefore a legacy API name, not the canonical
architecture term for every contribution kind.

It owns:

- prepared slot content for the fixed shell contract
- title and navigation presentation when the contribution is navigable
- activation hooks such as `onShow()` and `onHide()` for navigable tab content

It does not own workbench layout, slot resizing policy, shell navigation
state, toolbar ordering rules, or inspector-hosting mechanics.

### `ShellRuntimeContext`

`ShellRuntimeContext` is the only shell-scoped runtime gateway available to
features.

It exposes:

- `inspector()` for publishing inspector entries into the shell-owned details
  surface
- `services()` for looking up shell-owned runtime capabilities and
  application-service factories through `ServiceRegistry`
- `session(...)` for typed per-shell shared runtime sessions

Features must not bypass this gateway by importing `AppShell` or concrete
shell pane types. Routine runtime-capability lookup belongs in `assembly/`, not in the
contribution root, `View/`, or `ViewModel/`.

This runtime lookup seam is a composition facility of the shell. It is not a
second public backend layer alongside `*ApplicationService`.

## Fixed Shell Contract

The external shell contract is fixed and typed.

The public shell contract lives under `shell/api/**`.

The concrete shell host lives under `shell/host/**`.

Workbench surfaces use the following current Java API names:

- global toolbar: `TOP_BAR`
- control rail: `COCKPIT_CONTROLS`
- primary work surface: `COCKPIT_MAIN`
- inspector panel: `COCKPIT_DETAILS`
- auxiliary panel: `COCKPIT_STATE`

Ownership rules:

- `TOP_BAR` is shell-owned global toolbar space fed only by
  `ShellTopBarSpec` contributions.
- `COCKPIT_CONTROLS` is optional feature-owned controls content for the active
  tab.
- `COCKPIT_MAIN` is the primary active work surface for a tab.
- `COCKPIT_DETAILS` remains shell-owned inspector space and must be fed only
  through inspector publishing APIs.
- `COCKPIT_STATE` is the shell-owned auxiliary panel. Runtime workflows may
  register auxiliary views through `ShellRuntimeStateSpec`; editor tabs may
  project active-tab-local auxiliary content through `ShellScreen.slotContent()`.

Current Java API slot rules:

- `ShellTabSpec` requires `COCKPIT_MAIN`
- `ShellTabSpec` may provide `COCKPIT_CONTROLS`
- `ShellTabSpec` must not provide `TOP_BAR` or `COCKPIT_DETAILS`
- `ShellTabSpec` with `ShellTabMode.RUNTIME` must not provide
  `COCKPIT_STATE`
- `ShellTabSpec` with `ShellTabMode.EDITOR` may provide `COCKPIT_STATE`
- `ShellTopBarSpec` must provide only `TOP_BAR`
- `ShellRuntimeStateSpec` must provide only `COCKPIT_STATE`

The shell owns resize and layout behavior for those surfaces. Features supply
content, not layout authority.

Navigation icons for navigable tabs are also feature-owned content, but they
are supplied declaratively through `ShellTabSpec` registration rather than
through `ShellScreen`.

## Allowed Feature-Facing Shell API Surface

The public shell-facing API surface is fixed by consumer bucket:

- contribution roots may use only `ShellViewContribution`,
  `ShellContributionSpec`, `ShellTabSpec`, `ShellTabMode`,
  `ShellTopBarSpec`, `ShellRuntimeStateSpec`, `ShellScreen`,
  `ShellRuntimeContext`, `ContributionKey`, and `NavigationGroupSpec`
- `assembly/` may use only `ShellRuntimeContext`, `ShellScreen`,
  `ShellSlot`, `InspectorSink`, `InspectorEntrySpec`, `ServiceRegistry`,
  and `NavigationGraphicSupport`
- data `*ServiceContribution` roots may use only `ServiceContribution`
  and `ServiceRegistry`

Feature code must not treat concrete `shell/host/**` classes as public
extension points.

## Dependency And Wiring Rules

Dependencies point inward:

- bootstrap depends on shell contracts and discovery mechanics
- shell depends on shell-owned contracts and generic runtime hosting
- view components use the allowed shell API surface only at the contribution
  root and `assembly/` boundary
- domain and data stay independent from shell implementation

Forbidden directions and patterns:

- feature imports of `AppShell` or concrete shell pane classes
- shell ownership of feature or business logic
- open-ended named-region composition as the default public extension model
- manual bootstrap feature registries as routine wiring
- long-lived runtime state in contribution classes
- routine slice composition or backend capability lookup in contribution roots
- feature-specific alternate wiring paths around `ShellRuntimeContext`

Shell-facing runtime composition belongs in the owning component's
`assembly/` bucket. The contribution root registers and delegates only. It
does not belong in `View/`, `ViewModel/`, or in legacy `Controller/`,
`Model/`, or `interactor/` buckets.

## Lifecycle And Realization

`createScreen(runtimeContext)` is a factory boundary. It must be safe for
shell-managed realization and caching.

Current state:

- `AppBootstrap` eagerly creates every `ShellScreen` during shell creation.
- `AppShell` activates screens through `navigateTo(...)`.
- `ShellScreen.onShow()` and `ShellScreen.onHide()` provide the current
  activation lifecycle hooks.

Target-compatible rule:

- the shell may later switch to lazy first-activation screen creation and
  shell-owned caching without changing the public contribution contract

That means feature code must not assume eager startup realization as a
semantic guarantee. Eager creation is current behavior, not the binding model.

## Current Code Mapping

Current Java API names already map onto the workbench model:

- `shell/host/AppShell.java` is the workbench host root
- `shell/host/ShellWorkspacePane.java` hosts the primary work surface,
  inspector panel, and auxiliary panel below `AppShell`
- `shell/api/ShellRuntimeContext.java` is the shell-scoped runtime gateway
- `shell/api/ShellScreen.java` is the current API type used for prepared
  contribution content across tab, top-bar, and auxiliary contributions

Current feature roots may still mix delegation and routine composition in
places. That is migration debt relative to this standard, not precedent.

## Verification Notes

The canonical owner model and rule-status vocabulary live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
The concrete Passive Workbench Shell rule-status and blocking-task matrix lives
in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

Current mechanical coverage:

- `shell-view-root-entrypoint-contracts` is enforced by `jQAssistant`
  (`checkViewArchitecture`) and `PMD architecture`
  (`pmdArchitectureMain`).
- `shell-service-root-entrypoint-contracts` is enforced by `build-harness`
  (`:build-harness:check`) and `PMD architecture` (`pmdArchitectureMain`).
- `shell-api-public-surface-allowlist` is enforced by `build-harness`
  (`:build-harness:check`).
- `shell-api-host-split` and
  `shell-host-passivity-dependency-direction` are enforced by
  `architectureTest`.
- `shell-runtime-context-api-shape` is enforced by `pmdArchitectureMain`.
- `shell-view-root-delegation-boundary` is enforced by `compileJava` via
  Error Prone for the current build-blocking subset: no direct root wiring to
  JavaFX, domain, data, or private view buckets; no inline `ShellScreen`
  construction; and no root use of `ShellRuntimeContext.inspector()`,
  `services()`, or `session(...)`.
- `shell-feature-facing-api-allowlist` is enforced by `compileJava` via Error
  Prone for view contribution roots, `assembly/`, and data
  `*ServiceContribution` roots.
- `shell-fixed-slot-api`, `shell-contribution-spec-family`,
  `shell-contribution-spec-metadata-purity`,
  `shell-contribution-spec-api-shape`, `shell-screen-api-shape`, and
  `shell-details-inspector-only` are enforced by `pmdArchitectureMain`.
- `shell-screen-lifecycle-hook-ownership` is enforced by `compileJava` via
  Error Prone.

Runtime guards outside the build-blocking harness:

- `AppShell` routes contribution registration through `ShellSlotValidator`, so
  invalid slot payloads are also rejected at shell-registration time even when
  a source-level rule missed the exact shape. This is the current mechanical
  owner for the full contribution-spec-to-slot matrix.

Review-owned rules in this standard:

- shell-owned lifecycle expectations beyond current hook presence
- the stronger workbench-role vocabulary and ownership boundaries
- `ShellScreen` as a current API name for prepared contribution content rather
  than proof that every contribution is a navigable screen
- lazy-realization readiness of `createScreen(...)`
- the ban on open-ended named-region composition and manual bootstrap feature
  registries as the default extension model
- the semantic remainder of the ban on feature-specific alternate wiring paths
  around `ShellRuntimeContext`

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [ADR 002: Passive Shell With Generic Feature Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 004: Shared Runtime Session Store](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/004-shared-runtime-session-store.md:1)
- [ADR 011: Passive Workbench Shell Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/011-shell-workbench-architecture-model.md:1)
