# Dungeon Geometry

## Purpose

`geometry` owns the canonical grid algebra for `dungeon`. Dungeon topology owners express shared spatial truth through this slice instead of maintaining parallel coordinate families.

## Canonical Types and APIs

- `checkDungeonGeometryConvention` — build-time gate that rejects second geometry dialects and raw public geometry collections on dungeon seams.
- `GeometryObject<T>` and `GridObject<T>` — common immutable base for canonical dungeon geometry values.
- `GridTranslatable<T>`, `GridOccupant`, `GridBounded` — canonical movement, occupancy, and boundary capability names.
- `GridPoint`, `GridSegment`, `GridSegmentPath`, `GridArea`, `GridBoundary`, `GridPath`, `CardinalDirection` — canonical public geometry carriers and helpers.
- `GridPoint.withLevel(...)` and `GridPoint.planarCellDistanceTo(...)` — canonical level-rebasing and planar cell-distance helpers. Reuse these instead of rebuilding half-step `x2()/y2()` math in consumer owners.
- `GridPath.segmentPath()` plus carrier composition helpers such as `GridArea.rectangle(...)`, `GridPath.concat(...)`, and `GridSegmentPath.concat(...)` — shared geometry composition seams.

## Where New Code Goes

- Put owner-neutral spatial algebra here.
- Keep public coordinates lattice-only through `GridPoint.x2()/y2()/z()`.
- Keep public movement deltas on `GridTranslation`, occupancy on `cellFootprint(): GridArea`, and aggregate boundary reads on `boundary(): GridBoundary`.
- Keep planar cell-distance and level-rebasing semantics on `GridPoint` instead of re-deriving them inside topology, catalog, runtime, or shell owners.
- Keep geometry immutable and value-like.

## Forbidden Drift

- Do not add a second coordinate family beside `GridPoint`.
- Do not add a public `GridCell` or `cellX()`/`cellY()`-style alias dialect.
- Do not reintroduce `CellCoord`, `CubePoint`, `GridPoint2x`, or comparable parallel primitives.
- Do not add public occupancy, boundary, or translation aliases beside `cellFootprint()`, `boundary()`, and `translated(GridTranslation)`.
- Do not expose raw point or segment collections from public/protected dungeon APIs outside the canonical carriers.
- Do not move owner semantics such as traversability, room identity, or stair-path generation into this slice.
