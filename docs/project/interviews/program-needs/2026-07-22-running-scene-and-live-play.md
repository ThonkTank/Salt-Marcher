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
- Entering a prepared location exposes its accepted monster groups and
  treasures in the Running Scene UI without starting combat or awarding them
  automatically.
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

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Die Szene ist immer da. Sie ist runtime zustand und
> kann imer befüllt werden. Sie ist im Szene Tab immer bereit. Der Gm kann iene
> zweite szene "starten" indem er die Party aus der eigentlichen szene aufteilt.

The primary Running Scene always exists as mutable runtime state and is always
ready in the Scene tab. The GM does not create or start it. A second Running
Scene arises only when the GM splits characters out of the primary Scene.

> [Owner, wörtlich zu 2] Der Gm kann in der Szene charaktere wählen und "in
> neue szene verschieben" auswählen.

The GM creates a split Scene by selecting characters in the current Scene and
choosing `move to new Scene`. Whether a character may belong to several Scenes
or none remains unanswered.

> [Owner, wörtlich zu 3] eine Szene hat null oder einen Ort. Wird der ort
> gewechselt, dann ähndern sich anwesende NPCs, Features, Treasures etc, es sei
> denn der Gm schiebt sie in die Party damit sie sich mitbewegen oder fixiert sie
> an der Szene.

A Running Scene has zero or one current location. Changing that location
changes its present NPCs, Features, treasures, and other location content. The
GM can instead make content travel with the Party or pin it to the Scene. The
exact eligible content and default movement behavior still need clarification.

> [Owner, wörtlich zu 4] Encounter sind eine Maske über der Szene. Sie nehmen
> PCs und ausgewählte NPCs aus der Szene und fügen HP tracking, initiative etc
> hinzu. Es gibt in dem Sinne keine "persistierten encounter" sondern nur
> gruppen von Monstern an Orten oder ohne Ortszuordnung.

An Encounter is a temporary combat mask over a Running Scene. It selects PCs
and NPCs already present in that Scene and adds combat behavior such as HP
tracking and initiative. There are no persistent Encounter objects. Prepared
World content consists of monster groups with or without a location. This
clarifies and supersedes the earlier preparation wording that called those
groups persistent Encounters.

> [Owner, wörtlich zu 5] nicht möglich. Die Szene endet nicht, sie verändert
> sich nur.

A Running Scene cannot be paused, closed, completed, or discarded. It never
ends; its runtime content only changes.

### Literal Evidence So Far

- The primary Scene is an always-present runtime workspace in the Scene tab.
  Additional Scenes arise from splitting characters out of it.
- A Scene has zero or one location. Location changes replace location-derived
  content unless the GM makes content travel with the Party or pins it to the
  Scene.
- An Encounter is a temporary combat mask over Scene participants, not a
  persistent object. Monster groups are the prepared and placed World content.
- A Scene has no end or closed state; it changes continuously.

## Second Breadth Block: Split Scenes, Travelling Content, And Combat Masks

1. May a current Party character belong to exactly one Running Scene or none,
   but never several? When all characters move out of a split Scene, does that
   empty split Scene disappear, while the primary Scene always remains?
2. Do split Scenes need a GM-visible name or label, or are their participants
   and current location enough to distinguish them?
3. Which content may the GM move with the Party or pin to a Scene: NPCs,
   monster groups, Features, treasures, individual Items, or all of them? On a
   location change, does every unpinned and non-travelling object immediately
   leave the Scene?
4. May one Scene have only one active Encounter mask at a time? How does the GM
   leave that mask, and which combat changes remain on the PCs and NPCs after
   the mask is removed?
5. To confirm the preparation correction: does Session generation create
   editable monster groups rather than Encounters, after which the GM selects
   Scene PCs and NPCs or monsters to enter the temporary Encounter mask?

No consolidated interpretation of this workflow is confirmed yet.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Session And Scene Preparation](2026-07-22-session-and-scene-preparation.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
