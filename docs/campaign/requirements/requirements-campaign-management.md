# Campaign Management Requirements

## Goal

Let the GM create, select and maintain installation-wide Campaign identities
without treating Campaign management as a running-play workspace.

## Shell Surface

- Campaign management is an anchored popover opened by the top-left burger
  button. It is not an icon-rail workspace or sidebar tab.
- The popover lists available Campaigns, marks the active Campaign, and exposes
  create, switch, rename, move-to-trash, restore, and permanent-delete actions.
- When no Campaign is active, the popover opens automatically and cannot be
  dismissed until the GM creates or selects one. The workspace behind it shows
  an honest idle state.
- Selecting or creating a Campaign activates it and opens Session. Restoring a
  Campaign does not activate it.

## Deletion

- Moving a Campaign to trash is recoverable and removes it from the available
  list. Moving the active Campaign to trash leaves the installation with no
  active Campaign; another Campaign is never selected implicitly.
- A trashed Campaign can be restored with the same identity and authored data.
- Permanent deletion is available only for trashed Campaigns and requires the
  GM to enter the exact Campaign display name. It removes the registry identity
  and Campaign store irreversibly.
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
