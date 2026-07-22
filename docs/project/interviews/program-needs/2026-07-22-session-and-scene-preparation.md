Status: Confirmed Evidence
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

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] ja

A timeline entry may reference zero or one location, never several. The same
location may appear in several timeline entries.

> [Owner, wörtlich zu 2] ersteres.

Session generation produces a timeline containing concrete Encounters and
treasures rather than only a collection for the GM to arrange afterward.

> [Owner, wörtlich zu 3] adventure day, gewünschte Szenen, gewünschte Orte,
> Fraktionen, NPCs, Items etc. Außer adventure day sind alle optional.

The required generation input is the Adventure Day. The GM may additionally
specify desired Scenes, locations, factions, NPCs, Items, and further optional
context.

> [Owner, wörtlich zu 4] ersteres.

The GM controls every generated Encounter and treasure independently: each can
be edited, regenerated, rejected, accepted, and placed without treating the
generated Session as one indivisible plan.

### Literal Evidence So Far

- Each timeline entry may reference no location or exactly one location. A
  location may occur in several entries.
- Generation creates a Session timeline with concrete Encounters and treasures.
- Adventure Day is the only required generation input. Desired Scenes,
  locations, factions, NPCs, Items, and other context are optional inputs.
- Each generated Encounter and treasure has an independent review, editing,
  regeneration, acceptance, rejection, and placement lifecycle.

## Fourth Breadth Block: Generation Semantics

1. What does the required `Adventure Day` input tell SaltMarcher in observable
   terms: a desired total challenge or resource budget, an amount of in-world
   time, a predefined rules concept, or something else?
2. What may the GM provide as `desired Scenes`: only a desired count, brief
   descriptions or goals, already authored timeline entries, or any mixture of
   these?
3. Are optional locations, factions, NPCs, Items, and other context binding
   constraints for generation, or preferences that the result may ignore? May
   generation create new Campaign content when the supplied Campaign content
   is insufficient?
4. When the GM regenerates one generated Encounter or treasure, must all other
   generated results, manual edits, accepted placements, and timeline changes
   remain unchanged?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Aus DMG kann abgeleitet werden, wieviel encounter, xp
> budget und loot pro adventuring day für x charaktere mit y level eingeplant
> werden müssten. Das wird für session generation verwendet um encounter und
> loot zu erstellen.

For the selected planning Party, the Adventure Day derives the expected
Encounter amount, XP budget, and loot from the DMG guidance using character
count and levels. Session generation uses that result to create Encounters and
loot.

> [Owner, wörtlich zu 2] anzahl.

`Desired Scenes` specifies only how many Scenes the generated Session should
suggest.

> [Owner, wörtlich zu 3] Verbindliche Vorgaben. Sie müssen in den
> vogeschlagenene Szenen vorkommen.

Every location, faction, NPC, Item, or other context the GM supplies is a
binding generation constraint and must occur in the suggested Scenes. Whether
generation may additionally invent new Campaign content remains unanswered.

> [Owner, wörtlich zu 4] ja.

Regenerating one Encounter or treasure leaves every other generated result,
manual edit, accepted placement, and timeline change untouched.

### Literal Evidence So Far

- Adventure Day generation derives Encounter amount, XP budget, and loot from
  DMG guidance for the planning Party's character count and levels.
- The optional desired-Scenes input is a count, not authored Scene content.
- Every optional Campaign object supplied to generation is mandatory content
  for the suggested Scenes, not an ignorable preference.
- Individual regeneration is isolated from all other generated and manually
  changed preparation.

## Fifth Breadth Block: Additional Content, Weather, Music, And Notes

1. May generation use additional existing Campaign content or create new NPCs,
   Items, factions, or locations alongside the GM's binding selections? If the
   selections cannot fit the Adventure Day budget, should generation return no
   result, return a visibly warned best effort, or ask the GM to change them?
2. Where does the GM prepare weather: as starting World weather, on individual
   timeline entries, on locations, or in some combination? When its moment
   arrives, does it become active automatically or appear as a suggestion for
   the GM?
3. What should music preparation provide: playable audio inside SaltMarcher,
   references to tracks or playlists, or only written cues? What may music be
   attached to, and does playback ever start automatically?
4. Which prepared objects need free-form GM notes: the Session, timeline
   entries, locations, Encounters, treasures, or all of them? When prepared
   content appears in a Running Scene, should its notes appear there and remain
   editable?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Ja, wenn es nicht passt wird das vor dem generieren
> gesagt und der generieren button gesperrt.

Generation may supplement the GM's binding selections with additional existing
or newly created Campaign content. SaltMarcher validates the binding selections
against the Adventure Day before generation. If they cannot fit, it explains
that before generation and disables the generate action; it does not produce a
partial or best-effort result.

> [Owner, wörtlich zu 2] Garnicht, wetter passiert autonom. Es entsteht
> basierend auf location terrain und ggf. anderer klima daten.

Weather is not Session or Scene preparation. It develops autonomously from the
location's terrain and any other available climate data. Its live behavior will
be clarified in the Running Scene and campaign-time workflows.

