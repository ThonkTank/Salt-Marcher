# AGENTS.md

## Purpose

`geometry` owns the canonical grid algebra for `dungeon`. All dungeon topology owners must express spatial truth through this slice instead of maintaining parallel coordinate families.

## Canonical Types and APIs

- `GeometryObject<T>` - public root owner object for dungeon geometry - anchors cross-owner geometry access and the shared geometry inheritance chain.
- `GridTranslatable<T>` - canonical translation capability - every public map/object delta seam must use `translated(GridTranslation)`.
- `GridOccupant` - canonical occupancy capability - every public occupied-cell seam must answer with `cellFootprint(): GridArea`.
- `GridBounded` - canonical boundary capability - every public boundary-segment aggregate seam must answer with `boundary(): GridBoundary`.
- `GridObject` - common immutable base for canonical grid objects - extends `GeometryObject` and exposes translation, occupied levels, and cell-footprint algebra.
- `GridPoint` - canonical lattice point - represents cell centers, edge centers, and vertices on the doubled grid; the public coordinate answer is `x2()/y2()/z()`.
- `GridSegment` - canonical same-level axis-aligned lattice segment - represents walls, doors, and corridor trace segments.
- `GridSegmentPath` - canonical ordered boundary-step route - represents ordered boundary-edit previews and commits while preserving the same step granularity as `GridBoundary`.
- `GridArea` - canonical unordered occupied cell set - represents room, corridor, and floor area.
- `GridBoundary` - canonical unordered boundary segment set - represents wall and door geometry.
- `GridPath` - canonical ordered dense lattice path - represents stairs, stair-like transitions, and routed corridor traces through a normalized step-by-step point sequence.
- `GridPath.segmentPath()` - canonical same-level segment derivation - projects a dense point path into the ordered `GridSegmentPath` view when the path stays on one level.
- `GridArea.rectangle(...)`, `GridPath.concat(...)`, `GridSegmentPath.concat(...)` - canonical composition helpers - build shared preview and routing shapes without reintroducing raw point or segment collection dialects.
- `CardinalDirection` - canonical 4-neighbor direction helper over cell-space movement.

## Where New Code Goes

- Put owner-neutral spatial algebra here.
- Put topology semantics on the owning feature slice, not on geometry helpers.
- Prefer one canonical operation here over parallel shape-specific helpers elsewhere.
- Keep public construction and transport on the canonical carriers themselves: callers should pass `GridArea`, `GridBoundary`, `GridPath`, `GridSegment`, `GridPoint`, or `GridTranslation`, not raw point/segment collections.
- Treat canonical carrier usage as enforced architecture, not style guidance: outside the geometry carriers themselves, public/protected dungeon seams must not expose raw `Set/List/Collection<GridPoint|GridSegment>`.
- Keep public movement deltas on `GridTranslation`; drag/drop, move requests, and reconciliation inputs must not encode translations as fake cell `GridPoint`s.
- Keep public occupancy reads on `cellFootprint()` and keep them as `GridArea` until a terminal UI/runtime leaf actually needs raw cells.
- Keep public boundary reads on `boundary()` and keep them as `GridBoundary` until a terminal UI/runtime leaf actually needs raw segments.
- Keep raw geometry collections confined to the canonical carriers and non-public algorithm or persistence leaves; if a caller truly needs raw cells or segments, unwrap `.cells()`, `.segments()`, or `.points()` only at that final leaf.
- `checkDungeonGeometryConvention` is the build gate for these rules: if a public/protected dungeon seam reintroduces raw geometry collections or second-dialect names, the build must fail.
- Keep public point reads lattice-only. Cell-space math belongs in owner-local leaf helpers derived from `x2()/y2()`, not as a second public coordinate API on `GridPoint`.
- Keep `GridPath` explicitly ordered and canonical: public callers may supply sparse ordered points, but the primitive normalizes them to one dense lattice route instead of leaving density policy to owners.
- Keep ordered boundary routes on `GridSegmentPath`; callers should not publish raw `List<GridSegment>` wall-path APIs beside it, and the primitive itself keeps boundary-step granularity canonical.
- Keep cell semantics explicit at owner seams: callers that mean cells must pass cell `GridPoint`s or `GridArea`s directly instead of projecting arbitrary points back to one "best" cell.
- Keep geometry immutable and value-like.

## Forbidden Drift

- Do not add a second coordinate family beside `GridPoint`.
- Do not add a public `GridCell` or a second cell-only coordinate dialect; cell-only semantics belong on owner seams and `GridArea`.
- Do not add public `cellX()`/`cellY()`-style aliases back onto `GridPoint`; lattice-space is the only public coordinate dialect.
- Do not let model, structure, repository, or shell code reintroduce `CellCoord`/`CubePoint`/`GridPoint2x`-style parallel primitives.
- Do not add public helper dialects such as point-normalization or best-center utilities beside `GridArea`/`GridBoundary`; canonical collection algebra belongs on the carrier type.
- Do not add public `occupiedPositions()`/`touchingCells()`-style occupancy aliases beside `cellFootprint()`.
- Do not add public `boundarySegments()`/`boundaryEdges()`-style aggregate boundary aliases beside `boundary()`.
- Do not add public `movedBy(...)`-style translation aliases beside `translated(GridTranslation)`.
- Do not add lossy point-to-cell coercions like `projectedCell()` in runtime, map, tool, or shell code; if a caller means occupied cells, it must use `GridArea` or an owner seam that already returns cells.
- Do not expose raw point or segment collections from public/protected dungeon APIs outside the canonical geometry carriers or private/package-private leaf implementations.
- Do not move owner semantics such as traversability, room identity, or selection policy into this slice.
- Do not move authored stair path patterns or stair-path generation back into `geometry`.
