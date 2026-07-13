Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-13
Source of Truth: Phase 2 W1 harness check/closure inventory for splitting
`DungeonAuthoredApplicationService`.

# W1 Harness Inventory - DungeonAuthoredApplicationService

## Scope

This inventory freezes the old-structure parity surface before the Phase 2 W1
baseline for `src/domain/dungeon/DungeonAuthoredApplicationService.java`.
No production code, harness scenario, fixture, assertion, proof label, or
visible text changed during this step.

`DungeonAuthoredApplicationService` exposes these W1-relevant public and
published seam families:

- Session and read model: `openSession`, `loadMap`, `findMap`, `derive`, and
  nested `Session` search/load/selection entrypoints.
- Authored geometry mutations: room rectangle, cluster boundary, door boundary,
  wall boundary, and cluster stretch operations.
- Handle and preview workflow: cluster, door, corridor, and stair handle moves;
  published preview apply; nested `Session` preview execution.
- Authored element lifecycle: corridor, stair, transition, and feature-marker
  create/delete/can-create operations.
- Detail-save seam types: room narration, label name, transition link,
  transition description, stair geometry, and operation-result records.

## Production Route

The W1 production-route oracle is the existing Dungeon Editor and Dungeon
Travel harness set. The harness runtime registers `SqliteDungeonMapRepository`
and `DungeonServiceContribution`, binds `DungeonEditorContribution` through the
shell slots, and records route rows with `ProofType=RealRoute`.

`dungeonEditorCoreBehaviorHarness` is retained as supplemental model-invariant
coverage. It is not treated as the only W1 parity proof.

## Frozen Scenario And Assertion Inventory

| Family | Tasks | Frozen coverage |
| --- | --- | --- |
| Core authored invariants | `dungeonEditorCoreBehaviorHarness` | 72 proof items covering geometry, component, floor, wall-core, door-core, path-core, corridor-core, stair-core, transition-core, runtime-projection, topology, cluster-core, room-core, and structure invariants. |
| Full editor route aggregate | `dungeonEditorBehaviorHarness`, `dungeonEditorRouteBehaviorHarness` | 206 aggregate and 187 route proof items covering map catalog, map controls, projection overlay, selection, stairs, transitions, features, corridors, labels, shared handles, door handles, cluster handles, cluster routes, doors, rooms, and walls. |
| Door/wall/room/cluster focus | `dungeonEditorDoorBehaviorHarness`, `dungeonEditorWallBehaviorHarness`, `dungeonEditorRoomBehaviorHarness`, `dungeonEditorClusterBehaviorHarness` | Door 58, wall 33, room 64, and cluster 84 proof items. Assertions cover SQLite mutation/readback, published state, render readback, selection, previews, handle movement, invalid geometry rejection, and reload stability. |
| Corridor/stair/transition/feature focus | `dungeonEditorCorridorBehaviorHarness`, `dungeonEditorStairBehaviorHarness`, `dungeonEditorTransitionBehaviorHarness`, `dungeonEditorFeatureBehaviorHarness` | Corridor 68, stair 63, transition 62, and feature-marker 59 proof items. Assertions cover create/delete, can-create rejection, anchor/handle moves, persisted readback, topology, selection, inspector state, and reload behavior. |
| Travel and render consumers | `dungeonTravelProjectionLevelHarness`, `dungeonMapRenderParityHarness` | Travel 5 proof items and render parity 3 image checks. Assertions cover `loadMap`, `findMap`, and `derive` consumers, linked/unlinked transition movement, projection level selection, party token location, no authored-truth mutation, and editor/travel render parity. |
| Harness structure | `checkBehaviorHarnessTopology` | Registered behavior-harness topology remains valid for the W1 proof set. |

Harness scenarios and assertions are frozen for W1 baseline and target design.
Only harness wiring may be ported, and only in the separate W1 wiring-port
cycle step.

## Retained Proof

Accepted W1 step-1 proof:

- `tools/gradle/run-observable-gradle.sh dungeonEditorCoreBehaviorHarness dungeonEditorBehaviorHarness dungeonEditorRouteBehaviorHarness` passed with retained log `build/gradle-run-logs/20260713T111054622741220-pid116911-dungeonEditorCoreBehaviorHarness__dungeonEditorBehaviorHarness__dungeonEditorRouteBehaviorHarness.log`.
- `tools/gradle/run-observable-gradle.sh dungeonEditorDoorBehaviorHarness` passed after a transient latency miss, retained log `build/gradle-run-logs/20260713T112021346890229-pid126221-dungeonEditorDoorBehaviorHarness.log`.
- `tools/gradle/run-observable-gradle.sh dungeonEditorDoorBehaviorHarness dungeonEditorWallBehaviorHarness dungeonEditorRoomBehaviorHarness dungeonEditorClusterBehaviorHarness` passed with retained log `build/gradle-run-logs/20260713T112142548201954-pid127574-dungeonEditorDoorBehaviorHarness__dungeonEditorWallBehaviorHarness__dungeonEditorRoomBehaviorHarness__dungeonEditorClusterBehaviorHarness.log`.
- `tools/gradle/run-observable-gradle.sh dungeonEditorCorridorBehaviorHarness dungeonEditorStairBehaviorHarness dungeonEditorTransitionBehaviorHarness dungeonEditorFeatureBehaviorHarness` passed with retained log `build/gradle-run-logs/20260713T112207247669148-pid128808-dungeonEditorCorridorBehaviorHarness__dungeonEditorStairBehaviorHarness__dungeonEditorTransitionBehaviorHarness__dungeonEditorFeatureBehaviorHarness.log`.
- `tools/gradle/run-observable-gradle.sh dungeonTravelProjectionLevelHarness dungeonMapRenderParityHarness checkBehaviorHarnessTopology` passed with retained log `build/gradle-run-logs/20260713T112649339019823-pid132371-dungeonTravelProjectionLevelHarness__dungeonMapRenderParityHarness__checkBehaviorHarnessTopology.log`.
- `tools/gradle/run-staged-verification.sh focused-handoff --path src/domain/dungeon --area dungeon-authored-application-service --with compile-integrity` passed with wrapper log `build/gradle-run-logs/20260713T092751Z-staged-focused-handoff.log` and observable log `build/gradle-run-logs/20260713T112752175226150-pid134722-focused-handoff.log`.

Non-advancing attempts:

- The first batch attempt inside the sandbox failed before task execution with
  Gradle wildcard-IP startup resolution. It is environment evidence, not a
  harness result.
- The first door/wall/room/cluster batch produced a transient
  `DE-HANDLE-006` latency miss (`max=342ms`) in the door harness. A focused
  door rerun passed, and the full batch command then exited green.
- A travel/render command containing the stale task name
  `checkHarnessMapConsistency` failed at Gradle task selection before harness
  execution. The live task list has `checkBehaviorHarnessTopology` and no
  `checkHarnessMapConsistency`; the corrected command passed.

## Gap Decision

No W1 harness gap blocks baseline. `docs/project/verification/harness-gaps.md`
has no open `DungeonAuthoredApplicationService` gap, and the current proof set
covers the service's editor, travel, render, persistence, publication, and
model-invariant consumers against the old structure.

W1 may proceed to baseline metrics. The baseline must measure the current
service surface, member clusters, chain lengths, tripwires, typed-boundary
residue, and any existing exception candidates before target design.
