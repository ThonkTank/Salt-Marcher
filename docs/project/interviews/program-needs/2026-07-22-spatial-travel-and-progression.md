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

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Ja. GM nutz das reisen state tab und ggf. eine
> mini-map im detail pane. Je nach Fortbewegungsart kann er auf hex-karten oder
> in dungeons routen planen oder direkt angrenzende Bereiche (locations auf dem
> hex, benachbarte hexes, benachbarte naigationsbereiche im Dungeon etc)
> auswählen. Für eine Route werden reisepunkte gewählt, und eine route von
> punkte zu punkt erstellt. Für direkt angrenzende Reise muss nur die jeweilige
> Loation als button gewählt werden. Routen können angehalten, vorgespult oder
> verlangsamt werden. Es gibt eien rückgängig-button.

Travel is one GM workflow in the travel state tab, optionally supported by a
mini-map in the detail pane. Depending on the movement context, the GM either
selects directly adjacent locations or navigation areas, or chooses travel
points from which SaltMarcher constructs a route. The GM can pause, accelerate,
slow, and undo route progress. The observable meaning of speed changes and undo
still needs clarification.

> [Owner, wörtlich zu 2] die "Szene" ist alles ,was grade am selben Ort wie
> die Party ist. Wenn der Ort "Taverne Löwenzahn" vom GM angelegt wurde sich
> dort zwei NPCs aufhalten, eine magisches Item, und die Party, dann ist das die
> aktuelle Szene.

A Scene consists of everything currently at the same place as its Party
subgroup. For example, if two NPCs, a magic Item, and the Party are at the
authored place `Taverne Löwenzahn`, they form the current Scene there. This
clarifies Scene content as a view of current co-location rather than an
independent collection. How nested places, exact actor positions, pinned
content, and narrative splits affect co-location still needs clarification.

> [Owner, wörtlich zu 3] "Normale Orte" existieren auf Karten. Hex nr. 34 ist
> ein Ort, auf dem sich der Ort "Dorf langen Weiler" existieren kann, in dem
> der Ort "Taverne Löwenzahn" existieren kann, in dem der Ort "Hinterzimmer"
> existieren kann. Räume sind Orte auf Dungoen Karten. Es kann orte geben, die
> nicht einer karte zugeordnet sind, und die kann der GM dann eifach als
> location auswählen, das ist aber keine Reise. In dem Fall muss er Zeit
> manuell vorschtellen um ggf. Reisezeit zu simulieren. Was soll das heißen
> "Als dieselbe Reise erhalten bleiben?"

Places form a nested spatial hierarchy on maps: a Hex is a place and may
contain a village, which may contain a tavern, which may contain a back room.
Dungeon Rooms are places on Dungeon maps. An authored place may also have no
map assignment. The GM may select such an unmapped place as the Scene's
location, but this is an administrative location change rather than travel and
does not advance time automatically. The GM advances time manually if desired.
Whether one planned route may cross map and hierarchy boundaries was not
understood from the original wording and remains to be asked concretely.

> [Owner, wörtlich zu 4] Korrekt. Pausieren müsen davon nur ereignisse,
> Fallen, Spuren falls die Party nach ihnen ausschau hällt, Wahrnehmung wenn die
> party NPCs wahrnimmt.

Ordinary travel may immediately advance position, time, weather, perception,
tracks, and applicable event evaluation. Travel pauses for events and Traps,
for tracks when the Party is actively looking for them, and when Party
perception detects NPCs. These pauses do not themselves decide a fictional
outcome.

> [Owner, wörtlich zu 5] Das ist eine technische Frage, die ich nicht
> beantworten kann und hängt davon ab, wieviel wir auf einmal simulieren
> können. Im idealfall sollte die gesammte Kampagnen Welt sich autonom mit der
> Party "mitdrehen" wann immer die Zeit voranschreitet, aber das ist nicht
> unbedingt praktikabel.

The solution-independent target need is that the entire Campaign World advances
autonomously with the Party whenever campaign time advances. The later
technical-needs and architecture work must determine what computation strategy
can satisfy that observable goal at the required scale. The product interview
still needs to define the expected result when independently timed split Scenes
advance through overlapping in-world periods.

### Literal Evidence So Far

- Travel is one GM workflow with direct adjacent movement and planned routes
  across mapped spatial contexts.
- A Scene presents the Party subgroup and everything co-located with it at an
  authored place.
- Places may be nested on Hex and Dungeon maps. Selecting an unmapped place is
  an administrative location change, not travel, and advances no time.
- Ordinary travel progression is automatic, while events, Traps, relevant
  tracks, and detected NPCs pause further travel for GM attention.
- The ideal target advances the complete autonomous Campaign World whenever
  campaign time advances; technical practicality must not silently redefine
  that user need.

## Second Breadth Block: Co-Location, Route Boundaries, And Time Semantics

1. Does a Scene automatically include every object at its most specific current
   place, plus relevant content inherited from containing places? In the
   example `Hex 34 > Langen Weiler > Taverne Löwenzahn > Hinterzimmer`, what
   appears when the Party is in the back room: only back-room content, or also
   selected content from the tavern, village, and Hex?
2. May characters in one Scene occupy different exact cells or neighboring
   navigation areas while still being considered at the same place? Does only
   the GM decide when separation becomes a new Scene, or should entering a
   different authored place split or move characters automatically?
3. Concretely, may one planned route contain points across map boundaries—for
   example `Hex 34 > Langen Weiler > Taverne Löwenzahn > Hinterzimmer` or from
   one Hex map through a Dungeon entrance into a Dungeon Room—or does travel
   stop at each boundary and require the GM to start the next leg?
