# Stair Owner

## Purpose

`stair` owns authored stair placement inputs and the translation from those editor inputs into canonical `GridPath` geometry.

## Canonical Types and APIs

- `StairObject` - public stair root seam - accepts typed stair workflow requests and delegates each request directly to the matching stair task.
- `input/CreateStairInput` - stair create request family - carries the authored stair draft in root-input form for new stair creation.
- `input/CreateStairResultInput` - stair create result carrier - returns the created stair id in stair-owned input form.
- `input/DeleteStairInput` - stair delete request - carries the active map id plus the target stair id.
- `input/LoadEditorSpecInput` - stair editor-spec request family - carries the map and stair id and returns the authored editor spec in input form.
- `input/MoveStairInput` - stair move request - carries the target stair id, the authored draft, and the grid translation in root-input form.
- `input/UpdateStairInput` - stair update request - carries the target stair id plus the authored draft in root-input form.
- `task/*Task` - stair orchestration layer - owns the current stair workflow delegation, request-to-service mapping, and editor-spec projection behind one request-matched task per public root request.
- `StairPathPatternKind` - authored stair path shape choice for editor workflows.
- `StairPathPatternSpec` - authored stair path parameters - validates and normalizes stair/transition path inputs before generation.
- `StairPathGenerator` - stair-owned generation seam - turns a validated `StairPathPatternSpec` plus anchor/span inputs into a canonical `GridPath`.
- `DungeonStairApplicationService` - current internal stair workflow seam - persists only stair-owned authoring metadata plus the resolved canonical stair.

## Where New Code Goes

- Put public cross-owner stair entrypoints on `StairObject`.
- Put public stair workflow request carriers under `input/`.
- Put stair workflow orchestration under `task/` with one `<Request>Task` per public stair root request.
- Put stair and stair-like transition authoring semantics here when they describe how a stair path is authored rather than how generic grid algebra works.
- Keep canonical realized path topology on `GridPath`; keep authored stair-specific options here.

## Forbidden Drift

- Do not move authored stair pattern types back into `geometry`.
- Do not make `GridPath` responsible for generating owner-specific stair shapes.
- Do not reintroduce draft-mapping or direct legacy-service calls back into `StairObject`; that belongs in the matching stair task.
