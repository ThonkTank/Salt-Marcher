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
- Current Party membership is authoritative. Earlier evidence allowed an
  activated character to remain unassigned, but the current live-workflow answer
  says every active Party character is assigned to exactly one Scene. Which
  Scene receives a newly activated character remains to be reconciled.
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

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] charaktere sind immer einer szene zugeordnet. Eine
> Szene ohne Charaktere verschwindet.

> [Owner, spätere Korrektur zu 1] aktive charaktere in der Party sind immer
> einer Szene zugeordnet. NIcht aktive roster charaktere snd keiner Szene
> zugeordnet, bewahren aber ihre letzte location und anderen zustand.

Every active Party character belongs to exactly one Running Scene. An inactive
Roster character belongs to no Scene but retains the character's last location
and other state. A Scene with no characters disappears. How this applies to the
always-available primary Scene, and which Scene receives a newly activated
character, remain unresolved.

> [Owner, wörtlich zu 2] Nein.

Split Scenes have no names or labels.

> [Owner, wörtlich zu 3] Alles ,was in einer szene sein kann. Inhalte
> "Verschwinden" nicht. Sie sind nichtmehr in der Szene, aber sie bleiben an dem
> Ort.

Anything capable of being in a Scene may be made to travel with the Party or be
pinned to the Scene. On a location change, other location-derived content
leaves the Scene but remains at its previous location; it is never deleted.

> [Owner, wörtlich zu 4] Ja. Alternativ gibt es auch chase masken und, falls
> später nötig, andere. Encounter kann vom GM beendet werden, der Workflow
> existiert bereits und ist richtig so.

A Scene has at most one active Encounter mask. A Chase mask and future mask
types provide alternative focused workflows over the Scene. The GM can end an
Encounter using the already accepted Encounter-completion workflow. Whether
different mask types are mutually exclusive still needs explicit confirmation.

> [Owner, wörtlich zu 5] Ja, monstergruppen werden erstellt und an Orten
> platziert, ist die Party an diesen Orten (oder verschiebt der GM die Gruppe an
> den aktuellen szenen Ort) kann er monster oder Gruppen auswählen und einen
> encounter starten.

Session generation creates monster groups and places them at locations. When
the Party is at such a location, or after the GM moves a group to the current
Scene location, the GM can select individual monsters or whole groups and start
an Encounter mask with them.

### Literal Evidence So Far

- Every active Party character belongs to exactly one Scene. Inactive Roster
  characters belong to none and retain their last location and other state.
- Empty Scenes disappear and split Scenes need no name or label. The special
  case of the primary Scene is still unresolved.
- Any Scene-capable content may travel with the Party or be pinned to a Scene.
  Content left behind remains at its location.
- Encounter, Chase, and possible future masks provide temporary focused
  workflows over Scene state. The GM can end an Encounter; the Scene continues.
- Prepared monster groups become eligible for an Encounter only at the current
  Scene location.

## Third Breadth Block: Assignment, Reunification, And Mask Exclusivity

1. When the GM activates a Roster character into the current Party, does the
   character enter the primary Scene, the currently focused Scene, or a Scene
   the GM chooses during activation?
2. Does `an empty Scene disappears` apply only to split Scenes, so the primary
   Scene remains available even when the current Party is empty? If the primary
   Scene is emptied while another Scene has characters, which one is primary?
3. How does the GM reunite split groups: by moving selected characters into an
   existing Scene? When the source Scene becomes empty, what happens to content
   pinned specifically to that disappearing Scene?
4. When the Party splits, which new Scene receives content currently travelling
   with the Party? Does the GM choose one Scene for each piece of content, and
   can the same concrete content ever appear in both?
5. May a Scene have only one active mask of any type, so starting a Chase or
   another mask requires ending the current Encounter mask first? When a mask
   ends, does the GM return to the same continuously updated Scene with the
   mask's confirmed consequences applied?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Der fokussierten

Activating a Roster character into the current Party assigns that character to
the currently focused Running Scene.

> [Owner, wörtlich zu 2] Wenn eine Szene leer ist, wird sie entfernt. Die
> verbleibende Szene ist dann die primäre. Gibt es keine aktive Party werden alle
> bis auf die primäre szene entfernt.

