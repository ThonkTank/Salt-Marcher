# Encounter Feature Spec

## Goal

Provide difficulty evaluation, Initiative, Combat, and Resolution for a
selected subset of groups belonging to the focused runtime Scene. Encounter
uses only PCs assigned to that Scene and never creates or edits Scene groups.

The pure evaluation and generation rules remain Encounter calculation
capabilities, but the interactive workflow belongs to Scene: Scene supplies its
assigned Party, optional Location, current group draft, generation mode,
creature filters, and tuning, then receives one complete transient roster.
Saving it is a Scene command and does not create Encounter runtime state.

## Non-Goals

- generator, roster editor, saved-plan browser, or Catalog-add action in the
  Encounter runtime pane
- copying Scene groups into a second mutable planning roster
- persisting an unaccepted Scene group proposal
- owning Party, Scene, Creature, Location, or Travel truth

## Primary Flow

1. The GM selects `Encounter` in the global scenario dropdown.
2. Encounter reads the focused Scene, its assigned active PCs, and its groups.
3. The GM selects one or more Scene groups.
4. Every selection change publishes Party thresholds, creature count, base XP,
   adjusted XP, difficulty, and a startability message.
5. A valid selection is snapshotted into Initiative; Combat then owns its
   individual runtime HP, initiative, round, turn, and result state.
6. Resolution may award XP once to the participating Scene Party and returns to
   group selection without changing Scene groups.

## Expected Capabilities

- reject stale Scene revisions and group IDs outside the focused Scene
- reject unavailable creatures, an empty group selection, or an empty assigned
  Party before Initiative
- preserve selected Scene group identities as Combat provenance
- keep a running Combat unchanged when a source Scene group is later edited
- reconcile assigned PC changes while retaining initiative, HP, round, and
  active turn where applicable
- aggregate matching monsters into the specified runtime mob cards while
  retaining per-individual HP
- expose the explicit no-loot state until the Loot owner is available

## Acceptance Criteria

- evaluation is read-only and changes immediately with the selected group set
- adjusted XP uses the selected Scene groups and only assigned active PCs
- Combat cannot be started from Catalog rows, generator output, saved plans, or
  foreign Scene groups
- Initiative, Combat, Resolution, XP-award status, and selected source group IDs
  survive restart
- switching the scenario dropdown to `Reise` does not stop a running Encounter

## References

- [Encounter Runtime State UI](requirements-encounter-state-tab.md)
- [Encounter Domain Model](../domain/domain-encounter.md)
- [Runtime Scene Requirements](../../scene/requirements/requirements-scene.md)
