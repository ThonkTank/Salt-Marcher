Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Shared top-bar dropdown helper slotcontent.

# Dropdown Helper Slotcontent

## Component Purpose

The dropdown helper slotcontent centralizes repeated top-bar popup mechanics
that are reusable across shell dropdown roots.

Current state:

- `DropdownPopupView` delegates trailing-edge alignment to `AnchoredPopupView`.
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

## Acceptance Criteria

- the dropdown popup helper remains reusable slotcontent and does not register
  a standalone shell surface
- invoking the helper toggles popup visibility for the owning dropdown root
- the helper owns only popup mechanics and alignment, while trigger text,
  content construction, and service lookup stay in the owning dropdown root
- trailing-edge popup alignment is delegated through the shared anchored-popup
  primitive

## References

- [Anchored Popup](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/requirements/requirements-anchored-popup.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
