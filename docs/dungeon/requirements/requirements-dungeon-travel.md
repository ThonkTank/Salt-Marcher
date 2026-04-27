Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Travel-facing dungeon behavior, visible states, and acceptance
criteria.

# Dungeon Travel Requirements

## Goal

Define the required runtime travel workflow over committed authored dungeon
truth plus party-owned runtime state.

## Non-Goals

- shared canvas contract design
- compact `Reise` state-tab behavior
- editor lifecycle behavior
- authored dungeon invariants
- SQLite schema detail

## Current State

- SaltMarcher already exposes a dungeon travel surface with map identity,
  refresh, reset-view, zoom, level, and overlay controls plus a state area for
  location and action text.
- The current SaltMarcher travel view resolves listed travel actions through
  the dungeon application boundary and shows resulting status text.
- Direct token drag to reachable dungeon tiles is part of the documented
  target state but is not yet fully wired in the current SaltMarcher travel
  binder.
- The sibling `salt-marcher` repo shows the fuller visible runtime target:
  token drag, centered runtime details, and action buttons for doors, stairs,
  and transitions.

## Visible Structure

- controls show map identity plus refresh and reset actions, zoom, level, and
  overlay controls
- main content is the shared dungeon map surface in runtime mode
- state content shows current map or area, tile, heading, movement status, and
  available travel actions

## Visible States

- loading state while runtime position is being resolved
- loaded runtime state with current party location and heading
- moving state while a selected action or drag target is resolving
- outside-dungeon state after a resolved overworld transition
- blocked or rejected move state with a clear non-committing outcome
- explicit no-actions state when no movement options are currently available

## Required Behavior

- travel MUST load from committed authored dungeon truth plus party runtime
  state
- runtime party position MUST NOT become authored dungeon truth
- the surface MUST show current party location, current tile, facing, and
  available movement choices
- the surface MUST expose explicit travel actions for visible doors, stairs,
  and transitions when such actions are available
- travel MUST support direct token movement to reachable local dungeon tiles
- refresh MUST reload the current travel surface from committed authored truth
  plus party runtime state
- level and overlay controls MUST affect presentation only
- reset view MUST restore camera state without mutating authored or runtime
  truth
- blocked or invalid movement MUST keep authored truth unchanged and surface a
  meaningful outcome

## Supported Movement Outcomes

- local traversal across door or stair links
- dungeon-transition follow-through
- overworld-transition follow-through
- rejected local movement with no partial runtime commit
- explicit empty state when no actions are available

## Acceptance Criteria

- The travel surface reloads after every resolved movement.
- Valid listed travel actions update the party runtime position.
- Valid token drag to a reachable tile updates the party runtime position.
- Valid dungeon or overworld transitions show the resulting destination state.
- Invalid movement does not partially commit authored or runtime truth.
- Reset view restores camera state without changing dungeon or runtime truth.

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Reise Requirements](./requirements-dungeon-reise.md)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
- [Dungeon Map Surface Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/contract/contract-maps-dungeon-surface.md:1)
- [Dungeon Map Adoption Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/architecture/architecture-maps-dungeon-adoption.md:1)
