# Encounter Runtime State UI

## Component Purpose

The global scenario pane is selected through a dropdown. Its current entries
are `Encounter` and `Reise`; the selector is extensible without exposing fake
future options. `Reise` renders the feature-neutral read-only Travel state.

Encounter contains no generator or mutable planning roster. It consumes only
groups already present in the focused runtime Scene.

## Visible Surfaces

- `Selection` shows the assigned Scene Party, checkboxes for Scene groups, live
  difficulty output, and the Initiative action.
- `Initiative` shows one editable row for every participating PC and monster.
- `Combat` shows round, active turn, HP, AC, initiative, and end confirmation.
- `Resolution` shows defeated-enemy selection, XP controls, the no-loot notice,
  one idempotent award action, and return to Selection.
- `Reise` shows either an approved compact Dungeon/Hex readback or the explicit
  `Kein aktiver Reisekontext` state. It exposes no movement commands.

## Interactions And States

- Selecting or deselecting a Scene group recomputes base XP, adjusted XP,
  creature count, Party thresholds, and difficulty without persistence.
- Initiative is disabled until at least one assigned active PC and one complete,
  available Scene group are selected.
- `Alle würfeln`, initiative editing, Combat turn progression, HP changes,
  confirmed Combat end, result configuration, and XP award retain their
  existing behavior.
- Switching between Encounter and Reise hides only the pane. It never clears
  Initiative, Combat, or Resolution.
- With no Scene groups, the pane directs the GM to create or generate a group in
  the focused Scene.

## Acceptance Criteria

- the dropdown visibly offers Encounter and Reise
- Encounter exposes no Generate, tuning, saved-plan, Catalog-add, reinforcement,
  or roster quantity controls
- evaluation and Combat preparation reject stale or foreign Scene group IDs
- active Combat state survives both dropdown switching and application restart
- Reise remains read-only and reports no context honestly when none exists

## References

- [Encounter Feature Spec](requirements-encounter.md)
- [Runtime Scene Requirements](../../scene/requirements/requirements-scene.md)
- [Travel State UI](../../project/requirements/requirements-travel-state-tab.md)
