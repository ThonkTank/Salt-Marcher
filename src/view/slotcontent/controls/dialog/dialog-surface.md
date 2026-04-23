Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Shared JavaFX dialog layout primitive.

# Dialog Surface

## Component Purpose

`DialogSurfaceView` centralizes dialog-like layout for embedded state-tab
surfaces and popup content. It owns only layout: optional header content, body
content, and a fixed footer action row.

## Rules

- Use `BodyPolicy.SCROLL` when the whole body may exceed the available height.
- Keep action buttons in the footer so navigation remains visible.
- Do not put feature services, domain objects, or command decisions in this
  primitive.
- Use an `AnchoredPopupView` host when a dialog surface must appear in a JavaFX
  popup.
