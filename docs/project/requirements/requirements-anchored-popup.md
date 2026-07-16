Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Observable behavior of the shared JavaFX anchored popup host.

# Anchored Popup

## Component Purpose

The anchored popup centralizes JavaFX popup hosting, visibility, placement,
offset, width, focus restoration, auto-hide, and Escape handling.

## Rules

- Owning features build popup content and handle feature actions.
- Use below placement for small inline popups and trailing placement for top-bar
  dropdowns aligned to the trigger's right edge.
- Use the shared dialog surface for form-like popups with headers and fixed
  actions.
- The popup host must not own feature or business actions.

## Acceptance Criteria

- the shared host centralizes popup mechanics instead of repeating
  anchoring, hide-on-Escape, auto-hide, and focus-return logic in feature Views
- owning features retain popup content and action ownership
- small inline popups use below placement, while trailing top-bar popups use
  trailing placement
- dialog-like popup content uses the shared dialog surface instead of duplicating
  header and footer layout in each caller
- popup visibility and placement remain host state, not feature truth

## References

- [Dialog Surface](requirements-dialog-surface.md)
- [Reusable Top-Bar Dropdown Popup](requirements-dropdown-popup.md)
