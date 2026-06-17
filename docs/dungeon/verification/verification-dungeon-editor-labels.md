Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Editor label route and presentation expectations for Dungeon
Editor behavior verification.

# Dungeon Editor Label Matrix

## Purpose

This catalog owns proof rows for cluster and room map labels: default text,
custom naming routes, placement, render style, hit behavior, and reload
stability. It does not own narration text or transition destination labels.

## Proof Suite

Label rows are covered by the `labels` suite and by
`dungeonEditorClusterBehaviorHarness` when cluster behavior is investigated.
Door-focused runs do not depend on label rows.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-LABEL-001` | Default cluster label | Reload seeded persisted unnamed cluster | `F1_SINGLE_ROOM` | Loaded map label text is `Cluster <clusterId>` and does not reuse the first room name. | Ready |
| `DE-LABEL-002` | Cluster label centered in cluster | Render unnamed cluster | `F15_COMPLEX_CLUSTER` | Cluster label anchor is the authored cluster floor-cell centroid, not a bounding-box-only point. | Ready |
| `DE-LABEL-003` | Default room label | Load unnamed room | `F1_SINGLE_ROOM` | Room floor label text is `Raum <roomId>`. | Ready |
| `DE-LABEL-004` | Room label derives from room floor cells | Render passive room label | `F15_COMPLEX_CLUSTER` | Room label renders as subdued floor text from model-owned room floor cells with view-owned longest-wall orientation, wall-adjacent placement, size-aware scaling, and no interactive room-label hit target. | Ready |
| `DE-LABEL-005` | State-panel cluster label rename | Select cluster, edit name in state panel, save | `F1_SINGLE_ROOM` | Custom cluster name persists, reloads, updates the rendered label, trims input, and does not mutate room geometry. | Ready |
| `DE-LABEL-006` | Shared room label-name save | Save room name through the shared label-name operation | `F15_COMPLEX_CLUSTER` | Shared room label-name save persists, reloads, renders, trims input, preserves geometry, and works from state-panel room selection. | Ready |
| `DE-LABEL-007` | Label target separation | Hit rendered labels and room floors | `F1_SINGLE_ROOM` / `F15_COMPLEX_CLUSTER` | Cluster labels select cluster-name targets and can start cluster drag preview. Room labels remain passive; selecting a room goes through room floor cells without cluster-name selection or cluster drag preview. | Ready |
| `DE-LABEL-008` | Direct cluster-label rename | Direct edit on rendered cluster label | `F1_SINGLE_ROOM` | `DungeonMapView` normal double-click on the overlapped cluster label opens the inline editor and saves through the shared label-name service. | Ready |
| `DE-LABEL-009` | Passive room-label edit rejection | Direct edit gestures on rendered room label plus floor selection | `F1_SINGLE_ROOM` | Normal and shifted direct room-label gestures do not open an inline editor or select a label target; room selection remains available through floor-cell hits, and room-name persistence is covered by the state-panel save route. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Room Matrix](verification-dungeon-editor-rooms.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
- [Dungeon Room Invariants](verification-dungeon-room-invariants.md)
- [Dungeon Cluster Invariants](verification-dungeon-cluster-invariants.md)
