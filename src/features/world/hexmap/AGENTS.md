# Hexmap Feature

## Purpose

`hexmap` owns the overworld map, the overworld editor, and the shared hex renderer used by both.

## Canonical Types and APIs

- `HexmapObject` — hexmap feature root seam — composes the overworld session surface, the map editor surface, and the shared travel scene surface for the world boundary via `compose`.
- `input/ComposeInput` — canonical world-facing hexmap composition request and result carrier.
- `catalog/CatalogObject` — canonical hexmap catalog and persistence seam — loads map lists and tile snapshots, creates or resizes maps, persists terrain batches, and updates the party tile.
- `editorcontrols/EditorcontrolsObject` — canonical hexmap editor-controls seam — composes map selection, tool switching, terrain selection, and editor state-pane controls for the editor surface.
- `ui/overworld/surface/SurfaceObject` — overworld session surface — drives the party-token travel view and delegates persistence to existing editor/runtime helpers.
- `ui/editor/surface/SurfaceObject` — map-editor session surface — owns the top-level editor view wiring while delegating paint, load, and inspector publication to existing editor collaborators.
- `ui/travel/TravelObject` — shared travel scene surface — renders overworld and dungeon travel summaries for the shell-owned scene pane.
- `features.world.hexmap.api.HexTileSummary` — stable read DTO for shell inspector hex-tile cards.
- `HexGridPane` — shared renderer for read-only and editing workflows.
- `service/HexMapService` — compatibility facade for older map-loading and persistence callers. Do not treat `service/` as placement precedent.

## Where New Code Goes

- Keep top-level world-facing hexmap composition on `HexmapObject`; the world feature should not manually assemble travel plus overworld/editor surfaces around it.
- Put map-list loading, first-map loading, map create/update persistence, terrain flushes, and party-tile persistence under `catalog/`.
- Put editor tool switching, map picker callbacks, and terrain-palette state under `editorcontrols/`.
- Keep runtime and editor hex rendering on the shared renderer.
- Keep debounced party-tile persistence and transactional map resizing owned by the canonical catalog seam even when UI-facing async wrappers still exist.
- Keep paint batching on the existing paint-and-flush workflow; editor and overworld wrappers should call the catalog seam instead of writing SQL directly.
- Let the editor surface consume a composed controls/state handoff instead of wiring `MapEditorControls` and `ToolSettingsPane` directly.
- Keep `TerrainType` in `src/ui/components/` while it remains shared by `HexGridPane` and `TilePropertiesPane`.

## Forbidden Drift

- Do not let the world parent recreate the hexmap travel surface or manually reassemble hexmap child views outside `HexmapObject`.
- Do not keep `HexMapService` or `HexMapSupport` as the factual home of map catalog and persistence behavior.
- Do not keep the editor surface as the factual owner of tool-switch and control-pane orchestration.
- Do not fork separate runtime and editor renderers for the same hex surface behavior.
- Do not degrade paint drag into per-tile persistence writes.
