Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Shell workbench role vocabulary, fixed cockpit-surface
contracts, lifecycle expectations, dependency rules, and forbidden shell
composition patterns.

# Passive Workbench Shell Standard

## Goal

SaltMarcher uses a passive workbench shell.

The shell exposes a fixed cockpit frame and public contracts through which
feature-owned contributions register tabs, global runtime state-panel tabs,
and top-bar dropdown windows. The shell hosts surfaces, navigation, lifecycle,
details/history, state-pane arbitration, and layout behavior. It does not own
feature or business behavior.

The vocabulary is based on established workbench and composite-application
patterns, but the binding model is SaltMarcher's fixed cockpit contract.

## Workbench Role Model

### `AppShell`

`AppShell` is the workbench host root.

It owns:

- left-bar navigation and contribution activation
- top-bar dropdown window hosting
- empty cockpit control-panel hosting
- empty cockpit main-panel hosting
- details-pane and history hosting
- global runtime state-panel tab hosting
- state-pane precedence between active-tab state and global runtime state tabs
- activation and deactivation calls
- layout persistence such as divider restoration

It must stay generic. It must not own feature or business logic.

### Shell Registration Contracts

Shell contribution specs and binding contracts are passive metadata and slot
contracts.

They define identity, ordering, navigation grouping, contribution kind,
activation behavior, and which fixed cockpit surfaces a contribution may bind.

They must not become a home for feature logic, presentation state, runtime-
capability lookup, domain service lookup, or prebuilt scene-graph construction
that belongs to a view contribution root.

### Contributions

A contribution is the feature-owned shell adapter for one UI entrypoint:

- a left-bar tab under `src/view/tabs/<entry>/`
- a top-bar dropdown window under `src/view/topbar/<entry>/`
- a global runtime state-panel tab under `src/view/state/<entry>/`

Responsibilities:

- provide passive shell registration metadata
- instantiate the owning ViewModel and passive views
- bind views to ViewModel state and actions
- project bound views into allowed shell surfaces through `ShellBinding`
- obtain shell-owned runtime capabilities and domain application services
  needed for composition

Rules:

- contributions live under contribution roots in `src/view/tabs`,
  `src/view/topbar`, and `src/view/state`
- each contribution file defines one shell-registered UI entrypoint
- long-lived runtime state must not be stored in the shell host
- feature logic, presentation state, JavaFX panel behavior, and business logic
  stay out of the shell

The current Java API uses `ShellContribution` and `ShellBinding` for
contribution-owned cockpit binding. Legacy shell-view contribution and
prepared-screen names must not be reintroduced as target view wiring.

### `ShellRuntimeContext`

`ShellRuntimeContext` is the only shell-scoped runtime gateway available to UI
contributions and data service roots.

It exposes:

- `inspector()` for publishing details/history entries into the shell-owned
  details surface
- `services()` for looking up shell-owned runtime capabilities and
  application-service factories through `ServiceRegistry`
- `session(...)` for typed per-shell shared runtime sessions

Features must not bypass this gateway by importing `AppShell` or concrete
shell pane types. Runtime-capability lookup belongs in a contribution, not in
passive Views.

This runtime lookup is a shell composition facility. It is not a second public
backend layer alongside `*ApplicationService`.

## Fixed Cockpit Contract

The public shell contract lives under `shell/api/**`.

The concrete shell host lives under `shell/host/**`.

Workbench surfaces use the following current Java API names:

- top-bar dropdown window surface: `TOP_BAR`
- top-left control panel: `COCKPIT_CONTROLS`
- primary work panel: `COCKPIT_MAIN`
- top-right details pane with history: `COCKPIT_DETAILS`
- bottom-right state pane: `COCKPIT_STATE`

Ownership rules:

- `TOP_BAR` is shell-owned dropdown-window space fed only through top-bar
  registration contracts.
- `COCKPIT_CONTROLS` is shell-owned empty control-panel space. The active
  left-bar tab may bind one passive control-panel view into it.
- `COCKPIT_MAIN` is shell-owned empty primary work-panel space. The active
  left-bar tab may bind one passive main-panel view into it.
- `COCKPIT_DETAILS` is shell-owned details/history space. Features publish
  details through shell-owned details/history APIs, not direct slot content.
- `COCKPIT_STATE` is shell-owned state-pane space. If the active left-bar tab
  claims it, the shell shows that active-tab state panel. Otherwise the shell
  shows registered global runtime state-panel tabs.

Encounter and similar global runtime state are runtime state-panel tabs, not
left-bar tabs.

