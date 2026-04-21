Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Shared top-bar dropdown helper slotcontent.

# Dropdown Helper Slotcontent

## Component Purpose

The dropdown helper slotcontent centralizes repeated top-bar popup mechanics
that are reusable across shell dropdown roots.

Current state:

- `DropdownPopupView` shows or hides an already-owned JavaFX `Popup`.
- The owning dropdown root still owns trigger text, content, callbacks, service
  lookup, and popup content construction.

## Visible Surfaces

- No standalone shell surface is registered by this slotcontent unit.
- Top-bar dropdown Views use the popup helper to align popups to the trailing
  edge of their trigger button.

## Interactions

- If the popup is open, invoking the helper hides it.
- If the popup is closed, invoking the helper runs the owner's open callback,
  lays out the trigger button, and shows the popup below the trigger.
