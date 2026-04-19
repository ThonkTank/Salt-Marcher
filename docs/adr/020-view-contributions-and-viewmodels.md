Status: Accepted
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Decision to split shell/workbench contribution adapters from
MVVM ViewModels in the view layer.

# ADR 020: View Contributions And ViewModels

## Context

ADR 019 moved the active view target away from component-local `View/`,
`ViewModel/`, `assembly/`, and `*ViewContribution` buckets, but it overloaded
the view-model role with shell discovery, ApplicationService lookup,
ViewModel state, view instantiation, and shell slot binding.

That made the type named ViewModel act as a shell/workbench adapter rather than
a conventional MVVM ViewModel.

## Decision

SaltMarcher separates shell contribution adapters from ViewModels.

- `src/view/tabs/<tab>/*Contribution.java`,
  `src/view/topbar/<window>/*Contribution.java`, and
  `src/view/state/<state>/*Contribution.java` are discovered by bootstrap and
  implement `shell.api.ShellContribution`.
- Co-located `*ViewModel.java` files own UI state, actions, commands,
  enablement, validation, loading, error, retry, and stale-state handling.
- Co-located `*View.java` files own passive JavaFX controls, layout, rendering,
  cells, dialogs, and widget-local state.
- `src/view/details/<entry>/` may contain detail ViewModels and views, but it
  is not a bootstrap-discovered shell contribution root.
- `src/view/views/` is reserved for generic reusable JavaFX views or base
  components used by multiple contribution folders.
- Encounter is a `src/view/state/<state>` runtime state-panel tab, not a
  `src/view/tabs/<tab>` left-bar tab. It is visible in the global state pane
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

## References

- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [ADR 019: Shell Cockpit MVVM Contribution View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
