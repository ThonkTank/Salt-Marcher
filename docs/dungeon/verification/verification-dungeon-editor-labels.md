Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Editor label route and presentation expectations for Dungeon
Editor behavior verification.

# Dungeon Editor Label Matrix

## Purpose

This catalog owns proof rows for cluster and room map labels: default text,
custom naming routes, placement, render style, hit behavior, and reload
stability. It does not own narration text or transition destination labels.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-LABEL-001` | Default cluster label | Reload seeded persisted unnamed cluster | `F1_SINGLE_ROOM` | Loaded map label text is `Cluster <clusterId>` and does not reuse the first room name. | Ready |
| `DE-LABEL-002` | Cluster label centered in cluster | Render unnamed cluster | `F15_COMPLEX_CLUSTER` | Cluster label anchor is the authored cluster floor-cell centroid, not a bounding-box-only point. | Ready |
| `DE-LABEL-003` | Default room label | Load or create unnamed room | `F1_SINGLE_ROOM` | Room floor label text is `Raum <roomId>`. | Harness Gap |
| `DE-LABEL-004` | Room label follows longest wall | Render room label | `F15_COMPLEX_CLUSTER` | Room label is subdued floor text parallel to the longest available room wall run. | Implementation Gap |
| `DE-LABEL-005` | State-panel cluster label rename | Select cluster, edit name in state panel, save | `F1_SINGLE_ROOM` | Custom cluster name persists, reloads, updates the rendered label, and does not mutate room geometry. | Implementation Gap |
| `DE-LABEL-006` | State-panel room label rename | Select room, edit name in state panel, save | `F1_SINGLE_ROOM` | Custom room name persists, reloads, updates the rendered label, and does not mutate room geometry. | Implementation Gap |
| `DE-LABEL-007` | Label target separation | Hit and drag rendered labels | `F1_SINGLE_ROOM` | Cluster label drag moves the cluster; direct edit edits the name; room label does not behave like a cluster drag handle. | Implementation Gap |
| `DE-LABEL-008` | Direct cluster-label rename | Direct edit on rendered cluster label | `F1_SINGLE_ROOM` | Direct edit persists the same authored cluster name as state-panel rename. | Implementation Gap |
| `DE-LABEL-009` | Direct room-label rename | Direct edit on rendered room label | `F1_SINGLE_ROOM` | Direct edit persists the same authored room name as state-panel rename. | Implementation Gap |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Room Matrix](verification-dungeon-editor-rooms.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
- [Dungeon Room Invariants](verification-dungeon-room-invariants.md)
- [Dungeon Cluster Invariants](verification-dungeon-cluster-invariants.md)
