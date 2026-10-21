# Atlasdarstellung, Auswahl und Bildausgabe

Zieländerung vom 20.10.2026: Die [Roadmap für den gemeinsamen räumlichen Atlas](../plans/maps/unified-spatial-atlas.md) ersetzt getrennte Drauf-/Kippdarstellung durch eine gemeinsame perspektivische Kamera. Der Anschluss nutzt die vorhandenen Atlaswerkzeuge; die folgenden Teilbelege ersetzen noch keine vollständige Produktabnahme.

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

Der normale Atlas veröffentlicht seine vorhandenen numerischen `AtlasPaint`-Kommandos über `AtlasPresentation`. `AtlasCanvas` bleibt Besitzer von Navigation, Szenengeneration, Bilddecodierung und Trefferfreigabe. Seine Eingaben verwenden die Weltpunkte und Treffer des aktiven Präsentationsadapters. Neigen, Drehen, senkrechtes Ausrichten und Werkzeugwechsel behalten denselben WebGL-Renderer; Canvas2D zeichnet darüber nur Bildschirmhilfen wie den Maßstab. Andere bestehende Canvasverbraucher und die Rasterausgabe verwenden denselben unveränderten Zeichenvertrag.

Die GPU-Anbindung hat getrennte Zuständigkeiten:

- `atlas-spatial-geometry.ts`: numerische Flächen/Pfade, Löcher und gestrichelte Linien; nur gespeicherte Symbolpfade werden als SVG-Literal gelesen.
- `atlas-spatial-surface.ts`: Geländeanpassung und lokale, kameranahe Koordinaten.
- `atlas-spatial-label.ts` und `atlas-spatial-color.ts`: Textressourcen und CSS-Farbtransparenz.
- `atlas-spatial-vegetation.ts`: instanzierter Bewuchs und gefilterte Auswahl mit Verdeckung durch Gelände.
- `atlas-spatial-scene.ts`: GPU-Ressourcen, Zeichenreihenfolge und ursprüngliche Auswahl-IDs.
- `terrain-spatial-view.ts`: gemeinsame Kamera, Gelände, Trassen und Atlasobjekte; `terrain-spatial-ui.ts`: Kameraeinstellungen und gebündelte Terrainaufträge.

Die bestehenden Stadt-, Raum- und Landschaftswerkzeuge bleiben die Autorenbesitzer. Weder Zeichenkommandos noch GPU-Treffer erhalten Schreibautorität; Main/SQLite validieren und speichern weiterhin. Der frühere Landschafts-3D-Dialog und sein eigener Renderer sind entfernt. Neigen und Drehen stehen ausschließlich im normalen Ansichtsmenü. Auch die Straßen-/Flussplanung besitzt keine Kartenfläche oder Kamera mehr: `terrain-route-ui.ts` hält die Bedienelemente und Entwürfe in der Atlas-Seitenleiste. Punkte, Vorschau, Geländeform, Navigation und History verwenden den normalen Atlas. Nur das Höhenprofil bleibt ein kleines Diagramm. `atlas-spatial-vegetation.ts` liefert instanzierte Bäume und Felsen in dieselbe Szene, ohne eigenen Renderer. Die alten isolierten Bildfixtures verwenden ebenfalls den Produktrenderer.

**Städte haben keine Papierfläche im Atlas.** `cityObjectsPaint` liefert Straßen, Häuser und weitere angelegte Objekte ohne rechteckigen Hintergrund oder lokalen Canvasrahmen. Hauptkarte und Atlasexport verwenden diesen gemeinsamen Objektaufbau; auch der dichte Bereichsraster zeichnet kein `city-paper` mehr. Nur der historische eigenständige Dokumentserializer besitzt noch seine Papierausgabe. Alte Bindings dienen vorerst ausschließlich der Koordinatenumrechnung vorhandener Daten. Sie erzeugen weder eine Stadtidentität auf der Karte noch Marker, Namen oder Sichtbarkeitsgrenzen. Gemalte Gebiete sind unabhängige Overlays; sie besitzen keine enthaltenen Objekte. Leere Zeichnungskontexte erzeugen ebenfalls keine Marker, Namen oder Kartentreffer. Ihr Fokus und ihre Koordinaten bleiben zum Zeichnen erreichbar; fehlende Geometrie wird nicht als Null-Rechteck ausgegeben.