> [Owner, wörtlich zu 3] Musik wird autonatisch ausgewählt. Musik wird
> kategorisiert basierend auf: Mood, Intensität, vibe-tags und genre. Mood und
> Intensität entstehen aus szene input (GM hat mehrere Slider wie komödie zu
> tragödie, romanze oder so, das muss später noch getestet werden, wie das am
> besten zu kategorisieren ist, intensität ist ein eigenen Slider) und Orten,
> NPCs, Fraktionen, Monstern etc, welche ebenfalls vibe tags und genres
> zugeordnet sind. Musikauswahl basiert dann also auf Szenen Inhalt, der GM kann
> aber auch über ein player dropdown im topbar selbst musik stoppen,
> überspringen, zurückspringen, auswählen, in die Warteschlange setzen oder
> einen oder mehrere Songs loopen.

SaltMarcher selects music automatically from Scene content. Songs are
categorized by mood, intensity, vibe tags, and genre. Scene input supplies mood
and intensity: the GM controls several mood-axis sliders and a separate
intensity slider. Locations, NPCs, factions, monsters, and other Scene content
also contribute assigned vibe tags and genres. The exact mood axes and best
classification model require later product testing and are not fixed yet.

A player dropdown in the top bar lets the GM override automation by stopping,
skipping, going back, selecting, queueing, or looping one or several songs.

> [Owner, wörtlich zu 4] Alles sollte erstmal potentiell Notizen tragen können,
> für den Fall dass der GM das braucht.

Every authored or generated object may carry free-form GM notes. Whether notes
surface automatically and remain editable in Running Scenes still needs an
explicit answer.

### Literal Evidence So Far

- Binding generation inputs are validated before generation. An impossible
  combination is explained and disables generation.
- Weather has no preparation lifecycle; it develops autonomously from terrain
  and climate data.
- Music selection is automatic and responds to Scene input and categorized
  Scene content, while the GM retains the listed top-bar player controls.
- The concrete mood-axis model is deliberately subject to later usability
  testing rather than fixed by this interview.
- Every object may carry GM notes.

## Sixth Breadth Block: Music, Note, And Treasure Boundaries

1. Where do playable songs come from: a GM-managed local music library,
   external music providers, or both? Can the GM edit every song's mood,
   intensity, vibe-tag, and genre classification?
2. Does automatic selection also start playback automatically? When Scene
   inputs or content change, may SaltMarcher interrupt the current song, or do
   the new criteria affect only the next automatic selection?
3. When the Party is split across several Running Scenes, which Scene controls
   automatic music: the currently focused Scene, a combination of all active
   Scenes, or a GM-selected Scene?
4. When noted content appears in a Running Scene, should its notes be visible
   and editable there automatically? Does the GM also need one searchable view
   across notes on all kinds of objects?
5. What does one prepared treasure contain from the GM's perspective: a bundle
   of currency, valuables, and Items, some other structure, or arbitrary
   content? Can each contained reward be edited independently before and after
   World placement?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Sogs werden lokal gespeichert und beim einpflegen vom
> GM kategorisiert.

Songs are stored locally. When the GM adds a song, the GM assigns its music
categories. Whether those categories remain editable afterward is not yet
explicitly answered.

> [Owner, wörtlich zu 2] Der GM kann autoplay aktivieren oder deaktivieren.
> Unterbrechungen an der Szene ändern die automatsch generierte Wateschlange und
> songs faden langsam aus wenn sie nichtmehr zur aktuellen Situation passen.

The GM can enable or disable autoplay. Scene changes update the automatically
generated queue. A currently playing song that no longer fits the situation
fades out gradually rather than stopping abruptly.

> [Owner, wörtlich zu 3] Die aktuell vom GM fokussierte.

When several Running Scenes exist, the Scene currently focused by the GM alone
drives automatic music selection.

> [Owner, wörtlich zu 4] ja.

Notes for content present in a Running Scene are visible and editable there.
The GM also has a searchable view across notes attached to every kind of
object.

> [Owner, wörtlich zu 5] Treasures können Items enthalten. Items können alles
> von Handelswaren über Münzen bis magic items und equipment sein.

A treasure may contain Items. The Item concept covers trade goods, coins,
magic Items, equipment, and other kinds of possession. Independent editing of
the Items inside a treasure remains unanswered.

### Literal Evidence So Far

- The music library and its audio files are local; the GM categorizes songs
  when adding them.
- Autoplay is optional. Scene changes recalculate its queue and obsolete music
  fades out gradually.
- Only the GM-focused Running Scene drives automatic music when Scenes are
  split.
- Object notes are editable in their Running Scene context and searchable
  across object kinds.
- A treasure is capable of containing Items, and Items encompass currency,
  trade goods, magic Items, equipment, and other possessions.

## Seventh Breadth Block: Manual Overrides And Treasure Editing

1. Can the GM change a song's mood, intensity, vibe tags, and genre after
   adding it to the local library?
