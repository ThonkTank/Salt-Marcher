Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Shared map-canvas component ownership, extension layers, and
MVVM role boundaries for `src/view/mapcanvas/**`.

# Mapcanvas UI

## Purpose

`mapcanvas` owns the reusable map canvas foundation used by dungeon-facing
views. It renders grid, cells, edges, labels, selection, and camera state while
owning the pan/zoom/layout transforms for all canvas-managed overlays.

## Ownership

- `api/` owns the reusable render model, viewport, topology, layers, handle,
  and callback-facing contracts consumed by other view components.
- `View/` owns the JavaFX canvas, camera interaction, hit testing, layer host
  layout, and render helpers.
- `ViewModel/` is reserved for reusable canvas presentation state when the
  component needs state that is independent of JavaFX scene graph nodes.

## Extension Layers

- The public cross-component boundary is `src.view.mapcanvas.api.*`.
- Consumers may provide layer content only through the handle/API, not by
  importing `View/` implementation classes.
- Fixed layers are below-grid, below-content, above-content, selection overlay,
  actor overlay, tool overlay, and HUD overlay.
- Travel-owned party tokens belong in the actor overlay.
- Editor-owned preview and authoring markers belong in the tool overlay.
