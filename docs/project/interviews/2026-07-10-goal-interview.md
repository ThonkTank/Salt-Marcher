Status: Draft
Owner: Aaron
Last Reviewed: 2026-07-10
Source of Truth: Verbatim German owner answers and confirmed interpretations
for the SaltMarcher vision, roadmap, acceptance criteria, and Definition of
Done interview.

# Goal Interview 2026-07-10

## Scope

Dieses Protokoll sammelt die wörtlichen Antworten des Owners vor jeder
Interpretation. Interpretationen werden separat markiert und erst nach
expliziter Bestätigung in repo-facing Dokumente übernommen.

## Vision

> [Owner, wörtlich] Na gut ,dann hier im chat.
> Die Person ist ein GM für DnD 5e.

> [Owner, wörtlich] Er hat mehrere Optionen,  die er innerhalb von 5 Minuten schaffen könnte:
> Einen NPC, einen Ort, ein Item, eine Fraktion, ein Monster oder etwas ähnliches anlegen.
> Die Charaktere seiner Spieler und einige Monster in ein encounter werfen, um die Reihenfolge und monster HP zu tracken
> Eine Session mit generierten Encountern vorbereiten, die auf das Level seiner Spieler abgestimmt sind. Hätte er bereits NPCs, Orte o.ä. angelegt könnte er sie hier in szenen verlinken.
> Einige heruntergeladene Songs in der Bibliothek einfügen und mithilfe von Tags kategorisieren, sodass das Programm dynamisch musik und ambiance basierend auf aktuellen Szeneninhalten layern kann.
> Einige Session Notizen aufschreiben.
> Sich zufälliges Wetter für seine Session generieren lassen.
> Den Kallender öffnen, um Zeit während einer Reise zu tracken.
> Ein Item, Monster Informationen oder eine andere Regel nachschlagen.
>
> Das wären erstmal alle Sachen, die mir einfallen, welche ein neuer GM inerhalb von 5 Minuten im Programm schaffen könnte. Es gibt noch weitere Sachen, die länger brauchen würden, wie einen Dungeon erstellen oder eine vorbereitete Session mit custom Loot, Notizen und ähnlichem zu füllen.

> [Owner, wörtlich] Eine Session im Session Planner öffnen. Einige Szenen erstellen, ihr Ort, NPCs und Fraktionen zuweisen. Combats und Loot generieren lassen (dynamisch basierend auf den hinzugefügten anderen Entitäten). Ggf. generator output nochmal anpassen.
>
> Wenn ich für meine letzten Sessions hex oder dungeon maps benutzt habe, schaue ich mir vielleicht nochmal an, wo die Party sich grade befinden. Und im Protokoll schaue ich mir an, welche Szenen in der letzten Session passiert sind: Wo sie waren, wen sie getroffen haben, wie evtl. Kämpfe ausgegangen sind oder welche Items sie erhalten haben.

> [Owner, wörtlich] Initiative, HP und anderes combat Zeug tracken, notizen organisieren, Zeit tracken, dynamisch musik aussuchen (oder mich manuell Musik managen lassen), erstellte encounter, Szenen, Orte usw. schnell und unkompliziert bereitstellen, wenn ich mit Maps arbeite, reisen simulieren und tracken wer oder was sich wo befindet. Kalenderevents im Auge behalten. Mithilfe generativer (nicht llm KI) Tools schnell on-the-fly content erzeugen wenn ich in der Klemme stecke.

> [Owner, wörtlich] Das Programm sollte selbst protokollieren, welche Encounter abgelaufen sind, welche NPCs und Orte die Party besucht hat (ich habe sie entweder beim vorbereiten oder während dem Spiel der laufenden Szene hinzugefügt), welche Items die Party bekommen hat etc. Ich notiere mir bei Orten, NPCs, Fraktionen usw. was sich bei ihnen während der Session verändert hat, wenn nötig. Ich update auch die intern getrackten Charakterbögen, sodass Level, passive Werte und andere relevante Informationen aktuell sind.

> [Owner, wörtlich] Nein, SaltMarcher soll ein reines Organisations Tool sein. Alles, was ich traditionell am Tisch machen kann (combat maps, minis, wüfel etc) bleibt am tisch. Alles, was Spieler auch sehen müssen, bleibt am Tisch.

> [Owner, wörtlich] In ferner Zukunft wäre das cool. Aber ich habe dazu keine konkreten Pläne. Erstmal soll es mir beim Leiten helfen.

> [Owner, wörtlich] Was meinst du mit ersetzen?

