Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Shared JavaFX anchored popup host under src/view/primitives.

# Anchored Popup

## Component Purpose

`AnchoredPopupView` centralizes JavaFX `Popup` host mechanics for project-owned
popup surfaces. It owns anchoring, hide-on-Escape, auto-hide, and focus return.

## Rules

- Owning feature Views still build popup content and wire technical callbacks.
- Use `showBelow` for small inline popups and `showTrailing` for top-bar
  dropdowns aligned to the trigger's right edge.
- Use `DialogSurfaceView` as content for form-like popups with headers and
  fixed actions.

## Acceptance Criteria

- `AnchoredPopupView` centralizes popup-host mechanics instead of repeating
  anchoring, hide-on-Escape, auto-hide, and focus-return logic in feature Views
- owning feature Views still own popup content construction and feature
  callbacks
- small inline popups use `showBelow`, while trailing top-bar popups use
  `showTrailing`
- dialog-like popup content composes `DialogSurfaceView` instead of duplicating
  header and footer layout in each caller

## References

- [Dialog Surface](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/requirements/requirements-dialog-surface.md:1)
- [Dropdown Helper Slotcontent](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/requirements/requirements-dropdown-popup.md:1)
