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
feature tab.

## Visible Surfaces

- `TOP_BAR` hosts the party dropdown trigger and dropdown content through the
  shell top-bar contribution contract.
- The dropdown content shows the active party summary, member rows, rest
  cadence status, and compact feedback when party data cannot be loaded.

## Interactions

- Opening the dropdown refreshes the party snapshot through the active-root
  Binder and ViewModel.
- The dropdown is informational in the current state and does not mutate party
  roster data.
- Closing the dropdown leaves party domain state unchanged.

## Visible States

- Loading: party summary content is temporarily unavailable while the snapshot
  refreshes.
- Empty: no active party members are available.
- Loaded: member summaries and adventuring-day status are visible.
- Storage error: the dropdown reports that party data could not be loaded.
