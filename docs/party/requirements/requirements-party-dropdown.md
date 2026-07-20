Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Party top-bar dropdown structure, interactions, and visible
states.

# Party Dropdown UI

## Component Purpose

The party dropdown is the top-bar surface for the current party snapshot. It
gives a compact read-only overview of active party members, party composition,
and adventuring-day readiness without becoming a separate navigation tab.

Current state: the dropdown reads the real party snapshot and adventuring-day
summary, and mutation controls use the Party feature's public mutation API.

## Visible Surfaces

- The application top bar hosts the party dropdown trigger and dropdown content.
- The dropdown trigger shows only party membership state: no-party text or the
  active character count with average level. Adventuring-day rest-budget state
  is shown by the separate Adventuring Day top-bar surface.
- The dropdown content shows a `PARTY` header, active member rows, rest action
  controls, reserve-character search suggestions, a new-character affordance,
  a summary footer, and compact feedback when party data cannot be loaded.
- Active member rows are compact full-width two-line cards. The first line
  shows character and player identity, current and next level, an overlaid
  `current XP/next-level XP (%)` level-up meter, and popup-based XP correction.
  The second line shows combat/rest metadata plus edit and remove affordances.
- The create/edit character editor is a secondary anchored dropdown with
  character, player, level, passive perception, AC, and edit-mode delete
  confirmation controls. It stays open on validation or storage failures and
  reports the field or mutation error inline.

## Interactions

- Opening the dropdown requests the current party snapshot from the Party
  feature.
- Search filters reserve-character suggestions locally.
- Add, create, edit, delete, XP correction, remove, short-rest, and long-rest
  controls persist through the Party feature's public mutation API and refresh
  the dropdown snapshot after successful mutations.
- Clicking a character's level-up meter opens a compact XP popup. `+XP` awards
  XP, while `-XP` corrects previously awarded XP without lowering the
  character below the current level's XP floor.
- Character editor submission validates name, level, passive perception, and AC
  before submitting the change to the Party feature; failed validation does not
  close the editor or mutate the party.
- After successful party mutations, updated Party state is available when
  Encounter surfaces refresh party-derived thresholds and combat baselines.
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

## Acceptance Criteria

- the Party dropdown remains a top-bar party surface and does not become a
  separate navigation tab
- opening the dropdown refreshes the current party snapshot before new
  mutations are presented as final state
- create, edit, remove, rest, and XP-correction actions persist only through
  the Party feature's public mutation API
- failed editor validation keeps the editor open, preserves entered values, and
  renders inline error feedback
- after successful mutations, downstream Encounter refreshes observe the
  updated party-derived thresholds and baselines
- closing the dropdown without a completed mutation leaves party domain state
  unchanged

## References

- [Adventuring Day Top-Bar UI](requirements-adventuring-day-dropdown.md)
- [Party Domain Model](../domain/domain-party.md)
- [Party Persistence](../contract/contract-party-persistence.md)
