# Runtime Scene Requirements

Status: Active target requirements with native Godot core implemented
Owner: Scene
Last Reviewed: 2026-07-28
Source of Truth: This document

## Goal

Give the GM one restart-safe runtime workspace for maintaining parallel scenes,
switching split-party contexts, and opening the exact matching Encounter.
Scene owns runtime composition and focus; Party, World Planner, Shared
Definitions, and Encounter retain ownership of referenced facts.

## Non-Goals

- editing Party, World Planner, Creature, saved Encounter, or Session Planner truth;
- treating Session Planner timeline entries as stored running Scenes;
- allowing more than one location in a running scene;
- copying foreign profiles or statblocks into Scene persistence.

## Primary Flow

1. One primary running group always exists. It contains every active PC when
   there is no split.
2. The GM uses one character-move action to split a PC into a new group or move
   a PC into an existing group to reunite them.
3. The GM moves NPCs between contexts, selects one place, adds
   Creature-backed mob groups, and records defeated state or quick notes.
4. Changing focus changes the visible Scene card and the Encounter context that
   the Encounter route opens.
5. Initiative, combat, HP, round, turn, and result state remain independent per
   scene and resume after restart.

## Visible Behavior

- Group labels are derived as `Hauptgruppe` or from the split-group members;
  the GM neither names, creates, completes, nor deletes running Scenes.
- Every active Party PC belongs to exactly one running Scene. Activating a
  character assigns it to the focused Scene; reserving or deleting it removes
  it in the same Campaign commit.
- Moving the last PC out removes the empty group. A populated destination is
  promoted to primary when the prior primary empties. With no active Party,
  one empty primary Scene remains.
- A PC or NPC can belong to at most one running Scene and moves atomically.
- Friendly NPCs enter the Scene Encounter as allies, hostile NPCs as enemies,
  and neutral NPCs remain visible without joining combat.
- Mob groups retain stable assignment identity and positive count.
- PC, NPC, or mob changes reconcile the full Encounter roster while
  preserving compatible initiative, HP, round, active turn, and mode.
- Storage, reference, definition, or stale-generation failure is visible and
  publishes neither partial Scene truth nor a mismatched Encounter context.
- Keyboard-operable controls remain usable at 1366 x 768 and compact desktop
  sizes without horizontal scrolling.

## Acceptance Criteria

- No public command can produce a logical workspace with zero scenes.
- Split scenes keep independent Builder, Initiative, Combat, and Result state.
- Initiative and XP use only the PCs assigned to the selected Scene.
- Scene persistence stores foreign identities, never copied Party, World
  Planner, Session Planner, saved Encounter, or Creature facts.
- Every Scene change and its complete Encounter-context synchronization publish
  in one Campaign generation or not at all.
- A restart restores focus, composition, participant state, Encounter roster,
  initiative, combatants, HP, round, turn, result, and XP-award status.
- Production proof covers first initialization, focus, split/reunite Party,
  NPC/location/mob assignment, participant state, Encounter deep link, combat,
  stale-read suppression, worker cleanup, and restart.
- Passive display, masks, independent time, live search/music, and owner-visible
  acceptance remain explicit completion gates.

## References

- [Scene Domain](../domain/domain-scene.md)
- [Scene Architecture](../architecture/architecture-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)
