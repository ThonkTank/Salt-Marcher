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
5. The GM creates or edits named creature groups in one catalog-backed builder
   and may manually compose, fill, or replace its transient roster.
6. Switching scenes immediately switches the visible Encounter session.
7. Every persisted scene and Encounter session is restored after restart.

Each prepared-scene import creates a new copy of title, notes, location,
participant references, linked saved Encounter plan, and source provenance.
Only active, currently unassigned participants are copied. The same prepared
scene can be imported repeatedly; later planner edits do not update any runtime
copy.

## Visible Behavior

- The Standardszene cannot be deleted but can be renamed.
- Newly activated PCs appear as unassigned instead of moving automatically.
- Inactive PCs are removed from their running scene on refresh.
- Assigning a PC or NPC to another scene moves that reference atomically; it is
  never shown in two scenes.
- Each scene has at most one location, while the same location may be used by
  several scenes.
- Friendly NPCs enter the scene Encounter as allies, hostile NPCs as enemies,
  and neutral NPCs remain visible context without joining combat.
- The scene location automatically constrains later Encounter generation.
- `Gruppen managen` combines the filtered Creature catalog with one transient
  group draft. Manual changes and generation are evaluated immediately against
  the assigned Party.
- `Auffüllen` preserves the current roster as its generation basis, while `Neu
  generieren` replaces it. Both use optional location, catalog filters, tuning,
  the effective preset, and a deterministic seed. Scene supplies concrete
  source capacity and materializes the shared abstract composition exactly; it
  never weakens a selected CR-Block. Shared Config V5, selection, stock, and
  ranking behavior is defined by the
  [Encounter Generation Requirements](../../encounter/requirements/requirements-encounter-generation.md).
  An unsaved result is discarded only after confirmation and never survives
  restart.
- Encounter may select only persisted groups from the focused Scene.
- Selected groups remain live-linked: Combat HP, death and conditions update
  the same stable Scene members, and saved group edits reconcile immediately.
- Group generation changes living members only and retains existing dead
  members. Archiving a linked group removes it from the running Combat.
- PC and NPC changes during initiative or combat reconcile immediately while
  retaining existing initiative, HP, round, and active turn where applicable.
- Each identical monster below the configured mob threshold receives its own
  initiative slot. At the threshold, the identical set receives one mob slot;
  this partition is fixed when initiative is prepared, remains stable when the
  linked roster changes, and is restored unchanged after restart. Persistence
  records the source Scene-entry ID and `individual`/`mob` partition kind
  explicitly rather than deriving either from a row-ID suffix. The prepared
  runtime also records the effective preset ID/revision, config hash, and mob
  threshold.
- A failed Encounter synchronization is visible as pending. The saved Scene
  workspace remains usable, while stale Encounter context MUST NOT be presented
  as synchronized. Initialization and refresh retry the saved revision.
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
- A restart restores focus, scene contents, initiative, combatants, HP, round,
  turn, result, and XP-award status, but not an unaccepted group proposal.
- The Scene tab leaves the global Encounter state pane visible.

## References

- [Encounter Generation Requirements](../../encounter/requirements/requirements-encounter-generation.md)
- [Scene Domain](../domain/domain-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)

## Party and Groups desktop windows

The scene desktop replaces Overview with independent Party and Groups singleton
windows using the existing move, resize, snap, minimize, and restore controls.
Location editing and scene time remain available in the desktop toolbar.

Party lists only active PCs assigned to the focused scene. Each PC expands
independently to Character, Combat, Passive, and Languages sections, in that
order. D&D terms are English; movement uses the stored feet value. Passive
scores use Per., Ins., and Inv. Class and level form one value; species and
player names have no redundant labels. User-entered text is never translated.
Unknown numeric values show an em dash, not zero.

The Quick Values popup selects which fields also appear beside the collapsed
character name. Its categorized checkboxes do not hide expanded details.
AC and Per. are the defaults. Installation preferences preserve this selection
across scenes and restarts. The row move popup targets another existing scene
through the atomic roster-move command and retains errors without closing.

Groups retain editing, archives, references and loot. Their independent drag
grip places a group into the Combat window without moving either desktop window.
Before initiative, a drop adds to the scene's persisted combat selection only.
During initiative/combat it joins through the existing reinforcement command.
Repeated drops never duplicate membership. Foreign-scope, archived, wholly dead,
and result-phase drops are invalid. Keyboard pickup, target focus, Enter/Space
to drop, and Escape cancellation support the same operation.

Desktop document version 5 migrates each legacy overview to Party plus an offset
Groups window; preserves other windows, selection and minimized state; and leaves
intentionally closed desktops closed. Window capacity allows the extra migrated
window. No campaign or combat state is copied into desktop presentation data.
