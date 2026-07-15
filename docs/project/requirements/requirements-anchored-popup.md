Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Shared JavaFX anchored popup host under
`src/view/slotcontent/primitives/popup/`.

# Anchored Popup

## Component Purpose

`AnchoredPopupView` is a reusable slotcontent primitive with the strict triad
shape:

- `AnchoredPopupView`
- `AnchoredPopupViewInputEvent`
- `AnchoredPopupContentModel`

The primitive centralizes JavaFX `Popup` host mechanics for project-owned
popup surfaces. `AnchoredPopupContentModel` owns popup visibility, placement,
offset/width, and focus-request state. The view owns only the JavaFX popup
host and emits technical shown/hidden input events.

## Rules

- Owning feature Views still build popup content and wire same-root translation
  from popup input events.
- Use below placement for small inline popups and trailing placement for top-bar
  dropdowns aligned to the trigger's right edge.
- Use `DialogSurfaceView` as content for form-like popups with headers and
  fixed actions.
- Feature or reusable business actions must not be expressed as direct popup
  callback APIs on the primitive itself.

## Acceptance Criteria

- `AnchoredPopupView` centralizes popup-host mechanics instead of repeating
  anchoring, hide-on-Escape, auto-hide, and focus-return logic in feature Views
- owning feature Views still own popup content construction and same-root event
  translation
- small inline popups use below placement, while trailing top-bar popups use
  trailing placement
- dialog-like popup content composes `DialogSurfaceView` instead of duplicating
  header and footer layout in each caller
- popup visibility and placement state live in `AnchoredPopupContentModel`

## References

- [Dialog Surface](requirements-dialog-surface.md)
- [Dropdown Helper Slotcontent](requirements-dropdown-popup.md)
