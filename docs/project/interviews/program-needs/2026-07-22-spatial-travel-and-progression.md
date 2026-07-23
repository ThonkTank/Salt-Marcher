Status: Confirmed Evidence
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

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Wetter wird auf hex-basis gemacht und an alle
> sub-locations vererbt. Musik-relevante Tags werden vererbt, wenn der Sub-Ort
> keine eigenen bereitstellt. Mit NPCs und fraktionen meine ich, dass Orte
> definieren können, welche Fraktionen eine chance haben dort aufzutauchen, das
> wird ebenfalls vererbt wenn es nicht explizit überschrieben ist.

Weather is determined at Hex level and inherited by every subplace. Music tags
use fallback inheritance: a subplace inherits them only when it supplies none
of its own. Places do not inherit concrete NPCs or factions as Scene members.
Instead, a place defines which factions have a chance to appear there; a
subplace inherits those appearance factors unless it explicitly overrides
them.

> [Owner, wörtlich zu 2] Ja. Nein. Uerschiedliche Orte edeuten unterschiedliche
> szenen.

Creating or moving Party members into another Scene remains an explicit GM
action. A Scene cannot contain Party members at different full places: different
places imply different Scenes, while subplaces within the same place do not.

> [Owner, wörtlich zu 3] Wäre cool wenn, muss aber nicht.

Cross-map route planning is an optional future convenience, not a binding
long-term target need.

> [Owner, wörtlich zu 4] Ja. Nein.

Travel undo reverses the listed results of the last segment, including triggered
Traps or events, NPC discovery, weather changes, tracks, and autonomous World
actions. The original segment and its undo do not remain visible in ordinary
Campaign history. Travel undo is therefore an explicit, narrow exception to the
otherwise immutable-history behavior. Its interaction with shared consequences
observed by other Scenes still needs clarification.

> [Owner, wörtlich zu 5] Das ist die Art von Zeitparadoxon, das ein GM im Spiel
> sowieso vermeiden muss. Es sollte dafür explizite Tools geben um sowas zu
> resolven wenn notwendig, aber die default annahme sollte sein, dass das
> einfach nicht passiert weil der GM es vermeidet.

The default product assumption is that the GM avoids introducing consequences
at an earlier Scene time which contradict an already established future.
SaltMarcher need not automatically rewrite that future. It must nevertheless
provide explicit GM tools to resolve such a paradox when it occurs. The
required detection, choices, and resulting history behavior remain to be
defined.

### Literal Evidence So Far

- Hex weather always flows to subplaces. Music tags and faction-appearance
  factors use fallback inheritance with explicit subplace replacement.
- Concrete NPCs are not inherited as Scene members merely because a containing
  place can generate appearances from their faction.
- Different places require different Scenes; subplaces do not. Scene splitting
  and character movement remain explicit GM actions.
- Cross-map route planning is optional convenience rather than binding scope.
- Route undo reverses every result of the latest segment and removes the segment
  from ordinary history, creating a narrow exception to immutable history.
- Earlier-time paradoxes are GM-avoided by default and resolved through explicit
  tools rather than automatic future rewriting.

## Fourth Breadth Block: Scene Movement, Shared Undo, And Paradox Repair

1. How do loot- and Encounter-generator factors inherit across `Hex > place >
   subplace`: does a child with its own factors replace the parent set entirely,
   or may the GM combine selected parent and child factors?
2. If only part of a Scene travels to another full place, does that travel
   action itself create a new Scene for the selected characters? If every Party
   member in the Scene travels together, does the same Scene simply change its
   place?
3. If undoing a travel segment would reverse autonomous actions or other World
   changes that another Scene has already observed or depended on, should undo
   still proceed, be blocked, or require the GM to resolve the conflict first?
4. Can the GM press travel undo repeatedly to step back through several travel
   points, and is there a corresponding redo? What establishes an undo point:
   every adjacent move, every selected route point, every pause, or only points
   the GM explicitly marks?
5. What explicit paradox-resolution tools does the GM need? Should SaltMarcher
   detect and flag likely contradictions, then let the GM choose which facts to
   keep, edit, or delete, or is a simpler manual correction interface enough?
   Whatever the GM chooses, what should remain visible in Campaign history?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Wird pro ort eingestellt, ob additiv oder
> überschreibend gearbeitet wird.

Each place defines whether its loot- and Encounter-generator factors add to the
inherited factors or replace them.

> [Owner, wörtlich zu 2] genau.

If selected members of a Scene travel to another place, the travel action
creates a new Scene for them. If the complete Scene travels together, the same
Scene changes its place.

> [Owner, wörtlich zu 3] Hmm... Die am weitesten fortgeschrittene Szene behällt
> die Authorität.

