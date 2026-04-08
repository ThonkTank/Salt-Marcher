# Hexmap Feature

## Purpose

`hexmap` owns the overworld map, the overworld editor, the shared hex renderer used by both, and the local calendar behavior tied to that feature area.

## Canonical Types and APIs

- `HexmapObject` — hexmap feature root seam — composes the overworld session surface, the map editor surface, and the shared travel scene surface for the world boundary.
- `ui/overworld/surface/SurfaceObject` — overworld session surface — drives the party-token travel view and delegates persistence to existing editor/runtime helpers.
- `ui/editor/surface/SurfaceObject` — map-editor session surface — owns the top-level editor view wiring while delegating paint, load, and inspector publication to existing editor collaborators.
- `ui/travel/TravelObject` — shared travel scene surface — renders overworld and dungeon travel summaries for the shell-owned scene pane.
- `features.world.hexmap.api.HexTileSummary` — stable read DTO for shell inspector hex-tile cards.
- `HexGridPane` — shared renderer for read-only and editing workflows.
- `HexMapService` — async map loading and overworld persistence workflow seam.
- `CalendarService` — Forgotten Realms calendar parsing and day conversion seam.

## Where New Code Goes

- Keep runtime and editor hex rendering on the shared renderer.
- Keep debounced party-tile persistence and transactional map resizing in `HexMapService`.
- Keep paint batching on the existing paint-and-flush workflow.
- Keep `TerrainType` in `src/ui/components/` while it remains shared by `HexGridPane` and `TilePropertiesPane`.

## Forbidden Drift

- Do not fork separate runtime and editor renderers for the same hex surface behavior.
- Do not degrade paint drag into per-tile persistence writes.
- Do not repeatedly reparse calendar configuration in hot paths.
