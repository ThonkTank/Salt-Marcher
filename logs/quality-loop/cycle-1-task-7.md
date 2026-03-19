Build successful. The refactoring is complete:

- **New record `ViewportRenderSnapshot`** (`canvas/grid/ViewportRenderSnapshot.java`): immutable record with the 6 fields `layout`, `renderData`, `camera`, `selection`, `activeLocation`, `hoveredCorridorId`.

- **`DungeonBaseGridViewportRenderer`**: replaced the 4 individual mutable fields (`layout`, `renderData`, `selectedTarget`, `activeLocation`) and the `final camera` field with a single `private ViewportRenderSnapshot snapshot` field. The `screenResolver` now reads `snapshot.camera()` dynamically. The old `update()` method became `setSnapshot(ViewportRenderSnapshot)`. All render and helper methods use `snapshot.*()` accessors.

- **`DungeonBaseGridViewport`**: constructor call updated to `new DungeonBaseGridViewportRenderer()`, both `showLayout()` and `updateSelection()` now construct a `ViewportRenderSnapshot` atomically and pass it via `renderer.setSnapshot(...)`.
