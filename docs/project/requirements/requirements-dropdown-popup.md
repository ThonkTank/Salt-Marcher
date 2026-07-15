Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Shared top-bar dropdown slotcontent under
`src/view/slotcontent/topbar/dropdown/`.

# Dropdown Helper Slotcontent

## Component Purpose

The dropdown popup slotcontent is a reusable strict triad unit:

- `DropdownPopupView`
- `DropdownPopupViewInputEvent`
- `DropdownPopupContentModel`

It centralizes repeated top-bar trigger and popup mechanics that are reusable
across shell dropdown roots.

Current state:

- `DropdownPopupView` delegates trailing-edge popup hosting to
  `AnchoredPopupView`.
- `DropdownPopupContentModel` owns trigger text, accessibility text, popup
  width, tooltip text, mnemonic mode, and open state.
- The owning dropdown root still owns popup content construction, service
  lookup, and translation from dropdown input events into root-local intent.

## Visible Surfaces

- No standalone shell surface is registered by this slotcontent unit.
- Top-bar dropdown Views use the popup slotcontent to align popups to the
  trailing edge of their trigger button.

## Interactions

- If the popup is open, invoking the trigger closes it.
- If the popup is closed, invoking the trigger opens the trailing popup and
  emits a `DropdownPopupViewInputEvent` snapshot so the owning root can react.

## Acceptance Criteria

- the dropdown popup unit remains reusable slotcontent and does not register a
  standalone shell surface
- invoking the trigger toggles popup visibility for the owning dropdown root
- the unit owns trigger/popup mechanics and alignment, while popup content
  construction and service lookup stay in the owning dropdown root
- dropdown open state and trigger presentation live in
  `DropdownPopupContentModel`
- trailing-edge popup alignment is delegated through the shared anchored-popup
  primitive

## References

- [Anchored Popup](docs/project/requirements/requirements-anchored-popup.md:1)
