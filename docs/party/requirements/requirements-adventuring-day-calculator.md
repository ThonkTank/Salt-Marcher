# Adventuring Day Calculator

Status: Active product requirement with native Godot implementation
Owner: Party
Last Reviewed: 2026-07-28
Source of Truth: This document

## Component Purpose

The Adventuring Day calculator appears inside the Adventuring Day dropdown. It
presents the original-style budget and progress controls and shows calculation
results for either the active party or custom level/count rows.

Current state:

- The calculator supports row editing, mode toggles, summary output, and timeline
  output.
- Active-party levels and calculated results come from the owning Party feature.
- The calculator presentation does not define adventuring-day calculation rules.
- Calculation runs off the scene-tree thread with one active and one latest
  pending request; superseded work cannot publish over the newest input.

## Visible Surfaces

- The calculator has no separate navigation destination.
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
- Invalid input: empty groups, out-of-range levels, non-positive counts,
  negative XP, and values beyond exact numeric representation fail visibly
  without changing Party state.

## Acceptance Criteria

- the calculator remains contained in the Adventuring Day dropdown and has no
  separate navigation destination
- switching from active-party mode to direct row editing does not mutate the
  party roster
- budget mode exposes daily threshold and rest-milestone output for the current
  rows
- progress mode maps the entered XP amount into adventuring-day progress,
  rest-count, level-up summary, and timeline events
- adventuring-day calculations come from the owning Party feature, while the
  calculator surface presents inputs and results without defining those rules
- large timelines remain scrollable and presentation renders a bounded prefix
  with an explicit remaining-event count rather than creating unbounded controls
- counted level rows support large parties without expanding one calculation or
  one UI control per character and without an arbitrary character-count cap
- every result exposes the local `dnd5e-2014` profile, normalized inputs, and
  applicable third/share rounding rules

## References

- [Adventuring Day Top-Bar UI](requirements-adventuring-day-dropdown.md)
- [Party Dropdown UI](requirements-party-dropdown.md)
