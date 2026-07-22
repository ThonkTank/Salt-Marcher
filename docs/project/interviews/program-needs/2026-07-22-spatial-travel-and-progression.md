Status: Active Evidence
Owner: Aaron
Last Reviewed: 2026-07-22
Source of Truth: Verbatim owner answers and confirmed interpretations for the
program-wide spatial travel and campaign-time progression workflow.

# Spatial Travel And Progression Interview 2026-07-22

## Scope

This workflow connects ordinary Campaign places, Hex exploration, Dungeon
exploration, travel, position, events, perception, tracks, and optional Actor
Autonomy to the already confirmed Running Scene model. It asks what the GM must
experience across those contexts without assuming that today's features,
screens, state owners, or spatial detail levels are the correct target
decomposition.

The transcript is evidence only. Confirmed interpretations enter the
[Program Capability Requirements](../../requirements/requirements-program-capabilities.md).
Architecture, contracts, persistence, APIs, and delivery order remain out of
scope.

## Carried-Forward Confirmed Evidence

- Every active Party character belongs to exactly one Running Scene. Split
  Scenes progress independently, and the focused Scene controls the passive
  second display.
- Dungeon exploration already has accepted long-term needs for cell-precise
  actor positions, routes, calculated travel time, interruptions, perception,
  tracks, and a visibility-filtered map.
- Dungeon travel distinguishes rule-based travel from a deliberate GM position
  override. A completed travel segment changes position and time together;
  events may interrupt later progress.
- Optional Actor Autonomy advances only with GM-confirmed campaign time. Party
  involvement pauses before autonomous danger resolution, while bounded
  non-Party conflict may continue.
- Hex travel and the transitions between ordinary places, Hexes, and Dungeons
  have not yet been integrated into the program-wide workflow.

These accepted feature needs remain evidence, but any wording that assumes one
undivided Party, one global active context, or a feature-owned runtime must be
reconciled with the now-confirmed Scene and Party behavior before it becomes
program-wide truth.

## First Breadth Block: One Journey Across Spatial Detail Levels

1. Is `Travel` one continuous GM workflow for the focused Scene regardless of
   whether the group moves between ordinary Campaign places, across a Hex map,
   or through a cell-precise Dungeon? What does the GM choose to begin it: only
   a destination, a route, a duration, a travel mode, or some combination?
2. Which positions must exist at the same time? Does a Running Scene or Party
   subgroup have one shared position, while individual PCs, NPCs, monster
   groups, and travelling content may additionally have their own exact
   positions? When does spatial separation require a new Scene rather than
   several positions inside one Scene?
3. When travel crosses from an ordinary place into a Hex map or Dungeon, or
   back out again, should the same journey continue with its elapsed time,
   route progress, travelling content, and participants intact? What should the
   GM see or decide at that transition?
4. During travel, which consequences may SaltMarcher apply immediately without
   another GM confirmation: position and time progress, weather, perception,
   tracks, planned events, random events, trap prompts, or something else?
   Which of them must pause travel before any further segment is applied?
5. When time advances in one Running Scene, which autonomous NPCs and monster
   groups should also advance: only actors at that Scene's location, every
   enabled actor in the same spatial context, or all enabled Campaign actors?
   What should happen when autonomous activity reaches the Party or requires a
   GM decision?

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Dungeon Needs Interview](../2026-07-20-dungeon-needs-interview.md)
- [Dungeon Travel Requirements](../../../dungeon/requirements/requirements-dungeon-travel.md)
- [Actor Autonomy Requirements](../../../autonomy/requirements/requirements-actor-autonomy.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
