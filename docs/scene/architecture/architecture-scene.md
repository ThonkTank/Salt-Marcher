# Runtime Scene Architecture

Status: Active native Godot architecture
Owner: Scene
Last Reviewed: 2026-07-28
Source of Truth: This document

## Objective

Provide one native split-party runtime owner whose visible composition and
Encounter contexts can never diverge across a successful publication.

## Current Topology

```text
Party partition ------------+--> SceneCommandController
World Planner partition ----+          |
Shared Definitions ---------/          +--> SceneKnowledge
                                         +--> EncounterRuntimeKnowledge
                                         +--> one Campaign generation

File Campaign Store --> SceneReadController --> SceneWorkspace
                                              --> exact Encounter context deep link
```

`scene_knowledge.gd` is pure owner logic. `scene_command_controller.gd` reads a
generation-bound snapshot of supporting owner partitions, resolves complete
Creature facts, transforms Scene and Encounter copies, confirms Campaign and
Shared-Definition generations, and submits both replacements to the admitted
serial Campaign writer. `scene_read_controller.gd` uses one active plus one
latest pending worker and suppresses stale publication. `scene_workspace.gd`
dispatches intents and renders the bridge deck. `main_shell.gd` is the sole
route composition point.

## Decisions

- Running Scenes are independent runtime contexts, not Session Planner records.
- Session Planner timeline entries are not materialized as Scene copies.
- Scene owns composition; Encounter owns all workflow and combat state.
- Party activation, reserve, and deletion synchronize exact Scene assignment
  and Encounter context facts in the same Campaign publication.
- Context IDs derive deterministically from stable Scene IDs without making
  Encounter depend on Scene types.
- A complete owner generation replaces the former save-then-sync saga. There is
  no partial "Scene saved, Encounter pending" success state.
- Creature details are resolved in one bounded Shared-Definition read before a
  write. Scene stores only references and last-known display comes from the read
  projection.
- Hidden Scene UI performs no route-activation write. The first Party membership
  change can initialize the primary Scene atomically; route activation refreshes
  current foreign facts.
- The focus compass keeps parallel context visible while one explicit deep link
  opens the exact Encounter runtime.

Rejected alternatives are one global Encounter, copied or live-linked prepared
Scenes, Scene-owned combat snapshots, background hidden-route writes, and a
retryable cross-owner storage saga.

## Execution And Failure

Pure transforms run off the scene-tree thread. Campaign file reads and
Shared-Definition resolution run on the command/read workers. Only immutable
snapshot application and input dispatch occur on the scene-tree thread.
Cancellation or supersession drops avoidable read work. A command that reaches
the serial writer resolves as one complete success or failure.

## References

- [Source Architecture](../../project/architecture/source-architecture.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
- [Scene Requirements](../requirements/requirements-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)