The Scene at the greatest in-world time retains authority over shared World
state. An earlier Scene's travel undo cannot silently replace shared truth
already established by that authoritative Scene. The precise user-visible undo
result in that case remains to be clarified.

> [Owner, wörtlich zu 4] Ja, es gibt ein redo zum undo und es gibt mehrere
> tiefen von undo. Alle genannten.

Travel provides multi-level undo and redo. Every adjacent move, selected route
point, pause, and explicitly marked point establishes an undo point.

> [Owner, wörtlich zu 5] Der GM kann sich dazu entscheiden dinge zu einem
> Zeitpunkt zu entfernen, obwohl sie später schon history erzeigt haben. In
> diesem Fall wird er gewarnt und muss, wenn er trotzdem weiter macht, alle
> konflikte manuell resolven. Nicht sofort, aber entsprechende history einträge
> werden als konfliktierend markiert.

The GM may deliberately remove something at an earlier in-world time even when
it already produced later history. SaltMarcher warns before the removal. If the
GM proceeds, dependent later history entries are marked as conflicting and the
GM resolves every conflict manually. Resolution need not be immediate. The
original later history is not automatically recalculated or erased.

### Literal Evidence So Far

- Every place chooses additive or replacing inheritance for its loot- and
  Encounter-generator factors.
- Partial-group travel creates a new Scene; whole-Scene travel moves the
  existing Scene to the destination place.
- The Scene furthest ahead in in-world time is authoritative for shared World
  state.
- Travel has multi-level undo and redo across adjacent moves, route points,
  pauses, and explicit points.
- Earlier removal which contradicts later history requires a warning, marks
  dependent history as conflicting, and leaves manual resolution to the GM
  without blocking unrelated work or automatically rewriting history.

## Fifth Breadth Block: Authoritative Time And Travel Interruptions

1. Is the additive-versus-replacing generator setting one shared choice for all
   loot and Encounter factors at a place, or may the GM choose independently
   for loot, Encounter composition, faction appearance, and other factor
   families? What default should a newly created place use?
2. Scene A is authoritative at 12:00. Scene B at 11:00 undoes a travel segment
   whose autonomous results contributed to A's World state. Should B's own
   position, time, and local travel results still undo while the shared World
   results remain as established by A, with a conflict marker? Or should the
   undo be unavailable until the GM resolves the shared conflict?
3. When an event, Trap, detected NPC, or relevant track pauses travel, has the
   just-completed movement and elapsed time already taken effect? Which actions
   must the GM have immediately: inspect, resolve or dismiss the interruption,
   resume the route, choose a different route, or end travel at the current
   point?
4. Does a travel interruption appear as context inside the same Running Scene
   and travel state, rather than creating another Scene? When an NPC is
   perceived, does that NPC become visible in the Scene immediately while an
   Encounter still requires separate GM confirmation?
5. For a history entry marked as conflicting, what must manual resolution let
   the GM do: keep it as an acknowledged inconsistency, edit its facts or time,
   link a corrective entry, or delete it? When is the conflict marker removed,
   and must the resolution itself remain visible in history?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] individuell

The GM chooses additive or replacing inheritance independently for each factor
family, including loot, Encounter composition, faction appearance, and future
families. The default for a new place remains unanswered.

> [Owner, wörtlich zu 2] Alles was Bs reise hinzugefügt hat wird zurückgesetzt.
> Alles was A bereits etabliert hatte wird behalten.

Undo removes everything introduced by Scene B's journey, including B's
position, time, local results, and journey-owned World consequences. Anything
already established by the authoritative later Scene A remains unchanged. Undo
therefore respects the authority of the furthest-progressed Scene rather than
rewriting its established truth.

> [Owner, wörtlich zu 3] Ja. Eine Unterbrechung gilt als Reisepunkt, an dem die
> Reise gestoppt und der Zwischenzustand festgehalten wird. Ja.

Movement and elapsed time up to an interruption are already committed. Every
interruption is a travel point: travel stops there and its intermediate state is
preserved. The GM can inspect and resolve or dismiss the interruption, resume
the route, choose another route, or end travel at that point.

> [Owner, wörtlich zu 4] Ja.

An interruption appears in the same Running Scene and travel state rather than
creating another Scene. A perceived NPC becomes visible in the Scene
immediately; starting an Encounter still requires explicit GM confirmation.

> [Owner, wörtlich zu 5] Ja. Die markierung verschwindet, wenn der GM sie als
> resolved markiert.

Manual conflict resolution may keep an acknowledged inconsistency, edit its
facts or time, link a corrective entry, or delete the conflicting entry. The
resolution remains visible in Campaign history. Its conflict marker disappears
when the GM explicitly marks the conflict resolved.

