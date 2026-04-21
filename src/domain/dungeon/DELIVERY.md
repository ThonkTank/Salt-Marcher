Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Temporary rollout notes, phasing, and open delivery questions
for the dungeon feature.

# Dungeon Delivery Notes

## Delivery Shape

Current foundation:

- The dungeon root service is assembled by the data contribution with concrete
  SQLite-backed adapters.
- The active write model is `DungeonMap`; editor operations mutate that
  aggregate and save through `DungeonMapRepository`.
- Read selection uses `DungeonMapSearch`, keeping read-only map lookup separate
  from authored persistence.
- The SQLite schema manager creates the legacy-compatible dungeon table family
  required for later parity work.
- Room and cluster read parity is active: the data layer loads room records,
  floor anchors, visual descriptions, exit descriptions, cluster centers,
  cluster vertices, and explicit internal wall or door edges. The domain layer
  hydrates room cells and boundary facts from those authored inputs.
- Corridor read parity is active: the data layer loads corridor membership,
  waypoints, and door overrides. The domain layer derives corridor areas,
  corridor door boundaries, and room-to-corridor relation facts from those
  authored inputs.
- Stair and transition read parity is active: the data layer loads stair path
  nodes, stair exits, corridor attachments, and transition destinations. The
  domain layer exposes them as authored feature facts and relation summaries.

Recommended rollout:

1. Load and inspect a dungeon map on the base surface.
2. Deliver the travel surface with room inspection and travel actions.
3. Deliver the editor surface with selection, preview, and history.
4. Add advanced topology tools such as corridor, stair, and wall authoring.

## Risks

- UI specifications are broader than the currently stabilized domain policies.
- Preview behavior and undo/redo semantics need explicit implementation
  contracts before broad editor rollout.
- Room and connection projections can drift if runtime travel action rules are
  not derived consistently from the authored feature facts.
- Full parity still needs runtime travel action parity, editor mutation
  policies, and remaining non-space feature mapping before those behaviours can
  be considered preserved.
- Advanced editor operation carriers must be introduced only with implemented
  domain policies, and their public API signatures must use API-owned carrier
  types rather than internal domain-module model types.

## Next Parity Step

Implement runtime travel action parity next. The original implementation turns
stair exits and transition destinations into travel-surface actions; this
codebase now loads those authored facts but does not yet expose movement
commands or cross-map/overworld transition execution.

## Open Delivery Questions

- Which editor tools are mandatory for the first usable milestone?
- What minimal room-inspector content is required for travel to feel complete?
- Which topology-repair policies must be locked before editor history is
  considered stable?
