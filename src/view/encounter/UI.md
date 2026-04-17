Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: UI structure, interactions, and user-visible states for the
encounter component.

# Encounter UI

## Purpose

The encounter tab is a runtime workspace for generating and iterating on
balanced encounter suggestions.

## Left Controls

Visible elements:

- difficulty selector
- shared creature-filter pane with optional type, subtype, and biome
  multi-select controls
- active creature-filter chips
- generate action
- reroll action

## Main Workspace

Visible elements:

- active-party level summary
- threshold summary for easy, medium, hard, and deadly bands
- daily-budget summary
- ranked encounter table
- selected-encounter detail panel

The detail panel shows:

- adjusted XP and creature count
- generator highlights
- per-creature quantity, CR, XP, role hint, and derived tags

## State Panel

Visible elements:

- locked-composition summary
- excluded-creature summary
- status text
- lock selected
- clear locks
- exclude selected
- clear exclusions

## User-Visible States

- no active party
- no creature matches for the current filters
- generated alternatives ready
- locked reroll context active
- excluded creature set active
