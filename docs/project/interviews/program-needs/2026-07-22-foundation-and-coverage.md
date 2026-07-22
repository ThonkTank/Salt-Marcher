Status: Active Evidence
Owner: Aaron
Last Reviewed: 2026-07-22
Source of Truth: Confirmed scope, method, carried-forward owner answers, and
discovery prompts for the program-wide SaltMarcher needs interview.

# Program Needs Foundation And Coverage 2026-07-22

## Owner Motivation

> [Owner, wörtlich] Ich glaube ein grundlegendes Problem ist, dass bisher alle
> Features des Programms in Isolation geplant und umgesetzt wurden, und diesen
> Fehler wiederholen wir grade. Wir sollten das Bedürfniss Interview erstmal auf
> alle Features erweitern, die das Programm am Ende haben soll. Modularität ist
> trotzdem ein wichtiges feature, damit wir einzelne Aspekte ohne große Probleme
> bearbeiten können, aber für etwas wie grundlegende Architektur und Technologie
> Entscheidungen wäre ein gesammtbild der Ziele wahrscheinlich wichtig.

## Confirmed Analysis Boundary

The owner selected and confirmed:

- `GM-Kernprodukt`: the complete local GM tool is binding; player-operated and
  remote-play extensions remain parked separately
- `Bestätigtes behalten`: confirmed vision and owner answers remain valid;
  feature requirements, architecture, and code serve only as prompts and
  counterexamples
- `Als verfrüht schließen`: architecture PR #547 must not become target truth
- `Erst Breite, dann Tiefe`: establish the complete GM lifecycle and capability
  map before deepening only gaps and architecture-significant interactions
- `Kleine Themenblöcke`: ask three to five closely related concrete questions
  per interview turn
- `Pro Workflow bestätigen`: confirm one compact interpretation after each
  coherent GM workflow and perform one final overall confirmation

## Carried-Forward Confirmed Cross-Workflow Answers

The following owner-confirmed answers were produced after the Dungeon-focused
interview. They remain product evidence but prescribe no root, storage, module,
transaction, or integration technology.

### Encounter Outcome

One explicit overall confirmation applies Encounter result and completion,
calculated Party XP, and selected named-NPC lifecycle or finite-stock
consequences together or applies none of them. The associated Running Scene
continues. Loot persistence is not part of this confirmation.

### Scene And Encounter Reconciliation

A valid Scene change is saved first and remains usable. Failed Encounter
synchronization is visibly pending; stale Encounter context is never presented
as synchronized. Initialization, refresh, or explicit retry resumes the saved
reconciliation.

### Party Membership Reconciliation

Party activation, deactivation, or deletion becomes authoritative immediately.
Activation assigns no Running Scene automatically. After deactivation or
deletion, only Running Scenes that reference that character and their Encounters
reconcile to the accepted Party state. Failure does not roll back Party and does
not change unaffected running contexts.

### Campaign History

The GM needs an immutable chronological journal of meaningful confirmed World
consequences such as time, travel, Encounter completion, XP, membership,
NPC/stock consequences, and GM corrections. Corrections append linked entries.
A whole-campaign historical snapshot, event replay, or arbitrary past restore
is not required.

## Breadth-First Discovery Prompts

The following census prevents omissions. It is not a confirmed feature list and
does not imply separate modules.

### Already Represented In Current Product Documents

- Party and adventuring-day information
- Creatures, Items, Encounter Tables, saved Encounters, World records, and the
  shared Catalog workspace
- Session planning, deterministic session generation, runtime Scenes, Encounter
  building/combat/resolution, and generated rewards
- Dungeon and Hex authoring, travel, shared map presentation, global travel
  context, perception, and optional Actor Autonomy

### Vision And Inventory Gaps Requiring Program-Level Confirmation

- multiple Campaigns and the boundary between reusable reference knowledge and
  Campaign-specific authored facts
- calendar, campaign time, events, weather generation and override
- music library, tags, automatic ambience choice, and manual table control
- loot generation, actual possession or award, finite resources, and later
  correction
- fast rules/reference lookup beyond the current Creature and Item subsets
- campaign notes, rumours, quests, changing relationships, and improvised
  content created during play
- cross-feature history and session follow-up
- local import/export, reference refresh, backup, restore, and failure recovery
- passive second-monitor presentation without player input

## First Breadth Block: Campaign Foundation And Knowledge

The next owner-answer block must clarify:

