Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: User-facing behavior and acceptance criteria for the session
planner workspace.

# Session Planner Requirements

## Goal

Provide one planning workspace that:

- uses the active party as the planning baseline
- shows the session XP budget and the remaining or exceeded amount
- imports saved encounter plans as reusable encounter budget blocks
- recommends how many short and long rests the planned encounter XP implies
- lets the user place rests between planned encounters
- keeps loot and gold planning visibly open without inventing fake gold math

## Non-Goals

- persisting session-planner work as canonical saved truth
- editing encounter-plan rosters inside the session planner
- deriving gold budgets from provisional heuristics
- replacing the encounter state tab or the party dropdown

## Primary User Flow

1. The user opens the Session Planner left-bar tab.
2. The planner reads the active party and the current saved encounter plans.
3. The user imports one or more saved encounter plans into the planner.
4. The planner updates the planned XP total, remaining budget, and rest
   recommendation.
5. The user reorders encounters and places short or long rests between them.
6. The user adds loot placeholders while the gold budget remains explicitly
   unresolved.

## Expected Capabilities

- show active-party size, level spread, and planning readiness
- show the total XP budget for the active party
- show planned encounter XP, remaining XP, and over-budget XP when applicable
- visually distinguish in-budget and over-budget planning states
- show recommended short-rest and long-rest counts derived from the planned
  encounter XP
- show how many rests are currently placed in the timeline
- import saved encounter plans through the encounter public boundary instead of
  touching encounter persistence directly
- show imported encounter cards with their adjusted XP, base XP, difficulty
  label, and creature count
- allow encounter reordering
- allow short-rest or long-rest placement only in the gaps between encounters
- allow loot placeholders that do not affect XP math and do not claim a gold
  budget is already available

## Visible States

Current state:

- the first implementation is an open scaffold
- XP budget and rest recommendation are real party-based calculations
- imported encounter cards use real encounter-plan budget reads
- gold budgeting remains a visible placeholder
- loot placeholders are structural only

Target state:

- later iterations may attach real loot and gold rules, persistence, and richer
  encounter composition controls without changing the owning feature boundary

## Acceptance Criteria

- the session planner is a dedicated left-bar tab and not a dropdown or global
  state tab
- the planner depends only on public party and encounter application-service
  boundaries
- imported encounters contribute real adjusted XP to the planner budget
- the planner shows when the imported encounters stay within the XP budget and
  when they exceed it
- recommended rests update when the imported encounter XP total changes
- placed rests can appear only between adjacent encounters
- loot placeholders stay visible while gold budgeting remains explicitly marked
  as unavailable

## References

- [Session Planner Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/architecture/architecture-session-planner.md:1)
- [Session Planner Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/domain/domain-session-planner.md:1)
- [Encounter Plan Budget Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/contract/contract-encounter-plan-budget.md:1)