### Literal Evidence So Far

- Generator-factor inheritance mode is selected independently per factor
  family.
- Undo removes only what the earlier Scene's journey introduced and preserves
  truth already established by the authoritative later Scene.
- Every interruption commits a travel point and intermediate state before the
  GM inspects, resolves, dismisses, reroutes, resumes, or ends travel.
- Interruptions remain within the same Scene and travel state. Perceived NPCs
  appear immediately, but Encounters still require GM confirmation.
- Conflicting history supports acknowledgement, editing, correction, or
  deletion. Resolution remains visible, and the GM explicitly clears the
  marker by marking it resolved.

## Sixth Breadth Block: Hex Maps And General Travel Controls

1. What inheritance default should a newly created place use for each generator
   factor family: additive, replacing, inherited from its parent, or explicitly
   unset until the GM chooses?
2. What must the GM be able to author for Hex maps: several maps per Campaign,
   map name and scale, map extent, terrain per Hex, roads or other connections,
   nested places, and links to other maps? Must maps begin empty, may the GM
   import an image or data, and is procedural Hex generation a target need?
3. When planning Hex travel, which facts determine the calculated route and
   duration: terrain, roads, weather, travel mode, Party movement rates, chosen
   pace, rests, carried load, or something else? Which of those may the GM
   override for a particular journey?
4. What does the GM and passive second display know about an unexplored Hex
   map? Should Hexes distinguish unknown, previously explored, and currently
   perceivable information, and should visibility belong to each Party subgroup
   or be shared across the complete Party?
5. You established the travel state tab as the GM's travel control surface,
   optionally with a mini-map in the detail pane. Is a separate full Hex or
   Dungeon travel workspace also required for route planning and inspection, or
   should selecting or enlarging the mini-map provide the complete mapped
   travel interaction while controls remain in the state tab?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] additiv ist default

Every newly created generator-factor family uses additive inheritance by
default. The GM may change that family to replacing inheritance for the place.

> [Owner, wörtlich zu 2] Mehrere Karten, wie Dungeons. Mehrere Karten sollten
> möglich sein. karten sind unbounded. Hex-durchmasser kann eingetellt werden
> beim erstellen der Karte. hex karten können nested sein bzw. mehrere "Zoom
> Stufen" haben, wenn man einen Kontinen erstellen möchte und dann eine genauere
> Karte einer spezifischen Region erstellen will. Felder haben Terrain,
> weiterhin müssen Flüsse, Straßen, Klippen und Schluchten eingezeichnet werden
> können, sowie location marker platziert werden können. Fraktionen können
> Einfluss auf karten verbreiten, was begegnungschancen dort beeinflusst.
> karten sollten ex- und importiet werden können, Es sollte möglich sein assets
> hinzuzufügen. Hex-generatoren sind ein weit entferntes komfort feature.
> Klimadaten sind eine eigene Ebene überterrain, aber ich habe noch keine Ahnung
> wie komplex die wetter simulation sein soll oder wie die dazu benötigten
> karten daten aussehen könnten. Was mir wichtig ist, ist dass der Gm kontrolle
> über das Wetter hat, wetter ereignisse erstellen und dafür sorgen kann dass
> verschidene regionen unterschiedliche Klimata haben, und die generation
> wetter realistisch und sinnvoll graduell sich ändern lässt in reaktion auf
> Tages und Jahreszeit, sodass plötzliche Umschwünge sinn machen und man nicht
> in jedem Hex komplett anderes zufälliges Wetter hat, sondern wetterphänomene
> sich sinnvoll über die map bewegen. ich habe übrigens vergessen zu erwähnen,
> dass neben Musik auch mehrere Layer an ambiance sound möglich sein sollen,
> die auf location, wetter und tageszeit basieren.

A Campaign may have several Hex maps. A map has no authored extent limit, and
the GM chooses its Hex diameter when creating it. Maps may be nested as several
zoom levels, such as a continent map whose selected region links to a more
detailed regional map.

Hexes own terrain. The GM can also author rivers, roads, cliffs, ravines,
location markers, and visual assets. Factions can spread influence across a
map, which changes local Encounter chances. Hex maps can be exported and
imported. Procedural Hex generation is only a distant convenience feature.

Climate is a distinct authored layer over terrain. Different regions may have
different climates. Automatic weather must change gradually and plausibly with
time of day and season; sudden changes must arise meaningfully rather than from
independent random weather per Hex. Weather phenomena move coherently across
the map. The GM retains control and can author weather events. The exact model
and required climate inputs remain open.

In addition to music, live play supports several simultaneous ambience-sound
layers selected from location, weather, and time of day. Their sourcing,
categorization, mixing, and manual controls remain open.

