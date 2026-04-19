Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: Shared-map view ownership and MVVM role boundaries for the
reusable canvas workspace under `src/view/mapshared/**`.

# Mapshared UI

## Purpose

`mapshared` owns the reusable canvas workspace that editor- and travel-facing
components render inside their own screens.

## Ownership

- `View/` owns the JavaFX canvas, camera interaction, hit testing, and render
  helpers.
- `ViewModel/` owns the reusable render payloads and camera/view data that the
  canvas consumes.
- `assembly/` owns component construction and adapts the workspace into the
  shell-facing shared view surface.
- `api/` owns the intentional public workspace boundary consumed by other view
  components.

## Boundary Rules

- Foreign components may reuse the workspace only through
  `src/view/mapshared/api/**`.
- Private `View/`, `ViewModel/`, and `assembly/` types remain internal to
  `mapshared`.
