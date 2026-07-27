# Party Dropdown UI

## Component Purpose

The party dropdown is the top-bar surface for the Campaign Roster and its
distinct current-Party subset. It lets the GM manage all Campaign PCs and
explicitly change table participation without becoming a separate navigation
tab.

Current state: the dropdown reads the real party snapshot and adventuring-day
summary, and mutation controls use the Party feature's public mutation API.

## Visible Surfaces

- The application top bar hosts the party dropdown trigger and dropdown content.
- The dropdown trigger shows only party membership state: no-party text or the
  active character count with average level. Adventuring-day rest-budget state
  is shown by the separate Adventuring Day top-bar surface.
- The dropdown content shows a `PARTY` header, active member rows and rest
  actions plus a distinct `CHARAKTER-ROSTER` section containing every active or
  inactive PC. Roster rows expose stable Roster IDs so namesakes remain
  distinguishable. Search matches name, player, or Roster ID.
- Active member rows are compact full-width two-line cards. The first line
  shows character and player identity, current and next level, an overlaid
  `current XP/next-level XP (%)` level-up meter, and popup-based XP correction.
  The second line shows combat/rest metadata plus edit and remove affordances.
- The Roster create/edit editor is a secondary anchored dropdown. Only the
  character name is required; player, level, passive perception, and AC are
  optional and can be cleared again. Edit mode identifies the PC by stable ID
  and retains explicit delete confirmation. The editor stays open on validation
  or storage failures and reports the field or mutation error inline.

## Interactions

- Opening the dropdown requests the current party snapshot from the Party
  feature.
- Roster search filters all Campaign PCs locally.
- Creating a PC adds it only to the Roster. It does not activate current-Party
  membership, attach the PC to the Party travel token, or assign a Scene.
- Adding or removing current-Party membership is a separate explicit action on
  an existing Roster PC. Create, edit, delete, XP correction, membership, rest,
  and long-rest controls persist through the Party feature's public mutation
  API and refresh the dropdown snapshot after successful mutations.
- Clicking a character's level-up meter opens a compact XP popup. `+XP` awards
  XP, while `-XP` corrects previously awarded XP without lowering the
  character below the current level's XP floor.
- Character editor submission requires a non-blank name and validates only
  optional values that were entered. Failed validation does not close the
  editor or mutate the Roster.
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
- name-only creation succeeds, leaves every optional fact absent, and changes
  neither current Party nor Scene/travel participation
- duplicate names remain independently editable and visibly distinguishable by
  stable Roster ID
- clearing an optional player, level, passive-perception, or AC value restores
  absence rather than a default or sentinel
- current-Party membership changes only through a separate explicit action
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
