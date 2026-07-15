Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Adventuring-day calculator slotcontent.

# Adventuring Day Calculator

## Component Purpose

The Adventuring Day calculator is passive top-bar slotcontent embedded by the
Adventuring Day dropdown. It renders the original-style budget and progress
calculator controls while the owning dropdown ViewModel supplies calculation
results through Binder wiring.

Current state:

- The View owns JavaFX controls, row editing, mode toggles, summary rendering,
  and timeline rendering.
- The dropdown Binder supplies active party levels and maps calculator results
  between the dropdown ViewModel and this passive View.
- Domain calls stay in `AdventuringDayTopBarViewModel`.

## Visible Surfaces

- The calculator has no standalone shell registration.
- It appears inside the Adventuring Day top-bar popup scroll area.

## Interactions

- Active-party mode follows the levels supplied by the owning dropdown.
- Custom mode lets the user edit level/count rows locally without mutating the
  party roster.
- Budget mode shows daily XP thresholds and rest milestones.
- Progress mode maps group XP to adventuring days, rest counts, level-up
  summary, and timeline events.

## Visible States

- Active-party mode: calculator rows mirror the current active party levels.
- Custom mode: edited rows remain local to the calculator surface.
- Budget mode: daily thresholds and rest milestones are visible.
- Progress mode: group XP produces day-progress, rest-count, and timeline
  output.

## Acceptance Criteria

- the calculator remains passive slotcontent with no standalone shell
  registration
- switching from active-party mode to direct row editing does not mutate the
  party roster
- budget mode exposes daily threshold and rest-milestone output for the current
  rows
- progress mode maps the entered XP amount into adventuring-day progress,
  rest-count, level-up summary, and timeline events
- domain calculations stay outside the passive View and are supplied through
  Binder and ViewModel wiring

## References

- [Adventuring Day Top-Bar UI](docs/party/requirements/requirements-adventuring-day-dropdown.md:1)
- [Party Dropdown UI](docs/party/requirements/requirements-party-dropdown.md:1)
