Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Observable runtime-scene behavior and acceptance criteria.

# Runtime Scene Requirements

## Goal

Give the GM one runtime tab for maintaining parallel running scenes, switching
between split-party contexts, and keeping the matching Encounter session in
view.

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

Prepared-scene import is a one-time copy of title, notes, location, participant
references, and linked saved Encounter plan. Only active, currently unassigned
participants are imported. Later planner edits do not update the runtime scene.

## Visible Behavior

- The Standardszene cannot be deleted but can be renamed.
- Newly activated PCs appear as unassigned instead of moving automatically.
- Friendly NPCs enter the scene Encounter as allies, hostile NPCs as enemies,
  and neutral NPCs remain visible context without joining combat.
- The scene location automatically constrains later Encounter generation.
- PC and NPC changes during initiative or combat reconcile immediately while
  retaining existing initiative, HP, round, and active turn where applicable.
- A failed Encounter synchronization is visible and blocks use of stale
  Encounter state until synchronization succeeds.

## Acceptance Criteria

- A logical `no scene` state cannot be produced through the UI or domain API.
- Split scenes keep independent Builder, Initiative, Combat, and Result state.
- XP balancing and awards use only PCs assigned to that scene.
- Scene persistence stores foreign IDs, not copied Party or World Planner data.
- A restart restores focus, scene contents, generated alternatives, initiative,
  combatants, HP, round, turn, result, and XP-award status.
- The Scene tab leaves the global Encounter state pane visible.
