Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Temporary rollout notes, phasing, and open delivery questions
for the dungeon feature.

# Dungeon Delivery Notes

## Delivery Shape

Current foundation:

- the dungeon root service is assembled by the data contribution with concrete
  SQLite adapters
- `DungeonMap` is the active write model
- the map-owned topology model is active
- authored room, corridor, stair, and transition reads are represented through
  the current persistence path
- runtime travel actions already use authored truth plus party runtime state

Recommended rollout:

1. load and inspect a dungeon map on the base surface
2. deliver the travel surface with room inspection and travel actions
3. deliver the editor surface with selection, preview, and history
4. add advanced topology tools such as corridor, stair, and transition
   authoring

## Risks

- UI expectations are broader than the currently stabilized domain policies
- undo and redo semantics still need a harder implementation contract
- full parity still needs direct token-drag movement, cross-map transition
  follow-through, and remaining non-space feature mapping

## Next Parity Step

Implement direct token movement next so token drag feeds the same party-owned
runtime position path as action-driven movement.

## Current Debt

- the shared map-canvas seam is now implemented through `MapCanvasView`,
  `MapRenderScene`, and `DungeonMapCanvasAdapter`
- remaining parity debt is now outside the old one-off dungeon boundary-carrier
  cleanup, which has been replaced by the canonical authored-read,
  authored-mutation, catalog, and travel boundary families

## Open Delivery Questions

- Which editor tools are mandatory for the first usable milestone?
- What minimal room-inspector content is required for travel to feel complete?
- Which topology-repair policies must be locked before editor history is
  considered stable?

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Travel Requirements](./requirements-dungeon-travel.md)
- [Dungeon Editor Requirements](./requirements-dungeon-editor.md)
