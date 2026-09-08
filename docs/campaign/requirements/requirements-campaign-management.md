# Campaign Management Requirements

## Goal

Let the GM create, select and maintain installation-wide Campaign identities
without treating Campaign management as a running-play workspace.

## Shell Surface

- The top-left burger opens a compact anchored menu containing only
  `Kampagnen` and `Einstellungen`. It is not an icon-rail workspace or sidebar
  tab.
- `Kampagnen` opens a full-width screen below the app header which lists available Campaigns,
  marks the active Campaign, and exposes create and switch actions. Create, rename,
  move-to-trash, restore, and permanent-delete actions use child modals.
- `Einstellungen` opens a separate installation-wide settings dialog. Its
  Encounter Generator section owns revisioned generator presets and an
  optional active-Campaign assignment; an unassigned Campaign uses the
  protected system preset.
- Preset protection, copying, explicit assignment, conflicts, command-receipt
  recovery, Config V5, and the settings interaction are defined once in the
  [Encounter Generation Requirements](../../encounter/requirements/requirements-encounter-generation.md).
- Every application start opens the Campaign screen, including when an active
  identity is recorded. There is no automatic Session resume, close button, or
  Escape route out of this screen. Workspace rails and Session quick controls
  are hidden; selecting or creating a Campaign enters Session. The persisted
  active pointer is retained for the explicit Continue action.
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

## Campaign screen and child modals

- Sort Campaigns by last opening descending (unknown last), creation descending,
  then identity. Show local calendar-day dates and times; unknown historical
  usage is labeled honestly. Create and activate commands record UTC
  `lastOpenedAt` in the registry transaction and receipt. Read, startup, rename,
  restore and background recovery do not record usage. Command replay retains
  the original timestamp. Installation schema 40 introduces the nullable column;
  historical command receipts without it normalize to null.
- Show a create button and an always-visible counted trash entry, including empty
  states. Name editors trim input, allow 1–100 characters and duplicate names.
- Create, edit and trash modals close with X or Escape, not backdrop clicks.
  Closing a name editor discards its draft immediately. Explicit Save commits
  a rename; successful creation enters Session. The edit modal owns trashing.
- The trash modal restores without activation and stays open with feedback.
  Permanent-delete confirmation requires the exact display name; cancel/Escape
  returns to trash. Trashing the active identity never selects a replacement.
- Pending operations block repeat submissions and modal dismissal. Unknown
  outcomes use existing receipt reconciliation. Errors preserve drafts; Session
  loading after accepted activation can be retried without replaying activation.
- Opening the Campaign screen from a workspace with registered unsaved drafts
  is blocked until the owning editor saves or discards them.
