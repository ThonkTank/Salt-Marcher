Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Reusable passive JavaFX progress-meter primitive under
`src/view/slotcontent/primitives/progressmeter/`.

# Progress Meter

## Component Purpose

`ProgressMeterView` is a reusable slotcontent primitive with the strict triad
shape:

- `ProgressMeterView`
- `ProgressMeterViewInputEvent`
- `ProgressMeterContentModel`

The primitive renders a compact track, filled region, centered text overlay,
optional tooltip, and optional amount popup in one passive JavaFX control.

The primitive owns only JavaFX rendering plus primitive-local popup
presentation state such as the current amount draft. It does not calculate HP,
XP, thresholds, labels, readiness, or business state.

## Visible Surfaces

- The control shows a track, a filled region, centered text overlay, and an
  optional tooltip.
- When amount actions are enabled, the control can open a compact popup for
  signed or unsigned adjustments.

## Interactions

- Active roots provide projected text, fraction, accessible text, sizing
  style, fill style, tooltip text, initial amount, and action metadata through
  `ProgressMeterContentModel`.
- Popup-based amount actions emit amount snapshots through
  `ProgressMeterViewInputEvent` instead of direct feature callbacks.
- The primitive may be composed anywhere a passive reusable progress meter is
  needed without registering a shell entrypoint.

## Visible States

- No popup: the control shows only the passive meter surface.
- Tooltip available: the control exposes projected tooltip text.
- Amount popup available: the control can open the compact adjustment popup.
- Disabled action state: the control renders the passive meter without
  mutating any owning feature state directly.

## Acceptance Criteria

- `ProgressMeterView` remains a passive reusable primitive and does not own
  business calculations for HP, XP, thresholds, or readiness
- active roots supply all projected business meaning, while the primitive owns
  only rendering and widget-local layout
- amount actions emit `ProgressMeterViewInputEvent` snapshots to the owning
  surface instead of mutating domain state directly inside the primitive
- popup draft state and popup availability live in `ProgressMeterContentModel`
- popup-based amount editing reuses the shared anchored-popup surface instead
  of introducing a second popup-host mechanism

## References

- [Anchored Popup](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/requirements/requirements-anchored-popup.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
