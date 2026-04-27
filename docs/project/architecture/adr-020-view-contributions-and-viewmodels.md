# ADR 020: View Contributions And ViewModels

- Status: Superseded by [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-022-view-slotcontent-and-binders.md:1)
- Date: 2026-04-20

## Context

ADR 019 moved the active view target away from component-local `View/`,
`ViewModel/`, `assembly/`, and `*ViewContribution` buckets, but it overloaded
the view-model role with shell discovery, ApplicationService lookup,
ViewModel state, view instantiation, and shell slot binding.

That made the type named ViewModel act as a shell/workbench adapter rather than
a conventional MVVM ViewModel.

## Decision

SaltMarcher separates shell contribution adapters from ViewModels.

- `src/view/leftbartabs/<tab>/*Contribution.java`,
  `src/view/topbar/<window>/*Contribution.java`, and
  `src/view/statetabs/<state>/*Contribution.java` are discovered by bootstrap and
  implement `shell.api.ShellContribution`.
- Co-located `*ViewModel.java` files own UI state, actions, commands,
  enablement, validation, loading, error, retry, and stale-state handling.
- Co-located `*View.java` files own passive JavaFX controls, layout, rendering,
  cells, dialogs, and widget-local state.
- `src/view/details/<entry>/` may contain detail ViewModels and views, but it
  is not a bootstrap-discovered shell contribution root.
- `src/view/views/` is reserved for generic reusable JavaFX views or base
  components used by multiple contribution folders.
- Encounter is a `src/view/statetabs/<state>` state tab, not a
  `src/view/leftbartabs/<tab>` left-bar tab. It is visible in the global state pane
  only when the active left-bar tab does not claim `COCKPIT_STATE`.

The public shell-facing contribution contract is named `ShellContribution`.
`ShellContributionSpec`, `ShellBinding`, `ShellRuntimeContext`, and fixed slot
contracts remain shell-owned API.

## Consequences

- Adding a tab, top-bar window, or runtime state-pane tab does not require a
  `shell/` or feature-specific `bootstrap/` edit.
- ViewModels no longer import shell APIs or concrete view classes.
- Passive views no longer import shell, domain, data, ApplicationService,
  Contribution, or ViewModel types.
- Architecture checks must enforce the contribution roots, co-located
  ViewModel independence, passive view dependency boundary, and the details
  non-discovery rule.

## Related Documents

- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-mvvm.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/shell-and-discovery.md:1)
- [ADR 019: Shell Cockpit MVVM Contribution View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-019-shell-cockpit-tab-model-view-layer.md:1)
