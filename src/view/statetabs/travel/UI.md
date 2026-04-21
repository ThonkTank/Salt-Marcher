Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Travel global state-tab placeholder structure and visible
runtime travel context.

# Travel State Tab UI

## Component Purpose

The Travel state tab restores the original lower-right `Reise` scene tab next
to the Encounter state tab. It is a global runtime state tab, independent from
the navigable Travel left-bar tab.

Current state:

- The tab shows the original static travel placeholder context.
- Live travel state remains owned by the Travel left-bar tab and dungeon travel
  runtime work.

## Visible Surfaces

- `COCKPIT_STATE` contains the `Reise` tab content when selected in the global
  state-tab strip.
- The visible placeholder shows a location row, `Reisend` status badge,
  weather, time-of-day, pace, and the interaction hint.

## Interactions

- Selecting `Reise` switches the global state pane from Encounter content to
  the travel placeholder.
- The placeholder exposes no commands in this parity step.
