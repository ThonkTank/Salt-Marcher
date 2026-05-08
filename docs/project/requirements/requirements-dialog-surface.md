Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Shared JavaFX dialog layout primitive under
`src/view/slotcontent/primitives/dialog/`.

# Dialog Surface

## Component Purpose

`DialogSurfaceView` is a reusable slotcontent primitive with the strict triad
shape:

- `DialogSurfaceView`
- `DialogSurfaceViewInputEvent`
- `DialogSurfaceContentModel`

The primitive centralizes dialog-like layout for embedded state-tab surfaces
and popup content. JavaFX section composition stays in the owning surface,
while `DialogSurfaceContentModel` owns layout state such as header visibility,
footer visibility, and body scroll policy.

## Rules

- Use `DialogSurfaceContentModel.BodyPolicy.SCROLL` when the whole body may
  exceed the available height.
- Keep action buttons in the footer so navigation remains visible.
- Do not put feature services, domain objects, or command decisions in this
  primitive.
- Use an `AnchoredPopupView` host when a dialog surface must appear in a JavaFX
  popup.
- The primitive must not own feature callbacks or domain-facing behavior.

## Acceptance Criteria

- `DialogSurfaceView` centralizes dialog-like layout instead of duplicating
  header, body, and fixed-footer structure in each embedded state or popup
  surface
- large dialog bodies use `DialogSurfaceContentModel.BodyPolicy.SCROLL` so the
  footer actions remain visible
- feature services, domain objects, and command decisions stay outside this
  primitive
- the primitive exposes only the strict triad surface and keeps layout state in
  `DialogSurfaceContentModel`
- popup-hosted dialog content composes `AnchoredPopupView` rather than opening
  raw JavaFX popups directly from feature layout code

## References

- [Anchored Popup](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/requirements/requirements-anchored-popup.md:1)
- [Travel State Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/requirements/requirements-travel-state-tab.md:1)
