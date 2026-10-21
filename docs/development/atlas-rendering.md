# Atlasdarstellung, Auswahl und Bildausgabe

Entwicklervertrag für die gemeinsame Atlasfläche. Code besitzt Implementierung
und veränderliche Budgets; diese Seite verbindet Zuständigkeiten und Schutzregeln.
Nach dem Codeeinstieg nur den betroffenen Abschnitt lesen; Zahlenbudgets direkt
beim genannten Besitzer nachschlagen. Fachumfang und Speichergrenze bleiben im [Runtimeplan](../../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md).

## Wo ändern und prüfen?

| Aufgabe | Zuständiger Code | Vorhandene Gegenprobe |
| --- | --- | --- |
| Zeichenkommandos, Transformationen, Pfade und Symbolfamilien | [AtlasPaint](../../src/app/atlas-paint.ts), [AtlasCanvasScene](../../src/app/atlas-canvas-scene.ts); historische SVG-Ausgabe: [Serializer](../../src/app/atlas-paint-svg.ts) | [Paint-Verträge](../../tests/desktop-atlas-paint.test.mjs) |
| [Kamera, sichtbarer Frame und Trefferfreigabe](#welcher-frame-darf-eingaben-annehmen), [Bilder und Recovery](#grenzen-und-fehlerwiederaufnahme) | [AtlasCanvas](../../src/app/atlas-canvas.ts): `render`, `drain`, `paint`, `recover` | [Canvasfälle](../../tests/desktop-atlas-canvas.test.mjs), [native Wiederherstellung](../../tools/test-desktop-canvas-recovery.mjs) |
| [Autorenebene, Entwürfe und Wiederverwendung](#was-bleibt-bei-rasterwechsel-und-pan-erhalten) | [CampaignAtlasWorkbench](../../src/app/campaign-atlas-ui.ts): `chooseAt`, Autorenzeichnung und Hintergrundaufbau | [Autorenregression](../../tests/desktop-atlas-author-overlay.test.mjs), [nativer Autorenablauf](../../tools/test-desktop-atlas-author-overlay.mjs) |
| [Genaue Kandidaten](#welcher-frame-darf-eingaben-annehmen) und Landschaftsraster | [AtlasRegionReader](../../src/app/storage/atlas-region.ts): `candidatesAt`; [AtlasLandscapeReader](../../src/app/storage/atlas-landscape-region.ts) | [Bereichsauswahl](../../tests/desktop-atlas-region.test.mjs), [Bereichsworker](../../tests/desktop-atlas-regions.test.mjs), [Zeichenüberhang](../../tests/desktop-landscape-paint-bounds.test.mjs) |
| [GM-Bildausgabe und ihr Lebenszyklus](#gm-ausgabe-und-öffentliche-freigabe) | `exportPNG`/`outputRun` im Workbench, [atlasRegionPaint](../../src/app/atlas-region-export.ts) | [nativer Bereichsexport](../../tools/test-desktop-region-export.mjs), Canvasregressionen |
| [Kippbares Gelände und Dreieckstreffer](#draufsicht-und-geländeprojektion) | [TerrainSpatialUI](../../src/app/terrain-spatial-ui.ts), [Vorschauworker](../../src/app/terrain-spatial-worker.ts), [TerrainSpatialView](../../src/app/terrain-spatial-view.ts) | [Projektionsfälle](../../tests/terrain-tilted-atlas.test.mjs), [Speicherfälle](../../tests/terrain-tilted-atlas-storage.test.mjs), [native Geländeprobe](../../tools/test-desktop-terrain-tilted-atlas.mjs) |

Leisten, Werkzeuge und Navigation: [Atlasoberfläche ändern](../../ARCHITECTURE.md#atlasoberfläche-ändern).
Testvorbereitung und native Sitzungen: [Testanleitung](testing.md).
Die aufgeführten Prüfwege sind keine neue Ausführung oder Produktabnahme.

## Draufsicht und Geländeprojektion

Die gemeinsame Draufsicht zeichnet numerische Kommandos direkt auf Canvas2D.
Kartenobjekte erzeugen weder verbundene SVG-/DOM-Elemente noch einen versteckten
zweiten Kartenhost. Fachfelder und Status bleiben DOM-Controls. `cityPaint` und
`elementPaint` erzeugen passive Geometrie; historische SVG-Schnittstellen behalten
ihren Serializer samt Maskierung am Ausgaberand. Es entsteht kein zweites
Autorenmodell oder Datenformat.

**Atlas kippen** verwendet Three.js/WebGL mit orthografischer Kamera. Der
Vorschauworker leitet Höhennetz und Farbtextur aus Bereichsdaten ab; Eingabe,
Kamerabox, Auswahl, Landpinsel und History bleiben mit dem Atlas verbunden.
Dreieckstreffer werden in Weltmeter zurückgeführt; Überhöhung ändert keine
Autorenhöhe. Main/SQLite bleiben kanonisch. Beim Verlassen werden Worker,
Geometrien und Texturen freigegeben. Aktive Wissensmasken und der vorhandene
Bildexport wechseln zur Draufsicht. Perspektivische Ausgabe und weitere
Geländelieferungen gehören zur [Relief-Roadmap](../plans/maps/terrain-relief.md).

## Welcher Frame darf Eingaben annehmen?

Render, Trefferprüfung und Bildausgabe verwenden dieselben bestätigten
Quellen und Transformationen. Eine Darstellungskontur, Rasterpixel oder ein
DrawPlan erhält keine Schreibautorität. Autorentreffer und Hover verlangen
zusätzlich einen vollständig gezeichneten Frame mit aktueller Kamera und
CSS-Innenfläche. Kameraänderung, Größenwechsel und versteckt vorbereitete
Frames geben keine alten Treffer frei. CSS-Maße, Bitmap-DPI und Weltmaßstab
bleiben getrennt. Hover verschwindet bei Gesten, Framewechsel oder Fehlern.

Ein Quellen-/Geschoss-/Schnitt-/Dachfilterwechsel hält die alte Szene vollständig
sichtbar und für Autorenhits gesperrt, bis die neue Quelle bestätigt ist.
Atlasverlassen widerruft verspätete Antworten. Ein ausstehender Frame ist keine
leere Fläche für linkes Navigationsziehen; ausdrückliches Mittel-/Alt-Navigieren
bleibt möglich. Eine beim Speichern oder Frameaufbau abgewiesene Geste darf beim
späteren Loslassen keine neue Auswahl auslösen.

Die Main-Kandidatenabfrage vereinigt die genaue ID eines getroffenen Glyphen
mit allen geometrischen und Landschaftstreffern, auch außerhalb seines
logischen Ankerradius. Quellenkennung, Geschoss/Dach/Binding, Seiten und
Archivierung bleiben wirksam. Mehrere Treffer verlangen Auswahl; nur ein
vollständiger Einzeltreffer darf direkt öffnen. Detailpayloads folgen danach.
Eine ausgefallene Ebene wird ausdrücklich benannt und verhindert automatische
Auswahl sowie eine falsche Leermeldung. Rechteck-/Ellipsentreffer benutzen
tatsächliche Ausdehnung und Drehung; eine Indexhülle ist nur Kandidatensuche.
Horizontale Wände benutzen ihre Breite, nicht ihre vertikale Höhe als Dicke.

Bei ausgewählten Objekten hält das Layout auf schmaler Fläche die Eigenschaften
neben der Karte und blendet die breite Werkzeugpalette vorübergehend aus.
Die Werkzeuggruppen bleiben erreichbar; ein akzeptierter Werkzeugwechsel bringt
die Palette zurück. Schließen der Eigenschaften oder mehr Fensterbreite stellt
die bevorzugten Breiten wieder her. Diese Platzanpassung ändert weder Auswahl,
Geometrie noch gespeicherte Layoutvorlieben. Die native Zugangswegprobe lässt
beim Ziehen, Undo/Redo und Wiederöffnen die Eigenschaften ausdrücklich offen;
sie prüft zusätzlich den direkten Rückweg zu den Werkzeugen bei 200 Prozent.

## Wann bleibt ein Quellenstand gültig?

Abgewiesene Schreibversuche dürfen einen bestätigten Kartenstand oder eine
laufende Suche nicht veralten lassen. Atlasframes, Atlas-Suchseiten und
Raumverzeichnis verwenden dafür [CommittedSources](../../src/app/storage/committed-sources.ts):
eine langlebige lesende Verbindung je kanonischer Datenbank beziehungsweise
Graphvorschau beobachtet deren `PRAGMA data_version`. Sie hält keine Lesetransaktion
offen. Damit zählen bestätigte Änderungen auch außerhalb der räumlichen Tabellen
und aus anderen Verbindungen; Rollbacks und TEMP-Hilfsdaten zählen nicht.
Die Beobachter werden beim Verwerfen/Übernehmen der Vorschau und beim Schließen
des Stores geschlossen. Dateiformat und Archiv bleiben unverändert.

Das transaktionale Atlasjournal liefert weiterhin gezielte Indexänderungen;
Quellenkennung, Journal und fachliche Revisionen erfüllen verschiedene Aufgaben.
`total_changes()` bleibt nur für den internen Erstraumcache erhalten: Dieser wird
auch innerhalb laufender Schreibtransaktionen benutzt und muss deren noch nicht
bestätigte Änderungen sehen. Er darf keine veröffentlichte Quellenkennung liefern.
Eine Änderung während der Quellen- oder Suchabfrage bricht deren Ergebnis ab,
damit ein alter Lesesnapshot keine neue Quellenkennung erhält.
Echte Änderungen sperren alte Frames und Suchcursor weiterhin; die genaue
Wiederholung eines bereits quittierten Befehls bleibt möglich.

Gegenproben: [Rollback, Suchcursor, Metadaten und Graphvorschau](../../tests/desktop-atlas-regions.test.mjs),
[native Fehlerkorrektur mit Undo/Redo und Neustart](../../tools/test-desktop-atlas-rejected-edit.mjs).

## Was bleibt bei Rasterwechsel und Pan erhalten?

Die Autorenebene liegt genau einmal über dem Detail-/Rasterhintergrund. Offene
Kontur-/Objektzüge, Originalauswahl und Griffe bleiben erreichbar. Gebündelte
Griffe behalten Originalindizes; weiterer Zoom erschließt Details. Raster allein
sperrt keine Autorenwerkzeuge. Aktive Punktwerkzeuge besitzen ihre Eingabe;
Rasterfallback, vorhandene Griffe oder Partymarker übernehmen ihren Zug nicht.
Geschoss, Schnitt und Wissensfilter gelten auch hier; in der Gruppenwissenssicht
werden keine GM-Autorenkonturen darübergelegt. Geschossgrenzen berücksichtigen
freie Zeichnungselemente auch ohne Raumflächen. Fokus passt beide Ausdehnungen
in das tatsächliche Seitenverhältnis ein.

Pan innerhalb geladener Abdeckung verwendet Geometrie und decodierte Bilder
erneut. Nur ausdrücklich unveränderliche Hintergrundteilbäume teilen Path2D
über Szenen hinweg. Der schwache Cache gehört einer Canvasinstanz; Kontextwechsel
oder Zeichenfehler verwerfen ihn. Matrizen, Stil, Trefferhierarchie und Reihenfolge
werden je Veröffentlichung bestimmt. Eine Raumvorschau ersetzt ihren ursprünglichen
Zeichenplatz: Raumfüllung unter Objekten, Referenzbilder unter Landschaft/Wegen.
Entwürfe und Griffe ersetzen keine unveränderten Geschoss-/Eingangsoptionen.

Maßstab, Quellenantwort, Auswahl und Sichtfilter invalidieren betroffene
Hintergründe. Stadtgenerierung, Gebäudeziehen, Dungeon-Reisevorschau und
Wissensmaskierung dürfen nicht vorschnell als unveränderlich behandelt werden.
Eine bestätigte Reisevorschau bleibt bei reinem Kameraread derselben Quelle
erhalten; während Reads oder Fehlern bleibt Reisebeginn gesperrt. Gezeichnet
wird ohne zusätzliche Autorenreads und ohne Traversierung aller Dungeons.

## Grenzen und Fehlerwiederaufnahme

Die aktuellen Pixel-, Kanten-, Skalierungs-, Bildanzahl- und Decodegrenzen stehen
bei `AtlasCanvas.paint`, `render` und `image`/`drain`. Decodierkanten hängen vom
Quelltyp ab; eine pauschale Vorschaugröße oder daraus errechnete Gesamtspeicherzusage
wäre falsch. Eigenes Backingstore-/Bitmapbudget, Bereichstransport-/Cachebudget
und tatsächlicher Electron-/SQLite-/GPU-/Prozessspeicher sind getrennte Größen.
Darstellungsgrenzen ändern oder verwerfen keine Originalmedien/Autorenkonturen.
Detailqualität bei unzureichenden Vorschauen braucht einen gezielten Kachel-/LOD-Vergleich.

Nur der neueste vollständige Frame wird veröffentlicht. Bilddecodierung und
Bereichsreads bleiben begrenzt, mit ersetzbaren Nachfolgern; keine Decoderlawine.
Die sichtbare Fläche wird direkt gezeichnet. Eine nötige Sichtmaske verwendet
einen begrenzten, wiederverwendbaren Puffer mit `destination-out`; alte Bitmaps
werden geschlossen. Pfad-/Szenen-/Bildcaches gehören ihrer Quelle und Instanz.
Kamera und genaue Auswahl teilen die Bereichsqueue; ein neuer Kameraauftrag
verdrängt keine wartende Auswahl. Das aktuelle Laden verfolgt das Zoomziel
gedrosselt und gibt Autorenhits erst bei bestätigtem Maßstab frei.

Ein Zeichenfehler löscht das unvollständige Bild und sperrt Treffer. Canvas2D-
`contextlost` wird **nicht** abgebrochen; `recover`/`contextrestored` fordern den
aktuell bestätigten Frame an. Fehlender oder noch verlorener Kontext bleibt
sichtbar gesperrt, auch vor Ereigniszustellung oder bei Verlust während Paint.
Kamera, Listener und Daten werden nicht neu angelegt. Fehler einer alten Szene
sperren keine gesunde neue Quelle. Das ist vom WebGL-Ausfallweg zu unterscheiden.

Optionale Bildvorlagen erhalten bei fehlenden Bytes einen transformierten Umriss,
bei Decodefehler einen Umriss mit Kreuz. Gesunde Bilder und genaue Treffer bleiben
verfügbar; Retry leert auch den Fehlercache. Gleiche Asset-ID unter neuer Quelle
verlangt neue Vorschaubytes. Fehlende Pflichtbilder für dichte Geometrie erlauben
keinen erfolgreichen Frame. Landschaftsfehler erhalten gesunde Raum-/Stadtgeometrie;
der nächste Sync baut die Landschaft erneut auf. Der Ortsinspektor behält seinen
DOM-Knoten und Schreibvertrag auch beim Umhängen ins Auswahldock.

Landschaftsreads streamen vollständige Payloads in expliziter Schlüsselreihenfolge;
sie sammeln nicht den gesamten Bestand im JS-Heap und bauen keinen unbenötigten
Writer-Index beim Start. Terrain nutzt kanonische Bounds, andere Geometrie ihren
Index. Sampleablehnung bleibt konservativ einschließlich SQLite-Math-Fallback.
Ränder, Löcher, Reihenfolge und lokale Invalidierung erhalten dieselben Pixel.
Lese- und Cachebereiche berücksichtigen Zeichenüberhang von Namen, Markern und
Mindeststrichen über Kachelgrenzen. Namensgrenzen ändern sich mit Orten/Namen,
nicht mit jeder Kameraabfrage.

## GM-Ausgabe und öffentliche Freigabe

`exportPNG` bindet vor dem ersten asynchronen Read Ausschnitt, Geschoss, Schnitt,
Dachfilter, Rasterstufe, Vorlage, Größe und Format. Ein eigener `outputRun` besitzt
Abbruch, Status und Freigabe; eine alte Antwort schließt keinen neuen Lauf ab.
Quellenwechsel, gemischte Revisionen, unvollständige Quellen oder überschrittenes
Bildbudget liefern keine Datei. Ein Abbruch erhält den Vorgängerexport.

Die GM-Ausgabe liest bestätigte Szenenkacheln sequenziell, zeichnet dieselben
numerischen Canvas-Kommandos über eine wiederverwendete Kachelfläche ins Zielbild
und kodiert nur dieses einmal. Keine Sammlung kodierter Zwischenkacheln und kein
SVG-Zwischenbild. PNG/JPEG-Bytes gehen über die vorhandene IPC-Dateigrenze.
Ausgabegröße und Kachelung stehen bei `exportPNG`; Bereichs-/Geometriecaches
besitzen eigene Grenzen und ersetzen keine Bild-/GPU-Speicherqualifikation.

Automatische GM-Beschriftungen werden bis 1024 Pixel längster Bildkante in
Ausgabepixeln angeordnet; darüber bleibt diese Referenzkomposition erhalten.
Schrift, Halo, Abstände und Kollisionsprüfung verwenden denselben Maßstab und
wachsen gemeinsam mit der Bildauflösung. Zusätzliche Pixel verkleinern dadurch
weder Raumnamen noch ändern sie deren Platzierungsentscheidung. Geometriekacheln
verwenden weiterhin die tatsächliche Ausgabeauflösung. Die Canvasregression
prüft Hoch-/Querformat und konkurrierende Namen; die native Grundrissprobe
vergleicht die tatsächlichen PNGs bei 1536 und 3072 Pixeln.

GM-Ausgabe und öffentliche Datenfreigabe bleiben getrennt. Öffentliche Ausgabe
verwendet freigegebene Sicht-/Erinnerungsprojektionen, keine aktuellen GM-Flächen
oder GM-Raster über bloß erinnerten Hexes. Feinere öffentliche Küsten/Wege
benötigen bei Sicht gespeicherte freigegebene Geometrie mit Erinnerungsversion.
Liveprojektion und statischer Veröffentlichungsstand sind eigene Prüfwege.

## Prüfwege und offene Qualifikation

Die obigen Regressionen sichern ihre konkreten Fälle. Native Autoren-/Export-
und Recoveryproben müssen tatsächliche Fensterpixel, Bedienung, History und
frischen Prozess prüfen; entfernte SVG-Knoten oder gültige PNGs allein reichen
nicht. Kontextfehlerproben sind keine physischen GPU-/Treiberresets. Neue Oberfläche,
Testgrün oder isolierte R5-Belege qualifizieren nicht den gesamten aktuellen Stand.

Offen bleiben die durchgehenden Kaltlade-/Eingabeziele, Compositorpräsentation,
physische **16-GiB-Geräte**, lange Autorensitzungen mit Undo und Medienwechseln
sowie kombinierte Einzelkontur-/Text-/Licht-/Graph-/Public-Ausgabelasten,
große Monitore/200 % und maximale Bildausgaben. Ein Renderbackendwechsel folgt
einem gemessenen Zeichenengpass; GPU-Komposition beseitigt keine SQL-/Projektionsarbeit.
Persistente Geometrie, Text-/Geometrietrennung und Koordinatenmigration sind
dadurch weder geliefert noch ausgeschlossen. Die R7-Geländeabnahme bleibt separat.

Die [eingefrorene Dokumentationsfassung mit den datierten Funktions- und Laufzeitbefunden](https://github.com/ThonkTank/Salt-Marcher/blob/a7f8b9a46ad0edb0ab56e4892195eec190e35b3c/ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#canvas2d-als-atlasdarstellung)
bewahrt die damaligen Proben, Zahlen, gescheiterten Versuche und Methodenberichtigungen.
Die schnellere Serie vom 17.10.2026 und die langsameren Serien vom 18.10.2026
ergeben zusammen **keine** allgemeine Einhaltung von 2 s/16 ms. Hostlast ist keine
nachgewiesene Ursache. Frühere `cpu`-Felder von `TaskDuration` bezeichneten unter
`timeTicks` verstrichene Taskzeit, keine reine CPU- oder GPUzeit; alte Rohbelege
bleiben unverändert. Zwei Animationsframes im Messfenster beweisen keine einzelne
Frame- oder Präsentationszeit.

Nach `npm run build:desktop` läuft die Messung über `tools/ui-session.py`.
`ATLAS_BASELINE_FIXTURES` bindet identische Bestände, `ATLAS_RUNTIME_DIR` die
eingefrorene Runtime; `ATLAS_CYCLES` steuert Wiederholungen und `ATLAS_COLLECT_GC`
erfasst Post-GC getrennt.

Der [Messaufbau](../../tools/measure-atlas-runtime.mjs) trennt jetzt Renderer-CPU,
verstrichene Task-/Nachladezeit und ausdrücklich ungemessene Präsentation.
Er vergleicht identische Fixturekopien und eingefrorene Runtimes bei 100/200 %;
„kalt“ bedeutet frischen Prozess/Projektionscache, keinen kontrollierten OS-Cache.
Der Sichtausschnitt und tatsächliche Kamerabewegung müssen nachgewiesen sein;
Appbereitschaft und ergänzender Volumenschnitt werden separat ausgewiesen.
Begrenzte Zoomzyklen sind kein Leakbeweis; Post-GC-Werte sind keine normale Speichernutzung.
Das damalige Cacheexperiment begründet keine Budgeterhöhung.
[Stufenmessung](../../tools/measure-atlas-regions.mjs) ergänzt Store/Worker/Transport,
ohne zusammengesetzte Phasen als isolierte CPUkosten auszugeben.
