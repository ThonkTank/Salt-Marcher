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

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] Gm verteilt items

The GM, not SaltMarcher, chooses every Item recipient. No automatic recipient
selection is required. Whether distribution may target only individual
characters or also shared storage and locations remains to be clarified.

> [Owner, wörtlich zu 2] XP wird immer gleichmäßig aufgeteilt. "Level Up" sind
> einfach "Charakter hat XP Schwelle überschritten" der GM muss da nichts
> bestätigen.

Encounter XP is always divided equally among the applicable characters and is
not individually adjusted. Crossing an XP threshold is itself the level-up
state and requires no GM confirmation. The exact recipient set and handling of
fractions remain to be clarified.

> [Owner, wörtlich zu 3] HP und Tod. Alles andere ist GM sache.

The direct Encounter-completion consequences for characters and NPCs are HP
and death. Conditions, capture, location, consumed resources, possessions, and
notes are ordinary GM-managed state rather than inferred or proposed
completion consequences. Whether death is derived automatically or explicitly
chosen by the GM remains to be clarified.

> [Owner, wörtlich zu 4] Was? Wie? Warum?

The abstract question did not describe a recognizable GM task and establishes
no product behavior. It must be replaced with a concrete table-play scenario
rather than interpreted.

> [Owner, wörtlich zu 5] Ja. Wird sie nicht? Ich wüsste nicht wie.

A later correction immediately updates current Campaign state while history
keeps the original fact plus a linked correction. The owner did not recognize
the proposed downstream-dependency case, so no automatic dependent-state
reversal or conflict behavior is established here. Concrete examples are
needed to determine whether any such case matters.

### Literal Evidence So Far

- The GM distributes Items; SaltMarcher does not choose recipients.
- Encounter XP is always divided equally among its applicable recipients.
- Crossing an XP threshold needs no separate GM confirmation.
- Encounter completion directly carries HP and death; other consequences remain
  ordinary GM work.
- Corrections update current truth immediately and append linked history.
- No behavior has yet been established for narrative World consequences or for
  corrections which might affect later derived state.

## Second Breadth Block: Concrete Recipients And Corrections

1. Wohin genau darf der GM ein gefundenes Item verteilen: nur an einzelne
   Charaktere, auch in ein gemeinsames Party-Inventar, oder zurück an einen
   Treasure beziehungsweise Ort? Kann er einen Treasure teilweise verteilen
   und den Rest dort lassen?
2. Wer erhält den gleichmäßigen XP-Anteil: nur PCs, die am Encounter
   teilgenommen haben, alle Charaktere der betroffenen Scene oder die gesamte
   aktuelle Party einschließlich Charakteren in anderen Scenes? Wie werden
   nicht glatt teilbare XP behandelt?
3. Soll SaltMarcher HP aus dem laufenden Encounter beim Abschluss einfach
   übernehmen und der GM markiert Tod ausdrücklich, oder darf das Programm Tod
   aus den verfolgten Kampfregeln selbst ableiten?
4. Konkretes Beispiel zur vorigen Frage 4: Nach dem Sieg über Banditen möchte
   der GM die Quest `Banditenlager` als abgeschlossen markieren und das Ansehen
   beim Dorf erhöhen. Soll der Encounter-Abschluss dafür direkte Felder oder
   Aktionen anbieten, oder beendet der GM zuerst den Encounter und bearbeitet
   Quest und Dorf danach ganz normal an ihren jeweiligen Stellen?
5. Konkretes Korrekturbeispiel: Der GM korrigiert später die XP nach unten und
   ein Charakter liegt dadurch wieder unter seiner letzten Level-Schwelle.
   Soll sich der abgeleitete Level-Status sofort mitkorrigieren, während die
   ursprüngliche Vergabe und Korrektur in der History bleiben?

### Owner Answers 2026-07-22

> [Owner, wörtlich zu 1] ja.

The GM may distribute part or all of a Treasure among individual characters, a
shared Party inventory, another Treasure, or a place and leave any remainder
undistributed. Item distribution remains entirely GM-chosen.

