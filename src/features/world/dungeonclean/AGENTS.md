# Dungeon Clean Feature

## Purpose

`dungeonclean` is the parallel clean-room dungeon rebuild under `features.world`. It exists beside legacy `dungeon` so capabilities can be reimplemented and migrated incrementally without reopening tangled legacy owner seams.

## Canonical Types and APIs

- `DungeoncleanObject` — public feature root seam for the clean dungeon rebuild and the packaged clean launcher target.
- `DungeoncleanObject.loadSurface(...)` — clean feature surface export seam — returns the clean editor workspace as a registered clean shell surface.
- `input/LoadSurfaceInput` — clean feature surface request and result carrier.
- `editor/EditorObject` — clean editor owner seam for the current parallel workspace surface.
- `cluster/ClusterObject` — clean cluster owner seam for persisted rewrite fallout.
- `cluster/input/PersistClusterRewriteTailInput` — clean cluster rewrite-tail handoff.
- `cluster/input/LoadClusterRewriteTailStatusInput` — clean cluster status read request and result carrier.
- `cluster/state/PersistClusterRewriteTailState` — clean cluster-owned persisted room rewrite state.
- `cluster/repository/PersistClusterRewriteTailRepository` — clean cluster-owned room rewrite persistence boundary.

## Where New Code Goes

- Add migrated capabilities here instead of extending or repairing legacy `features.world.dungeon`.
- Keep each migrated capability fully functional inside `dungeonclean` before wiring any caller across.
- Prefer request-local nested input value types over untyped payload carriers when clean facts cross owner seams, including shell panel handoffs.

## Forbidden Drift

- Do not import clean owner `task`, `state`, or `repository` layers across owner boundaries.
- Do not route new clean capabilities back through legacy owner objects just to reuse old orchestration.
- Do not treat `dungeonclean` as a compatibility wrapper over `dungeon`; it is a parallel replacement path.
