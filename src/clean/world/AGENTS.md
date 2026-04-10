# Clean World

## Purpose

`src/clean/world` owns the active clean world preparation surfaces. Keep map catalog loading and the aggregated `Travel` / `Map Editor` hosts here, because the clean app now routes all active world wiring through this subtree.

## Canonical Types And APIs

- `WorldObject.composeWorld(ComposeWorldInput)` - returns the two top-level world shell surfaces.
- `mapcatalog/MapcatalogObject.loadMaps(LoadMapsInput)` - returns the typed clean-local map list plus any explicit load error.
- `travel/TravelObject.composeTraveltab(ComposeTraveltabInput)` - returns the aggregated `Travel` surface with host switching.
- `editor/EditorObject.composeMapeditortab(ComposeMapeditortabInput)` - returns the aggregated `Map Editor` surface with host switching.
- `hex/HexObject.composeHextravel(ComposeHextravelInput)` - returns the Hexmap runtime child host surface.
- `hex/HexObject.composeHexeditor(ComposeHexeditorInput)` - returns the Hexmap editor child host surface.
- `dungeon/DungeonObject.composeDungeontravel(ComposeDungeontravelInput)` - returns the dungeon runtime child host surface.
- `dungeon/DungeonObject.composeDungeoneditor(ComposeDungeoneditorInput)` - returns the dungeon editor child host surface.

## Where New Code Goes

- Keep clean-local world map loading capability in `mapcatalog`, because the world subtree owns the selectable clean map set for both top-level tabs.
- Keep the aggregated shell host logic in `travel` and `editor`, because those owners decide how selector state, host containers, and lifecycle handoff work.
- Keep Hexmap and dungeon runtime/display truth in `hex/state` and `dungeon/state`, because active map choice, editor mode, selection, and similar transient host facts belong to owner-local runtime state.
- Keep final Hexmap and dungeon child-surface assembly in private owner-local paths under `hex` and `dungeon`, because those owners are the final consumers of static data and the final shell-surface composers for their child hosts.
- Keep request-shaped static data preparation in matching child `task` seams when a world child owner needs data transformed before the owner consumes `state`.

## Forbidden Drift

- Keep `src/clean/world` isolated from `database`, `features`, and `ui`, because the clean world rebuild must stay locally movable and reviewable.
- Keep explicit error and empty states in the aggregated tabs, because map loading failures must remain visible rather than collapsing into silent placeholder content.
- Do not put additional Java files next to `TravelObject`, `EditorObject`, `HexObject`, `DungeonObject`, `WorldObject`, or `MapcatalogObject`, because each world owner directory must remain a single-file owner seam.
- Do not encode map-kind behavior helpers inside `input`, because world input carriers must stay passive enough to satisfy the owner-boundary checks.
