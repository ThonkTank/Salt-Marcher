Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-06
Source of Truth: User-facing behavior and acceptance criteria for the session
planner session record and planning workspace.

# Session Planner Requirements

## Goal

Provide one session-owned planning surface that:

- creates or loads one persisted session plan
- stores session-local participant references without mutating party
  membership
- uses those session participants as the planning baseline
- shows the session XP budget and the remaining or exceeded amount
- attaches saved encounter plans as reusable session-encounter references
- recommends how many short and long rests the planned encounter XP implies
- lets the user place rests between planned encounters
- keeps loot and gold planning visibly open without inventing fake gold math

## Non-Goals

- editing encounter-plan rosters inside the session planner
- mutating party membership when a character is added to or removed from a
  session
- copying encounter rosters, party character details, creature statblocks, or
  loot internals into sessionplanner-owned truth
- deriving gold budgets from provisional heuristics
- replacing the encounter state tab or the party dropdown

## Primary User Flow

1. The user opens the Session Planner left-bar tab.
2. The user creates a new session or opens an existing persisted session.
3. The planner reads session-local participant refs plus the current foreign
   party and encounter summaries needed for planning.
4. The user adds or removes party characters from the session without changing
   party membership.
5. The user attaches one or more saved encounter plans to the session.
6. The planner updates the planned XP total, remaining budget, and rest
   recommendation.
7. The user reorders encounters, adjusts encounter budget allocations, and
   places short or long rests between them.
8. The user selects one session encounter for the preparatory state-panel
   context.
9. The user adds loot placeholders while the gold budget remains explicitly
   unresolved.

## Expected Capabilities

- create or reopen a session-owned planning record
- show session participant count, level spread, and planning readiness
- show the total XP budget for the current session participants
- show planned encounter XP, remaining XP, and over-budget XP when applicable
- visually distinguish in-budget and over-budget planning states
- show recommended short-rest and long-rest counts derived from the planned
  encounter XP
- show how many rests are currently placed in the timeline
- attach saved encounter plans through the encounter public boundary instead of
  touching encounter persistence directly
- show session-encounter cards with their adjusted XP, base XP, difficulty
  label, creature count, and session-local budget allocation
- allow encounter reordering
- allow budget-percent changes per attached encounter
- allow short-rest or long-rest placement only in the gaps between encounters
- preserve selected encounter context for the preparatory state panel
- allow loot placeholders that do not affect XP math and do not claim a gold
  budget is already available

## Visible States

Current state:

- the first implementation is an open scaffold
- the planner now persists one current session record as planner-owned truth
- XP budget and rest recommendation are real party-based calculations
- imported encounter cards use real encounter-plan budget reads
- gold budgeting remains a visible placeholder
- loot placeholders are structural only

Target state:

- `sessionplanner` persists session-local planning truth as its own authored
  record
- later iterations may attach real loot and gold rules and richer encounter
  composition controls without changing the owning feature boundary

## Acceptance Criteria

- the session planner is a dedicated left-bar tab and not a dropdown or global
  state tab
- the planner can create or load a session-owned planning record instead of
  rebuilding all state as transient-only runtime orchestration
- the planner depends only on public party and encounter application-service
  boundaries
- attached encounters contribute real adjusted XP to the planner budget
- the planner stores only session-local references and planning allocations,
  not foreign encounter rosters or party-character internals
- the planner shows when the attached encounters stay within the XP budget and
  when they exceed it
- recommended rests update when the imported encounter XP total changes
- placed rests can appear only between adjacent encounters
- loot placeholders stay visible while gold budgeting remains explicitly marked
  as unavailable

## References

- [Session Planner Architecture](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/architecture/architecture-session-planner.md:1)
- [Session Planner Persistence Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/contract/contract-session-planner-persistence.md:1)
- [Session Planner Domain Model](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/sessionplanner/domain/domain-session-planner.md:1)
- [Encounter Plan Budget Contract](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/encounter/contract/contract-encounter-plan-budget.md:1)
