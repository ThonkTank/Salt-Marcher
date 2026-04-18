Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-18
Source of Truth: Private shared-map view ownership and MVVM role boundaries for
the reusable canvas workspace under `src/view/mapshared/**`.

# Mapshared UI

## Purpose

`mapshared` owns the reusable canvas workspace that editor- and travel-facing
components render inside their own screens.

## Ownership

- `View/` owns the JavaFX canvas, camera interaction, hit testing, and render
  helpers.
- `ViewModel/` owns the reusable render payloads and camera/view data that the
  canvas consumes.
- The current repo still carries some projection helpers in `interactor/` as
  migration debt. Those helpers do not define a public reuse boundary and
  should continue moving toward canonical MVVM buckets.

## Boundary Rules

- `mapshared` is private shared view infrastructure, not a public cross-slice
  API.
- Foreign components may reuse the workspace only through direct composition
  inside the owning shared runtime code, not by importing a public
  `mapshared/api` surface.
