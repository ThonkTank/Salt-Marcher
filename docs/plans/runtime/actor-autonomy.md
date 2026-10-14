# Actor Autonomy: bestätigte Zeit und persistente Grundlage

Stand: 14.10.2026. Dieser Fachplan konkretisiert [SMR-09](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-09--actor-autonomy), die [Produktziele](../../PRODUCT.md), den [vollständigen Produktumfang](../../SCOPE.md), die [Lieferfolge](../../ROADMAP.md), den [Live-/Scenevertrag](smr03-live-scene-contract.md) und die [festgeschriebene Originalanforderung](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/autonomy/requirements/requirements-actor-autonomy.md).

## Nutzerablauf und Grenze

Der GM aktiviert einzelne NPCs oder Gruppen, konfiguriert Bedürfnisse und
freigegebene Jobs und bestätigt Campaignzeit über eine Scene. Autonomy verarbeitet
diese Zeit in begrenzten Schritten. Auswahl, Ausschlüsse, Bewegung, Wartezeiten,
Unterbrechungen und Wirkungen bleiben geloggt. Partygefahr, eine inzwischen
geänderte Worldposition und ein Stand vor der lokalen Scenezeit pausieren den NPC
für eine GM-Entscheidung.

Autonomy trifft keine Party- oder Erzählentscheidung, läuft nicht anhand der
Wall-clock und erzeugt oder löscht keine Autoreninhalte. Konfliktschaden und
Fallenreset bleiben ausdrücklich freigegebene, begrenzte Owneroperationen.

## Abdeckung und verbleibende Produktlücken

| Originalanforderung | Aktueller Nachweis | Verbleibende Abnahme |
| --- | --- | --- |
| Opt-in für bestehende NPCs/Monster und Gruppen; Identität bleibt erhalten | Einzelaktivierung und Aktivierung aller Mitglieder einer bestehenden vorbereiteten Gruppe verwenden dieselben Actor-IDs. | Eine persistente Autonomy-Gruppenidentität mit gemeinsamem Job/Reiseverhalten sowie konfiguriertem Split und Merge fehlt. |
| Bedürfnisse, Rollen, erreichbare Jobs, Routen sowie exklusive Reservierungen und Zeitbuchungen | Needs und Prioritäten, Rollenfilter, World-/Dungeonpfade, Reservierungen und überlappungsfreie Buchungen liegen im produktiven Store. | Eine längere Campaignmessung muss noch zeigen, wie Intervall-, Buchungs- und Bewegungsdaten wiederholt wachsen. |
| Erklärbare deterministische Auswahl und stabiler Gleichstand | Jeder Jobwechsel loggt Grundpriorität, NPC-Bonus, konkrete Needbeiträge, bis zu sechs zulässige Kandidaten, bis zu sechs Ablehnungen, Restzähler und den Job-ID-Tie-break. Die Oberfläche zeigt diese Fakten aufklappbar. | Die native Tastatur-/Screenreaderprüfung der aufklappbaren Fakten bleibt offen. Die vollständige Kandidatenauswertung wird vertragsgemäß nicht dauerhaft gespeichert. |
| Einfache, vom referenzierten Feature angebotene Interaktion über dessen Owner | Der konkrete Trap-Owner bietet den atomaren, geloggten Resetjob an. | Ein allgemeiner Vertrag für weitere einfache Featureinteraktionen fehlt; er darf erst mit einem echten Featureowner ergänzt werden. |
| Begrenzter Nicht-Party-Konflikt mit geloggten Inputs, Würfen, Folgen und Schutzgrenzen | Angriff, Abwehr, Wurf, HP-Grenze und Schaden werden über den Actor-/HP-Owner atomar angewandt und kompakt geloggt; Partygefahr und Konzentration pausieren vorher. | Position/Flucht, Gefangenschaft, Verletzung/Tod, Ressourcenverbrauch und Besitztransfer sind noch nicht als freigegebene Owneroperationen modelliert. |
| Ausschließlich bestätigte Campaignzeit, atomare Steps, Pause/Cancel/Override und genau einmaliges Catch-up | Scenezeit erzeugt eingefrorene Intervalle; Cursor, Ownerwirkungen, Buchungen, Logs und Receipts committen gemeinsam. Pendingentscheidungen verlangen eine Begründung und überleben Fresh. | Abbruch vor Commit und lange Begründungen müssen noch nativ bedient werden; ein Hardcrashbeleg steht ebenfalls aus. |
| Partygefahr vor Wirkung und passender GM-Kontext | World- und Dungeonwahrnehmung pausieren vor Bewegung, Reset oder Konflikt; die Actor-Karte verlinkt in den Scene-/Dungeonkontext. | Kamerafreiheit und unabhängige Reads während eines längeren Catch-ups sind noch nativ zu qualifizieren. |
| 200 Actors, p95 höchstens zwei Sekunden und sichtbarer Fortschritt binnen 100 ms | Minimal- und räumliche 200-Actor-Baseline liegen lokal unter zwei Sekunden p95; der DOM-Beleg setzt den Fortschritt vor dem ersten Await. | Native Progress-, Cancel- und Kameraabnahme sowie eine längere räumliche Wachstumsmessung bleiben offen. |

