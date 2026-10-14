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

Einzel-/Gruppen-Deaktivierung, manuelle Pause und ausdrücklicher Jobabbruch
geben zukünftige exklusive Buchungen an der bestätigten Actorzeit frei. Bereits
ausgeführte Buchungsteile bleiben erhalten; nur Jobabbruch verwirft den
Jobfortschritt. Wiederaufnahme bucht den verbleibenden Zeitraum für Job und Ziel
neu. Ein belegtes Ziel wird dabei nicht gewaltsam übernommen.

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

[Aktivierungs-/Rastprüfungen](../../../tests/desktop-autonomy-disable-time.test.mjs)
belegen übersprungene inaktive Zeit, erhaltene Standard-/Custom-Needs nach Kopie,
Deaktivierung mit gelöster Reservierung und erhaltenem Jobfortschritt sowie
atomare zeitgebundene Rasten: Autonomieablehnung rollt Fortschritt, Scenezeit und
beide Bestätigungen zurück; Replay wirkt genau einmal. Native Wirkung/Recovery
bleiben gesondert abzunehmen. Weitere Fälle prüfen Einzel-/Gruppen-Wiederaufnahme
nach Fresh mit erneuter exklusiver Buchung, Pause/Deaktivierung und Jobabbruch
am Intervallende sowie konkurrierende Jobs mit erhaltener Vergangenheit.
Längere manuelle Pause mit ausstehenden Intervallen, ein beim Resume belegtes
Ziel und Positionsoverride gegen beide Buchungstabellen bleiben zu prüfen.

## Nächste ausführbare Schritte

1. Mehractor-/Mehrowner-Rollback prüfen: eine Ownerwirkung erst nach einer
   vorher abgeschlossenen Wirkung eines anderen Actors scheitern lassen; Logs,
   HP, Featureladung, Reservierungen und Cursor gemeinsam vergleichen.
2. 200 aktivierte Actors unter der dokumentierten Quellbedingung messen.
   Nur belegte Engstellen ändern; keine zusätzliche persistierte Simulation oder
   Hintergrundlaufzeit einführen.
3. Den Ablauf nativ auf Tastaturfokus, lange Begründungen und Abbruch eines
   laufenden Catch-ups prüfen.
