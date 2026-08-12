# Reise-Szenario UI

## Component Purpose

The `Reise` entry in the Session scenario selector hosts the interactive travel
console for the focused Scene. It composes the selected provider context while
the provider continues to own movement rules, route truth, position, and
persistence.

## Visible Surfaces

- `COCKPIT_STATE` contains the selected travel provider's console.
- The center `Karte` tab contains only the provider's shared canvas and honest
  loading or empty states.
- A no-context state explains that no matching live travel context exists and
  may offer an explicit map-opening action.

## Interactions

- Selecting `Reise` swaps the scenario pane without changing the center tab.
- The active provider may expose map selection, route planning and clearing,
  accessible placement, start, pause/resume, abort, and presentation speed.
- `Karte öffnen` and actions that require the canvas may explicitly select the
  center map tab.
- The scenario shell delegates commands through the provider's typed API and
  never reconstructs or persists movement truth itself.

## Acceptance Criteria

- Exactly one travel console is shown for the focused Scene.
- Hex travel presents one shared state across the map and scenario panes.
- Selecting the scenario alone never navigates the center pane.
- Provider absence, unavailable maps, and rejected commands are explicit.
- Hex is the only current provider. A future Dungeon implementation must add a
  real adapter and acceptance cases rather than a competing registration or
  placeholder branch.

## References

- [Hex Travel Console Requirements](../../hex/requirements/requirements-hex-travel-state.md)
- [Dungeon Travel State Requirements](../../dungeon/requirements/requirements-dungeon-travel-state.md)
- [Travel Context Domain](../../travel/domain/domain-travel.md)
