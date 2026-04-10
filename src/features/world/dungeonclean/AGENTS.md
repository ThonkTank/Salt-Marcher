# Dungeon Clean Feature

## Purpose

`dungeonclean` is the final world-facing dungeon root under `features.world`. It still hosts clean-room replacement work, but world composition now enters dungeon through this seam instead of the legacy `dungeon` root.

## Canonical Types and APIs

- `DungeoncleanObject` — canonical world-facing dungeon root seam — returns the world-consumed dungeon runtime plus dungeon editor views and still exports the packaged clean surface.
- `DungeoncleanObject.loadSurface(...)` — clean feature surface export seam — returns the clean editor workspace as a registered clean shell surface with toolbar, inspector publication, scene-registration, and background-task hooks.
- `DungeoncleanObject.views(...)` — world-facing dungeon root request — returns the runtime dungeon view plus the clean dungeon editor view while clean internals continue replacing legacy owners incrementally.
- `input/LoadSurfaceInput` — clean feature surface request and result carrier, including passive inspector publication, scene-registration, and background-task callbacks from the shell.
- `input/ViewsInput` — canonical world-facing dungeon view-composition request and result carrier.
- `editor/EditorObject` — clean editor owner seam for the current parallel workspace surface.
- `cluster/ClusterObject` — clean cluster owner seam for persisted rewrite fallout.
- `cluster/input/PersistClusterRewriteTailInput` — clean cluster rewrite-tail handoff.
- `cluster/input/LoadClusterRewriteTailStatusInput` — clean cluster status read request and result carrier.
- `cluster/state/PersistClusterRewriteTailState` — clean cluster-owned persisted room rewrite state.
- `cluster/repository/PersistClusterRewriteTailRepository` — clean cluster-owned room rewrite persistence boundary.

## Where New Code Goes

- Add migrated capabilities here instead of extending or repairing legacy `features.world.dungeon`.
- Keep world-facing dungeon composition on `DungeoncleanObject` even while runtime internals still route through legacy owners under the boundary.
- Keep each migrated capability fully functional inside `dungeonclean` before wiring any caller across.
- Prefer request-local nested input value types over untyped payload carriers when clean facts cross owner seams, including shell panel handoffs.
- Accept shell-owned inspector publication and scene-registration callbacks from callers instead of importing shell owners directly.
- Accept shell-owned background-task callbacks from callers instead of importing shell async owners directly.

## Forbidden Drift

- Do not import clean owner `task`, `state`, or `repository` layers across owner boundaries.
- Do not route new clean capabilities back through legacy owner objects just to reuse old orchestration.
- Do not move the world-facing dungeon root back to `features.world.dungeon.DungeonObject`.
- Do not treat the clean editor surface export as a sidecar-only tool once `DungeoncleanObject` owns the world-facing boundary.
