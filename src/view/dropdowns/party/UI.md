Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-20
Source of Truth: Party top-bar dropdown structure, interactions, and visible
states.

# Party Dropdown UI

## Component Purpose

The party dropdown is the shell-discovered top-bar window for the current
party snapshot. It gives a compact read-only overview of active party members,
party composition, and adventuring-day readiness without becoming a left-bar
left-bar tab.

Current state: the dropdown is a representation-focused UI mock. It reads the
real party snapshot and adventuring-day summary, but mutation controls only
show mock feedback so later work can attach real behavior without changing the
surface shape.

## Visible Surfaces

- `TOP_BAR` hosts the party dropdown trigger and dropdown content through the
  shell top-bar contribution contract.
- The dropdown trigger shows either no-party text or the active character count
  with average level.
- The dropdown content shows a `PARTY` header, active member rows, rest action
  controls, reserve-character search suggestions, a new-character affordance,
  a summary footer, and compact feedback when party data cannot be loaded.
- Active member rows show name, level, player/combat metadata, progression,
  rest cadence, XP controls, edit, and remove affordances.
- The create/edit character editor is a secondary anchored dropdown with
  character, player, level, passive perception, AC, and edit-mode delete
  confirmation controls.

## Interactions

- Opening the dropdown refreshes the party snapshot through the active-root
  Binder and ViewModel.
- Search filters reserve-character suggestions locally.
- Add, create, edit, delete, XP, remove, short-rest, and long-rest controls
  currently report mock feedback only and do not mutate party roster data.
- Closing the dropdown leaves party domain state unchanged.

## Visible States

- Loading: party summary content is temporarily unavailable while the snapshot
  refreshes.
- Empty: no active party members are available.
- Loaded: member summaries and adventuring-day status are visible.
- Storage error: the dropdown reports that party data could not be loaded.
- Mock action feedback: a successful or warning-colored inline status explains
  which later action would have run.
