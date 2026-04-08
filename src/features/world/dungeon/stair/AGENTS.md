# Stair Owner

## Purpose

`stair` owns authored stair placement inputs and the translation from those editor inputs into canonical `GridPath` geometry.

## Canonical Types and APIs

- `StairPathPatternKind` - authored stair path shape choice for editor workflows.
- `StairPathPatternSpec` - authored stair path parameters - validates and normalizes stair/transition path inputs before generation.
- `StairPathGenerator` - stair-owned generation seam - turns a validated `StairPathPatternSpec` plus anchor/span inputs into a canonical `GridPath`.
- `DungeonStairApplicationService` - stair workflow seam - persists only stair-owned authoring metadata plus the resolved canonical stair.

## Where New Code Goes

- Put stair and stair-like transition authoring semantics here when they describe how a stair path is authored rather than how generic grid algebra works.
- Keep canonical realized path topology on `GridPath`; keep authored stair-specific options here.

## Forbidden Drift

- Do not move authored stair pattern types back into `geometry`.
- Do not make `GridPath` responsible for generating owner-specific stair shapes.
