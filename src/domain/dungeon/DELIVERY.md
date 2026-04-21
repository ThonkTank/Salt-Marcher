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
- Runtime travel action parity is active for doors, stairs, and transitions:
  the travel surface derives transient actions from authored door boundaries,
  stair exits, and transition destinations, stores the active dungeon position
  in the shell runtime session, and does not persist campaign-state movement
  yet.

Recommended rollout:

1. Load and inspect a dungeon map on the base surface.
2. Deliver the travel surface with room inspection and travel actions.
3. Deliver the editor surface with selection, preview, and history.
4. Add advanced topology tools such as corridor, stair, and wall authoring.

## Risks

- UI specifications are broader than the currently stabilized domain policies.
- Preview behavior and undo/redo semantics need explicit implementation
  contracts before broad editor rollout.
- Room and connection projections can drift until editor mutation and topology
  repair consistently rebuild the same authored relation graph used by runtime
  rendering and travel.
- Full parity still needs persistent campaign/world travel integration, editor
  mutation policies, direct runtime token-drag movement, and remaining
  non-space feature mapping before those behaviours can be considered
  preserved.
- Advanced editor operation carriers must be introduced only with implemented
  domain policies, and their public API signatures must use API-owned carrier
  types rather than internal domain-module model types.

## Next Parity Step

Implement persistent runtime travel integration next. The original runtime
updates campaign/world state as movement happens and also supports direct token
drag movement on the dungeon surface. This codebase now derives local door,
stair, and transition actions, but keeps the active party position in the shell
runtime session only.

## Open Delivery Questions

- Which editor tools are mandatory for the first usable milestone?
- What minimal room-inspector content is required for travel to feel complete?
- Which topology-repair policies must be locked before editor history is
  considered stable?