An empty Scene is removed. When only one populated Scene remains, it becomes the
primary Scene. If there is no active Party, every Scene except the primary Scene
is removed and the empty primary Scene remains available.

> [Owner, wörtlich zu 3] Charaktere könen nicht nur in neue, sondern auch in
> bestehende szenen geschoben werden über das selbe ui element. Verbleibende
> inhalte bleiben einfach an dem Ort.

The same Scene action moves selected characters either into a new Scene or an
existing Scene. When the source Scene becomes empty and is removed, its other
content remains at that Scene's location.

> [Owner, wörtlich zu 4] Der split gruppe, der sie hinzugefügt wurde. es kann
> nur einer gruppe Folgen.

Content travelling with the Party follows the one split group to which the GM
assigned it. The same concrete content cannot follow several groups at once.

> [Owner, wörtlich zu 5] Es kann mehrere masken geben, I guess. Der GM muss
> nicht "zurückkehren," die Szene bleibt unverändet im main panel, die Masken
> bleiben im state panel neben der Szene.

Several masks may coexist beside one Scene. The Scene remains continuously
visible and unchanged as the main panel while its masks remain available in the
adjacent state panel. Ending a mask therefore does not navigate back to the
Scene. Whether actors may participate in several masks and whether several masks
of the same type may coexist remain unanswered.

### Literal Evidence So Far

- Party activation assigns the character to the GM-focused Scene.
- Empty Scenes are removed and a remaining populated Scene becomes primary. If
  the Party is empty, one empty primary Scene remains available.
- The same character-move action creates splits and reunites groups. Content
  from a removed Scene remains at its location.
- Travelling content follows exactly one split group.
- The Scene remains the main live workspace while several focused workflow
  masks can remain beside it in the state panel.

## Fourth Breadth Block: Mask Participation, Lookup, Time, And Weather

1. May several Encounter masks, several Chase masks, and different mask types
   coexist for one Scene? May the same PC, NPC, or monster participate in more
   than one active mask at the same time?
2. If a character moves to another Scene while participating in a mask, is the
   character removed from that mask, does the mask move with the character, or
   must the GM resolve the mask first?
3. During play, what must the GM be able to find or create without leaving the
   Scene: any Campaign object, reusable rules and definitions, local monster
   groups and treasures, or something else? Which immediate actions should a
   search result offer?
4. How does campaign time advance during live play: does the GM enter an amount,
   choose common actions or durations, run a clock, or use a combination? With
   split Scenes, may their local times differ?
5. When Scene time or location changes, does autonomous weather update
   immediately for that Scene? May the GM override the calculated weather, and
   if so, for how long or until what event?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] ja

Several Encounter masks, several Chase masks, and different mask types may
coexist for one Scene. The same PC, NPC, or monster may participate in several
active masks at the same time.

> [Owner, wörtlich zu 2] wird aus der maske entfernt.

Moving a character to another Scene removes that character from every mask the
character participated in; the masks do not move with the character and do not
block the Scene move.

> [Owner, wörtlich zu 3] suchen: alle. erstellen: alles, was in erster linie
> aus notizen besteht: npcs, orte, fraktionen und so. nicht aber komplee
> datenträger wie items, monstrt o.ä.

The GM can search all content without leaving the Scene. The GM can create
lightweight, primarily note-based Campaign content there, including NPCs,
locations, factions, and similar objects. Complete data records such as Items
or monsters are not created through the Scene. The immediate actions offered by
a search result remain unanswered.

> [Owner, wörtlich zu 4] szenen können unabhängig voneinander fortschreiten.
> zeit schreitet voran durch reisen, durch initiative runden in encounter,
> combat, exploretion etc.

Each Running Scene has an independently advancing time. Travel, initiative
rounds, combat, exploration, and other time-consuming live actions advance that
Scene's time. Manual time adjustment and reunification of Scenes with different
times still need clarification.

> [Owner, wörtlich zu 5] wetter chreitet mit zeit fort. der gm kann es wie
> musik übersteuern.

Weather advances with Scene time. The GM may override autonomous weather in the
same manner as automatic music; the scope and release of that override remain
unanswered.

