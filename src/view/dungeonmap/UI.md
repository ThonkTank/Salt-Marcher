Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Shared dungeon-map component ownership, extension slots, and
exported API boundary for `src/view/dungeonmap/**`.

# Dungeonmap UI

## Purpose

`dungeonmap` owns the reusable dungeon-map component used by the editor and
travel tabs. It combines the generic `mapcanvas` foundation with dungeon
render mapping, floor and overlay controls, selection, and named extension
slots for tab-specific controls and canvas content.

## Ownership

- `api/` owns reusable contracts consumed by editor/travel roots, including
  selection payloads, shared controls state, and the component-facing dungeon
  map API surface.
- `View/` owns JavaFX controls, inspector content, runtime-session facades,
  and slot/layer host nodes.
- `ViewModel/` owns reusable presentation state and actions for the shared
  dungeon-map component.
- `ViewModel/internal/` is migration debt for orchestration logic that should
  settle into public API contracts, component view models, or domain services
  as the shared component is completed.

## Extension Slots

- The public cross-component boundary is `src.view.dungeonmap.api.*`.
- Consumers must not import `src.view.dungeonmap.View.*` or
  `src.view.dungeonmap.ViewModel.*`.
- Controls expose named extension slots for map-row actions, mode controls,
  secondary actions, and footer content.
- Canvas extensions are routed through `mapcanvas` layers so the generic
  canvas remains the owner of pan/zoom and coordinate transforms.
- Editor supplies tool controls and authoring actions through the control
  slots, plus preview/authoring overlays through the tool overlay.
- Travel supplies runtime, party, and focus controls through the control slots,
  plus party/focus overlays through actor or selection layers.
