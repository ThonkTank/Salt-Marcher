Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-08
Source of Truth: Editor handle route and presentation expectations for
Dungeon Editor behavior verification.

# Dungeon Editor Handle Matrix

## Purpose

This catalog owns proof rows for the shared editor-handle concept. It covers
published handle identity, hit behavior, drag behavior, and non-obstructive
rendering. Concept-specific mutation effects remain in the owning room,
cluster, wall, corridor, or stair catalogs. Wall-run midpoint markers are part
of the shared published handle vocabulary and are now hit-indexed draggable
handles through the cluster wall-run route.

Later proof for corner-drag on a freshly UI-created room must compose this
shared handle route with the owning room and wall/floor persistence catalogs.
The shared handle rows below do not claim that UI-created-room corner-drag
round trip exists; they only prove common handle publication, hit routing,
preview, and presentation behavior.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-HANDLE-001` | Shared handle publication and basic hit shape | Load map with cluster, corridor, stair, and door handles | `F16_HANDLE_VARIETY` | Published handles use one common identity shape for cluster, door, corridor, and stair handles; the visible door handle resolves as an editor handle target. | Ready |
| `DE-HANDLE-002` | Shared handle hit route | `DungeonMapView` hit testing over interactive handle types | Existing focused handle fixtures | Cluster wall-run and cluster-corner handles resolve to handle targets, corridor/stair anchors are covered by their focused selection routes, and door handle hit shape is covered by `DE-HANDLE-001`. Door drag behavior remains boundary-owned and outside this shared-handle hit row. | Ready |
| `DE-HANDLE-003` | Shared handle drag preview | Primary drag on movable handles | Existing focused handle fixtures | Cluster wall-run and cluster-corner drags publish move preview deltas without mutating authored rows before release. Door drag-preview proof is boundary-owned and outside this shared-handle drag row. | Ready |
| `DE-HANDLE-004` | Non-obstructive visual style | Render scene inspection | `F16_HANDLE_VARIETY` | Wall-run handle style stays smaller and less obstructive than cluster corner handles while remaining hittable. | Ready |
| `DE-HANDLE-005` | Label targets are not generic handles | Hit testing cluster and room labels | `F1_SINGLE_ROOM` / `F15_COMPLEX_CLUSTER` | Label targets remain distinct from wall-corner, wall-line, corridor, and stair handles. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
- [Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md)
- [Dungeon Cluster Invariants](verification-dungeon-cluster-invariants.md)
- [Dungeon Corridor Invariants](verification-dungeon-corridor-invariants.md)
- [Dungeon Stair Invariants](verification-dungeon-stair-invariants.md)
