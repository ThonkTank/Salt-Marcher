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
  helpers, including the current workspace-session facade.
- `ViewModel/` owns the reusable render payloads and camera/view data that the
  canvas consumes.

## Boundary Status

- The former `api/` and `assembly/` buckets have been removed.
- Current dungeon shared code still reuses the workspace session and render
  payloads directly during the first MVVM-topology migration pass.
- A later pass should either absorb this workspace into the owning dungeon
  view component or define a target-approved shared-view boundary.
