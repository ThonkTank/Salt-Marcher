# AGENTS.md

## Purpose

`shell/interaction` owns dungeon hit probing, hit collection, and semantic highlight surface publication for editor and runtime consumers.

## Canonical Types and APIs

- `DungeonHitCollector` — shared hit-collection seam — gathers all hit descriptors and applies the single ordering policy.
- `DungeonHitSurface` — carrier-based shell leaf — publishes hit and highlight geometry only as `GridArea`, `GridBoundary`, `GridPoint`, or label bounds; this is the enforced public shell geometry seam, not one optional representation among several.
- `DungeonSelectionHighlightResolver` — semantic-selection-to-highlight seam — resolves owner and part refs into `DungeonHitSurface` payloads without introducing a second geometry dialect.

## Where New Code Goes

- Put shared hit and highlight geometry publication here before adding tool-local shell payloads.
- Keep shell hit surfaces carrier-based; if a renderer or collector needs raw cells or segments, unwrap `.cells()` or `.segments()` only at the final leaf.
- Keep point hits singular; if a future feature truly needs unordered public multi-point geometry, introduce a canonical primitive instead of falling back to `Set<GridPoint>`.
- Treat shell geometry compliance as enforced architecture: if a new public shell seam cannot speak `GridArea`, `GridBoundary`, `GridPoint`, `GridPath`, or `GridSegmentPath`, fix the seam or add a canonical primitive first instead of publishing raw collections.

## Forbidden Drift

- Do not reintroduce raw `Set/List/Collection<GridPoint|GridSegment>` hit or highlight payloads on public shell seams.
- Do not reintroduce `*2x` naming on public shell interaction types when the canonical geometry type already carries that meaning.
- Do not publish shell-local geometry wrappers that duplicate `GridArea`, `GridBoundary`, `GridPath`, or `GridSegmentPath`.