> [Owner, wörtlich] Der GM hat immer das letzte Wort. Saltmarcher trackt GM-festgelegte Fakten, wie HP oder Orte. Es hilft mir Dinge im Kopf zu halten. Es schlägt ggf. Optionen vor (encounter generator usw.) oder übernimmt Kopfrechnen. Es trifft niemals eigene Entscheidungen.

> [Owner, wörtlich] Es ist in erster Linie für den GM gedacht. Wenn die Spieler Ansicht dazu kommt, vielleicht. Aber der GM braucht keine remote verbindung zu sich selbst.

> [Owner, wörtlich] Saltmarcher soll protokolieren, was passiert ist (encounter outcomes, loot der vergeben wurde, welche NPCs oder Orte in Szenen mit der Party vorgekommen sind) oder die ich geschrieben habe (Ortsbeschreibungen, NPCs, Fraktionen etc.). Es kann Vorschläge machen (generierte encounter, generiertes Loot, automatische Musikauswahl basierend auf von mir gesetzten Tags) aber ob ich sie anehme oder ändere entscheide ich. Es generiert nicht selbstständig NPCs oder sowas ohne das Wissen des GMs. Wie auch? Ich wüsste nichtmal, wie das funktionieren würde geschweige denn warum man es bräuchte.

> [Owner, wörtlich] Wieso ist das ein entweder-oder? Was soll das überhaupt bedeuten? In welcher Situation müsste ich mich dazwischen entscheiden?

> [Owner, wörtlich] Nochmal: Stele die Frage spezifischer. Was ist "Etwas uerwartetes?" Wenn einer meiner Spieler versucht den Lich König zu romancen statt zu töten muss SaltMarcher da garnichts tun. Wenn einer meiner Spieler einen Herzanfall bekommt muss SaltMarcher da auch nichts tun.

> [Owner, wörtlich] Die Monsterliste muss innerhalb von einem Klick erreichbar sein und das Monster muss mit einem weiteren Klick hinzugefügt werden können, ohne den Encounter zu unterbrechen oder Informationen wie aktuelle HP, initiative reihenfolge oder aktuelle turn position zu verlieren.

> [Owner, wörtlich] Wenn ich die NPC beschreibung schon auf habe sollte es nur einen Klick brauchen, um ein textfeld zu öffnen in dem ich die Notiz schreiben kann.

> [Owner, wörtlich] Auch hier ist die Frage wieder zu unspeziefisch. Es muss den output anzeigen und speichern können, aber das sind basics die hoffentlich nicht erwähnt werden müssen für ein informations-management Programm. Also, was genau meinst du sonst?

> [Owner, wörtlich] Monster entfernen oder hinzufügen oder einfach den gesamten Encounter neu generieren.

[Interpretation] Vision-Draft auf Deutsch:

- Nutzer: SaltMarcher ist zuerst fuer einen DnD-5e-GM gedacht, der seine eigene
  Runde vorbereitet, leitet und nachbereitet.
- Jobs:
  - Ein GM kann NPCs, Orte, Items, Fraktionen, Monster und aehnliche
    Kampagnenobjekte schnell anlegen und wiederfinden.
  - Ein GM kann eine Session mit Szenen vorbereiten, Orte, NPCs und Fraktionen
    verlinken und passende Encounter oder Loot-Vorschlaege erzeugen.
  - Ein GM kann am Tisch Initiative, Monster-HP, aktuelle Runde, Notizen, Zeit,
    Kalenderereignisse, Musik und vorbereitete Szenen ohne Unterbrechung
    bedienen.
  - Ein GM kann mit Hex- oder Dungeon-Karten Reisepositionen und Aufenthaltsorte
    der Party nachvollziehen.
  - Ein GM kann nach der Session automatisch protokollierte Ereignisse,
    besuchte Orte, getroffene NPCs, vergebene Items und veraenderte
    Kampagnenfakten nachpflegen.
  - Ein GM kann Regeln, Monsterinformationen, Items oder andere Referenzen
    schnell nachschlagen.
- Non-Goals:
  - SaltMarcher ist kein Wuerfel-Chat.
  - SaltMarcher ersetzt keine physischen Tischmittel wie Battle Maps, Minis
    oder Wuerfel.
  - SaltMarcher ist vorerst keine Spieler-App und keine geteilte Spieleransicht.
  - SaltMarcher ist keine Remote-Spielplattform.
  - SaltMarcher entscheidet keine Regeln und trifft keine eigenen
    Kampagnenentscheidungen; der GM hat immer das letzte Wort.
  - SaltMarcher generiert keine NPCs, Orte oder Kampagneninhalte selbststaendig
    ohne Wissen oder Entscheidung des GMs.