> [Owner, wörtlich zu 3] Ja, alle genannten. Alle genannten.

Terrain, roads, weather, travel mode, Party movement rates, chosen pace, rests,
carried load, and future applicable travel facts all contribute to Hex route
and duration calculation. The GM may override every one of those inputs for a
particular journey. Whether the calculated duration itself remains binding as
previously confirmed still needs explicit reconciliation.

> [Owner, wörtlich zu 4] Ja, auch hier gibt es fog of war, sichtweite (von
> Wetter und terrain höhe beeinflusst) und unbekannte regionen und so weiter.
> Der Gm kann manuell teile der Karte oder bestimmte hex inhalte revealen.

Hex maps distinguish unknown and revealed space through Fog of War. Current
view distance is affected by weather and terrain elevation. The GM may manually
reveal map regions or specific Hex content. Whether knowledge belongs to each
Party subgroup or is shared across the complete Party remains unanswered.

> [Owner, wörtlich zu 5] reist state-tab und mini-map müssen reichen. Der GM
> soll während einer Session das szenen tab nicht verlassen müssen.
> Suplementäre informationen und Controls müssen über top bar, details pane und
> state pane tabs verfügbar sein.

The travel state tab and mini-map provide the complete live travel workflow; no
separate full travel workspace is required. During a Session the GM does not
need to leave the Scene tab. Supplementary information and controls remain
available through the top bar, detail pane, and state-pane tabs.

### Literal Evidence So Far

- Generator-factor inheritance is additive by default and configurable per
  factor family and place.
- A Campaign supports several unbounded Hex maps with chosen Hex diameter,
  nested zoom levels, terrain, linear map features, locations, visual assets,
  faction influence, and import or export.
- Climate is separate from terrain. Coherent weather changes with region, time,
  and season, moves across the map, and remains under GM control.
- Live audio includes several simultaneous ambience layers driven by location,
  weather, and time alongside music.
- All applicable travel inputs affect route and duration and may be overridden
  for a particular journey.
- Hex exploration has Fog of War, weather- and elevation-sensitive view range,
  unknown regions, and manual GM reveal.
- The GM controls complete live travel from the Scene tab through the travel
  state, mini-map, top bar, detail pane, and state pane.

## Seventh Breadth Block: Map Scale, Factions, Weather, And Ambience

1. How do nested Hex-map zoom levels relate? Does a parent-map region or Hex
   explicitly link to a child map, and are terrain, locations, travel position,
   faction influence, or other facts synchronized automatically between those
   levels, or authored independently at each scale?
2. How does faction influence spread across a Hex map: only through direct GM
   editing, automatically as campaign time advances, through faction actions,
   or a combination? Besides Encounter chances, what must influence visibly
   affect or expose to the GM?
3. What minimum climate facts must the GM be able to author for a region, and
   what controls are required for weather events: area or path, start time,
   duration, intensity, movement, and manual start, change, or end? Which parts
   may SaltMarcher derive automatically?
4. Are ambience sounds local files managed and categorized like songs? Which
   tags or roles distinguish simultaneous layers, and must the GM be able to
   start, stop, replace, loop, and independently adjust each layer while
   automatic selection continues for the others?
5. To reconcile the two confirmed answers: may the GM override all inputs used
   to calculate a journey while the resulting calculated duration itself
   remains non-editable, or should the GM now also be able to override the final
   duration directly?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Es handelt sich um eine Karte in die tatsächlih
> einfach mit dem mausrad hineingezoomt werden kann. Es gibt eine
> vorausbestimmte Menge an zo-stufen von einem lokal regionalen 3 meilen hex is
> zur Weltkarte.

The zoom levels are not separate linked maps. One continuous Hex map supports a
predetermined set of mouse-wheel zoom levels, ranging from local or regional
three-mile Hexes to a world-map scale. How authored detail appears or aggregates
across those levels remains to be clarified.

> [Owner, wörtlich zu 2] Erstmal wird er wir terrain vom GM gesetzt. Autonome
> fraktions simulation ist ein weit-weit-weit entferntes feature. Ungefähr so
> weit entfernt wie die vtt und spieler-facing funktionen.

Faction influence is initially authored directly by the GM like terrain. An
autonomous faction simulation is parked as a very distant extension, comparable
to VTT and player-facing functionality, and does not constrain the local GM
core.

> [Owner, wörtlich zu 3] Ich weiß es nicht. Hier brauche ich deine Hilfe und
> Recherche. Es muss für den GM simpel und schnell umzusetzen sein. Es sollte
> kein unnötig großer Aufwandt sein eine wetter simulation auf der Karte
> einzurichten.

