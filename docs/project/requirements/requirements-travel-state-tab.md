Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
Source of Truth: Travel global state-tab placeholder structure and visible
runtime travel context.

# Reise-State-Tab UI

## Component Purpose

The Reise-State-Tab restores the original lower-right tab labeled `Reise`
next to the Encounter state tab. It is a global runtime state tab,
independent from the navigable Travel left-bar tab.

Current state:

- The tab shows the original static travel placeholder context when no approved
  feature-owned live readback is registered for the active party.
- Hex travel-state readback is implemented. The Hex behavior is owned by
  `docs/hex/requirements/requirements-hex-travel-state.md:1`
  and replaces the placeholder when the party token points at a valid Hex tile.
- Other live travel state remains owned by the Travel left-bar tab and later
  dungeon travel runtime work.

Target state:

- When a feature-owned travel context publishes an approved live runtime
  readback for the active party, the `Reise` state tab shows that compact
  runtime context instead of the static placeholder.
- Feature-owned travel contexts keep their behavior requirements in their
  feature requirement docs; this project-wide document owns only the shared
  global state-tab shell behavior and the placeholder-to-live-context
  transition rule.

## Visible Surfaces

- `COCKPIT_STATE` contains the content of the runtime tab labeled `Reise` when
  that tab is selected in the global state-tab strip.
- The visible placeholder shows a location row, the runtime `Reisend` status
  badge, weather, time-of-day, pace, and the interaction hint.
- When a live travel readback is available, the same compact state-tab surface
  shows feature-owned travel context while staying distinct from the
  interactive travel workspace.

## Interactions

- Selecting the runtime tab labeled `Reise` switches the global state pane
  from Encounter content to the travel placeholder.
- The placeholder exposes no commands in this parity step.
- The live compact state-tab surface remains read-mostly. Travel movement and
  editing commands belong in the owning interactive travel or editor surface.

## Visible States

- Selected: the lower-right state pane shows the placeholder travel context.
- Not selected: the global state pane continues to show the currently selected
  state tab instead of the travel placeholder.
- Placeholder only: no approved live readback is available, so the static
  travel context remains visible.
- Live context: the lower-right state pane shows compact readback from the
  owning travel feature and keeps movement commands out of the state tab.

## Acceptance Criteria

- the Reise-State-Tab is a global runtime state-tab surface independent from
  the navigable Travel left-bar tab
- selecting the runtime tab labeled `Reise` swaps the state pane from
  Encounter content to the travel placeholder content
- the placeholder and live compact state remain command-free in this surface
- non-Hex live travel state continues to belong to the Travel left-bar tab and
  later dungeon-travel runtime work rather than to this placeholder surface
- a feature-owned live travel context can replace the placeholder only through
  an approved readback surface and without adding movement commands to this
  state tab

## References

- [Encounter Runtime State UI](docs/encounter/requirements/requirements-encounter-state-tab.md:1)
- [Hex Travel State Requirements](docs/hex/requirements/requirements-hex-travel-state.md:1)
