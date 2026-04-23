Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-23
Source of Truth: Party top-bar dropdown structure, interactions, and visible
states.

# Party Dropdown UI

## Component Purpose

The party dropdown is the shell-discovered top-bar window for the current
party snapshot. It gives a compact read-only overview of active party members,
party composition, and adventuring-day readiness without becoming a left-bar
left-bar tab.

Current state: the dropdown reads the real party snapshot and adventuring-day
summary, and mutation controls call the party application service.

## Visible Surfaces

- `TOP_BAR` hosts the party dropdown trigger and dropdown content through the
  shell top-bar contribution contract.
- The dropdown trigger shows only party membership state: no-party text or the
  active character count with average level. Adventuring-day rest-budget state
  is shown by the separate Adventuring Day top-bar contribution.
- The dropdown content shows a `PARTY` header, active member rows, rest action
  controls, reserve-character search suggestions, a new-character affordance,
  a summary footer, and compact feedback when party data cannot be loaded.
- Active member rows are compact full-width two-line cards. The first line
  shows character and player identity, current and next level, an overlaid
  `current XP/next-level XP (%)` level-up meter, and XP controls. The second
  line shows combat/rest metadata plus edit and remove affordances.
- The create/edit character editor is a secondary anchored dropdown with
  character, player, level, passive perception, AC, and edit-mode delete
  confirmation controls. It stays open on validation or storage failures and
  reports the field or mutation error inline.

## Interactions

- Opening the dropdown refreshes the party snapshot through the active-root
  Binder and ViewModel.
- Search filters reserve-character suggestions locally.
- Add, create, edit, delete, XP, remove, short-rest, and long-rest controls
  persist through the party application service and refresh the dropdown
  snapshot after successful mutations.
- Character editor submission validates name, level, passive perception, and AC
  before calling the party application service; failed validation does not close
  the editor or mutate the party.
- Successful party mutations publish a runtime refresh signal so the Encounter
  state tab can reload party thresholds and active combat baselines.
- The trigger supports the party mnemonic and can be opened from the top bar
  with `Alt+P` when focus is in the application.
- Closing the dropdown leaves party domain state unchanged unless an explicit
  mutation action has already completed.

## Visible States

- Loading: party summary content is temporarily unavailable while the snapshot
  refreshes.
- Empty: no active party members are available.
- Loaded: member summaries and adventuring-day status are visible.
- Storage error: the dropdown reports that party data could not be loaded.
- Action feedback: a successful or warning-colored inline status explains the
  mutation result.
- Editor error: invalid editor input, missing characters, or failed storage
  writes are shown inside the editor while the entered values remain available
  for correction.
