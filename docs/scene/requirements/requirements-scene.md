Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-22
Source of Truth: Observable runtime-scene behavior and acceptance criteria.

# Runtime Scene Requirements

## Goal

Give the GM one runtime tab for maintaining parallel running scenes, switching
between split-party contexts, and keeping the matching Encounter session in
view.

The affected user is the GM during live play. Scene owns runtime composition
and focus; Party, World Planner, Session Planner, and Encounter remain the
owners of the referenced content.

## Non-Goals

- editing Party, World Planner, creature, or saved Encounter truth
- writing runtime changes back into Session Planner scenes
- allowing more than one location in a running scene

## Primary Flow

1. On first use, a Standardszene exists and contains every currently active PC.
2. The GM creates another scene or loads a prepared Session Planner scene.
3. PCs are moved between scenes; one PC can be in at most one running scene.
4. The GM selects one World Planner location and any number of World Planner
   NPCs for the focused scene.
5. Switching scenes immediately switches the visible Encounter session.
6. Every scene and Encounter session is restored after an application restart.

Each prepared-scene import creates a new copy of title, notes, location,
participant references, linked saved Encounter plan, and source provenance.
Only active, currently unassigned participants are copied. The same prepared
scene can be imported repeatedly; later planner edits do not update any runtime
copy.

## Visible Behavior

- The Standardszene cannot be deleted but can be renamed.
- Newly activated PCs appear as unassigned instead of moving automatically.
- Inactive or deleted PCs stop counting as current Party facts immediately.
  Every affected running Scene and its Encounter reconcile to the accepted Party
  revision; unaffected running contexts do not change.
- Assigning a PC or NPC to another scene moves that reference atomically; it is
  never shown in two scenes.
- Each scene has at most one location, while the same location may be used by
  several scenes.
- Friendly NPCs enter the scene Encounter as allies, hostile NPCs as enemies,
  and neutral NPCs remain visible context without joining combat.
- The scene location automatically constrains later Encounter generation.
- PC and NPC changes during initiative or combat reconcile immediately while
  retaining existing initiative, HP, round, and active turn where applicable.
- A failed Encounter synchronization is visible as pending. The saved Scene
  workspace remains usable, while stale Encounter context MUST NOT be presented
  as synchronized. Initialization and refresh retry the saved revision.
- A Party mutation is not rolled back when Scene or Encounter reconciliation
  fails. The affected Scene stays visibly pending and retries without repeating
  the Party mutation.
- Storage failure is visible and does not publish an unsaved workspace as the
  durable result.

## Acceptance Criteria

- A logical `no scene` state cannot be produced through the UI or domain API.
- Construction and `SceneModel.current()` perform no persistence or foreign
  I/O; initialization and commands complete asynchronously.
- Split scenes keep independent Builder, Initiative, Combat, and Result state.
- XP balancing and awards use only PCs assigned to that scene.
- Scene persistence stores foreign IDs, not copied Party or World Planner data.
- A failed post-save Encounter synchronization leaves the persisted Scene
  revision marked unsynchronized, and a later initialization or refresh can
  mark that revision synchronized.
- an unavailable affected Scene or Encounter cannot make an inactive or deleted
  character appear to be a current Party member
- A restart restores focus, scene contents, generated alternatives, initiative,
  combatants, HP, round, turn, result, and XP-award status.
- The Scene tab leaves the global Encounter state pane visible.

The executable acceptance route is `./gradlew check`; headless JavaFX tests own
the observable controls/main-slot flow, while application and SQLite tests own
the invariants and recovery outcomes.

## References

- [Scene Domain](../domain/domain-scene.md)
- [Scene Architecture](../architecture/architecture-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)
- [Live Campaign Runtime Requirements](../../project/requirements/requirements-campaign-runtime.md)
