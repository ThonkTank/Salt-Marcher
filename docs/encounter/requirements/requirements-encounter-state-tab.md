# Encounter Runtime State UI

## Component Purpose

The global scenario pane is selected through a dropdown. Its current entries
are `Encounter` and `Reise`; the selector is extensible without exposing fake
future options. `Reise` renders the feature-neutral read-only Travel state.

Encounter contains no generator or mutable planning roster. It consumes only
groups already present in the focused runtime Scene.

## Visible Surfaces

- `Selection` shows the assigned Scene Party, checkboxes for active non-empty
  Scene groups with their adjusted XP contribution, a threshold meter, live
  difficulty output, and the Initiative action. Archived and empty groups are
  never valid selections.
- `Initiative` separates Party and monster rows. Both remain editable, while
  the roll action applies only to monsters.
- `Combat` shows the four-step breadcrumb, round, active and completed turns,
  front-member mob HP, living count, AC, initiative, conditions, undo, and end
  confirmation.
- `Resolution` shows defeated-enemy selection, XP controls, the no-loot notice,
  one idempotent award action, and return to Selection.
- `Reise` shows either an approved compact Dungeon/Hex readback or the explicit
  `Kein aktiver Reisekontext` state. It exposes no movement commands.

## Interactions And States

- Selecting or deselecting a Scene group recomputes base XP, adjusted XP,
  multiplier, creature count, Party thresholds, and the semantic difficulty
  band without persistence.
- Initiative is disabled until at least one assigned active PC and one complete,
  available Scene group are selected.
- Monster rolling, initiative editing, Combat turn progression, HP and
  condition changes, bounded undo, confirmed Combat end, result configuration,
  and XP award retain their existing behavior.
- Switching between Encounter and Reise hides only the pane. It never clears
  Initiative, Combat, or Resolution.
- With no Scene groups, the pane directs the GM to create or generate a group in
  the focused Scene.

## Acceptance Criteria

- the dropdown visibly offers Encounter and Reise
- Encounter exposes no Generate, tuning, saved-plan, Catalog-add, reinforcement,
  or roster quantity controls
- evaluation and Combat preparation reject stale or foreign Scene group IDs
- evaluation and Combat preparation reject archived Scene groups; archiving a
  source group does not change an already running Combat copy
- active Combat state survives both dropdown switching and application restart
- mob cards expose individual front-member HP and conditions without replacing
  the persisted individual combatants
- the latest 20 Combat mutations are available to undo in reverse order
- Reise remains read-only and reports no context honestly when none exists

## References

- [Encounter Feature Spec](requirements-encounter.md)
- [Runtime Scene Requirements](../../scene/requirements/requirements-scene.md)
- [Travel State UI](../../project/requirements/requirements-travel-state-tab.md)
