Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Cluster route expectations for Dungeon Editor behavior
verification.

# Dungeon Editor Cluster Matrix

## Purpose

This catalog owns route-level proof rows for authored cluster selection, whole
cluster movement, wall-line movement, and true-corner movement. Label text,
rename routes, placement, hit separation, and reload stability are owned by
[Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md).

## Proof Suite

Cluster rows are covered by `dungeonEditorClusterBehaviorHarness`, which selects
`labels`, `cluster-handles`, and `cluster-routes` through the shared suite
registry. Door creation/deletion rows stay in the door suite.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-SEL-007` | Existing straight wall drag | Select tool plus current straight wall drag route | `F1_SINGLE_ROOM` | Current route stretches the selected wall through SQLite and renders readback. | Ready |
| `DE-SEL-008` | Existing cluster-corner drag | Select tool plus current cluster-corner drag route | `F1_SINGLE_ROOM` | Current route moves the selected corner through SQLite and renders readback. | Ready |
| `DE-SEL-009` | Move selected cluster as a whole | Select tool plus cluster label drag route | `F1_SINGLE_ROOM` | Cluster, rooms, floor cells, vertices, boundaries, doors, topology, handles, and labels translate by the same delta. | Ready |
| `DE-CLUSTER-001` | Publish complex cluster corner and wall-run affordance facts | Snapshot publication after loading a non-rectangular cluster | `F15_COMPLEX_CLUSTER` | Affordance facts exist on every authored wall corner and every non-trivial straight wall-run midpoint, inside and outside; canvas handle hit/render is selected-only, with smaller wall-run marker styling. | Ready |
| `DE-CLUSTER-002` | Stretch selected true wall run | Select tool plus drag on a selected wall-midpoint handle | `F15_COMPLEX_CLUSTER` | Wall-run drag publishes boundary-stretch preview for the contiguous run, persists a valid move, preserves cluster and room identity, reloads, leaves no duplicate or orphan wall rows, and rejects invalid geometry atomically. | Ready |
| `DE-CLUSTER-003` | Move selected true wall corner | Select tool plus drag on a true corner handle | `F15_COMPLEX_CLUSTER` | The dragged handle is a real authored wall corner, not a bounding-box corner; preview does not mutate SQLite; release persists the moved vertex, recomputes adjacent wall spans, keeps reload stable, and leaves no orphan or duplicate wall rows. | Ready |
| `DE-CLUSTER-004` | Reject exterior wall deletion | Wall delete gesture on cluster exterior wall | `F1_SINGLE_ROOM` | Status reports rejection; authored geometry, topology, preview, and selection remain unchanged. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Handle Matrix](verification-dungeon-editor-handles.md)
- [Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md)
- [Dungeon Cluster Invariants](verification-dungeon-cluster-invariants.md)
- [Dungeon Room Invariants](verification-dungeon-room-invariants.md)
- [Dungeon Wall Invariants](verification-dungeon-wall-invariants.md)
