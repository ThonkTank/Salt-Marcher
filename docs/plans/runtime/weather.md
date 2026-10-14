# Wetter an Scenezeit und manuellem Override

Stand: 14.10.2026. Gesamtumfang: [SCOPE](../../SCOPE.md),
[SMR-08](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-08--shops-wetter-und-musik)
und [Scenezeit](smr03-live-scene-contract.md).
Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L175–179 und L270–287, verlangen
Wetter ohne Sessionvorbereitung, unabhängig aus jeder Scenezeit, Ort, Gelände
und Klima. Ein manueller Override gilt bis zur ausdrücklichen Freigabe; danach
setzt die Automatik fort. Quellenbindung: [Register](../../scope-sources.json),
SHA256 `714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

## Vorhandener Anschluss und korrigierter Fehler

`world-model.ts.weatherAt` berechnet Wetter aus Mapseed, Gelände/Höhe, Klima,
Kalender und räumlichen Wetterphänomenen. `storage/world.ts.currentWeather`
benutzt ausdrücklich die angefragte Sceneuhr und Position. Manuelles Wetter
liegt in `world_record` unter Campaign-/Scene-ID. Reisevorschauen binden Uhr,
Wetter-/Umgebungsbasis und weitere Revisionen; Annahme und Fortschritt prüfen
sie erneut. `syncSceneWorld` hält sichtbare Wetterhinweise nach dem aktuellen
Scenestand nach; bestätigte Zeitfolgen benutzen den gemeinsamen Storewriter.

Der Overridewriter prüfte nur vier numerische Wirkungswerte. Unbekannte Arten,
negativer oder nichtnumerischer Wind sowie falsch geformte Ambience-/Textfelder
konnten gespeichert werden. Korrekt gehashte beschädigte Overrides passierten
Reader, Backup und Export. `checkedWeather` prüft jetzt denselben Wettervertrag
für Schreibweg und gespeicherte Overrides: bekannte Art, endliche Werte,
gültige Textfelder und eine Liste aus Ambiencetexten. Vorhandene Wirkungsgrenzen
bleiben erhalten. Für Wind gibt es keine erfundene Höchstgeschwindigkeit.
`weatherOverride` prüft auch den gespeicherten Wrapper und den ausdrücklichen
Automatikwert `null`. Die Backupprüfung benutzt denselben Reader. Vor Setzen oder Freigeben prüft
der Writer auch den bisherigen Datensatz, sodass normale Änderungen keine
beschädigten Originalbytes überschreiben.

Die Prüfungen ändern keine gespeicherten Nutzertexte oder gültigen Altwerte.
Es gibt keine Datenmigration. Ein beschädigter Bestand wird nicht still durch
Standardwetter ersetzt und ersetzt auch keine frühere sichere Exportdatei.

## Lokaler Nachweis und Grenzen

`tests/desktop-weather-integrity.test.mjs` reproduzierte sechs Gegenbeispiele
vor der Korrektur. Acht echte SQLite-Storewege prüfen ungültige Eingabe ohne
State-/History-/Receiptwirkung, beschädigte gespeicherte Art einschließlich
abgewiesener normaler Änderung/Freigabe mit erhaltenen
DB-/Backup-/Exportbytes und gültigen Override über bestätigte Zeit,
Campaignwechsel/Fresh und ausdrückliche Freigabe. Die Automatik danach entspricht
`weatherAt` am bestätigten aktuellen Scenezeitpunkt und Ort. Ein Split mit zwei
Actors belegt außerdem voneinander unabhängige Uhren und den Override nur an
der ursprünglichen Scene. Reise-/Welteditor-
Prüfungen ergänzen die betroffenen bestehenden Wege.

Das qualifiziert den Overridevertrag lokal. Zeitliche Wiedervereinigung, unterschiedliche
Sceneorte, Kalenderänderung, pausierte/wandernde Phänomene, vollständige historische
Wetterbasis, Playerperception/Musikübergang, native Bedienung und Crash/Cancel
besitzen weiterhin eigene Fachabnahmen.

## Nächste ausführbare Abschlüsse

1. `world-model.ts`, `world-ui.ts`, `world-contracts.ts`: Einheiten und historische
   Bedeutung von Phänomenstart/-dauer/-bewegung bei individuellen Tageslängen
   ausdrücklich klären. Die UI rechnet Tage mit `calendar.daySeconds`; Bewegung
   teilt derzeit durch 86400000 ms. Vor Änderung gespeicherter Semantik den
   bestehenden Formatvertrag binden. Pause/Resume an zwei Scenes mit früherer
   bzw. späterer Uhr prüfen; kein zukünftiges Phänomen allein durch globale
   Pause rückwirkend in einer früheren Scene erscheinen lassen.
2. `storage/world.ts`: reine Shape-/Wertregeln für gespeicherte Kalender, Maps,
   Phänomene und deren historische Referenzen ergänzen. Aktuelle Änderungen
   benutzen dieselben Regeln; historische Fakten bleiben damalige Werte.
   Abnahme: korrekt gehashte beschädigte Werte vor Lesen/Backup/Import,
   gültige archivierte Quellen und ursprüngliche Paketbytes.
3. `consumeSceneTime`, Scene-/Journeywriter und Wetterhinweise: zwei unabhängige
   Scenes an unterschiedlichen Zeiten/Orten, Override nur an einer Scene,
   Wiedervereinigung und Campaignwechsel/Fresh kombinieren. Ownerfehler nach
   erster Zeitwirkung muss den gesamten betreffenden Command zurückrollen.
   Retry erzeugt keine doppelten Hinweise/History-/Zeitfolgen. Playerperception
   und Music/Ambience folgen dem bestätigten Focus ohne GM-Texte im Playerframe.
4. `world-contracts.ts`, `storage/world.ts`, `world-ui.ts`: ursprüngliche
   Overridebasis zusätzlich zur Scene-Uhr prüfen. Der jetzige Setter bindet nur
   `expectedClockRevision`; eine andere Wetteränderung bei unveränderter Uhr
   wird dadurch noch nicht als Konflikt erkannt. Den Override-Stand im Reader
   liefern und vor Setzen/Freigeben im Writer vergleichen. Danach offene
   Wetter-/Phänomeneingaben, ursprüngliche Revision,
   A/B/A-Antworten und unklarer Commitausgang/Workingdraft prüfen. Native
   Tastatur/IME/Fokus/Cancel und echter Prozessabbruch gesondert abnehmen;
   danach Query-/Renderkosten am tatsächlichen Größenfall messen.