### Literal Evidence So Far

- Multiple masks of the same or different types may coexist, and one actor may
  participate in several. A Scene move removes that actor from every mask.
- Live Scene search covers all content. Scene-local creation is limited to
  lightweight, note-first Campaign content rather than complete Item or monster
  records.
- Split Scenes advance time independently through their actual live actions.
- Autonomous weather follows Scene time and remains manually overridable.

## Fifth Breadth Block: Search Actions, Time Reconciliation, And Presentation

1. What immediate actions should a Scene search result offer: inspect details,
   add the content to the Scene, make it travel with the Party, pin it to the
   Scene, add it to a mask, or something else?
2. Besides action-driven advancement, can the GM add an arbitrary duration or
   set an exact Scene time? Are automatically calculated travel, round, combat,
   and exploration durations editable before they advance time?
3. When split groups reunite while their Scene times differ, does the earlier
   group advance to the later time, does the GM choose a shared time, or may the
   reunited Scene retain some other explicit result?
4. Is weather calculated separately for every Scene from its local time and
   location? Does a manual override remain until the GM releases it, after which
   autonomous weather resumes like music autoplay?
5. What may the passive second-monitor presentation show during live play, and
   does it always follow the focused Scene? Must every displayed map, image,
   handout, combat state, weather state, or other content be explicitly revealed
   by the GM so private notes can never appear automatically?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] zur szene hinzufügen.

A Scene search result offers the immediate action to add that content to the
current Scene.

> [Owner, wörtlich zu 2] zeit kann inkrementell vor oder urückggedreht werden.
> automatisch berechnete reisezeiten können erstmals nicht überschrieben werden,
> das wäre ein low priority qol feature. Encounter und chase runden sind immer 6
> Sekunden. Exploration wird vom Gm gewählt.

The GM can incrementally move Scene time forward or backward. Automatically
calculated travel duration is initially binding; overriding it is only a
low-priority quality-of-life extension. Encounter and Chase rounds always
advance time by six seconds. The GM chooses the duration of exploration.

> [Owner, wörtlich zu 3] Der Gm wählt resolved das manuell.

The GM manually resolves differing Scene times when groups reunite. The exact
effect of that resolution on the resulting time and already completed events
still needs clarification.

> [Owner, wörtlich zu 4] ja. override gillt, bis der Gm ihn abschaltet.

Weather is calculated independently for each Scene from its local time and
location. A manual override remains in force until the GM disables it, after
which autonomous weather resumes.

> [Owner, wörtlich zu 5] Die zweitanzeige zeigt die Karte beim reisen, sie kann
> NPC illustrationen aneigen, wenn der Gm sie highlighted, oder hintergrund art
> für Orte an denen sich die Charaktere befinden. Hintergrund und map werden
> automatisch angezeigt, aber begrenzt auf das was Charaktere tatsächlich sehen
> können (line of sight, licht, verstecktes etc.) illustrationen müssen vom GM
> gehighlighted werden, im Kampf oder während Chases kann der Gm aber automatisch
> das artwork des NPCs/PCs der grade dran ist anzeigen.

During travel, the passive second display shows the map. At a location it shows
background art. Both appear automatically but reveal only what the characters
can actually perceive after line of sight, lighting, hidden-content, and similar
visibility rules. NPC illustrations appear only when the GM highlights them.
During an Encounter or Chase, the GM may enable automatic artwork for the NPC or
PC whose turn is current. Whether the display follows the focused Scene and
whether it exposes any mechanical text remain unanswered.

### Literal Evidence So Far

- Search results can be added directly to the current Scene.
- The GM can increment Scene time forward or backward. Travel duration is
  initially fixed, Encounter and Chase rounds last six seconds, and exploration
  duration is chosen by the GM.
- The GM manually resolves differing Scene times during reunification.
- Weather is local to each Scene and a manual override persists until disabled.
- The second display automatically presents visibility-filtered travel maps and
  location art. Illustrations require a GM highlight, except for optional
  automatic current-turn artwork in Encounters and Chases.

## Sixth Breadth Block: Time Correction And Presentation Safety

1. When the GM moves Scene time backward, does only the Scene clock and derived
   state such as weather change, while completed travel, Encounter outcomes,
   awarded Items, and Campaign history remain untouched?
