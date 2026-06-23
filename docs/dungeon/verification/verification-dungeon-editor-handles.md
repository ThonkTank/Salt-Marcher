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
cluster, wall, corridor, door, or stair catalogs. Wall-run midpoint markers are part
of the shared published handle vocabulary, but cluster drag handles are canvas
visible and hittable only while their owning cluster is selected through a
cluster-specific route such as the cluster label. Selecting a room floor area is
a room selection, not a cluster selection, for this purpose. Door handle refs
are visible shared canvas drag handles; corridor endpoint refs remain
focused-route facts unless a corridor-specific route promotes them.

Later proof for corner-drag on a freshly UI-created room must compose this
shared handle route with the owning room and wall/floor persistence catalogs.
The shared handle rows below do not claim that UI-created-room corner-drag
round trip exists; they only prove common handle publication, hit routing,
preview, and presentation behavior.

## Proof Suites

Handle rows are split by ownership in `DungeonEditorBehaviorSuiteHarness`:
`shared-handles` owns cross-family handle identity and passive-ref behavior,
`door-handles` owns door handle movement and preview latency, and
`cluster-handles` owns selected cluster corner and wall-run handle behavior.
Focused feature tasks depend on only the handle suite they need.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DE-HANDLE-001` | Shared handle publication and active door handles | Load map with cluster, corridor, stair, and door facts | `F16_HANDLE_VARIETY` | Published refs preserve identity shape; door refs resolve as shared canvas drag handles while corridor endpoint refs remain passive outside focused corridor routes. | Ready |
| `DE-HANDLE-002` | Selected cluster handle hit route | `DungeonMapView` hit testing before and after cluster-label selection | Existing focused handle fixtures | Cluster wall-run and cluster-corner handles are not hittable before cluster selection; after selecting the owning cluster label, they resolve to handle targets. | Ready |
| `DE-HANDLE-003` | Cluster handle drag preview | Primary drag on selected movable cluster handles | Existing focused handle fixtures | Cluster corner drags publish move-handle preview deltas; cluster wall-run drags publish boundary-stretch preview deltas carrying the selected handle's exact published `sourceEdges` instead of re-expanded same-line wall segments; neither mutates authored rows before release. | Ready |
| `DE-HANDLE-004` | Non-obstructive selected visual style | Render scene inspection | `F16_HANDLE_VARIETY` | Selected wall-run handle style is a thinner midpoint affordance than selected cluster corner handles. | Ready |
| `DE-HANDLE-005` | Label targets are not generic handles | Hit testing cluster and room labels | `F1_SINGLE_ROOM` / `F15_COMPLEX_CLUSTER` | Label targets remain distinct from selected wall-corner, selected wall-run, corridor endpoint, door, and stair routes. | Ready |
| `DE-HANDLE-006` | Door handle preview responsiveness | Primary drag on a published door handle | `F16_HANDLE_VARIETY` | Door handle drag publishes a move-handle preview without persisting authored rows and stays within the editor drag-preview latency budget. | Ready |

## References

- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor-Wide Invariants](verification-dungeon-editor-wide-invariants.md)
- [Dungeon Editor Cluster Matrix](verification-dungeon-editor-clusters.md)
- [Dungeon Editor Label Matrix](verification-dungeon-editor-labels.md)
- [Dungeon Cluster Invariants](verification-dungeon-cluster-invariants.md)
- [Dungeon Corridor Invariants](verification-dungeon-corridor-invariants.md)
- [Dungeon Stair Invariants](verification-dungeon-stair-invariants.md)
