# Calendar Feature

## Purpose

`features.calendar` owns calendar definitions, epoch-day conversion, and the
calendar-owned semantics of day and phase progression.

## Canonical Types and APIs

- `CalendarObject` — canonical calendar root seam — loads calendar definitions, resolves the current session day, and advances day/phase through the persisted session cursor.
- `repository/ConfigRepository` — canonical calendar-config persistence boundary for `calendar_config`.
- `repository/PhaseRepository` — canonical time-of-day phase lookup boundary for phase progression.
- `service/CalendarService` — existing pure date-conversion helper. Keep it subordinate to the calendar root instead of treating `service/` as the product seam.

## Where New Code Goes

- Put new calendar-facing requests under `input/`.
- Keep persisted config/phase queries under the calendar repositories.
- Keep `campaignstate` as the owner of the persisted cursor fields while routing day/phase semantics through the calendar root.

## Forbidden Drift

- Do not move calendar definition or date arithmetic back into `world` or `hexmap`.
- Do not let `campaignstate` re-absorb calendar-owned day/phase progression semantics.
- Do not treat `service/` naming here as placement precedent for new owner-layer work.
