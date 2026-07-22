Status: Active Evidence
Owner: Aaron
Last Reviewed: 2026-07-22
Source of Truth: Verbatim owner answers and confirmed interpretations for the
program-wide Session and Scene preparation workflow.

# Session And Scene Preparation Interview 2026-07-22

## Scope

This workflow covers what the GM prepares before table play: Sessions, planned
Scenes, expected participants, linked Campaign knowledge, Encounter and reward
preparation, weather, music, and notes. It does not assume today's Session
Planner, Scene, Encounter, or generation boundaries are the correct target
decomposition.

The transcript is evidence only. Confirmed interpretations enter the
[Program Capability Requirements](../../requirements/requirements-program-capabilities.md).
Architecture, contracts, persistence, APIs, and delivery order remain out of
scope.

## Carried-Forward Evidence

The confirmed project vision already requires the GM to prepare Sessions with
Scenes, linked places, NPCs, and factions, and to request adjustable Encounter
or loot suggestions that fit that preparation. The earlier goal interview also
establishes that current implementation details are too compressed to complete
the program-level need.

## First Breadth Block: Session And Planned Scene Shape

1. When the GM creates a Session, what minimum information is required? Is a
   name enough, and is a date optional?
2. Does one Session represent one expected table sitting, or may one Session
   intentionally span several real play dates?
3. How are planned Scenes organized: an ordered sequence, an unordered set,
   optional alternatives, or a mixture that the GM can rearrange?
4. When table play begins, do all planned Scenes become Running Scenes, or only
   the Scenes the GM explicitly starts? May several of them run at once?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1, 3 und 4] Es gibt nur eine aktuelle Session. Diese kann
> im Session Planer überschrieben werden. Dort werden Encounter und treasures
> erstellt und dann auf Orten platziert. Die Session ist danach nurnoch die
> Timeline aller geplanten Szenen (wobei es auch nur eine aktuelle Szene gibt.
> Die vorbereiteten Szenen sind danach nurnoch da, vorbereitet. Wenn die Party
> den Ort betritt wird es wie in der geplanten Szene sein, aber es gibt keine
> gespeicherten, vorbereiteten Szenen zwischen denen man wechseln kann.

> [Owner, wörtlich zu 2] Nein das Programm soll die session verweigern, wenn sie
> nicht mit dem angegebenen Spieltermin übereinstimmt :) Natürlich soll ich sie
> wiederverwenden können wenn ich will du trottel. Wieso sollten wir dem User
> solche unnötigen Steine in den Weg legen?

This rejects the question's artificial date restriction. A Session is reusable
across as many real play dates as the GM wants.

### Literal Evidence So Far

- SaltMarcher has one current Session, which Session preparation may overwrite.
- Preparation creates Encounters and treasures and places them on locations.
- The prepared Session becomes a timeline of planned Scene occurrences.
- Prepared Scenes are not stored workspaces that the GM opens or switches
  between. Their preparation becomes relevant when the Party enters the
  corresponding location.
- There is one current Scene.
- A Session is not constrained to one date or one real table sitting.

The original question block incorrectly offered unnecessary restrictions. The
remaining interview uses concrete behavior that follows from this corrected
shape rather than asking whether SaltMarcher should obstruct reuse.

## Corrected Clarification Block

1. Earlier evidence says the current Party may split across Scenes. Does “one
   current Scene” mean one focused Scene while other split groups retain
   background Scene state, or literally one Scene state for the whole Party?
2. Is one Session-timeline entry primarily an expected visit to a location whose
   prepared content supplies the Scene, or does the timeline entry also own
   preparation such as notes, participants, and ordering independently of that
   location?
3. When Session preparation overwrites the current Session, should it replace
   the previous plan immediately or first ask before discarding manual timeline,
   Encounter, or treasure changes?
4. When the Party enters a prepared location, do all placed Encounters and
   treasures enter the current Scene automatically, or do they become prepared
   options that the GM explicitly activates or awards?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] split scenes sind zwei verschiedne. es gibt in dem
> fall doch mehrere. szenen sind dennoch nuur resumable runtime zustand

This corrects the earlier “one current Scene” statement. Ordinarily there is one
Running Scene; a split Party creates several distinct Running Scenes. Every
Scene is resumable runtime state, never a stored preparation workspace.

> [Owner, wörtlich zu 2] er kann notizen enthalten

A Session-timeline entry may contain its own notes. Its remaining relationship
to location preparation is not yet interpreted.

> [Owner, wörtlich zu 3] Platzierungen bleiben erhalten, die sind jetzt ja
> einfach prsidtierter welt-zustand ohne weiteren panner-bezug.

Encounter and treasure placements survive Session overwrite because accepted
placement is persistent World state with no remaining Planner ownership.

> [Owner, wörtlich zu 4] die stehen dann einfach in der szenen ui wo der GM
> machen kann was er will.

Entering a prepared location exposes its placed Encounters and treasures in the
Running Scene UI. Nothing starts, resolves, or awards automatically; the GM
decides what to do there.

## Second Breadth Block: Timeline And Placement Lifecycle

1. Does every Session-timeline entry reference exactly one location, or may an
   entry have no location and may the same location appear several times?
2. Can the GM add, remove, reorder, and annotate timeline entries manually at
   any time, including after generation?
3. Do generated Encounters and treasures remain adjustable draft suggestions
   until the GM explicitly accepts their placement as persistent World state?
4. When the Session Planner overwrites the current Session, does it replace the
   timeline, its notes, and any unaccepted drafts while leaving every already
   accepted World placement untouched?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] ja ja und ja

The first two literal answers conflict: an entry cannot both require exactly one
location and allow no location. Repeated use of the same location is confirmed;
the per-entry location cardinality remains open.

> [Owner, wörtlich zu 2] ja

The GM may manually add, remove, reorder, and annotate timeline entries at any
time, including after generation.

> [Owner, wörtlich zu 3] Sie sind auch danach weiterhin bearbeitbar, aber ja.

Generated Encounters and treasures remain adjustable before placement. Explicit
placement accepts them as persistent World state, but acceptance does not make
them immutable; the GM may continue editing them afterward.

> [Owner, wörtlich zu 4] ja.

Overwriting the current Session replaces its timeline, timeline notes, and
unaccepted drafts. Accepted World placements remain untouched and independent
of the new Session plan.

## Third Breadth Block: Generation Result And Control

1. Is the location rule `zero or one location per timeline entry`: an entry may
   have no location, never several locations, and the same location may appear
   in several entries?
2. When the GM generates a Session, does the result contain the timeline plus
   concrete Encounters and treasures, or does generation create only Encounters
   and treasures for the GM to arrange into the timeline?
3. Besides the planning Party, which generation inputs does the GM deliberately
   choose: session duration or Encounter count, difficulty, locations,
   factions, reward amount, or something else? Which of them are required?
4. Can the GM edit, regenerate, accept, reject, and place each generated
   Encounter or treasure independently, or is the generated result handled only
   as one complete plan?

No consolidated interpretation of this workflow is confirmed yet.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Project Vision](../../vision.md)
- [Goal Interview 2026-07-10](../2026-07-10-goal-interview.md)
