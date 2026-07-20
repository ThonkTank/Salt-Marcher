Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Shared global travel state-tab behavior and visible runtime
travel context.

# Reise-State-Tab UI

## Component Purpose

The Reise-State-Tab is the lower-right global runtime tab labeled `Reise` next
to the Encounter state tab. It is independent from navigable interactive
travel workspaces.

- One feature-neutral Travel capability consumes Party position plus approved
  Dungeon and Hex readbacks, selects the matching live context, and owns the
  single global `Reise` contribution.
- Feature-owned travel contexts keep their behavior requirements in their
  feature requirement docs; this project-wide document owns only the shared
  global state-tab shell behavior and the no-context-to-live-context selection
  rule.

## Visible Surfaces

- `COCKPIT_STATE` contains the content of the runtime tab labeled `Reise` when
  that tab is selected in the global state-tab strip.
- The explicit no-context state shows that no matching live travel context is
  currently available.
- When a live travel readback is available, the same compact state-tab surface
  shows feature-owned travel context while staying distinct from the
  interactive travel workspace.

## Interactions

- Selecting the runtime tab labeled `Reise` switches the global state pane
  from Encounter content to the selected travel context or explicit no-context
  state.
- The live compact state-tab surface remains read-mostly. Travel movement and
  editing commands belong in the owning interactive travel or editor surface.

## Visible States

- Selected: the lower-right state pane shows the matching compact travel
  context or an explicit no-context state.
- Not selected: the global state pane continues to show the currently selected
  state tab instead of travel content.
- No context: no approved readback matches the active Party position.
- Live context: the lower-right state pane shows compact readback from the
  owning travel feature and keeps movement commands out of the state tab.

## Acceptance Criteria

- the Reise-State-Tab is a global runtime state-tab surface independent from
  the navigable Travel left-bar tab
- selecting the runtime tab labeled `Reise` swaps the state pane from
  Encounter content to compact travel content
- the no-context and live compact states remain command-free in this surface
- a feature-owned live travel context can appear only through an approved
  readback surface and without adding movement commands to this state tab
- Dungeon and Hex MUST NOT register separate global `travel` contribution keys;
  the feature-neutral Travel capability owns exactly one contribution and an
  explicit no-context fallback

## References

- [Encounter Runtime State UI](../../encounter/requirements/requirements-encounter-state-tab.md)
- [Hex Travel State Requirements](../../hex/requirements/requirements-hex-travel-state.md)
- [Dungeon Travel State Requirements](../../dungeon/requirements/requirements-dungeon-travel-state.md)
- [Travel Context Domain](../../travel/domain/domain-travel.md)
