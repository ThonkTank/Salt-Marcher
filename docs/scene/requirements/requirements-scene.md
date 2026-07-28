# Runtime Scene Requirements

Status: Active target requirements with native Godot core implemented
Owner: Scene
Last Reviewed: 2026-07-28
Source of Truth: This document

## Goal

Give the GM one restart-safe runtime workspace for maintaining parallel scenes,
switching split-party contexts, and opening the exact matching Encounter.
Scene owns runtime composition and focus; Party, World Planner, Session Planner,
Shared Definitions, and Encounter retain ownership of referenced facts.

## Non-Goals

- editing Party, World Planner, Creature, saved Encounter, or Session Planner truth;
- writing runtime changes back into prepared Session Planner scenes;
- allowing more than one location in a running scene;
- copying foreign profiles or statblocks into Scene persistence.

## Primary Flow

1. First activation creates a non-deletable Standardszene containing every
   currently active PC.
2. The GM creates another running scene or copies a prepared Session Planner
   scene.
3. The GM moves PCs and NPCs between contexts, selects one place, adds
   Creature-backed mob groups, and records defeated state or quick notes.
4. Changing focus changes the visible Scene card and the Encounter context that
   the Encounter route opens.
5. Initiative, combat, HP, round, turn, and result state remain independent per
   scene and resume after restart.

Each prepared-scene import creates a new copy of title, notes, location,
participant references, linked saved Encounter plan, and provenance. Only
active, currently unassigned PCs are copied. Repeated imports are valid and
later planning edits never mutate a running copy.

## Visible Behavior

- The Standardszene cannot be deleted but can be renamed.
- Newly activated PCs remain explicitly unassigned; inactive PCs disappear on
  refresh.
- A PC or NPC can belong to at most one running scene and moves atomically.
- Friendly NPCs enter the Scene Encounter as allies, hostile NPCs as enemies,
  and neutral NPCs remain visible without joining combat.
- Mob groups retain stable assignment identity and positive count.
- PC, NPC, mob, or saved-plan changes reconcile the full Encounter roster while
  preserving compatible initiative, HP, round, active turn, and mode.
- Storage, reference, definition, or stale-generation failure is visible and
  publishes neither partial Scene truth nor a mismatched Encounter context.
- Keyboard-operable controls remain usable at 1366 x 768 and compact desktop
  sizes without horizontal scrolling.

## Acceptance Criteria

- No public command can produce a logical workspace with zero scenes.
- Split scenes keep independent Builder, Initiative, Combat, and Result state.
- Initiative and XP use only the PCs assigned to the selected Scene.
- Scene persistence stores foreign identities and provenance, never copied
  Party, World Planner, Session Planner, or Creature facts.
- Every Scene change and its complete Encounter-context synchronization publish
  in one Campaign generation or not at all.
- A restart restores focus, composition, participant state, Encounter roster,
  initiative, combatants, HP, round, turn, result, and XP-award status.
- Production proof covers first initialization, create/focus, split Party,
  NPC/location/mob assignment, participant state, Encounter deep link, combat,
  stale-read suppression, worker cleanup, and restart.
- Passive display, masks, independent time, live search/music, and owner-visible
  acceptance remain explicit completion gates.

## References

- [Scene Domain](../domain/domain-scene.md)
- [Scene Architecture](../architecture/architecture-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)
