Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-07
Source of Truth: Editor-wide Dungeon Editor verification conventions and
requirement-derived proof mapping shared by tool-specific behavior catalogs.

# Dungeon Editor-Wide Invariants

## Purpose

This document owns only editor-wide verification invariants shared by multiple
Dungeon Editor tools. Editor behavior requirements remain in
[Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md);
this catalog maps those requirements into shared proof conventions. Tool-
specific behavior rows live in the dedicated tool catalogs under this
verification folder.

## Scope Boundary

- This document does not define new user-facing editor behavior and does not
  define room, cluster, wall, door, corridor, stair, transition, handle, or
  label behavior rows.
- Shared input and design bullets below are requirement-derived proof mapping,
  not an independent behavior source.
- The fixture catalog owns named authored fixture definitions. Tool catalogs
  own their own row IDs, fixture usage, expected persistence, snapshots, render
  assertions, and gap statuses.
- Model-only invariant catalogs use `DGI-*` rows and do not close editor
  `DE-*` route rows.
- Dungeon-specific domain architecture lives in
  [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md);
  domain truth lives in [Dungeon Domain](../domain/domain-dungeon.md).

## Proof Model

Real-route editor proofs drive the actual View route where possible:

- build input through the owning view control or JavaFX event handler
- let the production route run through the owning view control or JavaFX event
  handler when a UI route exists, view input adapter such as
  `DungeonEditorIntentHandler` where present, migrated feature-runtime operation
  owner for migrated editor workflows, domain owner APIs for authored mutation,
  persistence, publication, and render-frame/content-model readback
- inspect authored geometry in SQLite-backed repository readback, editor state
  in `DungeonEditorMapSurfaceSnapshot`, and render facts in
  `DungeonMapContentModel`
- use direct published-command construction only as a marked fallback, carrying
  `Input Route Gap` until the real View route exists

Every published route proof row must include `OwnerSuite`, `ProofType=RealRoute`,
and the catalog `DE-*` row id. Model invariant rows must include `OwnerSuite`,
`ProofType=ModelInvariant`, and their `DGI-*` id.

## Behavior Suite Routing

Dungeon Editor behavior proof is addressed through
`DungeonEditorBehaviorSuiteHarness`. The harness owns the runnable suite graph:
atomic suites declare their prerequisite suites, while `core`, `routes`, and
`all` are aliases only. The registry is the only ordering source; Gradle
entrypoints select JUnit methods that run the matching registry suite scope
instead of keeping separate proof order.

Use these focused Gradle entrypoints during investigation:

| Task | Suite scope |
| --- | --- |
| `dungeonEditorDoorBehaviorHarness` | Door route behavior, door handles, and declared core dependencies. |
| `dungeonEditorWallBehaviorHarness` | Wall route behavior and declared wall/core dependencies. |
| `dungeonEditorRoomBehaviorHarness` | Room route behavior and declared room/core dependencies. |
| `dungeonEditorClusterBehaviorHarness` | Label, cluster-handle, and cluster-route behavior plus declared cluster/core dependencies. |
| `dungeonEditorCorridorBehaviorHarness` | Corridor route behavior and declared corridor/core dependencies. |
| `dungeonEditorStairBehaviorHarness` | Stair route behavior and declared stair/core dependencies. |
| `dungeonEditorTransitionBehaviorHarness` | Transition route behavior and declared transition/core dependencies. |
| `dungeonEditorFeatureBehaviorHarness` | Feature-marker controls, create/delete, hit, and reload behavior plus declared editor-route dependencies. |
| `dungeonEditorCoreBehaviorHarness` | Model-only `DGI-*` core invariant suites. |
| `dungeonEditorRouteBehaviorHarness` | All editor real-route suites through the same registry. |
| `dungeonEditorBehaviorHarness` | Complete Dungeon Editor behavior proof aggregate. |

`dungeonEditorBehaviorHarnessSuites` reports the current suite IDs through a
JUnit task. A focused task must not manually construct expected behavior or
bypass production routes; it only selects which existing production-route proofs
and declared dependencies run.

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `Ready` | Expected behavior, route, persistence, snapshot, and render assertions are concrete enough for route proof. |
| `Implementation Gap` | Required behavior is not sufficiently implemented end to end. |
| `Input Route Gap` | Domain/model surface exists, but the real View route is absent or not exposed. |
| `Harness Gap` | The route exists, but focused behavior-harness proof is absent or incomplete. |
| `Behavior Ambiguous` | Required behavior leaves an observable result unclear. |

## Requirement-Derived Shared Proof Mapping

- Proof rows for tool selection map to the requirement for one focused button
  per editor tool family.
- Primary-input proof rows map to the requirement that LMB or primary input
  selects or places the normal authored target.
- Secondary-input proof rows map to the requirement that RMB or secondary input
  deletes or removes the target, except where an active tool process has a
  documented completion meaning, such as wall path completion.
- Modifier proof rows map to the requirement that Shift and Ctrl only trigger
  the alternate action or mode toggle documented by the active tool catalog.
- Dropdown proof rows map to the requirement that secondary option dropdowns
  anchor under the family button, remember the last option, close on pointer
  leave, and reset to `Auswahl` on `Esc`.
- Preview proof rows map to the requirement that preview state remains visually
  inspectable and never persists authored truth before explicit completion.
- Handle and label visual proof rows map to the requirement that shared styling
  stays non-obstructive and does not make label edit targets indistinguishable
  from geometry drag handles.

## Tool Catalogs

- [Map, projection, and controls](verification-dungeon-editor-map-controls.md)
- [Rooms](verification-dungeon-editor-rooms.md)
- [Selection](verification-dungeon-editor-selection.md)
- [Clusters](verification-dungeon-editor-clusters.md)
- [Walls](verification-dungeon-editor-walls.md)
- [Doors](verification-dungeon-editor-doors.md)
- [Corridors](verification-dungeon-editor-corridors.md)
- [Stairs](verification-dungeon-editor-stairs.md)
- [Transitions](verification-dungeon-editor-transitions.md)
- [Features](verification-dungeon-editor-features.md)
- [Handles](verification-dungeon-editor-handles.md)
- [Labels](verification-dungeon-editor-labels.md)

## Verification Route

Documentation-only changes to these catalogs use:

```bash
./gradlew checkDocumentationEnforcement --console=plain
```

Later production-code or harness implementation must use the smallest
documented focused route during development and the production-code handoff
route required by `AGENTS.md` before final handoff.

## References

- [Dungeon Feature Docs](../README.md)
- [Dungeon Domain Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain](../domain/domain-dungeon.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Editor Fixture Catalog](verification-dungeon-editor-fixtures.md)
- [Core Model Invariants](verification-dungeon-core-model-invariants.md)
