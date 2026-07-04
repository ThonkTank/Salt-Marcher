Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Shell responsibilities, fixed cockpit surfaces, shell API
surface, lifecycle boundaries, and forbidden shell-owned feature behavior.

# Shell Layer Standard

## Goal

SaltMarcher uses a passive cockpit shell.

The shell owns hosting, navigation, lifecycle, details/history, state-pane
arbitration, and shell-scoped runtime services. It does not own feature logic,
business behavior, or presentation-state mutation.

## Shell Responsibilities

### `AppShell`

`AppShell` is the shell host root. It owns:

- left-bar navigation and contribution activation
- top-bar dropdown window hosting
- empty cockpit controls and main-panel hosting
- details/history hosting
- global state-tab hosting
- state-pane precedence between active-tab state and global state tabs
- activation, deactivation, and layout persistence

### `ShellRuntimeContext`

`ShellRuntimeContext` is the only shell-scoped runtime gateway available to UI
contributions and their Binders. It exposes:

- `inspector()` for details/history publication
- `services()` for root application-service lookup through `ServiceRegistry`
- `session(...)` for typed shell-scoped runtime sessions

Features must not bypass it by importing `AppShell` or concrete shell panes.

## Contribution And Binder Boundaries

- a `*Contribution` is the shell-facing registration adapter for one left-bar
  tab, state tab, or top-bar dropdown window
- a `*Contribution` owns passive registration metadata only and delegates
  binding to its co-located `*Binder`
- a `*Binder` is the active-root runtime composition adapter for one shell
  entrypoint
- a `*Binder` may use shell public contracts, `ShellRuntimeContext`, and
  shell binding surfaces, but `ContributionModel`, `ContentModel`,
  `IntentHandler`, and `View` must not use shell APIs

## Fixed Cockpit Contract

Workbench surfaces use these Java API names:

- `TOP_BAR`
- `COCKPIT_CONTROLS`
- `COCKPIT_MAIN`
- `COCKPIT_DETAILS`
- `COCKPIT_STATE`

Ownership rules:

- `TOP_BAR` is shell-owned dropdown-window space
- `COCKPIT_CONTROLS` is shell-owned control-panel space
- `COCKPIT_MAIN` is shell-owned primary work-panel space
- `COCKPIT_DETAILS` is shell-owned details/history space
- `COCKPIT_STATE` is shell-owned state-pane space with shell-owned precedence

## Dependency Rules

- shell depends only on shell-owned contracts and hosting code
- `ShellControls` owns reusable shell-side composition for stacked cockpit
  control-slot content
- shell must not import feature contributions, models, IntentHandlers, or
  Views
- feature code must not import `AppShell` or concrete shell pane classes
- long-lived feature state must not be stored in shell host classes
- feature-specific alternate runtime wiring around `ShellRuntimeContext` is
  forbidden

## Lifecycle Rules

- shell activation happens through registered `ShellBinding` instances
- `ShellBinding.onActivate()` and `ShellBinding.onDeactivate()` are the active
  lifecycle hooks
- the shell may later switch to lazy first-activation realization and
  shell-owned caching without changing the public registration contract

## References

- [Architecture Overview](docs/project/architecture/overview.md:1)
- [Layering Architecture Standard](docs/project/architecture/patterns/layering-architecture.md:1)
- [Bootstrap Standard](docs/project/architecture/patterns/bootstrap.md:1)
- [View Layer Standard](docs/project/architecture/patterns/view-layer.md:1)
- [Shell Layer Enforcement](docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell AppShell Enforcement](docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [Shell RuntimeContext Enforcement](docs/project/architecture/enforcement/shell-runtime-context-enforcement.md:1)