1. what the GM creates or selects when beginning a new Campaign and what minimum
   information must exist before preparation or play can start
2. which information is reusable reference knowledge across Campaigns and which
   information belongs to exactly one Campaign
3. whether and how the GM keeps multiple Campaigns, switches between them, and
   avoids accidental cross-Campaign changes
4. how quickly the GM can create an intentionally incomplete NPC, place, item,
   faction, quest, rumour, or similar fact during play and complete it later

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Ein name reicht. Sesions können auch ohne Party
> vorbereitet, aber nicht generiert werden.

> [Owner, wörtlich zu 2] korrekt

This confirms the proposed split in the question: rules, general Creature data,
and Item definitions are reusable across Campaigns; PCs, NPCs, places,
factions, quests, rumours, possessions, and concrete Item instances belong to
one Campaign.

> [Owner, wörtlich zu 3] Ja, wechsel passiert über ein
> optionen/einstellungen menü

> [Owner, wörtlich zu 4] Ein Name, alles andere ist optional

### Literal Evidence So Far

- A Campaign requires only a name.
- A Session may be authored without a Party. Session generation requires a
  Party.
- SaltMarcher keeps multiple Campaigns and exposes Campaign switching through
  options or settings.
- A spontaneous Campaign object requires only a name; every other property is
  optional and may be completed later.

These are evidence, not yet the confirmed interpretation of the complete
Campaign-foundation workflow.

## Second Breadth Block: Campaign Switching And Immediate Use

The next owner-answer block must clarify:

1. whether Running Scene, Encounter, and travel state in Campaign A remains
   exactly preserved and resumes when the GM returns after switching to
   Campaign B
2. whether switching with running table state happens immediately, requires a
   warning or confirmation, or is unavailable until that state is closed
3. whether refreshing a reusable Creature, Item, or rule definition changes
   Campaign-specific uses automatically or must preserve the version and
   overrides already used in that Campaign
4. whether a name-only NPC, place, item, quest, or rumour created from a Running
   Scene is attached to that Scene immediately or is merely created for later
   selection

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Ja

> [Owner, wörtlich zu 2] Sofort

Together these answers confirm that switching Campaigns immediately preserves
the complete Running Scene, Encounter, and travel state of the previous
Campaign for direct continuation after switching back. No warning, confirmation,
or prerequisite closure is needed.

> [Owner, wörtlich zu 3] Diese Dinge "Verwenden" den Gegenstand nicht, sie
> referenzieren ihn allerhöchstens. Wenn sie aus irgend einem Grund doch auf die
> Inhalte des Gegenstands zugreifen müsssen (z.b. wieviel licht eine Laterne
> während exploration spenden kann) muss dass nicht in bereits vergangenen
> Szenen retroaktiv korrigiert werden, aber in jetzt laufenden und zukünftigen.

This corrects the question's premise: Campaign content references reusable
definitions rather than embedding or consuming copies of them. A changed
definition affects facts read in current and future play. It does not
retroactively rewrite already completed Scenes or their historical account.

> [Owner, wörtlich zu 4] Wenn das scene feature mir die Option anbietet, direkt
> dort Inhalte zu erstellen, sollte das der default sein, weil ich davon ausgehe
> dass ich das für diese aktuelle Szene mache. Der Dialog sollte mir aber die
> Option bieten, das selbst zu entscheiden.

A name-only object created from a Running Scene is therefore attached to that
Scene by default. The creation dialog lets the GM opt out before confirming.

These are evidence, not yet the confirmed interpretation of the complete
Campaign-foundation workflow.

## Third Breadth Block: Party And Campaign-Object Lifecycle

The next owner-answer block must clarify:

1. whether one Campaign has exactly one Party with active and reserve characters
   or may contain several separately selectable Parties
2. whether a Campaign-specific NPC, place, faction, quest, rumour, or concrete
   Item instance can be copied into another Campaign and, if so, whether the copy
   becomes fully independent
3. whether two Campaign objects of the same kind may have the same name
4. what happens when the GM deletes an object that current preparation, a
   Running Scene, or completed history still references

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Hier sollten wir zwischen Roster und Party trennen.
> Roster ist die gesammtheit aller PCs in der Kampagne, ob grade aktiv ode
> rnicht. Party sind jene Charaktere, deren Spieler grade mit dem GM am
> Spieltisch sitzen. Die party kann in mehrere Szenen aufgeteilt werden und
> oswas, was halt im Spiel passieren kann, das Roster ist aber nur zum managen
> da.

