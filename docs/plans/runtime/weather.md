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

## Konfliktschutz und Bestätigung im Wettereditor

`SceneWorld.weatherOverrideRevision` liefert die gespeicherte Overridebasis,
`WeatherAction.expectedOverrideRevision` bindet Setzen/Freigeben daran zusätzlich
zur Uhr. `null` bedeutet, dass noch kein Override-Datensatz existiert. Eine
Freigabe bleibt als revisionierter Datensatz bestehen: Setzen → Freigeben → alte
Automatikeingabe kann damit nicht unbemerkt erneut schreiben. Der Reader prüft
auch positive Rowrevision und Übereinstimmung mit dem Payload. Bestehende gültige
Datensätze bleiben unverändert; neue Commands benötigen eine ausdrückliche Basis.
Die Reisevorschau verwendet weiter den tatsächlichen Wetterwert und GM-Reisefaktor.

`world-ui.ts` hält Owner, Auswahlgeneration und beide Revisionen ab der ersten
Eingabe fest. Ein Refresh ersetzt diese Eingabebasis nicht. Pending blockiert
weitere Wettercommands; spätere Tastatureingaben bleiben erhalten. Nur die eigene
passende Bestätigung schreibt ihre Basis fort. Ältere Reads/Acks können einen
neueren sichtbaren Stand nicht zurücksetzen. Ein Campaign-/Scenewechsel entzieht
dem alten Auftrag seine aktuelle Editorberechtigung. Fremde neuere Revisionen
bleiben Konflikte; „Eigene Eingabe verwerfen“ lädt ausdrücklich einen neuen Stand,
prüft Auswahl und Eingabeversion und setzt erst dann den Entwurf zurück.
Wetterfreigabe erhält eine daneben offene Wettereingabe.

Bei verlorener Antwort hält die bestehende Weltcommand-Recovery zusätzlich die
ursprüngliche Wettereingabeversion und den Owner im Speicher. „Auftrag prüfen“
übernimmt nur die eigene passende Bestätigung, führt den Command nicht nochmals
aus und erhält spätere Eingaben. Nicht übernommene Commands behalten ihre alte
Basis. Die Store-Reconciliation prüft neue Wetterbestätigungen gegen Auftrag,
Scene, Uhr, Overriderevision und gesetzten Wetterwert. Historische Receipts werden
nicht umgeschrieben. Das ersetzt keinen persistenten Wetter-Workingdraft.

## Lokaler Nachweis und Grenzen

`tests/desktop-weather-integrity.test.mjs` prüft echte SQLite-Wege: ungültige
Werte und revisionierte Hüllformen ohne Teilwirkung, erhaltene Original-/Backup-/
Exportbytes, gültiger freier GM-Text über Zeit/Campaignwechsel/Fresh/Freigabe,
unabhängige Split-Sceneuhren, veraltetes Setzen/Freigeben bei gleicher Uhr und
Automatik-ABA. Weitere Proben prüfen den GM-Reisefaktor sowie Receiptreplay nach
Fresh ohne Überschreiben eines späteren Overrides und semantisch beschädigte
Bestätigung bei gültiger Prüfsumme.

`tests/desktop-weather-authority.test.mjs` benutzt die produktive UI mit
kontrolliertem DOM und echtem Store. Sie prüft offene Eingabe gegen Refresh,
Campaignwechsel vor Write und vor Ack, spätere Eingabe nach eigener Bestätigung,
ältere Reads/Acks, ausdrückliches Verwerfen/Freigeben sowie verlorene Antworten
mit angewendeten und nicht angewendeten Commands. Bestehende Reise-/Welteditor-
Prüfungen ergänzen die betroffenen Wege. Ausführbar mit `node --test
--test-concurrency=1 tests/desktop-weather-integrity.test.mjs
 tests/desktop-weather-authority.test.mjs` im Repository; Ressourcenlimits des
Arbeitsplatzes gelten für den Aufruf.

Das sind lokale Teilbelege. Zeitliche Wiedervereinigung, unterschiedliche
Sceneorte, Kalenderänderung, pausierte/wandernde Phänomene, vollständige historische
Wetter-/Receiptbasis, Playerperception/Musikübergang, native Bedienung und
Crash/Cancel besitzen weiterhin eigene Fachabnahmen. Der Wetterentwurf und seine
unklare Editorbestätigung liegen derzeit nur im Speicher.

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
4. `world-ui.ts`, vorhandene Workingdraft-/Weltreceiptports: persistente
   Wettereingabe mit ursprünglicher Campaign-/Scene-/Clock-/Overridebasis und
   unklarem Commandausgang anschließen. Nicht mit der aktuellen Revision
   automatisch neu binden. Gegenprobe: Schreiben bestätigt, Antwort verloren,
   Prozessabbruch/Fresh, neuere fremde Änderung und anschließendes ausdrückliches
   Prüfen/Verwerfen; kein doppelter Command und keine verlorene Rohtexteingabe.
   Native A/B/A, Tastatur/IME/Fokus/Cancel gesondert abnehmen. Phänomeneditor besitzt
   weiterhin seinen eigenen Draft-/Replyumfang; Weatherguards qualifizieren ihn
   nicht automatisch. Danach Query-/Renderkosten am tatsächlichen Größenfall messen.
