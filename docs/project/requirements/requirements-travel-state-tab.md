Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Travel global state-tab placeholder structure and visible
runtime travel context.

# Reise-State-Tab UI

## Component Purpose

The Reise-State-Tab restores the original lower-right tab labeled `Reise`
next to the Encounter state tab. It is a global runtime state tab,
independent from the navigable Travel left-bar tab.

Current state:

- The tab shows the original static travel placeholder context.
- Live travel state remains owned by the Travel left-bar tab and dungeon travel
  runtime work.

## Visible Surfaces

- `COCKPIT_STATE` contains the content of the runtime tab labeled `Reise` when
  that tab is selected in the global state-tab strip.
- The visible placeholder shows a location row, the runtime `Reisend` status
  badge,
  weather, time-of-day, pace, and the interaction hint.

## Interactions

- Selecting the runtime tab labeled `Reise` switches the global state pane
  from Encounter content to the travel placeholder.
- The placeholder exposes no commands in this parity step.

## Visible States

- Selected: the lower-right state pane shows the placeholder travel context.
- Not selected: the global state pane continues to show the currently selected
  state tab instead of the travel placeholder.
- Placeholder only: live travel mutations remain absent from this parity-step
  surface.

## Acceptance Criteria

- the Reise-State-Tab is a global runtime state-tab surface independent from
  the navigable Travel left-bar tab
- selecting the runtime tab labeled `Reise` swaps the state pane from
  Encounter content to the travel placeholder content
- the placeholder remains command-free in this parity step
- live travel state continues to belong to the Travel left-bar tab and later
  dungeon-travel runtime work rather than to this placeholder surface

## References

- [Encounter Runtime State UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/requirements/requirements-encounter-state-tab.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
