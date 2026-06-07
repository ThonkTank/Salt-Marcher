Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Editor handle route and presentation expectations for
Dungeon Editor behavior verification.

# Dungeon Editor Handle Matrix

## Purpose

This catalog owns proof rows for the shared editor-handle concept. It covers
published handle identity, hit behavior, drag behavior, and non-obstructive
rendering. Concept-specific mutation effects remain in the owning room,
cluster, wall, corridor, or stair catalogs. Wall-run midpoint markers are part
of the shared published handle vocabulary, but `CLUSTER_WALL_RUN` is currently
a visual-only marker until the cluster wall-run drag row is implemented; it is
not a normal hit-indexed or draggable handle yet.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-HANDLE-001` | Shared handle publication | Load map with cluster, corridor, stair, and door handles | `F16_HANDLE_VARIETY` | Published handles use one common identity shape for kind, owner, topology, cell, direction, and index. | Harness Gap |
| `DE-HANDLE-002` | Shared handle hit route | `DungeonMapView` hit testing over each interactive handle type | `F16_HANDLE_VARIETY` | Each rendered interactive handle resolves to a handle target, not to a presentation-only label or generic area; `CLUSTER_WALL_RUN` is excluded while it remains visual-only. | Harness Gap |
| `DE-HANDLE-003` | Shared handle drag preview | Primary drag on movable handles | `F16_HANDLE_VARIETY` | Drag publishes move preview deltas without mutating authored rows before release. | Harness Gap |
| `DE-HANDLE-004` | Non-obstructive visual style | Render scene inspection | `F16_HANDLE_VARIETY` | Interactive handles render smaller, rounder, and less obstructive than current label-like controls while remaining hittable; visual-only wall-run midpoint markers render unobtrusively without claiming hit readiness. | Implementation Gap |
| `DE-HANDLE-005` | Label targets are not generic handles | Hit testing cluster and room labels | `F1_SINGLE_ROOM` | Label drag/edit targets remain distinct from wall-corner, wall-line, corridor, and stair handles. | Implementation Gap |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
- [Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md)
- [Dungeon Cluster Invariants](verification-dungeon-cluster-invariants.md)
- [Dungeon Corridor Invariants](verification-dungeon-corridor-invariants.md)
- [Dungeon Stair Invariants](verification-dungeon-stair-invariants.md)