Die [Terrain-Zusammenführung](../reference/atlas-terrain-reconciliation-20261021/README.md) verbindet diese Kamera mit der gestreamten Projektion im Readonly-Worker. Normale Navigation überträgt ein begrenztes Höhen-/Farbfeld, keine vollständigen Autorenrecords. Abgeleitete Blöcke werden bei lokalen Änderungen invalidiert. Additive Höhenbänder erhalten kleine Geländeformen bei großen Pinseloperationen. Die [Live-Anzeige](../reference/atlas-live-main-camera-20261021/README.md) verwendet eine feste Trefferfläche pro Pinselzug und bestätigte Teilstände mit partiellen GPU-Uploads. Erst der Abschluss synchronisiert den ganzen Atlasbereich. Messkästchen bleiben im Bildschirmraum; Höhenprofile lesen über Main von derselben Kartenfläche. Der [Repository-Entwicklungsstart](../reference/atlas-objects-main-20261021/repository-start.md) verwendet jetzt ebenfalls diese Hauptkamera.

`atlas-camera.ts` definiert die Meterprojektion für Kamera, Arbeitsebenen und kanonische Pinselverdeckung. Poseänderungen bewegen vorhandene GPU-Puffer unmittelbar. `terrain-spatial-source.ts` hält einen geladenen oder angeforderten Ausschnitt für kleine Pan-/Zoombewegungen fest. Ältere orthografische Pinselschnappschüsse bleiben lesbar; Überhöhung verändert keine gespeicherten Meterwerte.

`terrain-grid-layout.ts` verteilt die Knoten eines gemeinsamen Geländenetzes:
Ein optionales `TerrainView.refinement` erhält drei Viertel der Intervalle je
Achse, die äußeren Ränder den Rest. Die Hauptkamera verwendet 257×257 Knoten
mit einer Verfeinerung über der anderthalbfachen Ausschnittsbreite. Alle Bänder
teilen ihre Randknoten; es gibt keine überlappenden Geländeebenen.
`terrain-ray.ts` schneidet nur die durchquerten Rasterzellen statt alle Dreiecke
bei jeder Zeigerbewegung. Das Ergebnis bleibt der erste sichtbare Fronttreffer;
Neigung, Überhöhung und die eingefrorene Pinsel-Trefferfläche bleiben wirksam. Renderer,
Dreieckshöhen, kanonische Sichtprüfung, Spieler-Höhenprojektion und Main-Cache
verwenden dasselbe Layout. Alte Views ohne Verfeinerung bleiben gleichmäßig.
Der Readonly-Worker sampelt bis zu neun reguläre Blöcke; lokale Invalidierung
und eingefrorene Trefferflächen während Pinselzügen bleiben erhalten.

[Fokusnetz und Trefferprüfung](../reference/atlas-focus-grid-20261021/README.md) dokumentieren den nativen Entwicklungsstart, Regressionsfälle und begrenzte Messungen.

Die Hauptkamera veröffentlicht zuerst die vollständige Geometrie mit höchstens
128×128 Farbpixeln. Danach lädt `TerrainDetailTiles` weltfest ausgerichtete
256×256-Farbkacheln von der Mitte nach außen und veröffentlicht jede fertige
Kachel über `TerrainSpatialView.setDetail`. `terrain-texture-upload.ts` überträgt
bestätigte Rechtecke mit jeweils einer GPU-Kopie und vollständige Bilder mit
einem Upload; Boden, Detail und Live-Pinsel teilen diesen Weg. Die CPU-Quelle
teilt die vorhandenen Pixel und belegt keine zusätzliche GPU-Textur. Das verändert weder Höhen noch
Treffer, Objekte oder deren GPU-Puffer. Zuletzt wird die weite Kontexttextur auf
höchstens 512×512 Pixel verfeinert. `terrain-navigation-plan.ts` bleibt Besitzer
der beiden Geometrie-/Kontextanfragen; die feine Farbe dazwischen verwendet
`atlas:terrain-color` und den gemeinsamen Rasterkern in `terrain-color-raster.ts`.
Live-Pinsel und perspektivische Ausgabe verwenden weiterhin vollständige
Projektionen mit ihrer jeweiligen Detailauflösung.

