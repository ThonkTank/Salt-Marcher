# AGENTS.md

## Purpose

`geometry` owns the canonical grid algebra for `dungeon`. All dungeon topology owners must express spatial truth through this slice instead of maintaining parallel coordinate families.

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
- Keep public construction and transport on the canonical carriers themselves: callers should pass `GridArea`, `GridBoundary`, `GridPath`, `GridSegment`, `GridPoint`, or `GridTranslation`, not raw point/segment collections.
- Keep `GridPath` explicitly ordered: public callers construct it from ordered point lists, not from unordered collections or owner-local raw path aliases.
- Keep cell semantics explicit at owner seams: callers that mean cells must pass cell `GridPoint`s or `GridArea`s directly instead of projecting arbitrary points back to one "best" cell.
- Keep geometry immutable and value-like.

## Forbidden Drift

- Do not add a second coordinate family beside `GridPoint`.
- Do not let model, structure, repository, or shell code reintroduce `CellCoord`/`CubePoint`/`GridPoint2x`-style parallel primitives.
- Do not add public helper dialects such as point-normalization or best-center utilities beside `GridArea`/`GridBoundary`; canonical collection algebra belongs on the carrier type.
- Do not add lossy point-to-cell coercions like `projectedCell()` in runtime, map, tool, or shell code; if a caller means occupied cells, it must use `GridArea` or an owner seam that already returns cells.
- Do not move owner semantics such as traversability, room identity, or selection policy into this slice.
- Do not move authored stair path patterns or stair-path generation back into `geometry`.
