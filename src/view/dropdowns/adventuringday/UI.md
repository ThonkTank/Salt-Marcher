Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Adventuring-day top-bar trigger and dropdown summary.

# Adventuring Day Top-Bar UI

## Component Purpose

The Adventuring Day top-bar dropdown restores the original separate rest-budget
trigger next to the Party trigger. It reads the active party's adventuring-day
summary and shows compact rest thresholds without owning party membership
editing.

Current state:

- The trigger reads the active party's rest-budget summary from the party
  application service.
- The dropdown is a compact summary, not the full original calculator surface.

## Visible Surfaces

- `TOP_BAR` hosts the rest-budget trigger before the Party trigger.
- The trigger shows `Rastbudget`, `Kein Rastbudget`, `Rastbudget nicht
  verfügbar`, or `SR <xp> · LR <xp>` depending on read state.
- The dropdown shows an `ADVENTURING DAY` header, short-rest threshold,
  long-rest threshold, and consumed daily budget.

## Interactions

- Opening the dropdown refreshes the active party's adventuring-day summary.
- The dropdown does not mutate party or encounter state in this parity step.
