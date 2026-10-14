# Actor Autonomy: bestätigte Zeit und persistente Grundlage

Stand: 14.10.2026. Dieser Fachplan konkretisiert [SMR-09](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-09--actor-autonomy), den [Produktumfang](../../SCOPE.md) und den [Live-/Scenevertrag](smr03-live-scene-contract.md).

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
Auflösung nach einem Neustart. `tests/core/autonomy-time-conflict-ui.test.ts`
prüft am vollständigen DOM die Zeit-/Worldinformationen und beide begründeten
Entscheidungen.

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
2. Die Autonomy-Fachseite anschließend gegen Produktumfang und Roadmap
   rückverlinken und verbleibende Abnahmelücken dort eindeutig zuordnen.
3. Wiederholtes räumliches Wachstum erst anhand einer realen längeren
   Campaignzeit messen; den Erstschrittwert nicht als lineare Prognose verwenden.
