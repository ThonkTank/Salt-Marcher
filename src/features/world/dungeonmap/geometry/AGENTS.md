# AGENTS.md

## Purpose

`geometry` owns the canonical grid algebra for `dungeonmap`. All dungeon topology owners must express spatial truth through this slice instead of maintaining parallel coordinate families.

## Canonical Types and APIs

- `GridObject` - common immutable base for canonical grid objects - exposes translation, occupied levels, and cell-footprint algebra.
- `GridPoint` - canonical lattice point - represents cell centers, edge centers, and vertices on the doubled grid.
- `GridSegment` - canonical same-level axis-aligned lattice segment - represents walls, doors, and corridor trace segments.
- `GridArea` - canonical unordered occupied cell set - represents room, corridor, and floor area.
- `GridBoundary` - canonical unordered boundary segment set - represents wall and door geometry.
- `GridPath` - canonical ordered point path - represents stairs, stair-like transitions, and routed corridor traces.
- `CardinalDirection` - canonical 4-neighbor direction helper over cell-space movement.

## Where New Code Goes

- Put owner-neutral spatial algebra here.
- Put topology semantics on the owning feature slice, not on geometry helpers.
- Prefer one canonical operation here over parallel shape-specific helpers elsewhere.
- Keep geometry immutable and value-like.

## Forbidden Drift

- Do not add a second coordinate family beside `GridPoint`.
- Do not let model, structure, repository, or shell code reintroduce `CellCoord`/`CubePoint`/`GridPoint2x`-style parallel primitives.
- Do not move owner semantics such as traversability, room identity, or selection policy into this slice.
- Do not move authored stair path patterns or stair-path generation back into `geometry`.
