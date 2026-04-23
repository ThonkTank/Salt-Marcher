Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Shared JavaFX anchored popup host.

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
