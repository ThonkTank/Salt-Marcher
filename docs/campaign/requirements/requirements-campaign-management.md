# Campaign Management Requirements

## Goal

Let the GM create, select and maintain installation-wide Campaign identities
without treating Campaign management as a running-play workspace.

## Shell Surface

- The top-left burger opens a compact anchored menu containing only
  `Kampagnen` and `Einstellungen`. It is not an icon-rail workspace or sidebar
  tab.
- `Kampagnen` opens a dedicated modal dialog which lists available Campaigns,
  marks the active Campaign, and exposes create, switch, rename, move-to-trash,
  restore, and permanent-delete actions.
- `Einstellungen` opens a separate installation-wide settings dialog. Its
  Encounter Generator section owns revisioned generator presets and an
  optional active-Campaign assignment; an unassigned Campaign uses the
  protected system preset.
- Preset protection, copying, explicit assignment, conflicts, command-receipt
  recovery, Config V3, and the settings interaction are defined once in the
  [Encounter Generation Requirements](../../encounter/requirements/requirements-encounter-generation.md).
- When no Campaign is active, the Campaign dialog opens automatically and
  cannot be dismissed until the GM creates or selects one. The workspace behind
  it shows an honest idle state.
- Selecting or creating a Campaign activates it and opens Session. Restoring a
  Campaign does not activate it.

## Deletion

- Moving a Campaign to trash is recoverable and removes it from the available
  list. Moving the active Campaign to trash leaves the installation with no
  active Campaign; another Campaign is never selected implicitly.
- A trashed Campaign can be restored with the same identity and authored data.
- Permanent deletion is available only for trashed Campaigns and requires the
  GM to enter the exact Campaign display name. It removes the registry identity
  and Campaign store irreversibly. Installation-owned generator-preset
  assignments reference that identity with `ON DELETE CASCADE`; permanent
  deletion cannot leave an orphan assignment.
- Duplicate display names remain valid. Identity, not display name, controls
  switching, trash, restore and deletion.

## Acceptance

- create A/B, switch A/B/A, rename, restart, and active-Campaign resume preserve
  the selected identity and authored data
- trashing the active Campaign publishes an empty active pointer
- restore never changes the active pointer
- an incorrect permanent-delete confirmation is rejected without mutation
- interrupted trash and permanent-delete file transitions are reconciled on
  startup without exposing a partial Campaign
- changing, assigning, or deleting generator presets advances one monotonic
  installation registry revision; deleting an assigned custom preset restores
  the system-preset fallback
- repeating a completed preset command ID returns the same exact receipt, while
  reusing it for a different operation is rejected
- copying and saving a preset does not change the active-Campaign assignment;
  explicit assignment survives application restart
- Scene and Session generation report the same effective preset identity,
  revision, and generator-config hash after assignment