The shell owns resize, layout, precedence, history, and activation behavior for
those surfaces. Features supply bound content and user-event emitters through
their contributions.

Navigation icons for navigable tabs are feature-owned content, but they are
supplied declaratively through registration metadata rather than through panel
views.

## Allowed Feature-Facing Shell API Surface

The public shell-facing API surface is fixed by consumer bucket:

- UI contributions may use shell public registration contracts, contribution
  identity/order types, `ShellRuntimeContext`, details/history publishing
  contracts, and fixed surface-binding contracts.
- ViewModels must not use shell APIs.
- passive Views must not use shell APIs.
- data `*ServiceContribution` roots may use only `ServiceContribution` and
  `ServiceRegistry`.

Feature code must not treat concrete `shell/host/**` classes as public
extension points.

## Dependency And Wiring Rules

Dependencies point inward:

- bootstrap depends on shell contracts and discovery mechanics
- shell depends on shell-owned contracts and generic runtime hosting
- contributions use allowed shell API surface and domain public boundaries
- ViewModels use domain public boundaries and expose bindable presentation
  state
- passive Views stay below ViewModels and do not use shell or domain APIs
- domain and data stay independent from shell implementation

Forbidden directions and patterns:

- feature imports of `AppShell` or concrete shell pane classes
- shell ownership of feature or business logic
- shell imports of feature contributions, ViewModels, or Views
- ViewModels importing shell APIs
- passive Views importing shell APIs
- open-ended named-region composition as the default public extension model
- manual bootstrap feature registries as routine wiring
- long-lived feature runtime state in shell host classes
- feature-specific alternate wiring paths around `ShellRuntimeContext`

Shell-facing runtime composition belongs in the owning contribution under
`src/view/tabs`, `src/view/topbar`, or `src/view/state`. It does not belong in
ViewModels, passive Views, concrete shell host classes, or legacy
`ViewContribution`, `assembly`, `Controller`, `Model`, or `interactor`
buckets.

## Lifecycle And Realization

Shell realization must be safe for shell-managed caching and lazy first use.

Current state:

- `AppBootstrap` eagerly discovers and binds every `ShellContribution` during
  shell creation.
- `AppShell` activates tabs through `navigateTo(...)`.
- `ShellBinding.onActivate()` and `ShellBinding.onDeactivate()` provide the
  current activation lifecycle hooks.

Target-compatible rule:

- the shell may later switch to lazy first-activation contribution realization
  and shell-owned caching without changing the public registration contract

Feature code must not assume eager startup realization as a semantic guarantee.
Eager creation is current behavior, not the binding model.

## Current Code Mapping

- `shell/host/AppShell.java` is the workbench host root.
- `shell/host/ShellWorkspacePane.java` hosts the controls, main, details, and
  state surfaces below `AppShell`.
- `shell/host/RuntimeStatePane.java` hosts global runtime state-panel tabs.
- `shell/api/ShellRuntimeContext.java` is the shell-scoped runtime gateway.
- `shell/api/ShellContribution.java` is the shell-facing UI contribution
  contract.
- `shell/api/ShellBinding.java` is the bound slot-content and lifecycle
  contract.
- `shell/api/ShellSlot.java` names the fixed cockpit surfaces.

Feature roots must not compose screens through legacy shell-view contribution
types. Those names are migration debt relative to the contribution-root target,
not precedent.

## Verification Notes

The canonical owner model and rule-status vocabulary live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1).
The concrete Passive Workbench Shell rule-status and blocking-task matrix lives
in the
[Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-coverage.md:1).

Current mechanical coverage enforces the target shell-facing API shape where it
has a stable static surface:

- shell APIs are used by contributions, not by ViewModels or passive Views
- concrete `shell.host` types do not leak into feature code
- shell host code does not import feature contributions, ViewModels, Views,
  `src.domain`, or `src.data`
- details content is published through shell-owned details/history contracts
- state-pane precedence is enforced by shell registration and activation rules
- fixed surface contracts remain closed and typed

New mechanical gates require explicit user request before being added to the
local build/check pipeline.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/architecture-enforcement-harness.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/quality-platforms.md:1)
- [ADR 002: Passive Shell With Generic Feature Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 004: Shared Runtime Session Store](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/004-shared-runtime-session-store.md:1)
- [ADR 011: Passive Workbench Shell Architecture Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/011-shell-workbench-architecture-model.md:1)
- [ADR 019: Shell Cockpit MVVM Contribution View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/020-view-contributions-and-viewmodels.md:1)
