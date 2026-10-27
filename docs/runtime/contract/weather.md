# Wetter an Scenezeit und manuellem Override

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 15.10.2026. Gesamtumfang: [SCOPE](../../project/requirements/scope.md),
[SMR-08](../../project/requirements/product-scope-2.md#smr-08--shops-wetter-und-musik)
und [Scenezeit](smr03-live-scene-contract.md). Der gemeinsame Fehler-/Fokusanschluss
zu Musik und Ambience steht im [Audio-Wiederaufnahmeplan](music-recovery.md).
Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L175–179 und L270–287, verlangen
Wetter ohne Sessionvorbereitung, unabhängig aus jeder Scenezeit, Ort, Gelände
und Klima. Ein manueller Override gilt bis zur ausdrücklichen Freigabe; danach
setzt die Automatik fort. Quellenbindung: [Register](../../project/requirements/sources.json),
SHA256 `714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

## Unabhängige Sceneprosa bei beschädigtem Wetter

Die übergeordneten Program Capabilities verlangen, dass ein Fehler einer
unterstützenden Fähigkeit unabhängige Live-/manuelle Änderungen nicht blockiert.
`CampaignStore.executeLive` synchronisierte bisher auch bei reinen Titel-/
Notizänderungen den World-/Wetterstand. Ein beschädigter Override konnte dadurch
bestätigbare Sceneprosa samt Receipt zurückrollen, obwohl weder Ort noch Uhr
oder Wetter geändert wurden.

Vor einem `scene-content`-Command wird der bisherige Sceneort gelesen. Bleibt er
gleich, hat die Änderung keine Worldfolge und benötigt keinen Wetterread oder
Worldwrite. Sceneprosa/Revision/Receipt bleiben ihre bisherigen Besitzer;
Wetterbytes werden weder repariert noch überschrieben. Reconciliation und
Receiptreplay bestätigen dieselbe Sceneänderung ohne erneute Worldwirkung.
Ein unabhängiger SQLite-Reader sieht den gespeicherten Originaltext. Die
Worldanzeige liest weiter ihren eigenen Stand und meldet ihren Fehler statt
fälschlich eine behobene Wetterquelle zu behaupten.

Ortswechsel, Zeitfortschritt, Reise, Restock und Autonomy behalten ihre
bestehenden erforderlichen Folgen und Prüfungen. Das ist keine allgemeine
Freigabe, fehlerhafte abhängige Wirkungen zu überspringen. Die vollständige
Capabilityisolation bei kaputten Orts-/Zeit-/Maskenfolgen bleibt offen; dafür
müssen erforderliche Fakten und wiederaufnehmbare abhängige Projektionen am
konkreten Owner unterschieden werden. Keine neue Catch-all-Recovery, Schema-
oder Formatmigration. `desktop-weather-integrity.test.mjs` prüft falsche
Wetterform und Checksumme neben unveränderter Worldtruth, exakte Texte,
separaten Reader, Receipt und Replay sowie weiterhin atomar abgewiesenen
Zeitfortschritt. Native Fehler-/Save-/Close-/Wiederaufnahmequalifikation bleibt
eine getrennte Abnahme.

## Vorhandener Anschluss und korrigierter Fehler

`world-model.ts.weatherAt` berechnet Wetter aus Mapseed, Gelände/Höhe, Klima,
Kalender und räumlichen Wetterphänomenen. `storage/world.ts.currentWeather`
benutzt ausdrücklich die angefragte Sceneuhr und Position. Manuelles Wetter
liegt in `world_record` unter Campaign-/Scene-ID. Reisevorschauen binden Uhr,
Wetter-/Umgebungsbasis und weitere Revisionen; Annahme und Fortschritt prüfen
sie erneut. `syncSceneWorld` hält sichtbare Wetterhinweise nach dem aktuellen
Scenestand nach; bestätigte Zeitfolgen benutzen den gemeinsamen Storewriter.

Scene-, Positions- und Wetterreader verwenden innerhalb desselben Aufrufs die
bereits validierte Scene. Der Weltreader benötigt damit einen vollständigen
Sceneread statt vier; auch Atlasposition, Reisevorschau und laufende Reisebasis
lesen ihre vorhandene Scene nicht nochmals. Der öffentliche Positionsreader
validiert seine Scene weiterhin selbst. Nach Änderungen wird die neue Basis
neu gelesen; es gibt keinen aufrufübergreifenden Cache oder eine neue Datenform.

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

`tests/runtime/desktop-weather-integrity.test.mjs` prüft echte SQLite-Wege: ungültige
Werte und revisionierte Hüllformen ohne Teilwirkung, erhaltene Original-/Backup-/
Exportbytes, gültiger freier GM-Text über Zeit/Campaignwechsel/Fresh/Freigabe,
unabhängige Split-Sceneuhren, veraltetes Setzen/Freigeben bei gleicher Uhr und
Automatik-ABA. Weitere Proben prüfen den GM-Reisefaktor sowie Receiptreplay nach
Fresh ohne Überschreiben eines späteren Overrides und semantisch beschädigte
Bestätigung bei gültiger Prüfsumme.

[desktop-weather-authority.test.mjs (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-weather-authority.test.mjs) benutzt die produktive UI mit
kontrolliertem DOM und echtem Store. Sie prüft offene Eingabe gegen Refresh,
Campaignwechsel vor Write und vor Ack, spätere Eingabe nach eigener Bestätigung,
ältere Reads/Acks, ausdrückliches Verwerfen/Freigeben sowie verlorene Antworten
mit angewendeten und nicht angewendeten Commands. Bestehende Reise-/Welteditor-
Prüfungen ergänzen die betroffenen Wege. Ausführbar mit `node --test
--test-concurrency=1 tests/runtime/desktop-weather-integrity.test.mjs
 tests/runtime/desktop-weather-authority.test.mjs` im Repository; Ressourcenlimits des
Arbeitsplatzes gelten für den Aufruf.

Das sind lokale Teilbelege. Zeitliche Wiedervereinigung, unterschiedliche
Sceneorte, Kalenderänderung, pausierte/wandernde Phänomene, vollständige historische
Wetter-/Receiptbasis, Playerperception/Musikübergang, native Bedienung und
Crash/Cancel besitzen weiterhin eigene Fachabnahmen. Der Wetterentwurf und seine
unklare Editorbestätigung liegen derzeit nur im Speicher.

`tools/test-desktop-weather-override.mjs` prüft den vollständigen nativen Ablauf
bei 100 und 200 Prozent: zwei Gruppen an verschiedenen Hexpositionen und Zeiten,
manueller Nebel für eine Gruppe, bestätigte drei Tage, Neustart, Fokuswechsel und
ausdrückliche Freigabe zur Automatik. Die andere Gruppe bleibt unverändert;
Overridebytes überstehen Zeit und Fresh, und genau zwei Wetteränderungen stehen
im Verlauf. Die Probe erfasst Buildprüfsummen, sichtbare Wetterbilder und normale
Prozessenden. Dies ersetzt keine Plattform-, Crash- oder vollständige Wetterabnahme.

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
   Wiedervereinigung und Campaignwechsel/Fresh kombinieren. Fehler erforderlicher
   autoritativer Zeit-/Weltfolgen rollen den betreffenden Command atomar zurück.
   Abgeleitete unterstützende Anzeigen sind davon zu trennen: vor Erweiterung
   der Isolation `syncSceneWorld` in erforderliche Positionsfolge und lesend
   nachholbare Wetterprojektion aufteilen. Vorhandene Scene-/Worldreader und
   Ackverbraucher müssen einen bestätigten Kernstand neben einer ausgefallenen
   Projektion kenntlich machen; Nachholen berechnet nur aus dem bestätigten
   Stand, statt einen neuen Zeitcommand zu erfinden. Gegenprobe: beschädigter
   Override oder Phänomen neben Notiz-, Orts-, Uhr- und Maskenänderung; jede
   notwendige Folge muss entweder bestätigt oder ausdrücklich offen sein.
   Keine allgemeine Fehlerunterdrückung und kein zweites Recoveryframework.
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