4. Do accelerate and slow change only how quickly SaltMarcher presents the same
   calculated journey, without changing its in-world duration? What exactly
   does `undo` reverse: only an uncommitted route choice, the last completed
   segment's position and time, or also events and other consequences produced
   during that segment?
5. Suppose Scene A advances the World from 10:00 to 12:00 while Scene B remains
   at 10:00, and Scene B later advances to 11:00. Should autonomous World actors
   progress only once for the 10:00-to-11:00 period? What World state should the
   GM see while focusing the earlier Scene B: the already current state from
   12:00, a historical 11:00 view, or some other behavior?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Wetter, Musik, Faktoren für Loot und begegnungs
> generatoren, NPCs, Fraktionen und weiteres können vererbt werden.

Weather, music selection, factors used by loot and Encounter generation, NPCs,
factions, and other relevant place content may be inherited from containing
places by their subplaces. Which inheritance is automatic, configurable, or
overridable remains to be clarified.

> [Owner, wörtlich zu 2] Nein. Navigationsbereiche in einem Raum sind nicht
> verschiedene Orte, sie sind der selbe ort. Das Hinterzimmer in der Taverne
> ist ebenfalls eher ein Unterort. Wenn die Taverne zwei Zimmer hat und die
> party sich verteilt, dann werden das nicht zwei verschiedene Szenen. Ich
> schätze hier müssen wir wirklich zwischen Orten und unterorten unterscheiden.

Exact cells and navigation areas inside one Room are not separate places. A
back room or another internal part of a tavern is a `subplace`, not necessarily
a separate place. Party members distributed across such subplaces remain in
one Scene. The product therefore needs an explicit distinction between places,
which provide the co-location boundary of a Scene, and subplaces, which refine
position and content within that boundary without creating Scenes.

> [Owner, wörtlich zu 3] Ich wüsste nicht, wie wir das in der UI umsetzen
> könnten, also würde ich erstmal nein sagen. Wäre aber cool wenn.

The initial product need does not require one planned route to cross map
boundaries. The owner considers that behavior desirable, but its status as a
long-term target need rather than an optional future extension remains open
because the answer was based on present UI uncertainty.

> [Owner, wörtlich zu 4] Verlangsamung der Darstellung, echtzeit-dauer.
> Rückgängig setzt die Reise und ihre Resultate zum letzten Punkt zurück.

Accelerating or slowing changes presentation speed only; it does not change the
journey's calculated in-world duration. Undo returns the journey and its results
to the preceding travel point. The exact consequence boundary and treatment of
the immutable Campaign history still need clarification.

> [Owner, wörtlich zu 5] Wenn Szene A von 10-12 läuft haben wir die autonomen
> Handlungen für 11 ja schon simuliert. Wir können einfach auf diesen für szene
> A vergangenen Stand zurückgreifen und ihn für Szene B zur Gegenwart machen.

Autonomous World behavior for a given in-world period is simulated only once.
When an earlier Scene reaches a time already processed through a later Scene,
SaltMarcher reuses the corresponding earlier World state and presents it as the
earlier Scene's current state. The observable behavior when that Scene adds a
new fact or consequence which was not part of the already processed future
remains to be clarified.

### Literal Evidence So Far

- Places provide Scene-level co-location. Subplaces, exact cells, and navigation
  areas refine position inside that same Scene boundary.
- Containing places may contribute weather, music, generator factors, NPCs,
  factions, and other content to their subplaces.
- Planned routes initially remain within one map. Cross-map planning is desired
  but not yet classified as a binding long-term need.
- Route speed controls presentation speed rather than in-world travel time.
  Undo returns travel and its results to the prior travel point.
- Independently timed Scenes reuse already processed autonomous World state for
  the same in-world period rather than simulating it again.

## Third Breadth Block: Inheritance, Undo, And Earlier-Time Changes

1. Is inheritance chosen separately per kind of place content and per concrete
   object? For example, can the GM inherit a tavern's music and weather into its
   back room, include one tavern NPC there, exclude another, and override the
   inherited Encounter-generator factors specifically for that back room?
2. Does creating or moving Party members into a new Scene remain an explicit GM
   action regardless of their places and subplaces? In other words, may one
   Scene temporarily contain characters at different full places if the GM has
   not split them yet, or must different full places always imply different
   Scenes?
3. Ignoring how the UI would achieve it: should cross-map route planning be a
   binding long-term target capability, merely an optional later convenience,
   or explicitly outside the intended product?
4. If the GM presses undo after a travel segment triggered a Trap or event,
   revealed an NPC, changed weather, created tracks, or caused autonomous World
   actions, which of those results are reversed? Does Campaign history retain
   the original journey and its undo as an explicit correction, or should the
   undone segment disappear from ordinary history?
5. Scene A has already established a World state at 12:00. Scene B then plays at
   11:00 and creates a new consequence that would have affected that future—for
   example, it kills or moves an NPC whom Scene A encountered at 12:00. Should
   the 12:00 history remain exactly as experienced while the new consequence
   changes only the World state from now on, or should SaltMarcher recalculate
   any part of the already established future?

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Dungeon Needs Interview](../2026-07-20-dungeon-needs-interview.md)
- [Dungeon Travel Requirements](../../../dungeon/requirements/requirements-dungeon-travel.md)
- [Actor Autonomy Requirements](../../../autonomy/requirements/requirements-actor-autonomy.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
