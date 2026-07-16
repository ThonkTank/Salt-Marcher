Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Observable behavior of the reusable JavaFX progress meter.

# Progress Meter

## Component Purpose

The reusable meter renders a compact track, filled region, centered text overlay,
optional tooltip, and optional amount popup in one JavaFX control.

The meter presents values supplied by its owning feature and keeps only local
popup interaction state such as the current amount draft. It does not calculate
HP, XP, thresholds, labels, readiness, or other business state.

## Visible Surfaces

- The control shows a track, a filled region, centered text overlay, and an
  optional tooltip.
- When amount actions are enabled, the control can open a compact popup for
  signed or unsigned adjustments.

## Interactions

- Owning features provide projected text, fraction, accessible text, sizing
  style, fill style, tooltip text, initial amount, and action metadata through
  the meter's public presentation input.
- Popup-based amount actions report amount snapshots to the owning feature
  instead of mutating feature state.
- The meter may appear anywhere a reusable progress display is needed without
  becoming a separate navigation destination.

## Visible States

- No popup: the control shows only the passive meter surface.
- Tooltip available: the control exposes projected tooltip text.
- Amount popup available: the control can open the compact adjustment popup.
- Disabled action state: the control renders the passive meter without
  mutating any owning feature state directly.

## Acceptance Criteria

- the progress meter remains passive and does not own
  business calculations for HP, XP, thresholds, or readiness
- owning features supply all projected business meaning, while the meter owns
  only rendering and widget-local layout
- amount actions report snapshots to the owning feature instead of mutating
  domain state directly inside the meter
- popup draft and availability remain local interaction state and do not become
  feature truth
- popup-based amount editing follows the shared anchored-popup behavior for
  placement, dismissal, and focus return

## References

- [Anchored Popup](requirements-anchored-popup.md)