- Quality Bar:
  - Am Tisch darf Bedienung den laufenden Zustand nicht verlieren oder
    unterbrechen.
  - Haeufige Aktionen sollen mit sehr wenigen Klicks erreichbar sein, zum
    Beispiel Monsterliste ein Klick, Monster hinzufuegen ein weiterer Klick.
  - Notizen an geoeffneten NPCs oder Orten sollen sofort erreichbar sein.
  - Generatorausgaben muessen direkt anpassbar sein: Monster entfernen,
    hinzufuegen oder den Encounter neu generieren.

> [Owner, wörtlich] Passt.

## Roadmap-Ideen

> [Owner, wörtlich] Zuerst encounter management (Generieren, bearbeiten, speichern, spielen, resolven, basierend auf Party evaluieren, Balancing optionen anzeigen, Loot vorschlagen, Sessions mit mehreren Encountern planen, Fraktionen und Orte erstellen, welche encounter pools beeinflussen, in Session Szenen hinzufügen, Sessions balancen etc.)
> Danach Szenen management (Szene als aktueller in-game Zustand: Zeit, Wetter, Ort, NPCs, Fraktion etc., vom GM im Spiel steuerbar)
> Danach Flavor für orte, fraktionen, NPCs events, Wetter etc. verwalten, nachschlagen, bearbeiten etc.
> Danach Karten für Dungeons und Hexmaps, mit Reisen und so.

> [Owner, wörtlich] ok

> [Owner, wörtlich] Gut

> [Owner, wörtlich] okay

> [Owner, wörtlich] okay

> [Owner, wörtlich] Musik, wetter generator, wie Orte, fraktionen und sonstiges sich auf Encounte rauswirken könnten, wie Loot generiert wird

> [Owner, wörtlich] ja

> [Owner, wörtlich] ja

> [Owner, wörtlich] ja, auch die anderen ideen behalten wir als ideen

> [Owner, wörtlich] erstmal nicht

> [Owner, wörtlich] Encounter Planung.

> [Owner, wörtlich] Danach kommt Szenen Management um aktuell relevante NPCs, Orte usw. an einem Ort griffbereit zu haben und danach dann Kalender und Wetter Systeme.

[Interpretation] Roadmap-Draft auf Deutsch:

