# Hex Editor Requirements

## Goal

Define the required editor workflow over committed hex-map truth so the user
can manage maps, inspect tiles, paint biomes, and place existing World Planner
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
- compact tool controls for `Auswahl`, `Biom malen`, and `Ort platzieren`
- main content as the shared hex map surface in editor mode
- state content for selected map metadata, active status,
  selected tile details, and marker editing
- biome palette plus `Malen` and `Radieren` submodes for the active biome
  tool
- a location tool with the World Planner location catalog and marker
  presentation controls

## Visible States

- no map loaded
- loaded editable hex map
- selected tile with visible details
- active biome-paint mode
- active biome-erase mode
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
  windows while only authored tiles, biome overrides, and markers are persisted
- the empty axial guide grid MUST remain a renderer affordance; a new map has no
  authored tiles and MUST NOT appear as a pre-filled biome diamond
- the editor MUST support a selection tool for tile inspection
- the editor MUST support a biome-paint tool
- biome painting MUST support continuous pointer strokes and a visible
  brush level from `1` through `10`, mapped to mathematical radius `0..9`
- stroke path and radius MUST be validated and expanded by one shared canonical
  axial-geometry implementation used by preview and committed commands
- the editor MUST provide an eraser with the same stroke and radius mechanics
- painting or erasing MUST patch affected chunks without recreating the canvas
  or resetting its camera
- the active biome MUST be visible while painting
- `Katalog → Orte → Platzieren` MUST open a map chooser and Hex placement view
- the Hex editor MUST also provide a location-placement tool that selects one
  existing World Planner location and confirms its target authored tile
- the location-placement tool MUST expose one compact searchable dropdown for
  the active World Planner location; its popup MUST filter by location name,
  kind, or region and MUST reflect locations selected by the create workflow
- the Hex editor location tool MUST let the user create a World Planner
  location through the complete shared location editor; the created location
  MUST become the active selection and MUST be placed immediately when the
  current selection is an authored, unoccupied tile
- creating a location MUST NOT implicitly author a tile, replace an occupied
  tile, or create a Hex map; without an eligible tile the new location remains
  selected for the next explicit placement
- location creation and Hex placement MUST remain explicit sequential commands;
  when creation succeeds but placement fails, the location MUST remain selected
  and the UI MUST identify the partial success instead of reporting creation as
  failed
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
  map's biome-content revision for marker-only changes
- tile inspection MUST surface visible details for at least position, biome,
  elevation, exploration state, and notes when those values are
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
  biome, erase, and location-placement changes; Undo restores map truth only
  and does not restore cleaned Party positions or aborted Journeys
- external Hex change notices MUST invalidate only the changed chunks without
  treating every cached chunk as current at the new map revision

## Shared Biome Catalog

- Hex maps and the creature catalog MUST use the same installation-owned biome
  definitions and stable IDs. The visible term is always `Biom`; `Terrain` is
  not a separate product concept.
- The protected built-in set consists of 35 canonical biomes: `Grasland`,
  `Wüste`, `Wald`, `Sumpf`, `Gebirge`, `Wasser`, `Arktis`, `Küste`,
  `Hügelland`, `Tundra`, `Eis`, `Dschungel`, `Höhlen`, `Unterreich`, `See`,
  `Ozean`, `Unterwasser`, `Vulkan`, `Ruinen`, `Siedlung`, `Stadt`,
  `Kanalisation`, `Tempel`, `Grabstätte`, `Labor`, `Astralebene`,
  `Ätherebene`, `Feywild`, `Shadowfell`, `Abyss`, `Hölle`, `Ebene der Luft`,
  `Ebene der Erde`, `Ebene des Feuers`, and `Ebene des Wassers`.
- Legacy creature environment aliases MUST resolve to those canonical IDs:
  `Caves`/`Caverns`, `Hill`/`Hills`, `Mountain`/`Mountains`, and
  `Ruin`/`Ruins` each form one biome. `Any` is not a biome; it contributes its
  creatures through one protected global encounter table for every biome.
- Every biome publishes its display name, color, passability, travel cost, and
  links to zero or more installation-wide Encounter Tables. Built-ins can be
  edited but not deleted.
- `Neu` MUST create custom biomes without a fixed catalog-size limit. Custom
  biomes can be edited and deleted.
- The palette MUST be a server-searched, server-paged, virtual three-column
  tile grid so the number of custom biomes does not increase mounted renderer
  controls linearly.
- Deleting a custom biome MUST retain its linked Encounter Tables and rewrite
  every map usage in active and recoverable trashed campaigns to the protected
  warning biome `Zu ersetzen`. The placeholder uses grassland travel semantics
  plus a warning color/pattern and cannot be selected for painting.
- Each map MUST expose a bulk action that replaces all `Zu ersetzen` cells with
  one selected valid biome.
- Encounter Tables can be campaign-owned or installation-owned. Installation
  tables are usable from every campaign; protected standard tables can be
  edited but not deleted.

## Acceptance Criteria

- The user can create a new map through the shared catalog `Neu` flow and
  immediately see it as an editable sparse map centered on axial `0,0`.
- The user can select a tile and inspect visible tile details.
- The user can paint any built-in or custom biome and see it on the map.
- The user can search a virtual three-column palette, create and edit biomes,
  delete a custom biome after reviewing map impact, and bulk-replace resulting
  `Zu ersetzen` cells.
- The user can drag continuous paint and erase strokes at visible brush level
  `1..10` (mathematical radius `0..9`) while the camera stays in place.
- The user can place, move, reveal, and remove an existing World Planner
  location from its Catalog detail or directly in the Hex editor.
- The user can create a complete World Planner location from the Hex editor and
  see it selected and placed on the currently selected free authored tile.
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
