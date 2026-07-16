Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: User-facing behavior and acceptance criteria for the session
planner session record and planning workspace.

# Session Planner Requirements

## Goal

Provide one session-owned planning surface that:

- creates or loads one persisted session plan
- stores session-local participant references without mutating party
  membership
- uses those session participants as the planning baseline
- stores how many encounter days the session covers
- stores ordered session-owned scenes with title, notes, and an optional World
  Planner location reference
- lets a scene optionally reference one saved encounter plan; scenes are not
  encounters and may exist without an encounter
- shows the session XP budget and the remaining or exceeded amount
- attaches saved encounter plans as optional scene encounter references
- recommends how many short and long rests the planned encounter XP implies
- lets the user place rests between planned scenes
- previews deterministic session generation before it changes the authored plan
- applies a current preview as encounter-plan and generated-reward references

## Non-Goals

- editing encounter-plan rosters inside the session planner
- mutating party membership when a character is added to or removed from a
  session
- copying encounter rosters, party character details, creature statblocks, or
  loot internals into sessionplanner-owned truth
- copying World Planner location details into sessionplanner-owned truth
- deriving gold budgets from provisional heuristics
- owning generation formulas, generated reward detail, or generated encounter
  import
- replacing the encounter state tab or the party dropdown
- showing a generation ruleset selector or ruleset-version label

## Primary User Flow

1. The user opens the Session Planner left-bar tab.
2. The user creates a new session or opens an existing persisted session.
3. The planner reads session-local participant refs plus the current foreign
   party and encounter summaries needed for planning.
4. The user adds or removes party characters from the session without changing
   party membership.
5. The user adds one or more scenes to the session.
6. The user optionally links saved encounter plans to scenes.
7. The user records scene title, notes, and an optional World Planner location
   reference on each scene.
8. The planner updates the planned XP total, remaining budget, and rest
   recommendation.
9. The user reorders scenes, adjusts budget allocations for encounter-linked
   scenes, and places short or long rests between scenes.
10. The user selects one session scene for the preparatory state-panel
   context.
11. The user requests a generation preview. The planner fingerprints the
    current session identity and revision, resolved participant levels,
    adventure-day fraction, optional encounter count, and seed.
12. The user reviews the generated encounters, rewards, warnings, and audit
    outcome. The preview does not mutate the session.
13. If any fingerprint input changes, the preview remains visible as stale and
    Apply is locked until the user regenerates.
14. The user applies a current preview. Encounter first imports the complete
    generated encounter batch atomically; after explicit destructive
    confirmation Session Planner replaces the current scene, rest, and manual
    loot-placeholder content with the returned plan references in generation
    order and stable generated-reward references. Session identity,
    participants, and adventure-day fraction remain unchanged.
    Encounter-channel rewards attach to their generated encounter scenes;
    quest and environment rewards create encounter-free session scenes.

## Expected Capabilities

- create or reopen a session-owned planning record
- show session participant count, level spread, and planning readiness
- show the total XP budget for the current session participants
- show planned encounter XP, remaining XP, and over-budget XP when applicable
- visually distinguish in-budget and over-budget planning states
- show recommended short-rest and long-rest counts derived from the planned
  encounter XP
- show how many rests are currently placed in the timeline
- add blank session-owned scenes without requiring an encounter plan
- optionally attach saved encounter plans through the encounter public boundary
  instead of touching encounter persistence directly
- show scene cards with title, notes, optional World Planner location ID, and
  encounter detail only when a saved encounter plan is linked
- allow scene reordering
- allow budget-percent changes per scene when an encounter plan is linked
- allow short-rest or long-rest placement only in the gaps between scenes
- preserve selected scene context for the preparatory state panel
- allow loot placeholders that do not affect XP math and do not claim a gold
  budget is already available
- request a non-blocking Session Generation preview and keep the last stable
  preview visible while a newer request is pending or fails
- distinguish ready, stale, invalid, and failed generation states
- lock Apply when the preview fingerprint differs from current inputs or when
  a hard generation audit failed
- show no ruleset selector or ruleset-version label
- apply only the exact current generation identity, import all generated
  encounters as one Encounter batch, and store reward references rather than
  copied generated reward detail

## Visible States

Current state:

- the first implementation is an open scaffold
- the planner now persists a session catalog with stable session identity,
  user-visible session names, and one current-session pointer as
  planner-owned truth
- scene rows now persist session-owned scene title, scene notes, optional World
  Planner location reference, and optional encounter-plan reference
- XP budget and rest recommendation are real party-based calculations
- imported encounter-linked scene cards use real encounter-plan budget reads
- gold budgeting remains a visible placeholder
- loot placeholders are structural only
- generated previews are derived runtime state and are not part of the authored
  session until successfully applied

Target state:

- `sessionplanner` persists session-local planning truth as its own authored
  record
- later iterations may attach real loot and gold rules and richer encounter
  composition controls without changing the owning feature boundary
- applied generations add encounter-plan references and stable generated reward
  references without transferring generation truth into Session Planner

## Acceptance Criteria

- the session planner is a dedicated left-bar tab and not a dropdown or global
  state tab
- the planner can create or load a session-owned planning record instead of
  rebuilding all state as transient-only runtime orchestration
- the planner depends only on public party and encounter application-service
  boundaries
- linked encounter plans contribute real adjusted XP to the planner budget;
  blank scenes contribute no XP
- the planner stores only session-local references and planning allocations,
  not foreign encounter rosters or party-character internals
- scene location links store World Planner location IDs, not copied location
  detail
- the planner shows when linked encounter plans stay within the XP budget and
  when they exceed it
- recommended rests update when the imported encounter XP total changes
- placed rests can appear only between adjacent scenes
- loot placeholders stay visible while gold budgeting remains explicitly marked
  as unavailable
- requesting generation does not mutate scenes, rests, selections, encounter
  plans, or generated reward references
- a preview fingerprint covers session identity and revision plus every
  generation input; any mismatch leaves the preview readable but locks Apply
- a failed generation request keeps the last stable preview and authored
  session unchanged
- Apply is available only for a current preview whose hard audits pass
- Encounter import succeeds for the whole generated batch before Session
  Planner persists its scene and reward references; a partial import result is
  never applied
- persisted generated reward references contain only session scene identity,
  typed Session Generation run identity, treasure identity, ordering, and a
  last-known display label
- quest and environment rewards become encounter-free Session scenes, while an
  encounter-channel reward references its corresponding generated encounter
  scene
- removing a scene removes its generated reward references without deleting
  the Session Generation run or Encounter-owned saved plan
- the Session Planner generation UI shows no ruleset selector or ruleset label

## References

- [Session Planner Architecture](../architecture/architecture-session-planner.md) (line 1)
- [Session Planner Persistence Contract](../contract/contract-session-planner-persistence.md) (line 1)
- [Session Planner Domain Model](../domain/domain-session-planner.md) (line 1)
- [Encounter Plan Budget Contract](../../encounter/contract/contract-encounter-plan-budget.md) (line 1)
- [Session Generation Requirements](../../sessiongeneration/requirements/requirements-session-generation.md)
- [Encounter Generated Import Contract](../../encounter/contract/contract-encounter-generated-import.md)