## Persistierter Vertrag

`storage/autonomy.ts` führt Actors, Jobs, bestätigte Intervalle, Zeitfronten,
Reservierungen, Job- und Ressourcenbuchungen, Logs und Commandreceipts. Ein
Intervall friert die damaligen Actorregeln, Jobs, Worldpositionen, Routen,
Feature-Revisionen und Dungeon-Snapshotreferenzen ein. Catch-up darf diese Fakten
nicht durch heutige Werte ersetzen.

Die Reader-, Wirkungs- und Backupgrenze prüft deshalb:

- SQL- und Payloadidentität sowie Revision aktueller Jobs und Actors,
- kanonische positive Intervallgrenzen mit bestehendem Sceneowner,
- vollständige historische Actorsteuerung, Needs, Wahrnehmungs-/Spurenregeln,
  World- und Dungeonpositionen,
- historische Jobs, Routen, Featurestände und eindeutige Dungeonreferenzen,
- interne Owner-, Raum-, Geschoss-, Element-, Stil-, Pfad-, Passage- und
  Volumenstruktur jedes `autonomy_dungeon_basis`-Snapshots,
- Zeitfronten, Reservierungs-/Actorstand, überschneidungsfreie exklusive
  Buchungen, Logowner und Receipt-Fingerprint/Fortschritt.

Historische IDs werden nur gegen Daten innerhalb desselben eingefrorenen
Snapshots gebunden. Ein gelöschter oder heute geänderter Raum, Job oder Ort macht
eine damals gültige Zeitbasis nicht rückwirkend ungültig. Referenzen auf den
gespeicherten Dungeon-Snapshot selbst müssen dagegen weiterhin auflösbar sein.

Campaign-Kopien remappen kampagnenlokale Identitäten. Der fachliche Logwert
`intervalId: "manual"` bleibt dabei in SQL und Payload unverändert; Actor- und
Campaignowner werden remappt.

## Begründete Pending-Entscheidung

Ein Zeitkonflikt bleibt als pausierter Actorstand erhalten, bis der GM ihn über
`accept-pending` ausdrücklich klärt. Pause-, Actor- und Gruppenbefehle dürfen
diesen Zustand nicht nebenbei aufheben. Die Oberfläche zeigt den Abstand zwischen
Actor- und Scenezeit aus den persistierten Entscheidungsfakten sowie den aktuellen
World- und gegebenenfalls Dungeonstand. Fortsetzen mit diesem Worldstand und das
Auslassen des Zeitraums verlangen beide eine Begründung; Auflösung und Begründung
werden geloggt und bleiben nach Fresh nachvollziehbar.

## Sichtbare Jobentscheidung

Die deterministische Wahl sortiert zulässige Jobs nach berechneter Priorität und
bei Gleichstand nach stabiler Job-ID. Das Joblog zerlegt die Priorität in
Grundwert, NPC-Bonus, aktivierte Needbeiträge und gegebenenfalls die ausdrückliche
GM-Zuweisung. Rollen-, Reachability-, Reservierungs-, Zeit- und
Zielbedingungen erscheinen als Ablehnungsgründe; Partygefahr bleibt eine eigene
Pendingentscheidung. Pro Entscheidung werden
höchstens sechs zulässige und sechs abgelehnte Jobs gespeichert; Restzähler
machen die Begrenzung sichtbar. Damit bleibt die aktuelle Entscheidung prüfbar,
ohne die vollständige Kandidatenauswertung als dauerhaft wachsende Historie
anzuhängen.

## Lokaler Nachweis und Aussagegrenze

`tests/core/autonomy-persistence-integrity.test.ts` belegt korrekt neu gehashte
Beschädigungen an historischen Jobs, Actorregeln, Positionen, Routen, Features,
Dungeonreferenzen und Dungeon-Snapshots. Die Fälle prüfen Catch-up-Rollback,
unveränderten früheren Backupbestand, Ablehnung eines neuen Backups, Fresh sowie
eine gültige exklusive Ressourcenbuchung. Weitere Fälle prüfen Frontiers,
Reservierungen, beide Buchungstypen, Logs, Receipts und Campaign-Remap.

