Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-18
Source of Truth: Editor-facing hex-map behavior, visible states, and acceptance
criteria.

# Hex Editor Requirements

## Goal

Define the required editor workflow over committed hex-map truth so the user
can manage maps, inspect tiles, paint terrain, and place simple authored
markers without inventing a second map source of truth.

## Non-Goals

- interactive hex travel behavior
- compact runtime `Reise` travel-state behavior
- shared map-canvas contract design
- persistence schema detail
- hidden simulation or campaign rules that are not visible in the editor

## Current State

- SaltMarcher ships a dedicated Hex Map editor surface in
  `src/view/leftbartabs/hexmap`.
- The local SaltMarcher Hex editor owns the shipped editor target state: map
  selector, create and edit map flows, radius-change warning for authored data
  loss, selection tool, terrain brush, terrain palette, tile detail inspection,
  and simple tile-owned marker placement.
- V1 marker editing is target behavior for the Hex editor only. It does not
  imply runtime travel markers, encounter simulation, or Dungeon feature-marker
  semantics.

## Visible Structure

- controls for selecting a map and opening create or edit map actions
- tool selection for at least `Auswahl` and terrain painting
- main content as the shared hex map surface in editor mode
- state or inspector content for active tool and selected tile details
- terrain palette for the active paint tool
- marker placement controls for name, type, and optional note

## Visible States

- no map loaded
- loaded editable hex map
- selected tile with visible details
- active terrain-paint mode
- active marker-placement mode
- selected marker with visible name, type, note when present, and owning tile
- save or validation failure during map edits
- destructive radius-change warning before data loss

## Required Behavior

- the editor MUST let the user create and edit hex maps
- map editing MUST support visible name and radius changes
- map radius MUST stay inside the supported `0` through `99` range
- shrinking a map radius in a way that removes authored terrain or markers MUST
  surface an explicit destructive warning before commit
- the editor MUST support a selection tool for tile inspection
- the editor MUST support a terrain-paint tool
- the active terrain type MUST be visible while painting
- the editor MUST support placing a simple marker on one selected or clicked
  tile
- marker creation MUST require a nonblank name
- marker creation MUST require one marker type from the supported marker type
  vocabulary
- marker note text MUST be optional
- every marker MUST belong to exactly one owning hex tile
- marker feedback MUST be visible on the owning tile after placement
- tile inspection MUST surface visible details for at least position, terrain,
  elevation, biome, exploration state, and notes when those values are
  available
- tile inspection MUST expose markers owned by the selected tile when markers
  are present
- paint feedback MUST be visible on the map surface
- failed save operations MUST surface a visible failure outcome instead of
  silently discarding the edit

## Supported Terrain Palette

The editor terrain palette exposes these visible labels:

- `Grasland`
- `Wald`
- `Gebirge`
- `Wasser`
- `Wüste`
- `Sumpf`

## Supported Marker Types

The V1 marker vocabulary exposes these visible marker types:

- `SETTLEMENT`
- `LANDMARK`
- `DANGER`
- `RESOURCE`

## Acceptance Criteria

- The user can create a new map and immediately see it as an editable map.
- The user can select a tile and inspect visible tile details.
- The user can paint terrain and see the changed terrain on the map.
- The user can place a named marker with a supported type on exactly one tile.
- The user can add or omit a marker note without changing marker ownership.
- Marker validation failure produces a visible error outcome when name or type
  is missing.
- Destructive radius shrink requires an explicit warning before commit.
- Save failure produces a visible error outcome.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Persistence Contract](../contract/contract-hex-persistence.md)
- [Hex Editor Verification](../verification/verification-hex-editor.md)
- [Maps Canvas Requirements](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/maps/requirements/requirements-maps-canvas.md:1)
