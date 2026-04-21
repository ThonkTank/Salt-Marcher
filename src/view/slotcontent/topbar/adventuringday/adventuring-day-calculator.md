Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
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
