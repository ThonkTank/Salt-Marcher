Done. Here's a summary of what was done:

**New file: `CorridorColorResolver.java`** (`canvas/` package)
- Three static methods `fillColor`, `doorColor`, `strokeColor`, each taking `(Long corridorId, Long selectedId, Long hoveredId)`
- Pattern: `corridorId.equals(selectedId)` → selected color; `corridorId.equals(hoveredId)` → active/hovered color; else → default color
- Colors sourced directly from `DungeonCanvasTheme.Corridor.*`

**`DungeonGridCorridorRenderSupport`** — removed private `fillColor`/`doorColor` methods; added `selectedCorridorId()` (from `context.selectedTarget()`) and `hoveredOrActiveId(corridor)` helpers; all three call sites (drawCorridors, drawDoors, drawPreviewDoor) now call the resolver.

**`DungeonGraphCorridorRenderSupport`** — replaced `strokeColorFor` body with resolver delegation: graph-group-color fallback is preserved for unhighlighted corridors; highlighted corridors call `CorridorColorResolver.doorColor`; added same two private helpers.

**`DungeonBaseGridViewportRenderer`** — removed `fillColor`, `doorColor`, `strokeColor` private methods; added `selectedCorridorId()` helper; call sites pass `isActive(corridor) ? corridor.corridorId() : null` as the hoveredId (the resolver sees equality → active state). Unused `Color` import removed.

**Minor behavior note:** the "hovered" fill in the editor (was `CORRIDOR_SELECTED.deriveColor(0.22)`) and "hovered" door (was `DOOR_SELECTED.deriveColor(0.85)`) now use the unified secondary color (`CORRIDOR_ACTIVE.deriveColor(0.25)` / `DOOR_ACTIVE`) — a deliberate harmonization of the active/hovered secondary slot.
