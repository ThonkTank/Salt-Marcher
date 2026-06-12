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

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-LABEL-001` | Default cluster label | Reload seeded persisted unnamed cluster | `F1_SINGLE_ROOM` | Loaded map label text is `Cluster <clusterId>` and does not reuse the first room name. | Ready |
| `DE-LABEL-002` | Cluster label centered in cluster | Render unnamed cluster | `F15_COMPLEX_CLUSTER` | Cluster label anchor is the authored cluster floor-cell centroid, not a bounding-box-only point. | Ready |
| `DE-LABEL-003` | Default room label | Load unnamed room | `F1_SINGLE_ROOM` | Room floor label text is `Raum <roomId>`. | Ready |
| `DE-LABEL-004` | Room label derives from room floor cells | Render and hit room label | `F15_COMPLEX_CLUSTER` | Room label renders as subdued floor text from model-owned room floor cells with view-owned longest-wall orientation, orientation-aware hit geometry, and matching inline-editor presentation. | Ready |
| `DE-LABEL-005` | State-panel cluster label rename | Select cluster, edit name in state panel, save | `F1_SINGLE_ROOM` | Custom cluster name persists, reloads, updates the rendered label, trims input, and does not mutate room geometry. | Ready |
| `DE-LABEL-006` | Shared room label-name save | Save room name through the shared label-name operation | `F15_COMPLEX_CLUSTER` | Shared room label-name save persists, reloads, renders, trims input, preserves geometry, and works from state-panel room selection. | Ready |
| `DE-LABEL-007` | Label target separation | Hit rendered labels | `F1_SINGLE_ROOM` / `F15_COMPLEX_CLUSTER` | Cluster labels select cluster-name targets. The proven non-overlapping `F15` secondary room label selects a room target without cluster-name selection or cluster drag preview. Overlapped `F1` direct-edit priority is covered by the adjacent direct-edit rows. | Ready |
| `DE-LABEL-008` | Direct cluster-label rename | Direct edit on rendered cluster label | `F1_SINGLE_ROOM` | `DungeonMapView` normal double-click on the overlapped cluster label opens the inline editor and saves through the shared label-name service. | Ready |
| `DE-LABEL-009` | Direct room-label rename | Direct edit on rendered room label | `F1_SINGLE_ROOM` | Shifted direct room-label edit opens the inline editor; sequential typing accumulates, redraw/pan preserves draft, passive outside input preserves the draft, outside primary press cancels without persisting, Enter commits through the shared label-name service, Escape cancels, and committed text persists across reload. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Room Matrix](verification-dungeon-editor-rooms.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
- [Dungeon Room Invariants](verification-dungeon-room-invariants.md)
- [Dungeon Cluster Invariants](verification-dungeon-cluster-invariants.md)
