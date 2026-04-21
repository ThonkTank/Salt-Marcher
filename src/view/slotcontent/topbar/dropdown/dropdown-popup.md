Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Shared top-bar dropdown popup positioning helper.

# Dropdown Popup Slotcontent

## Component Purpose

The dropdown popup slotcontent helper centralizes the repeated top-bar popup
toggle and trailing-edge positioning behavior used by dropdown Views.

Current state:

- The helper shows or hides an already-owned JavaFX `Popup`.
- The owning dropdown View still owns trigger text, content, callbacks, and
  popup content construction.

## Visible Surfaces

- No standalone shell surface is registered by this slotcontent unit.
- Top-bar dropdown Views use it to align popups to the trailing edge of their
  trigger button.

## Interactions

- If the popup is open, invoking the helper hides it.
- If the popup is closed, invoking the helper runs the owner's open callback,
  lays out the trigger button, and shows the popup below the trigger.