`tests/core/autonomy-scene-time-boundary.test.ts` belegt, dass automatischer
Catch-up an der bestätigten Uhr der auslösenden Scene endet und ein bereits
späterer Actorstand nicht zurückgerollt wird. Der Test belegt außerdem die
persistente Pause, die Sperre alternativer Aufhebungswege und die begründete
Auflösung nach einem Neustart. Ein zusätzlicher Fall belegt Needbeiträge,
Rollen-Ablehnung und den stabilen Tie-break im begrenzten Joblog.
`tests/core/autonomy-time-conflict-ui.test.ts` prüft am vollständigen DOM die
Zeit-/Worldinformationen, beide begründeten Entscheidungen und die sichtbare
Kandidaten-/Ablehnungszusammenfassung.

`tests/core/autonomy-owner-atomicity.test.ts` lässt Dungeonbewegung,
Fallenreset und begrenzten NPC-Konflikt jeweils erst nach einer Ownerwirkung an
der folgenden Logschreibung scheitern. Der komplette SQLite-Stand bleibt dabei
unverändert und ohne Receipt. Derselbe Command kann anschließend erfolgreich
ausgeführt werden; sein Replay verändert Position, Featureladung, HP, Logs,
Buchungen und Actorcursor nicht erneut. Diese SQLite- und DOM-Nachweise sind
keine native Bedien-, Hardcrash-, Größen- oder vollständige Produktabnahme.

## 200-Actor-Baseline

`npm run bench:autonomy` erzeugt für je 20 unabhängige Läufe zwei validierte
Quellzustände mit 200 aktivierten Actors, 15 Minuten bestätigter Zeit und
höchstens zwölf Catch-up-Schritten je Actor. Die Minimalbaseline verwendet einen
unplatzierten Guard-Job. Die räumliche Baseline verwendet fünf gleichzeitig
erreichbare Guard-Angebote, einen Dungeon-Snapshot und Actors, die höchstens rund
elf Meter vom Jobziel entfernt stehen. Die unabhängigen Prozesse verhindern,
dass die Messung selbst wegen des vorgeschriebenen 512-MiB-Prozessbaumlimits alte
V8-Heaps mehrerer Läufe ansammelt.

Auf dem lokalen Linux-x64-Prüfrechner vom 14.10.2026 lagen die p95-Werte der
Minimalbaseline bei 25,61 ms für Capture/Intervallbildung, 348,31 ms für den
vollständigen Catch-up einschließlich Response-View und 13,37 ms für einen
separaten View. Die räumliche Baseline benötigte 38,65 ms, 1.094,55 ms und
16,90 ms. Die höchsten Worker-RSS-Werte betrugen 112.799.744 beziehungsweise
204.947.456 Bytes.

Die räumliche Gegenprobe deckte zunächst eine interne Vervielfachung auf: Jeder
1,5-m-Routenpunkt publizierte eine eigene Spur und ein eigenes Geräusch. Ein
atomarer Bewegungsabschnitt publiziert nun genau einen Trace und ein Signal; der
Trace enthält weiterhin den vollständigen zurückgelegten Pfad. Dadurch sank der
mediane SQLite-Seitenzuwachs der räumlichen Erstbewegung von 2.359.296 auf
1.171.456 Bytes. Die Minimalbaseline belegt 344.064 Bytes; die historischen
Intervallpayloads belegen 159.708 beziehungsweise 180.207 Bytes. Diese ersten
Seitenzuwächse sind keine Langzeit-Wachstumsraten.

Beide Baselines erfüllen die Zwei-Sekunden-p95-Grenze. Die Oberfläche setzt
vor dem ersten asynchronen Command sofort einen Status im Live-Bereich und
deaktiviert den Startknopf; der DOM-Gegenbeleg hält die Commandantwort offen und
prüft diesen Zwischenzustand. Kamerafreiheit und unabhängige Reads sind damit
noch nicht nativ qualifiziert.

## Nächste ausführbare Schritte

1. Den Ablauf nativ auf Tastaturfokus, Kamerafreiheit, unabhängige Reads, lange
   Begründungen und Abbruch eines
   laufenden Catch-ups prüfen.
2. Als nächsten Domainausbau entweder persistente Gruppenreise mit
   Split-/Merge-Regeln oder genau eine weitere einfache Featureinteraktion über
   deren bestehenden Owner liefern; keine parallele Simulationswahrheit anlegen.
3. Die weiteren Konfliktfolgen erst implementieren, wenn Position, Zustand,
   Ressourcen oder Besitz einen expliziten atomaren Ownerport anbieten.
4. Wiederholtes räumliches Wachstum erst anhand einer realen längeren
   Campaignzeit messen; den Erstschrittwert nicht als lineare Prognose verwenden.