Die Farbkoordinaten liegen auf einem Zweierpotenzraster. Seine Auflösung
unterschreitet die bisherige zentrale 1024-Pixel-Dichte nicht; einschließlich
Randkacheln entstehen höchstens 9×9 Kacheln beziehungsweise 2304×2304 Pixel.
Ein 32-MiB-LRU hält abgeleitete Kachelpixel. Zusammengesetzte aktuelle und
gegebenenfalls vorherige Detailbilder sowie GPU-Texturen benötigen zusätzlichen
Speicher; die LRU-Grenze ist keine Gesamt-RAM-Garantie. Identität umfasst
Kampagnentoken, Revision, Quellenfence und die Auswahl rasterisierter Trassen.
Pan und kleine Zoomänderungen nutzen passende Kacheln wieder; Quellenänderungen
verwerfen den Renderer-Cache. Die örtliche Backend-Invalidierung bleibt erhalten.

`TerrainDetailMaterial` mischt fehlende Kacheln mit der Übersicht. Eine kleine
Verfügbarkeitsmaske blendet Ränder zu noch fehlenden Nachbarn weich ein; bei
vollständiger Belegung entfällt diese zusätzliche Mischung. Vorhandene Farben
bleiben bei Navigation an ihren Weltkoordinaten erhalten. Antworten nach Quellen-
oder Gestenwechsel dürfen weder malen noch den Cache füllen. Unterbrochene
Verfeinerung setzt nach der Geste fort. Ein Fehler nur der Detailstufe behält
Übersicht und fertige Kacheln; der ausdrückliche Wiederanlauf nutzt diese erneut.

Die [Prüfung der Farbkacheln](../reference/atlas-color-tiles-20261021/README.md)
trennt frühe erste Details, vollständige Ladezeit, Bildübergänge und Regressionen.
Diese Farbverteilung ist ein Teilschritt; weltweites Geometrie-LOD und die
Leistungsziele sind damit nicht qualifiziert.
Die [Warteschlangenprüfung](../reference/atlas-scheduling-20261021/README.md) hält die Auswahlwartezeit und die höheren kalten Rasterkosten getrennt fest.
`readTerrainProjectionSteps` berechnet normale Farbprojektionen in 64er-Paketen.
Die eigenständigen 256er-Farbkacheln verwenden 128er-Pakete, um den wiederholt
abgetasteten Rand zu verkleinern. Der gemeinsame Rasterkern gibt den Worker
zusätzlich während der Höhenabtastung (höchstens 16.384 Samples je Zeilenband)
und der Reliefschattierung frei. Kein SQL-Iterator überlebt einen Haltepunkt.
Höhenstufen verwenden wiederverwendete Achsenkoordinaten; unsichtbare Ränder
liefern weiterhin Ableitungen und Küstenabstände, erhalten aber keine unnötige
Schattierung. [Pixelvergleich und gepaarte Worker-/UI-Prüfung](../reference/atlas-color-cost-20261021/README.md)
belegen diesen begrenzten Kostenschritt. Der Worker
beendet dort seinen WAL-Schnappschuss und prüft die Revision vor jeder Fortsetzung.
Auswahl kann zwischen diesen Schritten laufen. Kamera-, Live- und Autorenaufträge
ersetzen ausstehende normale Detailarbeit; brauchbare Cacheteile bleiben erhalten.
Die UI behandelt diese Verdrängung als erwarteten Ablauf und fordert bei Bedarf
die fehlenden Details nach. Nach einer veralteten Revision sperrt sie Wiederholungen,
bis das Nachladen der Region einen aktuellen Stand bestätigt. Überholte Nachladeaufträge
geben diese Sperre erst mit dem bestätigten Nachfolger frei. Es bleibt höchstens
eine pausierte Projektion im Worker.
Synchrone Live-Frames, Geometrie-Höhenfeldaufbau und Indexpflege besitzen noch keine entsprechende
Zeitgrenze. Bei starker Neigung kann die begrenzte Abdeckung am Horizont weiterhin
sichtbar werden.

Bei Grafik- oder Terrainladefehlern wechselt die Hauptkarte einmalig auf Canvas2D. Weitere Neuzeichnungen starten den gescheiterten Renderer nicht erneut. „Atlaskamera erneut laden“ im Ansichtsmenü ist der ausdrückliche Wiederanlauf. Laufende Raum-, Stadt-, Landschafts- und Bereichsgesten sperren Poseänderungen.