2. While autoplay is enabled, do manually selected, queued, or looped songs
   take precedence until the GM's manual selection, queue, or loop ends, after
   which automatic selection resumes?
3. Can the GM add, remove, replace, and edit every Item within a treasure
   independently both before and after placement? Can individual Items be moved
   out of one placed treasure into another treasure or location?
4. Can the GM create an empty current Session and manually build its timeline,
   Encounters, treasures, and World placements without a planning Party,
   Adventure Day, date, name, or any use of generation?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Der Gm kann songs nachträgich onch über die Dtenbasis
> verwalten.

After adding songs, the GM can continue managing their categories through the
local data collection.

> [Owner, wörtlich zu 2] Ja.

Manual selection, queueing, and looping take precedence over autoplay until the
manual choice ends. Automatic selection then resumes while autoplay remains
enabled.

> [Owner, wörtlich zu 3] Ja.

The GM can add, remove, replace, and edit every Item inside a treasure before
and after placement. Individual Items can move from a placed treasure into
another treasure or location.

> [Owner, wörtlich zu 4] Sessions haben, wie gesagt, keine Namen. Session ist
> eine Planungsmaske, welche hilft effizient content vorzubereiten und als
> persistierten Welt-zustand zu erstellen. Aber ja, content kann auch komplett
> manuell aufgebaut werden.

A Session is not a named content object. It is a planning workspace that helps
the GM efficiently prepare content and create it as persistent World state. The
GM can build the same content entirely manually without a planning Party,
Adventure Day, date, name, or generation.

## Confirmed Consolidated Interpretation

### Planning Workspace And Timeline

- `Session` means the planning workspace, not a named or date-bound content
  object. It exposes one current plan that the GM may reuse or overwrite.
- The plan becomes an ordered timeline of expected Scene occurrences. Each
  entry may have notes and zero or one location; one location may occur in
  several entries. The GM may add, remove, reorder, and annotate entries at any
  time.
- Timeline entries are not saved Scene workspaces. A Scene exists only as
  resumable runtime state. Ordinarily one Running Scene exists; splitting the
  Party creates several distinct Running Scenes.
- The GM may prepare every supported content type and World placement manually
  without a planning Party, Adventure Day, name, date, or generation.

### Assisted Generation

- Generation uses an expected planning Party selected from the Roster without
  changing the current table Party. It also requires an Adventure Day, from
  which DMG guidance supplies an Encounter amount, XP budget, and loot budget
  for the Party's character count and levels.
- The desired Scene count and selected locations, factions, NPCs, Items, and
  other Campaign content are optional inputs. Every supplied object is a
  binding constraint and must occur in the suggested Scenes.
- SaltMarcher may supplement those constraints with other existing or newly
  created Campaign content. It validates the constraints before generation. If
  they cannot fit the Adventure Day, it explains why and disables generation.
- A generated result includes the timeline plus concrete Encounters and
  treasures. The GM can independently edit, regenerate, reject, accept, and
  place each generated Encounter or treasure. Regenerating one result preserves
  every other result and all manual edits, placements, and timeline changes.

### Persistent World Content And Treasures

- Accepting an Encounter or treasure placement turns it into persistent World
  state and ends Planner ownership. It remains editable and survives replacing
  the current plan.
- Replacing the plan discards its timeline, timeline notes, and unaccepted
  drafts, but does not change accepted World placements.
- Entering a prepared location exposes its placed Encounters and treasures in
  the Running Scene UI. Nothing starts, resolves, or awards automatically; the
  GM decides what happens.
- A treasure may contain Items, including coins, trade goods, magic Items,
  equipment, and other possessions. Each Item remains independently editable
  before and after placement and may move between treasures and locations.

### Weather, Music, And Notes

- Weather is not prepared in the Session workspace. It develops autonomously
  from location terrain and other climate data; its live behavior belongs to a
  later workflow.
- Songs are stored locally and remain manageable by the GM. The GM categorizes
  them by mood, intensity, vibe tags, and genre when adding them and may change
  that data later.
- Scene sliders provide mood and intensity input; Scene content such as
  locations, NPCs, factions, and monsters contributes vibe tags and genres.
  The exact mood axes and categorization model remain subject to product
  testing.
- With autoplay enabled, the GM-focused Running Scene drives an automatically
  generated queue. Scene changes update the queue, and songs that no longer fit
  fade out gradually. Manual stop, skip, back, selection, queue, and loop
  controls take precedence; automation resumes when the manual choice ends.
- Every authored or generated object may carry free-form GM notes. Relevant
  notes are visible and editable in the Running Scene, and the GM can search
  notes across every kind of object.

## Owner Confirmation

> [Owner, wörtlich] passt

The owner confirmed the complete consolidated interpretation on 2026-07-22. It
is therefore eligible to enter the draft Program Capability Requirements. This
confirmation does not approve any architecture, technology, or delivery plan.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Project Vision](../../vision.md)
- [Goal Interview 2026-07-10](../2026-07-10-goal-interview.md)
