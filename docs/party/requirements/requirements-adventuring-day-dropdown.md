Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Adventuring-day top-bar trigger and dropdown calculator.

# Adventuring Day Top-Bar UI

## Component Purpose

The Adventuring Day top-bar dropdown restores the original separate rest-budget
trigger next to the Party trigger. It reads the active party's adventuring-day
summary for the trigger and hosts the original-style adventuring-day calculator
as a top-bar control panel.

Current state:

- The trigger reads the active party's rest-budget summary from the party
  application service.
- The dropdown renders the calculator surface with active-party and custom
  party input modes.
- Calculation decisions are requested through the party application service;
  the JavaFX view owns controls and rendering only.

## Visible Surfaces

- `TOP_BAR` hosts the rest-budget trigger before the Party trigger.
- The trigger shows `Rastbudget`, `Kein Rastbudget`, `Rastbudget nicht
  verfügbar`, or `SR <xp> · LR <xp>` depending on read state.
- The dropdown shows an `ADVENTURING DAY` header and a scrollable calculator
  panel.
- The calculator includes source controls (`Aktive Party`, `Zeile`, `Leeren`),
  mode controls (`Budget`, `XP -> Tage`), a `Gesamt-XP` input in progress mode,
  level/count rows, a summary card, and an `Etappen` timeline card.

## Interactions

- Opening the dropdown refreshes the active party's adventuring-day summary.
- `Aktive Party` repopulates calculator rows from the active party levels.
- Editing rows switches the calculator to custom party mode without mutating the
  party roster.
- `Budget` shows the daily budget and rest milestones for the current rows.
- `XP -> Tage` shows adventuring-day progress, rest counts, level-up summary,
  and timeline events for the entered group XP.

## Visible States

- Loading: the trigger can temporarily show that the rest-budget summary is
  unavailable while it refreshes.
- No budget: the trigger shows `Kein Rastbudget`.
- Storage error: the trigger shows `Rastbudget nicht verfügbar`.
- Loaded budget: the trigger shows `Rastbudget` or the compact `SR <xp> · LR
  <xp>` summary and the dropdown exposes the calculator surface.

## Acceptance Criteria

- the top bar exposes a dedicated rest-budget trigger separate from the Party
  trigger
- opening the dropdown refreshes the current active-party adventuring-day
  summary before showing stale results as final truth
- `Aktive Party` reloads calculator rows from the active party without mutating
  the underlying roster
- editing rows moves the calculator into custom mode without persisting party
  changes
- budget and progress modes stay available inside the same dropdown surface and
  reuse the shared calculator slotcontent

## References

- [Adventuring Day Calculator](requirements-adventuring-day-calculator.md)
- [Party Dropdown UI](requirements-party-dropdown.md)
