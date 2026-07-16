Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Observable behavior of the reusable top-bar dropdown popup.

# Reusable Top-Bar Dropdown Popup

## Component Purpose

The dropdown popup centralizes reusable top-bar trigger, accessibility,
anchoring, and open/close behavior.

Current state:

- the popup aligns to the trailing edge of its trigger
- the owning feature supplies trigger text, accessibility text, tooltip,
  content, width, and action handling

## Visible Surfaces

- The popup does not add a standalone shell surface.
- Top-bar dropdowns reuse the popup behavior and align to the trailing edge of
  their trigger button.

## Interactions

- If the popup is open, invoking the trigger closes it.
- If the popup is closed, invoking the trigger opens the trailing popup and
  informs the owning feature.

## Acceptance Criteria

- the dropdown popup behavior remains reusable by owning top-bar dropdowns
  without adding a standalone shell surface
- invoking the trigger toggles popup visibility for the owning dropdown root
- each owning dropdown shows its supplied popup content and exposes its supplied
  feature actions
- the popup aligns to the trailing edge of its trigger

## References

- [Anchored Popup](requirements-anchored-popup.md)
