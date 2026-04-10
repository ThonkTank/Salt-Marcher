# Hexmap Feature

## Purpose

`hexmap` owns the overworld map, the overworld editor, and the shared hex renderer used by both.

## Canonical Types and APIs

- `HexmapObject` — hexmap feature root seam — composes the overworld session surface, the map editor surface, and the shared travel scene surface for the world boundary via `compose`.
- `input/ComposeInput` — canonical world-facing hexmap composition request and result carrier.
- `catalog/CatalogObject` — canonical hexmap catalog and persistence seam — loads map lists and tile snapshots, creates or resizes maps, persists terrain batches, and updates the party tile.
- `editorcontrols/EditorcontrolsObject` — canonical hexmap editor-controls seam — composes map selection, tool switching, terrain selection, and editor state-pane controls for the editor surface.
- `editorsurface/EditorsurfaceObject` — canonical hexmap editor-surface seam — owns editor view composition, map load/reload flow, dirty-tile flush, dropdown workflows, and tile-detail publication into the shell inspector.
- `editorsurface/input/ComposeInput` — canonical editor-surface request carrying shell inspector access for the editor view.
- `overworldsurface/OverworldsurfaceObject` — canonical hexmap overworld-surface seam — owns the AppView composition, travel-scene handoff, initial map load, and party-token persistence lifecycle for the running overworld view.
- `overworldsurface/input/ComposeInput` — canonical overworld-surface request carrying the world-owned travel handoff.
- `travelsurface/TravelsurfaceObject` — canonical shared travel-scene surface — renders overworld and dungeon travel summaries for the shell-owned scene pane.
- `travelsurface/input/ShowOverworldTravelInput` — canonical request for the overworld travel presentation.
- `travelsurface/input/ShowDungeonTravelInput` — canonical request for the dungeon travel presentation plus action/centering handoff.
- `features.world.hexmap.api.HexTileSummary` — stable read DTO for shell inspector hex-tile cards.
- `HexGridPane` — shared renderer for read-only and editing workflows.
- `features.world.api.input.TravelSurfaceInput` — compatibility travel handoff for existing world/dungeon callers. Do not treat `world.api.input` as placement precedent for new travel code.
- `service/HexMapService` — compatibility facade for older map-loading and persistence callers. Do not treat `service/` as placement precedent.

## Where New Code Goes

- Keep top-level world-facing hexmap composition on `HexmapObject`; the world feature should not manually assemble travel plus overworld/editor surfaces around it.
- Put map-list loading, first-map loading, map create/update persistence, terrain flushes, and party-tile persistence under `catalog/`.
- Put editor tool switching, map picker callbacks, and terrain-palette state under `editorcontrols/`.
- Put editor-view composition, map dropdown flow, async map loading, paint flush orchestration, and inspector publication under `editorsurface/`.
- Put the running overworld AppView composition, travel-scene activation, initial load, and party-token session lifecycle under `overworldsurface/`.
- Put the shared travel-scene UI and its overworld/dungeon presentation requests under `travelsurface/`.
- Keep runtime and editor hex rendering on the shared renderer.
- Keep debounced party-tile persistence and transactional map resizing owned by the canonical catalog seam even when UI-facing async wrappers still exist.
- Keep paint batching on the existing paint-and-flush workflow; editor and overworld wrappers should call the catalog seam instead of writing SQL directly.
- Let the editor surface consume a composed controls/state handoff instead of wiring `MapEditorControls` and `ToolSettingsPane` directly.
- Keep `TerrainType` in `src/ui/components/` while it remains shared by `HexGridPane` and `TilePropertiesPane`.

## Forbidden Drift

- Do not let the world parent recreate the hexmap travel surface or manually reassemble hexmap child views outside `HexmapObject`.
- Do not keep `HexMapService` or `HexMapSupport` as the factual home of map catalog and persistence behavior.
- Do not keep the editor surface as the factual owner of tool-switch and control-pane orchestration.
- Do not keep legacy `ui/editor/surface` classes as the factual home of editor view workflow once `editorsurface/` exists.
- Do not keep legacy `ui/overworld/surface` classes as the factual home of overworld view workflow once `overworldsurface/` exists.
- Do not keep legacy `ui/travel` classes or `world.api.input.TravelSurfaceInput` as the factual home of travel-scene behavior once `travelsurface/` exists.
- Do not fork separate runtime and editor renderers for the same hex surface behavior.
- Do not degrade paint drag into per-tile persistence writes.