**Offene Grenzen:** Der neue Anschluss überträgt zunächst vorhandene Flächen, Symbole, Texte und Griffe auf die Terrainoberfläche. Gebäudevolumen aus Raumgrundrissen und perspektivische Bildausgabe sind [angeschlossen und lokal geprüft](../reference/atlas-objects-main-20261021/README.md). Vollständige Geschoss-Arbeitsebenen, semantische Detailstufen und Maskierung bleiben offen. Bei aktiver Wissensmaske bleibt der qualifizierte gefilterte Canvasweg maßgeblich. Bildexport verwendet denselben Kamerarenderer; die laufende Spieleranzeige ist noch separat zu qualifizieren. Die vollständigen Abnahmekriterien bleiben in der [räumlichen Atlasroadmap](../plans/maps/unified-spatial-atlas.md) offen.

### Ein Boden pro Darstellung

Der Hauptatlas und die perspektivische GM-Ausgabe fordern `terrainRaster=false`
an. Der Readonly-Reader überspringt dann Boden-PNGs, die die GPU bereits aus der
Terrainprojektion zeichnet. Dichte Landschaftsobjekte bleiben als transparente
`LandscapeRaster.content=objects` erhalten und werden über dem Gelände gezeichnet.
Die Rasterart gehört zum Cache-Schlüssel und zum bestätigten Regionenvergleich.
Grafikverlust lädt vollständige Bodenbilder für Canvas nach; ausdrücklicher
Wiederanlauf wechselt zurück. Wahrnehmung und öffentliche Ausgabe behalten den
vollständigen Bodenpfad. [Messung und native Gegenproben](../reference/atlas-ground-raster-20261021/README.md)
trennen die entfallende Regionenarbeit von der weiterhin benötigten Terrainfarbe.

### Höhenlinien auf dem vorhandenen Geländenetz

`terrain-contours.ts` zeichnet Höhenlinien im GPU-Material der gemeinsamen Atlasoberfläche. Standard ist „Automatisch“ (`-1`); `0` schaltet sie aus, positive Werte wählen feste Meterintervalle. Im Automatikmodus werden ineinander enthaltene Zweierintervalle ab einem Meter anhand der lokalen Bildschirmableitung überblendet. Linien bleiben auf ihren ursprünglichen Höhen, auch bei Neigung und unterschiedlicher Entfernung zur Kamera. Die Eingabehöhen bleiben unveränderte Meterwerte; Überhöhung verändert weder Intervall noch Linienhöhe. Bildschirmableitungen halten die Strichbreite beim Zoomen/Neigen konstant und blenden unlesbar dichte Linien aus. Jede fünfte Linie wird hervorgehoben. Die Meereshöhe erzeugt keine zusätzliche Linie auf der Wasserfläche.

Die Dichte richtet sich nach logischen Anzeigepixeln: Zielabstand 24 px, die verschachtelten Intervalle liegen je nach Überblendung etwa 12–24 px auseinander. Das Material erhält die tatsächliche Renderer-Pixeldichte; der CPU-Rasterkern berücksichtigt seine zweifache Abtastdichte je Achse. Strichbreiten und Deckkräfte stehen gemeinsam in `terrain-contour-style.ts`. Kantenglättung bleibt auf physische Pixel bezogen. Die Ausgabe mit eigener Auflösung verwendet Pixeldichte 1. [Lesbarkeitsvergleich und Hauptatlas bei 100/200 %](../reference/atlas-contour-readability-20261021/README.md) prüfen die Auswahl und den Anschluss. Grobe kanonische Höhen erzeugen weiterhin eckige Konturen; ihre Geometrie wird hier nicht geglättet.

Intervallwechsel aktualisieren das Material unmittelbar, ohne Bereichsread, Geländedaten oder Textur neu aufzubauen. Verspätete Terrainantworten erhalten die aktuelle Anzeigeeinstellung. Perspektivische Bildausgabe verwendet dasselbe Material; View-Offsets erhalten über Kachelgrenzen denselben Pixelmaßstab. Der Canvas2D-Fallback verwendet dieselbe Intervall- und Überblendungsregel aus `terrain-contour-style.ts`. Die Linien folgen dem angezeigten Dreiecksnetz, dessen begrenzte Auflösung bei weiterem Zoom durch LOD verbessert werden muss. Die native Pixelprobe liegt in `tools/terrain-contour-probe.mjs`; der [Repository-Startnachweis](../reference/atlas-contour-zoom-20261021/README.md) prüft automatische Intervalle, feste Linien und Exportkachelgrenzen.

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
