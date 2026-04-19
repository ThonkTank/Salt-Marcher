Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-19
Source of Truth: UI structure, interactions, and user-visible states for the
party toolbar component.

# Party UI

## Purpose

The party toolbar is the top-bar management surface for viewing roster state,
editing membership, and applying party maintenance actions.

## Structure

Visible elements:

- toolbar trigger button with active-party summary
- popup with active members, reserve members, rest actions, and budget summary
- create, edit, delete, activate, reserve, and award-XP actions
- reserve search field for local filtering
- inline status message for load and mutation results

## Ownership

- `PartyViewContribution` owns shell wiring and creation of the toolbar view
  and view model.
- `ViewModel/` owns party-loading, mutation commands, and presentation
  snapshots.
- `View/` owns JavaFX popup composition, dialog widgets, and local reserve-list
  filter text.

## User-Visible States

- no active party, with reserve-only summary
- active party loaded with adventuring-day budget and rest actions enabled
- no reserve characters
- reserve filter yields no matching characters
- load or mutation failure shown as inline status
