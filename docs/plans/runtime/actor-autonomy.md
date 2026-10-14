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

Gruppen-Opt-in bindet zusätzlich die aktuelle Revision der vorbereiteten Gruppe
und loggt ihre ID/Revision je Actor. Deaktivierung pausiert die automatische Arbeit
und erhält den bestätigten Jobfortschritt; ausdrücklicher Jobabbruch bleibt eine
eigene Aktion. Gemeinsame Gruppenreise, Split/Merge und weitere Konfliktfolgen
brauchen noch atomare Operationen ihrer jeweiligen Owner.

## Begründete Pending-Entscheidung

Ein Zeitkonflikt bleibt als pausierter Actorstand erhalten, bis der GM ihn über
`accept-pending` ausdrücklich klärt. Pause-, Actor- und Gruppenbefehle dürfen
diesen Zustand nicht nebenbei aufheben. Die Oberfläche zeigt den Abstand zwischen
Actor- und Scenezeit aus den persistierten Entscheidungsfakten sowie den aktuellen
World- und gegebenenfalls Dungeonstand. Fortsetzen mit diesem Worldstand und das
Auslassen des Zeitraums verlangen beide eine Begründung; Auflösung und Begründung
werden geloggt und bleiben nach Fresh nachvollziehbar. Wiederaufnahme endet an
der bestätigten Scenezeit; spätere Intervalle bleiben ausstehend. Ist der Actor
bereits weiter, darf Resume ihn nicht zurückrollen: der GM lässt den veralteten
Zeitraum begründet aus.

## Lokale Belege und verbleibende Grenzen

| Verhalten | Bestehende Prüfungen |
| --- | --- |
| Historische Jobs, Regeln, Positionen, Routen, Features und Dungeonstruktur; unveränderte Fakten und Backupschutz | `tests/core/autonomy-persistence-integrity.test.ts` |
| Unabhängige Sceneuhren, begrenzte Fortsetzung, persistente Pause und begründete Auflösung nach Fresh | `tests/core/autonomy-scene-time-boundary.test.ts`, `tests/core/autonomy-time-conflict-ui.test.ts` |
| Bewegung, Trap-Reset und Konfliktwirkung mit spätem Logfehler; vollständiger Rollback, Retry und Replay | `tests/core/autonomy-owner-atomicity.test.ts` |
| Inaktive Zeit übersprungen, Standard-/Custom-Needs bei Kopie erhalten, Einzel-/Gruppenreservierungen freigegeben und neu gebucht; atomare Rasten | `tests/desktop-autonomy-disable-time.test.mjs` |

Diese SQLite-/kontrollierten DOMbelege schließen weder alle Ownerwirkungen noch
native Bedienung, echten Prozessabbruch, Cancel oder die Gesamtqualifikation.
Historische Fakten bleiben erhalten; fehlende aktuelle Aktivität ist keine
fehlende historische Identität. Defekte Daten werden erklärt, nicht still repariert.

## 200-Actor-Baselines

`npm run bench:autonomy` misst je 20 unabhängige Läufe mit 200 aktivierten Actors,
15 Minuten bestätigter Zeit und höchstens zwölf Catch-up-Schritten je Actor.
Die Minimalbaseline hat einen unplatzierten Guard-Job; die räumliche Baseline
fünf erreichbare Guard-Angebote, einen Dungeon-Snapshot und höchstens etwa elf
Meter Abstand zum Ziel. Der dokumentierte lokale Lauf vom 14.10.2026 ergab p95
Capture/Catch-up samt View/separate View: 25,61/348,31/13,37 ms beziehungsweise
38,65/1.094,55/16,90 ms. Höchster beobachteter Worker-RSS: 112.799.744 bzw.
204.947.456 Bytes. Das qualifiziert diese Quellzustände, keine beliebige Last.

Ein atomarer Bewegungsabschnitt publiziert einen Trace mit vollständigem Pfad
und ein Signal statt einer Publikation je 1,5-m-Routenpunkt. Der dokumentierte
mediane SQLite-Seitenzuwachs der räumlichen Erstbewegung sank dadurch von
2.359.296 auf 1.171.456 Bytes; der Minimalfall belegte 344.064 Bytes. Erstschritte
sind keine Langzeit-Wachstumsrate. Der DOM-Test prüft sofortigen Status und einen
gesperrten Startknopf bei offener Antwort, keine native Reaktionszeit.

## Nächste ausführbare Schritte

1. Mehractor-/Mehrowner-Rollback nach einer bereits abgeschlossenen Wirkung eines
   anderen Actors prüfen; Logs, HP, Featureladung, Buchungen und Cursor gemeinsam
   vergleichen. Historische Configänderung und Aktivierungsgrenzen mit ausstehenden
   Intervallen sowie Fresh prüfen, ohne alte Geschichte neu zu berechnen.
2. Lange manuelle Pause, vorübergehend belegtes Resumeziel und Positionsoverride
   gegen beide Buchungstabellen prüfen. Alte Buchungsteile bleiben erhalten.
3. Nativ Fokus, Rohwerte, A/B/A, Kamerafreiheit, unabhängige Reads, Begründungen,
   Replyverlust und Cancel prüfen. Längeres räumliches Wachstum und Reaktionszeit
   messen; nur belegte Engstellen ändern, keine zweite persistierte Simulation.
