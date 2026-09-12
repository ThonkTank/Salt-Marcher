# Party Dropdown UI

Current consolidated desktop behavior is defined by [Party window](requirements-party-window.md).
Its XP, rest, history and window decisions supersede conflicting historical rules below.

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
  distinguishable. Search matches name, player, species, class, languages,
  passive scores, or Roster ID.
- Active member rows are compact full-width two-line cards. The first line
  shows character and player identity, current and next level, an overlaid
  `current XP/next-level XP (%)` level-up meter, and popup-based XP correction.
  The second line shows combat/rest metadata plus edit and remove affordances.
- The Roster create/edit editor is a secondary anchored dropdown. Only the
  character name is required; player, species, class, ordered comma-separated
  languages, level, all three passive scores, AC, and movement are optional
  and can be cleared again. Edit mode identifies the PC by stable ID
  and retains explicit delete confirmation. The editor stays open on validation
  or storage failures and reports the field or mutation error inline.

## Interactions

- Opening the dropdown requests the current party snapshot from the Party
  feature.
- Roster search filters all Campaign PCs locally.
- Creating a PC adds it only to the Roster. It does not activate current-Party
  membership, attach the PC to the Party travel token, or assign a Scene.
- Adding or removing current-Party membership is a separate explicit action on
  an existing Roster PC. `Zur Party` also assigns a newly active PC to the
  focused Scene; `Aus Party` removes that PC from every Scene. Create, edit,
  delete, XP correction, membership, rest, and long-rest controls persist
  through the Party feature's public mutation API and refresh the dropdown
  snapshot after successful mutations.
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
- `Zur Party` assigns all four seeded PCs to the focused Scene without another
  manual assignment step; with several Scenes it never targets an unfocused
  Scene
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

## Scene desktop roadmap transition

The approved scene-desktop roadmap supersedes the earlier no-catalog constraint:
phase 4 adds full campaign-wide character CRUD under Katalog → Charaktere and
scene-specific quickinfos. The dropdown remains available during migration and is
removed only in phase 6. Nullable profile fields, inactive creation, explicit
permanent deletion and personal loot are shared requirements of both entrypoints.
XP/rest and membership redesign belong to phase 5, not this transition.


## Scene desktop phase 5

The preview offers anchored batch roster replacement (current scene + inactive
characters), moves to existing/new scenes, immediate amount/+/-/overwrite XP,
and explicit selected-character rests. Rests require two clicks on the same type;
selection, revision, scene or dismissal invalidates confirmation. Manual XP never
changes encounter burden. Legacy counters remain stored but untrusted until the
corresponding rest; new characters begin at trusted zero. The domain supplies the
productive daily level budget; short-rest orientation uses one third of that
budget. Missing levels and untrusted baselines do not produce exact forecasts.
The legacy popup is retained until phase 6; its manual XP follows the corrected
semantics and actual rests also establish trusted baselines.


## Phase 6 replacement

The historical global Party dropdown is retired. Its CRUD belongs to the character
catalog; roster, XP and selected two-click rests belong to scene quickinfos.
Alt+P opens those quickinfos. The independent Adventuring-Day calculator is retained.
Legacy active characters without scene membership remain discoverable as “Ohne
Szene” and can be assigned through the scene roster selector.
