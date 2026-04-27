Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-27
Source of Truth: Shell workbench role vocabulary, fixed cockpit-surface
contracts, lifecycle expectations, dependency rules, and forbidden shell
composition patterns.

# Passive Workbench Shell Standard

## Goal

SaltMarcher uses a passive workbench shell.

The shell exposes a fixed cockpit frame and public contracts through which
feature-owned contributions register left-bar tabs, global state tabs, and
top-bar dropdown windows. The shell hosts surfaces, navigation, lifecycle,
details/history, state-pane arbitration, and layout behavior. It does not own
feature or business behavior.

## Workbench Role Model

### `AppShell`

`AppShell` is the workbench host root.

It owns:

- left-bar navigation and contribution activation
- top-bar dropdown window hosting
- empty cockpit control-panel hosting
- empty cockpit main-panel hosting
- details-pane and history hosting
- global state tab hosting
- state-pane precedence between active-tab state and global state tabs
- activation and deactivation calls
- layout persistence such as divider restoration

It must stay generic. It must not own feature or business logic.

### Contributions

A contribution is the feature-owned shell adapter for one UI entrypoint:

- a left-bar tab under `src/view/leftbartabs/<entry>/`
- a shell-discovered dropdown window under `src/view/dropdowns/<entry>/`
- a global state tab under `src/view/statetabs/<entry>/`

Responsibilities:

- provide passive shell registration metadata
- instantiate the co-located `*Binder` during `bind(ShellRuntimeContext)`
- return the Binder-created `ShellBinding`

Rules:

- contributions live under shell-discovered roots in `src/view/leftbartabs`,
  `src/view/statetabs`, and contributing `src/view/dropdowns` roots
- each contribution file defines one shell-registered UI entrypoint
- long-lived runtime state must not be stored in the shell host
- feature logic, presentation state, JavaFX panel behavior, and business logic
  stay out of the shell

### Binders

A Binder is the active-root runtime composition adapter for one left-bar tab,
state tab, or dropdown-capable unit.

Responsibilities:

- obtain shell-owned runtime capabilities and domain application services
  needed for composition
- instantiate the owning `PresentationModel`, optional `IntentHandler`,
  same-root feature-specific Views, and reusable `slotcontent` roles
- install bindings, listeners, and callback seams between those roles
- publish details/history entries through shell-owned Inspector APIs
- project bound content into allowed shell surfaces through `ShellBinding`
- own activation and deactivation lifecycle hooks

Rules:

- every active root under `src/view/leftbartabs`, `src/view/statetabs`, and
  `src/view/dropdowns` owns exactly one Binder
- Binder code may use shell public contracts and `ShellRuntimeContext`
- presentation state stays in `PresentationModels`, input interpretation stays
  in optional `IntentHandlers`, and JavaFX panel behavior stays in passive
  Views
- Binder-owned runtime callbacks and subscriptions are allowed; Binder-owned
  long-lived feature workflow state is not the target model

### `ShellRuntimeContext`

`ShellRuntimeContext` is the only shell-scoped runtime gateway available to UI
contributions and their Binders.

It exposes:

- `inspector()` for publishing details/history entries into the shell-owned
  details surface
- `services()` for looking up shell-owned root application services through
  `ServiceRegistry`
- `session(...)` for typed per-shell shared runtime sessions

Features must not bypass this gateway by importing `AppShell` or concrete shell
pane types.

## Fixed Cockpit Contract

Workbench surfaces use the following current Java API names:

- `TOP_BAR`
- `COCKPIT_CONTROLS`
- `COCKPIT_MAIN`
- `COCKPIT_DETAILS`
- `COCKPIT_STATE`

Ownership rules:

- `TOP_BAR` is shell-owned dropdown-window space fed only through top-bar
  registration contracts
- `COCKPIT_CONTROLS` is shell-owned empty control-panel space
- `COCKPIT_MAIN` is shell-owned empty primary work-panel space
- `COCKPIT_DETAILS` is shell-owned details/history space; features publish
  details through shell-owned details/history APIs, not direct slot content
- `COCKPIT_STATE` is shell-owned state-pane space; if the active left-bar tab
  claims it, the shell shows that active-tab state panel, otherwise registered
  global state tabs

Encounter and similar global runtime state are state tabs, not left-bar tabs.

## Allowed Feature-Facing Shell API Surface

- UI contributions may use shell public registration contracts,
  `ShellRuntimeContext`, and fixed surface-binding contracts needed to
  delegate to their Binder
- Binders may use shell public registration and binding contracts,
  `ShellRuntimeContext`, details/history publishing contracts, and fixed
  surface-binding contracts
- `PresentationModels` and `IntentHandlers` must not use shell APIs
- passive Views must not use shell APIs

## Dependency And Wiring Rules

Dependencies point inward:

- bootstrap depends on shell contracts and discovery mechanics
- shell depends on shell-owned contracts and generic runtime hosting
- contributions use allowed shell API surface and their co-located Binder
- Binders use allowed shell API surface, same-root `PresentationModels`,
  optional same-root `IntentHandlers`, feature-specific Views, reusable
  `slotcontent`, domain application-service roots, and explicit domain
  `published/**` carriers
- `PresentationModels` expose observable presentation state without knowing
  domain boundaries
- optional `IntentHandlers` interpret local input without knowing domain
  boundaries directly
- passive Views stay below `PresentationModels` and do not use shell or domain
  APIs

Forbidden directions and patterns:

- feature imports of `AppShell` or concrete shell pane classes
- shell ownership of feature or business logic
- shell imports of feature contributions, `PresentationModels`,
  `IntentHandlers`, or Views
- `PresentationModels` or `IntentHandlers` importing shell APIs
- passive Views importing shell APIs
- open-ended named-region composition as the default public extension model
- manual bootstrap feature registries as routine wiring
- long-lived feature runtime state in shell host classes
- feature-specific alternate wiring paths around `ShellRuntimeContext`

## Lifecycle And Realization

Shell realization must be safe for shell-managed caching and lazy first use.

Current state:

- `AppBootstrap` eagerly discovers and binds every `ShellContribution` during
  shell creation
- `AppShell` activates left-bar tabs through `navigateTo(...)`
- `ShellBinding.onActivate()` and `ShellBinding.onDeactivate()` provide the
  current activation lifecycle hooks

Target-compatible rule:

- the shell may later switch to lazy first-activation contribution realization
  and shell-owned caching without changing the public registration contract

## Current Code Mapping

- `shell/host/AppShell.java` is the workbench host root
- `shell/host/ShellWorkspacePane.java` hosts the controls, main, details, and
  state surfaces below `AppShell`
- `shell/host/StateTabPane.java` hosts global state tabs
- `shell/api/ShellRuntimeContext.java` is the shell-scoped runtime gateway
- `shell/api/ShellContribution.java` is the shell-facing UI contribution
  contract
- `shell/api/ShellBinding.java` is the bound slot-content and lifecycle
  contract
- `shell/api/ShellSlot.java` names the fixed cockpit surfaces

## Verification Notes

The canonical owner model, rule-status vocabulary, and blocking-task mapping
for these checks live in the
[Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1).
The current mechanical view-shell boundary coverage is recorded in
[Architecture Enforcement Coverage: View](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage-view.md:1).

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/shell-and-discovery.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
