Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Temporary rollout notes, phasing, and open delivery questions
for the dungeon map feature.

# Dungeon Map Delivery Notes

## Delivery Shape

Recommended rollout:

1. Load and inspect a dungeon map on the base surface.
2. Deliver the travel surface with room inspection and travel actions.
3. Deliver the editor surface with selection, preview, and history.
4. Add advanced topology tools such as corridor, stair, and wall authoring.

## Risks

- UI specifications are broader than the currently stabilized domain policies.
- Preview behavior and undo/redo semantics need explicit implementation
  contracts before broad editor rollout.
- Room and connection projections can drift if ownership rules are not enforced
  consistently.

## Open Delivery Questions

- Which editor tools are mandatory for the first usable milestone?
- What minimal room-inspector content is required for travel to feel complete?
- Which topology-repair policies must be locked before editor history is
  considered stable?