> [Owner, wörtlich zu 2] Teilnehmende PCs, welche in der initiative order
> waren. GM kann pcs hinzufügen oder entfernen.

Encounter XP is divided equally among participating PCs represented in the
initiative order. Before distribution, the GM may add or remove PCs from that
recipient set; the equal shares are then recalculated. Handling of indivisible
remainders remains open.

> [Owner, wörtlich zu 3] ersteres.

Encounter completion carries forward tracked HP and derives death from the
applicable tracked combat rules. The GM need not mark death separately.

> [Owner, wörtlich zu 4] Seit wann modellieren wir quests in SaltMarcher? Wäre
> mir neu.

This rejects the question's assumed RPG-style Quest workflow. The owner then
clarified the intended, much smaller capability:

> [Owner, ergänzend wörtlich] Quests können erstellt werden, indem Sinne, dass
> sie als reine text ontizen an ORte oder Fraktionen oder NPCs gehangen werden,
> vielleicht mit strukturierten reward feldern. Aber der GM muss nicht wie in
> einem RPG completion bedingungen mit bestimmten NPCs verknüpfen oder so einen
> mist, er kann die quest einfach später manuell resolven. Gleiches gillt auch
> für rumors und andere ähnlich komplexe nicht einfach mechanisierbare Konzepte.

Quests, rumours, and comparable narrative concepts are note-first records
attached to places, factions, or NPCs. They do not model completion conditions,
NPC-linked triggers, or automatic resolution; the GM resolves them manually.
Structured reward fields are still only a possibility to clarify. Encounter
completion does not infer or apply narrative consequences.

> [Owner, wörtlich zu 5] Ja.

If an XP correction moves a character below a threshold, the derived level
state updates immediately. History retains both the original award and its
linked correction.

### Literal Evidence So Far

- A Treasure may be distributed partially or completely among characters,
  shared Party inventory, other Treasures, and places.
- Encounter XP is always shared equally among GM-adjustable participating PCs
  from the initiative order.
- Tracked HP and rule-derived death carry forward at Encounter completion.
- Quests, rumours, and comparable narrative concepts remain lightweight notes
  with manual resolution, not automated RPG workflows.
- Corrected XP immediately corrects derived level state while preserving the
  original award and linked correction in history.

## Third Breadth Block: Inventory, Rewards, And Death Lifecycle

1. Wenn Encounter-XP nicht glatt durch die Empfängerzahl teilbar ist: Werden
   Bruchteile gespeichert, wird abgerundet und ein Rest verworfen, oder darf
   der GM den Rest verteilen?
2. Welche normalen Besitzaktionen braucht der GM nach der Verteilung: Items
   zwischen Charakteren, Party-Inventar, Treasures und Orten verschieben;
   ausrüsten oder ablegen; verbrauchen; sowie Mengenstapel teilen und
   zusammenführen?
3. Welche minimale Zustandsangabe brauchen Quests, Rumours und ähnliche
   Notizen: nur frei editierbarer Text, oder zusätzlich beispielsweise `offen`,
   `resolved` und `verworfen`? Soll das manuelle Resolven einer Quest ihre
   strukturierten Rewards über denselben XP- und Item-Verteilungsdialog
   anbieten?
4. Was geschieht mit einem regelbasiert gestorbenen PC oder NPC: Bleibt er als
   toter Charakter im Roster beziehungsweise am Ort, kann der GM ihn später
   wiederbeleben, und darf Tod niemals den Datensatz automatisch löschen?
5. Gehört Item-Verteilung zur selben atomaren Bestätigung wie Encounter-Ende,
   HP, Tod und XP, oder bleibt das Awarden eines Treasures eine unabhängige
   Aktion, die der GM vor oder nach dem Encounter-Abschluss ausführen kann?

## References

- [Program Needs Interview Series](README.md)
- [Confirmed Session And Scene Preparation](2026-07-22-session-and-scene-preparation.md)
- [Confirmed Running Scene And Live Play](2026-07-22-running-scene-and-live-play.md)
- [Confirmed Spatial Travel And Progression](2026-07-22-spatial-travel-and-progression.md)
- [Program Capability Requirements](../../requirements/requirements-program-capabilities.md)