The exact climate inputs remain open and require source-backed assistance. The
binding user need is that setting up useful map weather remains quick and
simple for the GM and does not require unnecessary meteorological authoring.

> [Owner, wörtlich zu 4] Ja, ambiance funktioniert wie Musik. nein, er muss
> nicht jedes Layer unabhängig starten. Wetter ist ein layer und
> location-basierte ambiance layert sich automatisch. Der GM kann eigene Sounds
> hinzufügen oder automatische entfernen. Außerdem muss das Programm versuchen
> sie bestmöglich zu balancen.

Ambience uses locally managed and categorized audio like music. Weather sound
forms one layer and location-based ambience layers automatically with it. The
GM need not operate every layer independently, but can add a chosen sound or
remove an automatically selected one. SaltMarcher automatically balances the
combined layers as well as possible.

> [Owner, wörtlich zu 5] Der GM kann die entgültige Reisedauer überschreiben
> oder alle faktoren, aus denen sie sich ergibt. Er kann auch beides machen, nur
> dann sind die faktoren irrelevant, weil das ergebnis bereits überschrieben
> wurde.

The GM may override the calculated journey duration, any of its input factors,
or both. A direct duration override is authoritative, so input changes no
longer affect that journey's duration while the override remains in force. This
supersedes the earlier answer that calculated travel duration was initially
non-editable.

### Literal Evidence So Far

- One continuous Hex map supports predetermined zoom levels from local
  three-mile Hexes to world scale.
- Faction influence is GM-authored for the local core; autonomous faction
  simulation is parked as a distant extension.
- Weather setup must be fast and simple and needs a source-backed minimal input
  model rather than assumed meteorological complexity.
- Ambience uses local categorized audio. Weather and location layers combine
  automatically, the GM can add or remove sounds, and SaltMarcher balances the
  mix.
- The GM can override travel inputs, final calculated duration, or both; the
  final-duration override wins.

## Research Evidence For Minimal Climate Authoring

