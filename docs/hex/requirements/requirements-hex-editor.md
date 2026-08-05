# Hex Editor Requirements

## Goal

Define the required editor workflow over committed hex-map truth so the user
can manage maps, inspect tiles, paint terrain, and place existing World Planner
locations without inventing a second place or map source of truth.

## Non-Goals

- interactive hex travel behavior
- compact runtime `Reise` travel-state behavior
- shared map-canvas contract design
- persistence schema detail
- hidden simulation or campaign rules that are not visible in the editor

## Visible Structure

- a shared shell catalog CRUD surface for selecting, creating, renaming, and
  reloading Hex maps
- compact tool controls for `Auswahl`, `Terrain malen`, and `Ort platzieren`
- main content as the shared hex map surface in editor mode
- state content for selected map metadata, active status,
  selected tile details, and marker editing
- terrain palette plus `Malen` and `Radieren` submodes for the active terrain
  tool
- a location tool with the World Planner location catalog and marker
  presentation controls

## Visible States

- no map loaded
- loaded editable hex map
- selected tile with visible details
- active terrain-paint mode
- active terrain-erase mode
- active location-placement mode
- selected placed World Planner location with its resolved name
- save or validation failure during map edits

## Required Behavior

- the editor MUST let the user create and edit hex maps
- new map creation MUST use the shared catalog `Neu` flow and create a named,
  initially empty sparse map
- map editing MUST support visible name changes from the state pane
- the Hex workspace MUST use the approved editor shell: a compact top map and
  tool bar, the flexible map canvas below it, a `264px` owning state pane, and a
  `30px` map status row; below `900px` it MUST stack the state pane without
  removing map access
- maps MUST grow without a coordinate boundary; panning loads bounded viewport
  windows while only authored tiles, terrain overrides, and markers are persisted
- the empty axial guide grid MUST remain a renderer affordance; a new map has no
  authored tiles and MUST NOT appear as a pre-filled terrain diamond
- the editor MUST support a selection tool for tile inspection
- the editor MUST support a terrain-paint tool
- terrain painting MUST support continuous pointer strokes and a visible
  brush level from `1` through `10`, mapped to mathematical radius `0..9`
- stroke path and radius MUST be validated and expanded by one shared canonical
  axial-geometry implementation used by preview and committed commands
- the editor MUST provide an eraser with the same stroke and radius mechanics
- painting or erasing MUST patch affected chunks without recreating the canvas
  or resetting its camera
- the active terrain type MUST be visible while painting
- `Katalog → Orte → Platzieren` MUST open a map chooser and Hex placement view
- the Hex editor MUST also provide a location-placement tool that selects one
  existing World Planner location and confirms its target authored tile
- one World Planner location MUST be placed globally at most once and one Hex
  MUST carry at most one World Planner location
- moving a placement MUST retain the World Planner location identity
- deleting the World Planner location MUST remove its placement atomically
- erasing tiles that carry locations, Party positions, or stored routes MUST
  show those references and require confirmation; confirmation removes the
  placements, aborts affected routes, and clears erased Party positions without
  deleting World Planner locations or Party members
- placement feedback MUST be visible on the owning tile
- a World Location's editable map presentation MUST be separately revisioned
  from its catalog content and MUST include optional title override, symbol,
  symbol size, label curve, and label position
- presentation controls MUST update optimistically, coalesce continuous slider
  input, flush on pointer release or blur, and restore the visible server value
  after a revision conflict
- chunk reads MUST project complete immutable marker render data; renderers MUST
  NOT join location or symbol catalogs to complete a marker
- built-in location symbols MUST come from one immutable common manifest
- custom one-path SVG symbols MUST be installation-owned and available through
  bounded, paged search, detail, rename, impact-preview, and confirmed-delete
  capabilities
- SVG selection MUST be bounded in Electron Main and untrusted SVG parsing MUST
  execute in the utility process against the documented one-path subset
- importing and assigning a symbol MUST be one idempotent journaled command;
  interruption before assignment MUST be compensated during recovery
- deleting a custom symbol MUST replace its references with the built-in `Ort`
  symbol in active and recoverable trashed campaigns before removal, and MUST
  resume idempotently from its maintenance journal after interruption
- location presentation, location catalog, symbol catalog, and affected Hex
  chunks MUST publish their own exact invalidation notices without increasing a
  map's terrain-content revision for marker-only changes
- tile inspection MUST surface visible details for at least position, terrain,
  elevation, biome, exploration state, and notes when those values are
  available
- tile inspection MUST expose markers owned by the selected tile when markers
  are present
- paint feedback MUST be visible on the map surface
- middle-pointer panning, zoom, resize, chunk reads, and content patches MUST
  preserve camera state; only map changes or explicit reset may recenter it
- the map canvas MUST NOT cover the map with visible coordinate inputs or a
  paged facts window
- failed save operations MUST surface a visible failure outcome instead of
  silently discarding the edit
- the editor MUST expose persistent per-map Undo and Redo for the latest twenty
  terrain, erase, and location-placement changes; Undo restores map truth only
  and does not restore cleaned Party positions or aborted Journeys
- external Hex change notices MUST invalidate only the changed chunks without
  treating every cached chunk as current at the new map revision

## Supported Terrain Palette

The editor terrain palette exposes these visible labels:

- `Grasland`
- `Wald`
- `Gebirge`
- `Wasser`
- `Wüste`
- `Sumpf`

The static V1 terrain catalog also publishes display color, passability, and
travel cost. Maps store stable terrain IDs. Editing terrain definitions through
Catalog CRUD is deliberately deferred without making those values hard-coded
map truth.

## Acceptance Criteria

- The user can create a new map through the shared catalog `Neu` flow and
  immediately see it as an editable sparse map centered on axial `0,0`.
- The user can select a tile and inspect visible tile details.
- The user can paint terrain and see the changed terrain on the map.
- The user can drag continuous paint and erase strokes at visible brush level
  `1..10` (mathematical radius `0..9`) while the camera stays in place.
- The user can place, move, reveal, and remove an existing World Planner
  location from its Catalog detail or directly in the Hex editor.
- The user can change a placed location's title, symbol, symbol size, curved
  label, and label position without resetting the map camera.
- The user can search custom symbols page by page, import a strict one-path SVG,
  rename it, inspect deletion impact, and confirm replacement across campaigns.
- Save failure produces a visible error outcome.
- The visible Hex map surface remains available below its compact controls and
  beside the owning `264px` state pane; the responsive stack remains operable at
  200% scaling.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Domain](../domain/domain-hex-map.md)
- [Hex Persistence Contract](../contract/contract-hex-persistence.md)
- [Maps Canvas Requirements](../../maps/requirements/requirements-maps-canvas.md) (line 1)