2. When the GM manually resolves different Scene times during reunification,
   can the GM choose the resulting Scene time freely? Does this resolution avoid
   rewriting either Scene's already completed events and history?
3. Does the second display always follow the currently focused Scene and switch
   immediately when the GM focuses another split Scene?
4. If characters in the focused Scene have different perception, does the map
   show the union of everything at least one of them can currently see, updating
   immediately as position, line of sight, light, or hidden state changes?
5. Can the GM blank, hide, or manually replace the automatic second-display
   content at any time? Besides artwork and maps, may it show mechanical or
   textual information such as names, weather, initiative, or HP, and must
   private GM notes always be excluded?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] History wird entfernt

Moving Scene time backward removes history. The exact history entries and
whether their World consequences are also reversed remain unresolved. This
conflicts with the earlier confirmed requirement that Campaign history is
immutable and corrections only append linked entries.

> [Owner, wörtlich zu 2] Kann vergangene Zeit wählen, wird aber informiert das
> etwas gelöscht werden würde.

When reuniting Scenes, the GM may choose a past resulting time. Before applying
it, SaltMarcher informs the GM that doing so would delete something. What is
deleted and whether the GM explicitly confirms or cancels still need
clarification.

> [Owner, wörtlich zu 3] ja.

The second display follows the currently focused Scene and switches immediately
when the GM focuses another Scene.

> [Owner, wörtlich zu 4] ja.

The second-display map shows the union of everything at least one character in
the focused Scene can currently perceive and updates immediately when position,
line of sight, lighting, or hidden state changes.

> [Owner, wörtlich zu 5] Die Anzeitge enthält nur npc/location artwork und map
> visuals.

The second display contains only NPC or location artwork and map visuals. It
never exposes mechanical or textual state such as names, weather, initiative,
HP, or private GM notes. Whether the GM may blank or manually replace automatic
visuals remains unanswered.

### Literal Evidence So Far

- Rewinding Scene time deletes history, but the deletion boundary and effect on
  World state conflict with the earlier immutable-history requirement and are
  not yet defined.
- Reuniting Scenes at a past time warns the GM that content would be deleted.
- The second display immediately follows the focused Scene.
- Its map uses the union of the focused Scene's character visibility and updates
  with visibility changes.
- The display is visual-only: maps and NPC or location artwork, never mechanics,
  text, or private notes.

## Seventh Breadth Block: Rewind Deletion Boundary And Display Control

1. When a Scene is rewound to time `T`, which history is deleted: every action
   and event recorded by that Scene after `T`, or only time-progression entries?
2. Are the deleted events' current World consequences also reversed—for example
   travel location, Encounter results, XP, NPC death, consumed stock, awarded
   Items, and possession changes—or does only their history disappear?
3. If a deleted Scene event affected another Scene or shared Campaign content,
   does rewind reverse that shared effect too, leave it untouched, or prevent
   the rewind until the GM resolves the conflict?
4. Is rewind an intentional exception to immutable Campaign history, so the
   deleted events vanish even from the audit trail after a warning and explicit
   confirmation? Or should the audit retain the deletion itself as a correction
   while hiding the removed events from ordinary history?
5. Can the GM blank the second display or manually replace its automatic map or
   background visual at any time?

### Owner Correction And Answer 2026-07-22

> [Owner, wörtlich zu 1/2/3/4] Okay, nein, warte, das machen wir nicht.
> Einträge werden nicht gelöscht, es kann ja auch einfach sein, dass wir nun
> dinge verfolgen, die "schon passiert sind" (in spiel-logik) aber wir uns am
> Tisch jetzt erst darauf fokussieren. Wenn wir uns in der Zeit zurück bewegen,
> und dann andere Dinge passieren, tuen wir einfach so als wäre das schon
> passiert gewesen. Das ist alles table-talk, wichtig is, es wird nichts
> gelöscht oder rückgägig gemacht, außer der GM nutz explizit dafür
> bereitgestellte Löschvoräge.

