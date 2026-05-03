Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Editor-facing hex-map behavior, visible states, and acceptance
criteria.

# Hex Editor Requirements

## Goal

Define the required editor workflow over committed hex-map truth so the user
can manage maps, inspect tiles, and paint terrain without inventing a second
map source of truth.

## Non-Goals

- interactive hex travel behavior
- shared map-canvas contract design
- persistence schema detail
- hidden simulation or campaign rules that are not visible in the editor

## Current State

- SaltMarcher does not yet ship a dedicated hex editor surface.
- The sibling `salt-marcher` repo shows a clear visible target state: map
  selector, create and edit map flows, radius-change warning on destructive
  shrink, selection tool, terrain brush, terrain palette, and tile detail
  inspection.

## Visible Structure

- controls for selecting a map and opening create or edit map actions
- tool selection for at least `Auswahl` and terrain painting
- main content as the shared hex map surface in editor mode
- state or inspector content for active tool and selected tile details
- terrain palette for the active paint tool

## Visible States

- no map loaded
- loaded editable hex map
- selected tile with visible details
- active terrain-paint mode
- save or validation failure during map edits
- destructive radius-change warning before data loss

## Required Behavior

- the editor MUST let the user create and edit hex maps
- map editing MUST support visible name and radius changes
- shrinking a map radius in a way that removes tiles MUST surface an explicit
  destructive warning before commit
- the editor MUST support a selection tool for tile inspection
- the editor MUST support a terrain-paint tool
- the active terrain type MUST be visible while painting
- tile inspection MUST surface visible details for at least position, terrain,
  elevation, biome, exploration state, and notes when those values are
  available
- paint feedback MUST be visible on the map surface
- failed save operations MUST surface a visible failure outcome instead of
  silently discarding the edit

## Supported Terrain Palette

The runtime terrain palette exposes these visible labels:

- `Grasland`
- `Wald`
- `Gebirge`
- `Wasser`
- `Wüste`
- `Sumpf`

## Acceptance Criteria

- The user can create a new map and immediately see it as an editable map.
- The user can select a tile and inspect visible tile details.
- The user can paint terrain and see the changed terrain on the map.
- Destructive radius shrink requires an explicit warning before commit.
- Save failure produces a visible error outcome.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
