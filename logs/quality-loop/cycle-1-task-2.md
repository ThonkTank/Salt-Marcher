Build successful. The refactoring is complete.

**Summary of changes:**

**`CorridorMarkerRenderer.java`** — extended with:
- `DoorMarkerStyle` record (radius + fill)
- `SegmentScreenCoords` record (x1, y1, x2, y2)
- `DoorMarkerCenterResolver` functional interface — maps `DoorSegment → ScreenPoint`
- `DoorMarkerStyleResolver` functional interface — maps `DoorSegment → DoorMarkerStyle`
- `WaypointScreenProjection` functional interface — maps `Point2i → ScreenPoint`
- `drawDoorMarkers(...)` — iteration over door markers with injected projection + style
- `drawWaypointHandles(...)` — iteration over waypoints with injected projection
- `drawSegmentLines(...)` — iteration over pre-projected segment coordinates

**`DungeonGridCorridorRenderSupport.java`** — replaced loops in `drawSegmentDoorHandles` and `drawWaypointHandles` with delegation to the new `CorridorMarkerRenderer` methods, injecting grid-specific coordinate projection lambdas.

**`DungeonGraphCorridorRenderSupport.java`** — replaced loops in `drawCorridorSegmentHandles`, `drawCorridorDoorMarkers`, and `drawCorridorWaypointMarkers` with delegation to the new `CorridorMarkerRenderer` methods, injecting graph-specific coordinate projection lambdas.