The owner withdraws the preceding deletion model completely. Moving Scene time
backward or choosing a past time while reuniting Scenes never deletes history,
reverses World consequences, or rolls back any other Scene. An event recorded
later at the table may have an earlier in-world time and is treated as having
already happened then. Only a GM-invoked operation explicitly provided for
deletion removes anything. The earlier proposed deletion warning therefore has
no applicable deletion to warn about.

This correction restores consistency with the confirmed immutable Campaign
history: temporal focus may move backward, while recorded facts remain and new
facts may be added at an earlier in-world time.

> [Owner, wörtlich zu 5] ja

The GM can blank the second display or manually replace its automatic map or
background visual at any time.

## Proposed Consolidated Interpretation For Confirmation

### Continuous Scene State And Party Splits

- The primary Scene is always present as mutable runtime state in the Scene tab;
  the GM neither creates nor completes it. It may have zero or one location;
  split Scenes need no name or label.
- Every active Party character belongs to exactly one Scene. Activating a Roster
  character assigns that character to the GM-focused Scene. Inactive Roster
  characters belong to no Scene and retain their last location and other state.
- The GM moves selected characters into a new or existing Scene through the
  same action. Empty Scenes are removed and a remaining populated Scene becomes
  primary. With no active Party, one empty primary Scene remains.
- A location change replaces the Scene's location-derived content. Any
  Scene-capable content may instead be pinned to the Scene or assigned to travel
  with exactly one Party subgroup. Content that leaves or outlives a Scene
  remains at its location and is never implicitly deleted.

### Masks And Prepared Monster Groups

- Persistent preparation creates editable monster groups at locations, not
  Encounters. At the current Scene location, the GM selects individual monsters
  or groups and Scene participants to start an Encounter.
- Encounter, Chase, and possible future masks add focused runtime behavior over
  the continuously visible Scene. The Scene remains in the main panel and mask
  state remains in the adjacent state panel.
- Several masks of the same or different types may coexist, and one PC, NPC, or
  monster may participate in several masks. Moving a character to another Scene
  removes that character from every mask without blocking the move.
- The GM can end an Encounter through the already confirmed completion
  workflow; its confirmed consequences apply while the Scene continues.

### Live Search, Creation, Notes, And Music

- The GM can search all content without leaving the Scene and add a result
  directly to it.
- The Scene can create lightweight, note-first Campaign content such as NPCs,
  locations, and factions. Complete data records such as Items and monsters are
  managed outside Scene-local creation.
- Relevant object notes remain visible and editable in the Scene, while notes
  across every object kind remain searchable.
- The focused Scene drives optional music autoplay. Scene changes update the
  queue, obsolete songs fade out, and the GM's manual player actions take
  precedence.

### Independent Time And Weather

- Every Scene advances its own time through travel, exploration, and mask
  activity. Encounter and Chase rounds last six seconds. Travel duration is
  calculated and initially not overridable; the GM chooses exploration
  duration.
- The GM may increment Scene time forward or backward. When groups with
  different times reunite, the GM manually chooses their temporal resolution.
- Moving temporal focus backward never deletes history or reverses World state.
  Facts entered later with an earlier in-world time are treated as having
  happened then. Only explicit deletion operations remove anything.
- Weather advances independently from each Scene's time, location, terrain, and
  climate data. A GM override remains until the GM disables it, after which
  autonomous weather resumes.

### Passive Second Display

- The second display immediately follows the focused Scene. During travel it
  automatically shows the map; at a location it automatically shows background
  art.
- Map visibility is the union of what at least one character in the focused
  Scene can perceive and updates with position, line of sight, light, hidden
  state, and similar visibility changes.
- NPC artwork appears only when highlighted by the GM. During Encounter or
  Chase masks, the GM may enable automatic artwork for the current actor.
- The display contains only maps and NPC or location artwork. It never exposes
  mechanics, text, or private notes. The GM can blank it or manually replace its
  automatic visual at any time.

## Confirmation Requested

This interpretation is ready for owner confirmation. Only after confirmation
will the complete live-play workflow enter the draft Program Capability
Requirements and the interview move to spatial travel and campaign-time
progression.

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Session And Scene Preparation](2026-07-22-session-and-scene-preparation.md)
- [Confirmed Campaign Foundation](2026-07-22-foundation-and-coverage.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
