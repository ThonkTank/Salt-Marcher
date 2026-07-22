Status: Active Evidence
Owner: Aaron
Last Reviewed: 2026-07-22
Source of Truth: Verbatim owner answers and confirmed interpretations for the
program-wide Running Scene and live table workflow.

# Running Scene And Live Play Interview 2026-07-22

## Scope

This workflow covers what the GM does during table play: starting and resuming
Running Scenes, assigning and splitting the current Party, changing locations,
running Encounters and combat, looking up or improvising content, managing
notes and campaign time, observing autonomous weather, controlling music, and
using passive presentation. It does not assume today's screens, features, or
runtime boundaries are the correct target decomposition.

The transcript is evidence only. Confirmed interpretations enter the
[Program Capability Requirements](../../requirements/requirements-program-capabilities.md).
Architecture, contracts, persistence, APIs, and delivery order remain out of
scope.

## Carried-Forward Evidence

- A Scene is resumable runtime state, not preparation. A split Party may have
  several distinct Running Scenes, and the GM-focused Scene controls automatic
  music.
- Current Party membership is authoritative. A character may remain unassigned
  after activation; affected Running Scenes and Encounters reconcile visibly
  without rolling the Party change back.
- Entering a prepared location exposes its accepted Encounters and treasures in
  the Running Scene UI without starting or awarding them automatically.
- Scene saves remain authoritative when Encounter synchronization is pending.
- Notes relevant to a Scene are visible and editable there. Weather develops
  autonomously from terrain and climate data.

## First Breadth Block: Running Scene Lifecycle And Encounter Shape

1. How does the GM start the first Running Scene? Must the GM select a location
   and Party members, or may a Scene start without either? Does a Running Scene
   need a name?
2. When the Party splits or reunites, does the GM assign characters manually?
   May one current Party member belong to more than one Running Scene at once,
   and may a member remain unassigned?
3. May a Running Scene have no location or exactly one current location? Can the
   GM move the same Running Scene to another location without ending it, and
   should the displayed prepared content change immediately with the location?
4. How many Encounters may be running inside one Scene at once? May an
   Encounter span several Running Scenes, and can the GM start an unprepared
   Encounter directly during play?
5. What can the GM do with a Running Scene besides continuing it: pause it,
   close it, mark it completed, or discard it? What remains visible afterward?

No consolidated interpretation of this workflow is confirmed yet.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Session And Scene Preparation](2026-07-22-session-and-scene-preparation.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