The World Meteorological Organization describes climatological normals as both
a benchmark and an indicator of conditions likely at a location. Its ordinary
climate representation uses monthly means or totals. This supports a seasonal
expected-condition baseline rather than requiring the GM to author daily
weather. Evidence: `/home/aaron/Schreibtisch/projects/references/climate-weather/wmo-climatological-normals.md`
([public source](https://wmo.int/wmo-climatological-normals)).

NOAA explains that local weather results from large atmospheric patterns plus
local geography, latitude, moisture, and solar input. Air masses and fronts
cover large areas and move across the world. This supports coherent moving
weather phenomena with local modifiers rather than unrelated random weather in
each Hex. Evidence: `/home/aaron/Schreibtisch/projects/references/climate-weather/noaa-weather-systems-patterns.md`
([public source](https://www.noaa.gov/education/resource-collections/weather-atmosphere/weather-systems-patterns)).

The product inference from these sources is deliberately simpler than a real
forecasting model:

- a new map may start quickly with one map-wide fallback climate preset
- a world-to-local map supports painted broad climate regions which replace or
  modulate that fallback
- a preset supplies seasonal expected temperature, precipitation or
  storminess, and prevailing weather movement without exposing raw scientific
  parameters
- terrain, elevation, water, time of day, and season provide automatic local
  variation where their facts are available
- a GM-authored weather event needs only a recognizable type, affected area,
  intensity, movement, and time extent; SaltMarcher derives local transitions
  and effects

This is a research-informed proposal for owner confirmation, not yet confirmed
product truth. Pressure fields, humidity curves, or detailed atmospheric
simulation are not justified user inputs unless later evidence requires them.

## Eighth Breadth Block: Minimal Weather Setup, Map Detail, And Knowledge

1. Is the proposed default setup sufficient: choose one map-wide climate preset
   and do nothing else, with optional painted climate regions for exceptions?
   Should the preset expose only understandable seasonal summaries such as
   temperature, wetness or storminess, and prevailing weather movement?
2. Is this sufficient for authored weather events: choose a type such as rain,
   snow, fog, storm, heat, cold, or strong wind; paint its starting area; set
   intensity, movement direction and speed, start time, and duration; then let
   SaltMarcher derive gradual local transitions? May the GM edit, move, pause,
   or end the event at any time?
3. On the one continuous multi-zoom map, does the GM author at whichever zoom
   level is useful while SaltMarcher aggregates or reveals detail at the other
   levels? For example, should a local road or location disappear at world
   scale while regional terrain and faction influence remain summarized?
4. Is Hex-map knowledge separate for each split Party subgroup, so one group
   does not automatically reveal discoveries to another until the GM shares or
   reunites their knowledge? Does a manual GM reveal change durable group
   knowledge or only the passive display presentation?
5. For automatic ambience, does the GM categorize each imported sound by its
   role or context, such as weather, location, time of day, or general
   background? Should a manual addition or removal last until the GM releases
   the override, after which automatic selection and balancing resume?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Wenn eine Karte von weltkarte bis lokaler region
> zoomen kann, dann reicht ein einziges Preset nicht aus, oder es muss mit
> malbaren klima zonen ergänzt oder anders moduliert werden können.

One map-wide climate preset alone is insufficient for a continuous world-to-
local map. The GM must be able to paint climate zones or otherwise modulate the
baseline regionally. A map-wide preset may remain a quick fallback, but regional
climate variation is binding behavior rather than an optional exception.

> [Owner, wörtlich zu 2] Wetterereignisse müssen auch Notzinen enthalten
> können, wie z.b. "nachteil auf vernkampf angriffe" oder Reisezeit, sichtweiter
> etc. beinflussen können. Wenn ein mechanisch relevantes Wetterereigniss
> stattfindet muss der Gm informiert werden. Ich wüsste nicht, wie der GM ein
> ereigniss verschieben können sollte. Pausieren, bearbeiten und beenden können
> sollte er es aber schon.

Weather events may carry free-form GM notes and mechanically relevant effects,
including travel duration, view distance, or a note such as disadvantage on
ranged attacks. SaltMarcher informs the GM when a mechanically relevant weather
event occurs. The GM can pause, edit, or end an event. Direct manual relocation
is not a required interaction; coherent automatic movement remains part of the
weather behavior.

> [Owner, wörtlich zu 3] Ja. Andersherum, wenn ein hex auf der Weltkarte berg
> terrain hat und man hineinzoom sollte das Terrain entsprechend vererbt
> werden. Wird es auf der regionalen Ebene geändert wird das globale hex aus
> dem aggregat neu berechnet.

The GM authors at the useful zoom level while SaltMarcher presents appropriate
detail at other levels. Coarse facts propagate downward: a mountain Hex at
world scale supplies corresponding terrain when zooming in. Fine changes
propagate upward through aggregation: editing regional terrain recalculates the
coarse world Hex from its detailed contents.

> [Owner, wörtlich zu 4] Puh... Einerseits wäre es schon cool, wenn jeder
> Charakter eigenes Karten Wissen hat, andererseits könnte das aber auch
> anstrengend werden, wenn informationen geteilt werden oder charakter A im
> roleplay charakter B eine Wegbeschreibung gibt... Ich schätze wen der GM
> manuell teil der karte revealen und dem charakterwissen hinzufügen kann ist
> charakter-spezifisches wissen aber cooler als generelles roster wissen. Die
> Party sieht ja sowieso das aggregat aller charaktere.

Map knowledge belongs to individual characters rather than to the Roster or
Party as a single store. The GM can manually reveal map regions or content and
add that knowledge to selected characters. The Party-facing view aggregates its
characters' knowledge. The exact sharing workflow and the relationship to
focused split Scenes still need confirmation.

> [Owner, wörtlich zu 5] Ambiance wird nach der Art der umgebung kategorisiert.
> Z.b. "Stadt" "Wald" "Hafen" "Menschenmenge" etc. Orte können entsprechend
> getaggt werden (oder erhalten das per terrain)

Ambience sounds are categorized by environment types such as city, forest,
harbour, or crowd. Places carry matching tags explicitly or derive them from
terrain. The duration of manual ambience additions or removals remains open.

### Literal Evidence So Far

- World-scale weather setup requires regionally paintable or otherwise
  modulated climate zones; one undifferentiated map preset is insufficient.
- Weather events carry notes and mechanical effects. The GM is notified of
  mechanically relevant weather and may pause, edit, or end an event.
- Multi-scale authored truth propagates both ways: coarse terrain supplies
  finer defaults, while detailed edits recalculate coarse aggregates.
- Map knowledge belongs to individual characters. Party presentation is an
  aggregate, and the GM may add revealed knowledge to selected characters.
- Ambience and places use environment tags which may be explicit or
  terrain-derived.

## Ninth Breadth Block: Weather Effects, Knowledge Sharing, And Overrides

1. Is this climate setup sufficient: every map has a fallback climate preset,
   while the GM may paint climate zones that replace or modify that baseline?
   May zones overlap and blend, or should every map position resolve to exactly
   one effective climate zone plus local terrain modifiers?
2. Which weather effects should SaltMarcher apply automatically as structured
   values: view distance, travel duration or cost, perception, temperature,
   ambience, and music? Should combat-facing effects such as ranged-attack
   disadvantage remain prominent GM notes rather than being adjudicated
   automatically?
3. When mechanically relevant weather reaches a Scene, should SaltMarcher only
   notify the GM and update its effects, or must active travel pause at a new
   travel point? Should the GM receive notifications for every affected Scene
   or only the currently focused one?
4. With character-specific map knowledge, does the focused Scene's passive map
   show the union of only the characters currently in that Scene, preserving
   the previously confirmed split-Scene behavior? Must the GM be able to copy
   selected knowledge from one character to chosen others after an in-fiction
   explanation or map exchange?
5. When the GM manually adds or removes an ambience sound, does that override
   remain until explicitly released, like weather and music overrides? When it
   ends, should automatic environment matching and mix balancing resume from
   the Scene's current location, weather, and time?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Ja. Je feinkörniger das System, desto besser, jedoch
> ohne die user experience zu stark zu belasten.

Every map may use a quick fallback climate preset plus regional climate zones
which replace or modulate it. The resulting climate may be as fine-grained as
the product can make useful without burdening the GM. Whether the technical
model blends overlaps or resolves one effective zone is not itself a user
decision; the required outcome is quick broad setup with optional precise local
control.

> [Owner, wörtlich zu 2] Bestimmte Kreaturen könnten bestimmte Wetter oder
> Tageseiten oder so bevorzugen, aber ertmal reichen die vorgeschlagenen
> Punkte. Es sollte allerdings nicht zu schwierig sein, weitere einflüsse
> später hinzuzufügen.

The initial structured weather effects cover view distance, travel duration or
cost, perception, temperature, ambience, and music. Combat-facing consequences
such as disadvantage on ranged attacks may remain prominent GM-facing notes
rather than automatic adjudication. Creature preferences for weather or time
of day are a credible later extension, and adding such influence families must
not require redesigning unrelated weather behavior.

> [Owner, wörtlich zu 3] Eine Pop-up benachrichtigun reicht. Sie sollte
> bleiben, bis das Wetter wieder verschwindet oder der GM sie weg-klickt.

Mechanically relevant weather updates its structured effects and produces a
persistent pop-up associated with the affected Scene or Scenes. Travel need not
pause merely because weather arrived. The notification remains until the
weather no longer applies or the GM dismisses it; how notifications from
several Scenes are grouped is a later interaction-design choice.

> [Owner, wörtlich zu 4] Ja. Nein, das wäre zu kompliziert, ein allgemeines
> "revealen" tool oder so wäre praktischer.

The passive map for the focused Scene shows the union of map knowledge held by
the characters currently in that Scene. SaltMarcher does not require a
character-to-character knowledge-copy workflow. A general GM reveal tool is
the simpler required interaction for adding selected map knowledge to relevant
characters.

> [Owner, wörtlich zu 5] Ja. Ja. Zusatz: Es ist nicht entweder automatisch
> oder manuell, der GM kann der automatischen auswahl dinge hinzufügen oder
> dinge aus ihr entfernen.

Manual ambience changes persist until the GM releases them, after which
automatic matching and balancing resume from the Scene's current place,
weather, and time. Manual control is an additive and subtractive overlay on the
automatic selection: the GM may add sounds to it and suppress sounds from it
without replacing automation as a whole.

### Literal Evidence So Far

- Climate authoring combines a quick fallback with optionally fine-grained
  regional control, bounded by low GM setup and operation cost.
- Initial structured weather effects cover visibility, travel, perception,
  temperature, ambience, and music. Combat rulings remain GM-facing, and new
  influence families must remain easy to add later.
- Mechanically relevant weather creates a persistent notification but does not
  force travel to stop.
- The focused Scene's passive map unions the knowledge of its current
  characters. Knowledge changes use a general GM reveal interaction rather
  than explicit character-to-character copying.
- Manual ambience additions and suppressions coexist with automatic selection
  and persist until released; automation then resumes from current Scene
  context.

## Confirmed Consolidated Interpretation

The owner confirmed this complete interpretation on 2026-07-22. It is the
evidence promoted into the draft Program Capability Requirements without
choosing architecture, storage, simulation algorithms, or UI implementation
beyond explicitly required GM interactions.

1. `Travel` is one live GM workflow for the focused Scene across ordinary
   places, Hex maps, and Dungeons. The GM works from the Scene tab through the
   travel state tab, optional mini-map, top bar, detail pane, and state pane;
   live travel does not require opening a separate workspace.
2. A direct move selects an adjacent destination. A longer journey uses travel
   points and a route within the current map. Cross-map route planning is a
   desirable optional convenience, not a binding core capability.
3. Travel advances position, campaign time, weather, tracks, perception,
   events, and applicable autonomous World behavior. The GM may pause, resume,
   change presentation speed, reroute, end, or step through several travel
   checkpoints with undo and redo. Presentation speed does not alter in-world
   duration.
4. The GM may override any factors used to calculate travel duration, the final
   duration, or both. A final-duration override is authoritative while active.
5. Events, Traps, relevant tracks, and perceived NPCs interrupt travel at a
   committed checkpoint for GM inspection. Perception makes an NPC available
   in the Scene; an Encounter begins only after explicit GM confirmation.
6. Travel undo removes the selected journey segment and everything that
   segment alone introduced, but preserves facts already established by a
   later authoritative Scene. An interruption is itself a travel checkpoint.
7. Full places are Scene boundaries. Subplaces, Dungeon navigation areas, and
   exact cells refine location inside the same Scene. Different full places
   imply different Scenes; moving only part of a group creates or joins another
   Scene, while moving the complete group changes the existing Scene's place.
8. Places form a nested hierarchy on Hex and Dungeon maps. Unmapped places are
   valid administrative Scene locations, but choosing one is not travel and
   advances no time automatically.
9. Weather, music tags, ambience context, and configurable loot, Encounter,
   and faction-appearance factors flow through place hierarchy according to
   their confirmed rules. Factor families may be additive or replacing per
   place, with additive behavior as the default.
10. Split Scenes advance independently. World behavior for an in-world period
    is processed once and reused when an earlier Scene reaches that period. The
    furthest-advanced Scene remains authoritative for shared World facts.
11. The GM normally avoids earlier-time contradictions. If the GM knowingly
    removes or changes something that already has later dependent history,
    SaltMarcher warns, permits the change, marks affected history as
    conflicting, and provides manual resolution whose marker clears only when
    the GM confirms resolution.
12. The solution-independent ideal is that the complete Campaign World
    progresses with confirmed campaign time. Optional Actor Autonomy remains
    GM-enabled and bounded; Party involvement pauses before autonomous danger
    resolution, while permitted non-Party behavior may proceed. Later
    technical work must determine how to meet this outcome at practical scale.
13. A Hex map is one continuous, unbounded authored map with predetermined
    mouse-wheel zoom levels from local three-mile Hexes to world scale. Several
    such maps may exist. Coarse facts provide finer defaults, while detailed
    edits recalculate coarse aggregates.
14. Hex authoring supports terrain, rivers, roads, cliffs, ravines, location
    markers, assets, GM-authored faction influence, import and export, Fog of
    War, unknown regions, visibility affected by weather and elevation, and
    manual reveal. Procedural Hex generation and autonomous faction simulation
    remain distant extensions.
15. Character-specific map knowledge is durable. The Party view is the union
    of the characters in the focused Scene, and a general GM reveal tool adds
    selected knowledge without requiring character-to-character transfer
    bookkeeping.
16. Weather uses a quick fallback climate plus paintable or otherwise
    modulatable regional climate zones. Seasonal baselines and coherent moving
    phenomena produce gradual, geographically sensible weather without
    per-Hex random discontinuities or burdensome meteorological setup.
17. The GM may author weather events with type, affected area, intensity,
    movement, time extent, notes, and mechanical effects, and may pause, edit,
    or end them. Structured effects initially cover visibility, travel,
    perception, temperature, ambience, and music. Other influence families can
    be added without rewriting unrelated behavior.
18. Mechanically relevant weather updates its effects and creates a persistent
    Scene-associated notification until the weather ends or the GM dismisses
    it. It does not by itself force a travel stop. Combat-facing rulings may
    remain prominent notes for GM adjudication.
19. Music and ambience use locally managed, categorized files. Weather and
    environment layers combine automatically and SaltMarcher balances the mix.
    The GM may add sounds to or suppress sounds from the automatic selection;
    those choices persist until released, then automation resumes from current
    Scene context.

Workflow 4 is confirmed. The interview continues with Workflow 5: follow-up,
possessions, progression, World consequences, history, and corrections.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Dungeon Needs Interview](../2026-07-20-dungeon-needs-interview.md)
- [Dungeon Travel Requirements](../../../dungeon/requirements/requirements-dungeon-travel.md)
- [Actor Autonomy Requirements](../../../autonomy/requirements/requirements-actor-autonomy.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
- WMO climatological normals:
  `/home/aaron/Schreibtisch/projects/references/climate-weather/wmo-climatological-normals.md`
  ([public source](https://wmo.int/wmo-climatological-normals))
- NOAA weather systems and patterns:
  `/home/aaron/Schreibtisch/projects/references/climate-weather/noaa-weather-systems-patterns.md`
  ([public source](https://www.noaa.gov/education/resource-collections/weather-atmosphere/weather-systems-patterns))
