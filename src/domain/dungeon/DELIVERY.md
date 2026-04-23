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
- The active topology ownership model is map-owned: selectable map elements
  carry stable topology refs, and `DungeonMap` resolves semantic bindings before
  applying topology mutations.
- Dungeon SQLite persistence now stores those stable refs in an authoritative
  topology-element table while keeping legacy room, corridor, stair, door, and
  transition tables as detail and compatibility storage.
- Read selection uses `DungeonMapSearch`, keeping read-only map lookup separate
  from authored persistence.
- The SQLite schema manager creates the authoritative topology table and the
  legacy-compatible dungeon detail table family required for later parity work.
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
- Runtime travel action parity is active for local traversal links and
  transitions: the travel surface derives one local tile-to-tile traversal
  model from authored door boundaries and stair exits, derives separate
  transition actions for cross-map or overworld targets, and stores active
  character travel positions through the party character-state boundary.

Recommended rollout:

1. Load and inspect a dungeon map on the base surface.
2. Deliver the travel surface with room inspection and travel actions.
3. Deliver the editor surface with selection, preview, and history.
4. Add advanced topology tools such as corridor, stair, and wall authoring.

## Risks

- UI specifications are broader than the currently stabilized domain policies.
- Undo/redo semantics need an explicit implementation contract before broad
  editor rollout. Preview/apply now share the published editor-operation
  vocabulary, while live canvas overlays remain presentation-local.
- Room and connection projections can drift until every editor mutation writes
  through the same map-owned topology refs and repair services that runtime
  rendering, travel, and SQLite persistence now share.
- Full parity still needs editor mutation policies, direct runtime token-drag
  movement, cross-map dungeon transition follow-through, and remaining
  non-space feature mapping before those behaviours can be considered
  preserved.
- Advanced editor operation carriers must be introduced only with implemented
  domain policies, and their public API signatures must use API-owned carrier
  types rather than internal domain-module model types.

## Next Parity Step

Implement direct token movement next. The original runtime updates character
position when the party token is moved on the dungeon surface, not only when a
listed travel action is selected. This codebase now persists action-driven
movement through the party character-state model, but token-drag movement still
needs to feed the same party-owned travel position command path.

## Open Delivery Questions

- Which editor tools are mandatory for the first usable milestone?
- What minimal room-inspector content is required for travel to feel complete?
- Which topology-repair policies must be locked before editor history is
  considered stable, especially for door, corridor, stair, and transition edits?
