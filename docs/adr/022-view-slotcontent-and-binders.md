Status: Accepted
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Decision to split active view roots from reusable
single-slot content and move runtime wiring into Binders.

# ADR 022: View Slotcontent And Binders

## Context

ADR 020 separated shell contribution adapters from ViewModels, but reusable
views still lived in a flat `src/view/views` package. That made reusable
surfaces such as the dungeon map own a display support model without a
slot-local ViewModel. Callers then duplicated projection support in their own
aggregate ViewModels.

The view layer also still used physical root names that described shell
implementation areas (`tabs`, `topbar`, `state`) rather than user-addressable
UI entrypoints and reusable cockpit slot content.

## Decision

SaltMarcher adopts active roots plus slotcontent:

- `src/view/featuretabs/<entry>/` owns left-sidebar feature tabs.
- `src/view/runtimetabs/<entry>/` owns global runtime state-panel tabs.
- `src/view/dropdowns/<entry>/` owns dropdown-capable UI units. A
  `*Contribution` is optional there and exists only when the shell should
  discover the dropdown directly.
- `src/view/slotcontent/<slot>/<entry>/` owns reusable or standalone content
  for exactly one cockpit slot.

`*Contribution` is now shell-discovery only. It exposes registration metadata
and delegates `bind(ShellRuntimeContext)` to the co-located `*Binder`.

Every active root has exactly one `*Binder`. The Binder owns runtime service
lookup, View/ViewModel construction, slotcontent construction, emitter wiring,
slot binding, details publication, and `ShellBinding` lifecycle hooks.

Active-root `*ViewModel` classes own aggregate presentation state and may call
domain application services. Slotcontent `*ViewModel` classes own slot-local
projection state and may interpret domain `published` read carriers, but they
do not call application services.

## Consequences

- Generic slot views can carry their own projection ViewModels instead of
  forcing every caller to duplicate support logic.
- Shell discovery remains generic and scans only active roots for
  `*Contribution` classes.
- Detail content moves into `slotcontent/details`; it remains published
  through shell-owned details/history APIs rather than bootstrap discovery.
- Quality gates must distinguish active roots, mandatory Binders, optional
  dropdown contributions, and slotcontent roots.

## References

- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/view-mvvm.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/020-view-contributions-and-viewmodels.md:1)
