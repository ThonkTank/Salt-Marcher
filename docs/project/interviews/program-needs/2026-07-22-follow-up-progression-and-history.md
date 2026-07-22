Status: Active Evidence
Owner: Aaron
Last Reviewed: 2026-07-22
Source of Truth: Verbatim owner answers and confirmed interpretations for
post-Encounter follow-up, possessions, progression, World consequences,
history, and correction needs.

# Follow-Up, Progression, And History Interview 2026-07-22

## Scope

This workflow begins when a live Encounter, Chase, discovery, or other Scene
event produces consequences which the GM may carry into possessions,
characters, NPCs, factions, quests, locations, World state, and Campaign
history. It asks what the GM must accomplish without assuming that today's
feature boundaries, persistence, screens, or update mechanisms are the right
solution.

The transcript is evidence only. Confirmed interpretations enter the
[Program Capability Requirements](../../requirements/requirements-program-capabilities.md).
Architecture, contracts, persistence, APIs, and delivery order remain out of
scope.

## Carried-Forward Confirmed Evidence

- The GM confirms one complete Encounter outcome. Completion, calculated Party
  XP, selected named-NPC lifecycle changes, and selected finite-stock effects
  become effective together or remain unchanged.
- The Running Scene continues after an Encounter or another runtime mask ends.
- Treasures and their Items are persistent editable World content before they
  are awarded. Reaching them never awards them automatically.
- Confirmed Campaign consequences ordinarily remain in explanatory history.
  Later table focus may use an earlier in-world time without rolling them back.
- Explicit deletion and travel undo have already confirmed exceptional
  behavior; conflicting later history is exposed for manual GM resolution.

## First Breadth Block: From Scene Outcome To Durable Campaign State

1. When the Party obtains a treasure, what must the GM be able to do in one
   operation: award the whole treasure to the Party, distribute individual
   Items to characters, leave some Items at the location, move them into a
   shared Party inventory, or any combination? Must SaltMarcher ever choose
   recipients automatically?
2. How should Encounter XP work after the already confirmed calculation: is it
   divided equally among participating PCs, assigned only when the GM confirms
   the outcome, individually adjustable before confirmation, and immediately
   reflected in progression? Does SaltMarcher perform level-up changes or only
   tell the GM when a threshold is reached?
3. Which other PC or NPC consequences must the completion workflow support
   directly—HP, conditions, death, capture, location, consumed resources,
   possessions, or arbitrary notes—and which of those should be automatic
   proposals versus explicit GM-entered choices?
4. When an outcome changes a faction, quest, rumour, place, or other World
   object, should the GM select and edit those consequences as part of the same
   completion operation, or finish the Encounter first and perform ordinary
   World edits afterward? Should any such narrative consequence be inferred
   automatically?
5. If the GM later corrects an awarded Item, XP amount, character consequence,
   or World change, should the current Campaign state update immediately while
   history keeps the original plus a linked correction? What must happen when
   the corrected fact has already influenced later progression or history?

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Session And Scene Preparation](2026-07-22-session-and-scene-preparation.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Confirmed Spatial Travel And Progression](2026-07-22-spatial-travel-and-progression.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