- Now:
  - Encounter-Planung und Encounter-Management (#433)
  - Szenenmanagement als aktueller Spielzustand mit relevanten NPCs, Orten und
    Kontext an einem Ort (#434)
  - Wetter fuer Sessions und Szenen als Teil von Kalender-/Wettersystemen
    (#439)
- Next:
  - Flavor fuer Orte, Fraktionen, NPCs und Events verwalten (#435)
  - Orte, Fraktionen und Kontext beeinflussen Encounter-Pools (#436)
  - Loot-Generierung und GM-Anpassung klaeren (#438)
- Later:
  - Musikbibliothek und szenenbasierte Ambience-Layer (#437)
  - Dungeon- und Hex-Karten mit Reise-Tracking (#432)

> [Owner, wörtlich] Passt so.

## Akzeptanzkriterien

> [Owner, wörtlich] Eine Liste mit allen Monstern, welche ich nach Namen durchsuchen oder nach CR, Typ und anderen DnD-typischen Faktoren filtern kann. Ich sehe eine Anzeige für das Encounter, wo ich die aktuelle Zusammenstellung mit Balancing Auswertung basierend auf meiner Party sehe. Ich sehe, weiviel Loot hier nötig wäre und kann items raussuchen lassen oder selbst raussuchen (von monster liste zu identisch aufgebauter item liste switchen). Ich kann auch das gesammte Encounter random generieren lassen, wobei meine aktuell in der Liste aktiven Filter verwendet werden, um den encounter pool zu begrenzen. Ich kann aussuchen, welchen template das encounter folgen soll (solo monster, boss mit Minions, horde etc.) und wie schwer das Encounter sein soll. Es gibt Optionen, um das Encounter zu benennen und für später zu speichern, oder um es zu starten. Wenn es startet kann ich für Monster und Spieler ihre Initiative eintragen und weiter klicken. Encounter runner funktioniert bereits, das angestrebte verhalten kannst du dort nachsehen. Wenn das Encounter vorbei ist kann ich XP und Loot verteilen. Gespeicherte Enounter kann ich in einer weiteren Liste verwalten und öffnen (ich werde gewarnt, bevor ich ein ungespeichertes Encounter überschreibe).
>
> Monster, Item und Encounter Verwaltung passiert im selben Katalog, in dem ich später auch Orte, NPCs, Fraktionen usw. verwalten kann. Die anzeie für ausgewählte Encounter ist davon unabhängig, sodass ich sie auch neben anderen Features wie z.b. der Szenenübersicht und der Karte verwenden kann.

> [Owner, wörtlich] es soll in der encounter liste erscheinen, obviously

> [Owner, wörtlich] Ich bekomme eine warnung "Encounter speichern, bevor du es schließt?" wo mir ein textfeld angeboten wird, um es zu benennen, sowie eine ja und nein opiton.

[Interpretation] Akzeptanzkriterien fuer #433 Encounter-Planung:

1. Wenn ich die Encounter-Planung oeffne, sehe ich eine Monsterliste, die ich
   nach Namen durchsuchen und nach CR, Typ und anderen DnD-typischen Faktoren
   filtern kann.
2. Wenn ich ein Monster aus der Liste auswaehle, erscheint es im aktuellen
   Encounter.
3. Wenn ich ein Encounter zusammenstelle, sehe ich daneben eine
   Balancing-Auswertung basierend auf meiner Party.
4. Wenn ich Loot fuer das Encounter brauche, sehe ich, wie viel Loot noetig
   waere, und kann Items generieren lassen oder in eine gleich aufgebaute
   Itemliste wechseln und selbst Items auswaehlen.
5. Wenn ich ein Encounter zufaellig generieren lasse, begrenzen die aktuell
   aktiven Listenfilter den Encounter-Pool; ich kann Template und Schwierigkeit
   auswaehlen.
6. Wenn ich ein Encounter speichern oder starten will, kann ich es benennen,
   speichern, starten und danach Initiative fuer Monster und Spieler eintragen.
7. Wenn ein Encounter vorbei ist, kann ich XP und Loot verteilen.
8. Wenn ich ein gespeichertes Encounter oeffne, waehrend das aktuelle Encounter
   ungespeichert ist, fragt SaltMarcher: "Encounter speichern, bevor du es
   schliesst?", bietet ein Textfeld fuer den Namen sowie Ja- und Nein-Optionen.
9. Wenn ich Monster, Items oder Encounter verwalte, passiert das im selben
   Katalog, der spaeter auch Orte, NPCs und Fraktionen aufnehmen kann; die
   Anzeige des ausgewählten Encounters bleibt davon unabhaengig und kann neben
   Szenenuebersicht oder Karte benutzt werden.

> [Owner, wörtlich] das ist extremst komprimiert und vage, aber solange meine originale Ausführung noch irgendwo steht sodass man nachvollziehen kann, was gemeint ist, sollte das okay sein schätze ich

> [Owner, wörtlich] ja

> [Owner, wörtlich] Ich sehe: EIne Übersicht über den Ort, die Zeit, das Wetter, die Party, ggf. unter-locations, NPCs die sich hier aufhalten, aktuelle Ereignisse und Informationen wie rumours, quests usw. Ich sehe auch für diese Szene geplante Encounter.

> [Owner, wörtlich] Im selben Katalog wie für das encounter kann ich statt "zu enconter hinzufügrn" auch "zu szene hinzufügen" wählen.

> [Owner, wörtlich] Es sollte sich nicht ändern ohne dass ich etwas tue?
> Wenn du meinst "du willst, dass es sich ändert, wie macht du das?" Dann gibt es dafür im top bar zwei dropdowns, wie aktuell für party management.

> [Owner, wörtlich] ... Das weiß ich noch nicht. Das Protokoll ist ein Feature, über das ich mir noch nicht so viele gedanken gemacht habe.

[Interpretation] Akzeptanzkriterien fuer #434 Szenenmanagement:

1. Wenn ich die aktuelle Szene oeffne, sehe ich Ort, Zeit, Wetter, Party,
   optionale Unter-Orte, anwesende NPCs, aktuelle Ereignisse, Informationen wie
   Rumours oder Quests und fuer diese Szene geplante Encounter.
2. Wenn ich im gemeinsamen Katalog ein Objekt auswaehle, kann ich neben
   "zu Encounter hinzufuegen" auch "zu Szene hinzufuegen" waehlen.
3. Wenn Zeit oder Wetter in der Szene geaendert werden sollen, aendere ich sie
   bewusst ueber zwei Top-Bar-Dropdowns wie beim heutigen Party-Management.
4. Wenn ich nichts tue, aendert SaltMarcher Zeit oder Wetter der Szene nicht
   selbststaendig.
5. Was beim Abschliessen einer Szene automatisch ins Protokoll kommt, bleibt
   offen und wird nicht als Kriterium fuer dieses Now-Issue gesetzt.

> [Owner, wörtlich] ja

> [Owner, wörtlich] Es gibt nicht wirklich einen "Wettergenerator" den ich öffnen kann. Es gibt die Kurzübersicht im top bar, welche mir das wetter kurz über temperatur, icon und ähnliches anzeigt. Es gibt das Dropdown, welches mir eine detailiertere Ansicht zeigt, sowie ggf. regeleffekte des aktuellen Wetters. Dann gibt es ein Wetter Feature, in dem ich eckdaten festlegen kann, aus denne das Wetter generiert wird (klima der Region, wie stark die jahreszeiten das beeinflussen und sowas). Wetter wird dann dynamisch mit der zeit getrackt. Wenn die Zeit voranschreitet ändert sich auch graduell das Wetter.

> [Owner, wörtlich] Im dropdown soll es Optionen geben, mit denen ich Wind, Temperatur usw. überschreiben kann.

> [Owner, wörtlich] Realistisch? Ich bin mir nicht ganz sicher, was du mit der Frage meinst.

> [Owner, wörtlich] Ah, wetter entsteht historisch basierend auf einem Seed, den Eckdaten und der aktuellen Zeit/Datum etc. Es soll sich natürlich/realistisch im Laufe der Zeit weiterentwickeln.

[Interpretation] Akzeptanzkriterien fuer #439 Wetter:

1. Wenn ich auf die Top-Bar schaue, sehe ich eine kurze Wetteruebersicht mit
   Temperatur, Icon und aehnlichen schnellen Hinweisen.
2. Wenn ich das Wetter-Dropdown oeffne, sehe ich eine detailliertere
   Wetteransicht und gegebenenfalls Regeleffekte des aktuellen Wetters.
3. Wenn ich Wetter-Eckdaten festlege, kann ich Faktoren wie Klima der Region
   und Staerke der Jahreszeiten setzen.
4. Wenn Zeit und Datum voranschreiten, entwickelt SaltMarcher das Wetter aus
   Seed, Eckdaten und aktueller Zeit historisch weiter, statt es bei jedem
   Schritt zufaellig neu zu wuerfeln.
5. Wenn ich als GM das aktuelle Wetter ueberschreiben will, bietet das Dropdown
   Optionen, um Werte wie Wind oder Temperatur manuell zu setzen.

> [Owner, wörtlich] passt

## Definition of Done

> [Owner, wörtlich] Wie zum fick soll der Agent ein video machen? Ich teste selbst.

> [Owner, wörtlich] ja

> [Owner, wörtlich] wenn ich alle funktionen getestet und approved habe

> [Owner, wörtlich] ?

> [Owner, wörtlich] ja

[Interpretation] Definition of Done auf Deutsch:

- Doku-only: gruenes Doku-Gate reicht; Aaron muss nicht selbst klicken.
- Sichtbare Features: abgenommen erst, wenn Aaron alle Funktionen selbst
  getestet und approved hat.
- Aenderungen an bestehender Kampagne oder Datenbank: vor Abnahme braucht
  Aaron ein Backup.
- Grundregel aus der Spezifikation bleibt: Issue mit bestaetigten
  Akzeptanzkriterien, aktive Requirements, Proof-Zuordnung, gruene Gates,
  Owner-Abnahme, danach Roadmap-Eintrag entfernen und Issue schliessen.

> [Owner, wörtlich] ja

## Geparkte Ideen

- Spieler-App oder geteilte Spieleransicht in ferner Zukunft; aktuell keine
  konkreten Plaene, Vision bleibt GM-Unterstuetzung beim Leiten. Issue:
  https://github.com/ThonkTank/Salt-Marcher/issues/440

## Offene Fragen

- Was genau soll SaltMarcher aus einer abgeschlossenen Szene automatisch im
  Protokoll festhalten? Issue:
  https://github.com/ThonkTank/Salt-Marcher/issues/441

> [Owner, wörtlich] Die Eckdaten I guess. Alles, was in der Szene hinzugefügt wurde oder so. Keine Ahnung. Erstmal lieber zuviel Info, als zu wenig.
