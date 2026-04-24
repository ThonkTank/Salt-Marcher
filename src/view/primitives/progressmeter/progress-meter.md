Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Reusable passive JavaFX progress-meter primitive under
`src/view/primitives`.

# Progress Meter

`ProgressMeterView` renders a compact track, filled region, centered text
overlay, optional tooltip, and optional amount popup in one passive JavaFX
control. Active roots provide already projected text, fraction, accessible
text, sizing style, fill style, tooltip text, initial amount, and amount
actions.

The primitive owns only JavaFX rendering and widget-local layout. It does not
calculate HP, XP, thresholds, labels, readiness, or business state. Popup
actions use the shared anchored-popup primitive and emit signed or unsigned
amounts through callbacks owned by the active root.