This introduces two distinct user concepts. `Roster` is the complete managed
set of Campaign PCs independent of current participation. `Party` is the subset
whose players currently participate at the table. Splitting those characters
across Running Scenes does not split the Roster.

> [Owner, wörtlich zu 2] Ja und ja

A Campaign-specific object may be copied to another Campaign and becomes an
independent object there.

> [Owner, wörtlich zu 3] Ja

Campaign objects of the same kind may share a name.

> [Owner, wörtlich zu 4] es wird aus diesen Dingen entfernt.

This answer confirms removal from current preparation and Running Scene
references. Its literal inclusion of completed history conflicts with the
previously confirmed immutable-history rule, under which corrections append and
past entries are not rewritten. Neither answer is reinterpreted until the owner
resolves that concrete conflict.

## Required Clarification Before Workflow Confirmation

The next owner-answer block must resolve:

1. whether each Campaign has exactly one Roster and at most one current Party
   subset, with Scene groups being subdivisions of that Party rather than
   separate Parties
2. which PCs Session generation uses before the players physically sit at the
   table: the whole Roster or an expected-attendance Party selected by the GM
3. whether deleting an object from completed history means removing only its
   live link while retaining the historical text/fact, or deleting the
   historical entry itself despite the earlier immutable-history answer
4. whether deleting an NPC, Item, or other object that is already used by a
   Running Encounter removes it from that Encounter immediately

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Ja

> [Owner, wörtlich zu 2] Der GM kann eine angenommene Party in der Session aus
> dem Roster auswählen. Das ist nicht die aktive Party, sie dient nur zur
> Planung.

The Session therefore owns a planning-only expected Party selection from the
Roster. It enables generation without changing the current table Party.

> [Owner, wörtlich zu 3] Nein, wenn ich aus irgend einem Grund Hans lösche,
> dann traf ie Party [UNKOWN] ggf. mit einem link zum papierkorb falls Hans noch
> dort liegt.

The completed historical fact remains, resolving the contradiction. Its deleted
object reference is shown as unknown rather than retaining the former live
identity. If the deleted object is still recoverable from a trash surface, the
history may link there.

> [Owner, wörtlich zu 4] Ja, wenn ich das Ding löschen will (warum auch immer
> ich das machen wollen sollte) dann sollte es gelöscht werden.

Explicit deletion also removes the object from a Running Encounter and discards
runtime state that depended on that object.

## Proposed Campaign-Foundation Interpretation

The following compact interpretation awaits explicit owner confirmation:

- A new Campaign requires only a name. SaltMarcher stores several Campaigns;
  the GM switches immediately through options or settings. Every Running Scene,
  Encounter, and travel state in the previous Campaign remains preserved and
  resumes when the GM returns.
- Rules, general Creature data, and Item definitions are reusable references
  across Campaigns. PCs, NPCs, places, factions, quests, rumours, possessions,
  and concrete Item instances belong to one Campaign. A Campaign-specific object
  may be copied to another Campaign as a fully independent object.
- Current and future play reads the current referenced definition. Completed
  Scenes and their historical facts are not retroactively recalculated when a
  reusable definition changes.
- Every Campaign has one `Roster` containing all of its PCs and at most one
  current `Party` containing the PCs whose players currently participate. Scene
  groups are subdivisions of that Party, not separate Parties.
- A Session may be authored without any Party. For generation, the GM selects a
  planning-only expected Party from the Roster; it neither is nor changes the
  current table Party.
- Any Campaign object may begin with only a name, every other property is
  optional, and same-kind objects may share names. Creation from a Running Scene
  attaches the object there by default, while the dialog lets the GM opt out.
- Explicit deletion removes the object from preparation, Running Scenes, and
  Running Encounters, including dependent runtime state. Completed history keeps
  the historical fact but displays the missing identity as `[UNKNOWN]`, with a
  link to the trash when the object remains recoverable there.

None of these bullets enters the program requirements until the owner confirms
the interpretation as one complete workflow.

## Owner Confirmation

> [Owner, wörtlich] passt

The proposed Campaign-foundation interpretation is confirmed in full on
2026-07-22 and may enter the draft program requirements.

## References

- [Program Needs Interview Series](README.md)
- [Project Vision](../../vision.md)
- [Goal Interview 2026-07-10](../2026-07-10-goal-interview.md)
- [Dungeon Needs Interview 2026-07-20](../2026-07-20-dungeon-needs-interview.md)
