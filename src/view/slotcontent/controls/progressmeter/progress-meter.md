Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Reusable passive JavaFX progress-meter primitive for
`src/view/**` surfaces that need an overlaid progress track.

# Progress Meter

`ProgressMeterView` renders a compact track, filled region, and centered text
overlay in one passive JavaFX control. Active roots provide already projected
text, fraction, accessible text, sizing style, and fill style.

The primitive owns only JavaFX rendering and widget-local layout. It does not
calculate HP, XP, thresholds, labels, readiness, or business state.
