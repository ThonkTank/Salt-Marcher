# Atlasdarstellung, Auswahl und Bildausgabe

Die normale Atlasfläche verbindet eine perspektivische Kamera, räumliche
Geometrie und getrennte Autorenhilfen. Main bleibt Besitzer der kanonischen
SQLite-Daten; Renderer greifen ausschließlich über die Preload-Brücke darauf zu.
Bedienung, Speicherformate und Produktumfang werden durch die interne
Bereinigung nicht geändert. Fachziele: [gemeinsamer Atlas](../plans/maps/unified-spatial-atlas.md).

## Zuständigkeiten und Datenfluss

Für den beschlossenen [Atlasumbau M0–M8](../plans/maps/unified-spatial-atlas.md)
entsteht parallel der neue Kartenanschluss. Der Desktopbuild stellt
`atlas-maplibre-runtime.js` als lokal ladbares Modul bereit; die normale
Workbench verwendet weiterhin die unten beschriebenen Besitzer. Der neue
[AtlasMapLibreBridge](../../src/app/atlas-maplibre-bridge.ts) besitzt pro Karte
Viewport, Matrixaufnahme, Overlay und Style-Lebenszyklus. Vor `map.remove()` muss
sein Besitzer `dispose()` aufrufen. Szenenursprung und Geometriepuffer gehören
zusammen; Kamerabewegungen verschieben diesen Ursprung nicht.
[Runtime](../../src/app/atlas-maplibre-runtime.ts) und
[Workerdecoder](../../src/app/atlas-maplibre-projection-worker.ts) verwenden
dieselben lokalen CRS-Definitionen. Die privaten Bibliotheksanschlüsse bleiben
auf die exakt gepinnten Versionen begrenzt. Produktübernahme und vollständige
M1-Abnahme sind weiterhin offen.

Die neue [Kamera](../../src/app/atlas-maplibre-camera.ts) hält physische Fokus-
und Darstellungshöhe getrennt. [Darstellung und Autorenstrahl](../../src/app/atlas-maplibre-matrices.ts)
teilen dieselbe numerische Matrixberechnung. Die GPU bestimmt das sichtbare Objekt;
der [Strahl](../../src/app/atlas-maplibre-ray.ts) verfeinert dessen Treffer auf den
tatsächlich dargestellten Dreiecken. Autoren dürfen nur einen vorhandenen `point`
verwenden. Nach Kamera-/Style-/Größenänderung sperrt `frameUsable` Treffer bis zum
frischen Rendern. Szenenpuffer sind unveränderliche Aufnahmen; geänderte Geometrie
erhält eine neue Aufnahme. [Lokale Schrift und Symbole](../../src/app/atlas-maplibre-assets.ts)
gehören zum Desktopbuild und werden über die konkrete Asset-Freigabe in Main geladen.
[Native Gegenprüfungen und verbleibende M1-Lücken](../reference/atlas-maplibre-camera-assets-20261023/README.md).

`CampaignAtlasWorkbench` verbindet Arbeitsbereich, Werkzeugwechsel und die
bestehende Schreibgrenze. Die Zustandsbesitzer bekommen gezielte typisierte
Ports, niemals die gesamte Workbench:

| Besitzer | Eigener Zustand und Verantwortung |
| --- | --- |
| [AtlasRegions](../../src/app/atlas-regions.ts) | Bereichsabfragen, laufende Reads, Quellenstand, Abdeckung und Geometriefreigabe. Abbruch entwertet Antworten und räumt den eigenen Timer auf. |
| [AtlasAuthor](../../src/app/atlas-author.ts) | Auswahl, Pointergesten, Raum-/Pfadentwürfe und deren Übergabe an den vorhandenen Writer. |
| [AtlasDrawing](../../src/app/atlas-drawing.ts) | Zeichenkommandos, Grundgeometriecache, Beschriftung und Autorenhilfen. Keine eigenen Speicher- oder Ladeaufträge. |
| [AtlasJourney](../../src/app/atlas-journey.ts) | Reisevorschau, ungeklärte Reiseaufträge, Eingänge und Wiedergabe. |
| [AtlasOutput](../../src/app/atlas-output.ts) | Ausgabeauswahl, eingefrorener Quellenstand und genau ein abbrechbarer Ausgabeauftrag. |
| [LandscapeBrushSession](../../src/app/landscape-brush-session.ts) | Pinselabtastung, gemeinsamer Animationsauftrag und Abschluss des bestehenden `TerrainLiveStroke`. |
| [LandscapeRoutes](../../src/app/landscape-routes.ts) | Temporäre Trassensitzung und Vorschau. Alte Abschluss- und Close-Callbacks dürfen keine Nachfolgesitzung verändern. |
| [LandscapeInspector](../../src/app/landscape-inspector.ts) | Ausgewählte Landschaftsrecords, Mehrfachauswahl und editierbarer Inspectorentwurf. |

Eine Kamerabewegung aktualisiert Darstellung und bei Bedarf den Ausschnitt.
`AtlasRegions` veröffentlicht nur Antworten des aktuellen Besitzers und Auftrags.
Zeichnung und Trefferfreigabe verwenden denselben bestätigten Quellenkontext;
ein noch sichtbares altes Bild erlaubt keine Bearbeitung mit veralteten Treffern.
Autorenaktionen passieren weiterhin die bestehende Commit-/Recoverygrenze.
`TerrainPresentation` und `TerrainLiveStroke` behalten getrennte Anzeige- und
Schreibaufträge; ein Pinselzug bleibt ein Historyschritt.

Die Workbench prüft vor dem Zeichnen den bestätigten Quellenstand und übergibt
den Szenenaufbau an `AtlasDrawing.draw`. Dort entstehen auch die behaltene
Stadt-/Raumgeometrie, Exportmarkierung und Reisezeichnung; die Cache-Schlüssel
bleiben unverändert. Abdeckung und Auflösung eines Bereichs werden gegen
dieselbe Aufnahme der Bedienelemente und Viewportmaße geprüft. Maß- und
Reisebeschriftungen teilen den bestehenden deutschen Zahlenstil über einen
wiederverwendeten `Intl.NumberFormat` in `atlas-units.ts`.

Beim Verbergen beziehungsweise Aktivieren eines anderen Kontexts werden
Bereichsantworten, Reisevorschauen und Ausgabeaufträge beim jeweiligen Besitzer
entwertet. Ein unbekannter Schreibausgang wird dadurch weder wiederholt noch
als erfolgreich behandelt. Die vorhandenen Fachguards bleiben erhalten.

[Bereinigungsnachweis: Regressionen, native Abläufe und offene Grenzen](../reference/atlas-technical-cleanup-20261022/README.md).

## Wo ändern und prüfen?

| Aufgabe | Zuständiger Code | Vorhandene Gegenprobe |
| --- | --- | --- |
| Zeichenkommandos, Transformationen, Pfade und Symbolfamilien | [AtlasPaint](../../src/app/atlas-paint.ts), [AtlasCanvasScene](../../src/app/atlas-canvas-scene.ts); historische SVG-Ausgabe: [Serializer](../../src/app/atlas-paint-svg.ts) | [Paint-Verträge](../../tests/desktop-atlas-paint.test.mjs) |
| [Kamera, sichtbarer Frame und Trefferfreigabe](#welcher-frame-darf-eingaben-annehmen), [Bilder und Recovery](#grenzen-und-fehlerwiederaufnahme) | [AtlasCanvas](../../src/app/atlas-canvas.ts): `render`, `drain`, `paint`, `recover` | [Canvasfälle](../../tests/desktop-atlas-canvas.test.mjs), [native Wiederherstellung](../../tools/test-desktop-canvas-recovery.mjs) |
| [Autorenebene, Entwürfe und Wiederverwendung](#was-bleibt-bei-rasterwechsel-und-pan-erhalten) | [AtlasAuthor](../../src/app/atlas-author.ts): Gesten und Entwürfe; [AtlasDrawing](../../src/app/atlas-drawing.ts): Autorenzeichnung und Hintergrundaufbau; `chooseAt` bleibt der Auswahlanschluss der Workbench | [Autorenregression](../../tests/desktop-atlas-author-overlay.test.mjs), [nativer Autorenablauf](../../tools/test-desktop-atlas-author-overlay.mjs) |
| [Genaue Kandidaten](#welcher-frame-darf-eingaben-annehmen) und Landschaftsraster | [AtlasRegionReader](../../src/app/storage/atlas-region.ts): `candidatesAt`; [AtlasLandscapeReader](../../src/app/storage/atlas-landscape-region.ts) | [Bereichsauswahl](../../tests/desktop-atlas-region.test.mjs), [Bereichsworker](../../tests/desktop-atlas-regions.test.mjs), [Zeichenüberhang](../../tests/desktop-landscape-paint-bounds.test.mjs) |
| [GM-Bildausgabe und ihr Lebenszyklus](#gm-ausgabe-und-öffentliche-freigabe) | `exportPNG`/`outputRun` in `AtlasOutput`, [atlasRegionPaint](../../src/app/atlas-region-export.ts) | [nativer Bereichsexport](../../tools/test-desktop-region-export.mjs), Canvasregressionen |
| [Kippbares Gelände und Dreieckstreffer](#draufsicht-und-geländeprojektion) | [TerrainSpatialUI](../../src/app/terrain-spatial-ui.ts), [Vorschauworker](../../src/app/terrain-spatial-worker.ts), [TerrainSpatialView](../../src/app/terrain-spatial-view.ts) | [Projektionsfälle](../../tests/terrain-tilted-atlas.test.mjs), [Speicherfälle](../../tests/terrain-tilted-atlas-storage.test.mjs), [native Geländeprobe](../../tools/test-desktop-terrain-tilted-atlas.mjs) |

Leisten, Werkzeuge und Navigation: [Atlasoberfläche ändern](../../ARCHITECTURE.md#atlasoberfläche-ändern).
Pinselgrößen werden bei Kamerabildern synchronisiert. Ihre Beschriftungsknoten
bleiben dabei bestehen; nur echte Einheitenwechsel ändern den Text.
[Native Stil-/Navigationsmessung](../reference/atlas-brush-controls-20261021/README.md).
Die Hilfsebene reicht inzwischen ihren bereits gemessenen Kartenmaßstab an
die Pinselregler weiter. Speicherbestätigungen benötigen dafür keine eigene
synchrone Layoutabfrage; direkte Eingaben prüfen aktuelle Maße weiterhin sofort.
Die Werkzeugleiste teilt eine aktuelle Katalogaufnahme je Aktualisierung und
behält unveränderte Beschriftungen bei. [Ablauf, Messgrenzen und volle Welt](../reference/atlas-control-frame-20261022/README.md).
Testvorbereitung und native Sitzungen: [Testanleitung](testing.md).
Die aufgeführten Prüfwege sind keine neue Ausführung oder Produktabnahme.

## Draufsicht und Geländeprojektion

Der normale Atlas veröffentlicht seine vorhandenen numerischen `AtlasPaint`-Kommandos über `AtlasPresentation`. `AtlasCanvas` bleibt Besitzer von Navigation, Szenengeneration, Bilddecodierung und Trefferfreigabe. Seine Eingaben verwenden die Weltpunkte und Treffer des aktiven Präsentationsadapters. Neigen, Drehen, senkrechtes Ausrichten und Werkzeugwechsel behalten denselben WebGL-Renderer; Canvas2D zeichnet darüber nur Bildschirmhilfen wie den Maßstab. Andere bestehende Canvasverbraucher und die Rasterausgabe verwenden denselben unveränderten Zeichenvertrag.

Die GPU-Anbindung hat getrennte Zuständigkeiten:

- `atlas-spatial-geometry.ts`: numerische Flächen/Pfade, Löcher und gestrichelte Linien; nur gespeicherte Symbolpfade werden als SVG-Literal gelesen.
- `atlas-spatial-surface.ts`: Geländeanpassung und lokale, kameranahe Koordinaten.
- `atlas-spatial-label.ts` und `atlas-spatial-color.ts`: Textressourcen und CSS-Farbtransparenz. `atlas-spatial-labels.ts` hält Kartenname-Texturen und ordnet die begrenzten Kandidaten aus `AtlasPaint.mapLabels` mit der aktuellen Kamera an. `MapLabelLayout` teilt Priorität und Kollisionsregeln mit der flachen Ausgabe.
- `atlas-spatial-vegetation.ts`: instanzierter Bewuchs und gefilterte Auswahl mit Verdeckung durch Gelände. `vegetation-lod.ts` teilt verschachtelte Kandidaten und Skalenregeln zwischen Erzeugung, Darstellung und Fallback; `vegetation-display.ts` verwendet die aktuelle Kameratiefe für Kronenbreite, Ausblenden und Treffer. Kamerafahrten verändern keine Instanzmatrizen. [Native und GPU-Belege](../reference/atlas-vegetation-camera-20261021/README.md).
- `atlas-spatial-scene.ts`: GPU-Ressourcen, Zeichenreihenfolge und ursprüngliche Auswahl-IDs.
- `terrain-spatial-view.ts`: gemeinsame Kamera, Gelände, Trassen und Atlasobjekte; `terrain-spatial-ui.ts`: Kameraeinstellungen und gebündelte Terrainaufträge.

`terrain-route-display.ts` ergänzt den maßhaltigen Straßen-/Flussbändern eine schmale Bildschirmdarstellung. Gemeinsame Schwellen aus `atlas-scale-policy.ts` steuern weiche Sichtbarkeit; die aktuelle Kameraprojektion steuert das Material auf jeder Zeichnung. Sichtbarkeit und Trefferauswahl verwenden dieselbe Regel. `terrain-route-clip.ts` begrenzt die Unterteilung auf den geladenen Bereich, ohne Streckenparameter oder Autorenpunkte zu verändern. [Native Zoom- und GPU-Prüfung](../reference/atlas-route-scale-20261021/README.md); zuständige Regression: `tests/terrain-route-display.test.mjs`.

`terrain-hex-grid.ts` zeichnet das maßstabsabhängige Hexgitter im Bodenmaterial.
Die Hauptkamera liefert nur Weltanker, Größe und Überblendung der Gitterstufen;
sie baut dafür keine projizierten Pfade pro Kamerabild mehr. Canvas-Fallback
und Vektorausgabe behalten ihre bisherigen Pfade. Automatische Höhenlinien
verwenden feste Höhenstufen, die nur nach Kartenmaßstab ausgewählt werden.
Geländesteigung, Nachladen und Bearbeitung verändern die Höhenstaffel nicht.
Unsichtbare Trassen werden konservativ vor der GPU-Einreichung ausgesondert.
Waldübersichten erzeugen ihre Höhenumgebung erst bei tatsächlich sichtbaren
Einzelobjekten. [Weltprobe, Ursachen und verbleibende Pinselblockade](../reference/atlas-world-response-20261021/README.md).

Die bestehenden Stadt-, Raum- und Landschaftswerkzeuge bleiben die Autorenbesitzer. Weder Zeichenkommandos noch GPU-Treffer erhalten Schreibautorität; Main/SQLite validieren und speichern weiterhin. Der frühere Landschafts-3D-Dialog und sein eigener Renderer sind entfernt. Neigen und Drehen stehen ausschließlich im normalen Ansichtsmenü. Auch die Straßen-/Flussplanung besitzt keine Kartenfläche oder Kamera mehr: `terrain-route-ui.ts` hält die Bedienelemente und Entwürfe in der Atlas-Seitenleiste. Punkte, Vorschau, Geländeform, Navigation und History verwenden den normalen Atlas. Nur das Höhenprofil bleibt ein kleines Diagramm. `atlas-spatial-vegetation.ts` liefert instanzierte Bäume und Felsen in dieselbe Szene, ohne eigenen Renderer. Die alten isolierten Bildfixtures verwenden ebenfalls den Produktrenderer.

**Städte haben keine Papierfläche im Atlas.** `cityObjectsPaint` liefert Straßen, Häuser und weitere angelegte Objekte ohne rechteckigen Hintergrund oder lokalen Canvasrahmen. Hauptkarte und Atlasexport verwenden diesen gemeinsamen Objektaufbau; auch der dichte Bereichsraster zeichnet kein `city-paper` mehr. Nur der historische eigenständige Dokumentserializer besitzt noch seine Papierausgabe. Alte Bindings dienen vorerst ausschließlich der Koordinatenumrechnung vorhandener Daten. Sie erzeugen weder eine Stadtidentität auf der Karte noch Marker, Namen oder Sichtbarkeitsgrenzen. Gemalte Gebiete sind unabhängige Overlays; sie besitzen keine enthaltenen Objekte. Leere Zeichnungskontexte erzeugen ebenfalls keine Marker, Namen oder Kartentreffer. Ihr Fokus und ihre Koordinaten bleiben zum Zeichnen erreichbar; fehlende Geometrie wird nicht als Null-Rechteck ausgegeben.

Die [Terrain-Zusammenführung](../reference/atlas-terrain-reconciliation-20261021/README.md) verbindet diese Kamera mit der gestreamten Projektion im Readonly-Worker. Normale Navigation überträgt ein begrenztes Höhen-/Farbfeld, keine vollständigen Autorenrecords. Abgeleitete Blöcke werden bei lokalen Änderungen invalidiert. Additive Höhenbänder erhalten kleine Geländeformen bei großen Pinseloperationen. Die [Live-Anzeige](../reference/atlas-live-main-camera-20261021/README.md) verwendet eine feste Trefferfläche pro Pinselzug und bestätigte Teilstände mit partiellen GPU-Uploads. Erst der Abschluss synchronisiert den ganzen Atlasbereich. Messkästchen bleiben im Bildschirmraum; Höhenprofile lesen über Main von derselben Kartenfläche. Der [Repository-Entwicklungsstart](../reference/atlas-objects-main-20261021/repository-start.md) verwendet jetzt ebenfalls diese Hauptkamera.

`atlas-workplane.ts` verbindet die Geschosshöhe und den Weltanker mit Fundament-/Geländehöhen. Innenraumflächen, Autorenkonturen, Maßprojektion, Raumnamen und Zeigerstrahlen verwenden denselben Bezug. Geländewerkzeuge bleiben an der Geländeoberfläche. [Prüfungen und offene Grenzen](../reference/atlas-workplanes-20261021/README.md).

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
Der Readonly-Worker sampelt bis zu neun reguläre Blöcke bei kompakten Rändern
und bis zu 81 bei großer Fernabdeckung. Die Zahl der Knoten bleibt gleich;
pro äußerem Rand wachsen bis zu vier Bänder nach außen, damit nahe Übergänge
keine großen Dreiecke erhalten. Lokale Invalidierung und eingefrorene
Trefferflächen während Pinselzügen bleiben erhalten.

`terrain-coverage.ts` bestimmt die quadratische, drehungsunabhängige Abdeckung
aus der Neigung (3-, 6-, 10-, 24- oder 64-fache längste Ausschnittsseite).
Stärkeres Neigen fordert eine größere Quelle an; die Kamera bewegt vorhandene
Daten sofort. Ab 60° blendet ein kontinuierlicher atmosphärischer Horizont
fernes Gelände aus. Renderer, Beschriftungsverdeckung, Treffer und kanonische
Pinselprüfung verwenden dieselbe Grenze, auch bei gekachelter Bildausgabe.
Himmel und Meer haben unterschiedliche Farben. Straßen und Flüsse werden
entlang dieser Rasterbänder adaptiv abgetastet; nahe Trassen erhalten Vorrang
im begrenzten Vektorbudget. [Abdeckung und native Prüfungen](../reference/atlas-terrain-coverage-20261021/README.md)
halten die Teilverbesserung und verbleibende Ladegrenzen fest.

[Fokusnetz und Trefferprüfung](../reference/atlas-focus-grid-20261021/README.md) dokumentieren den nativen Entwicklungsstart, Regressionsfälle und begrenzte Messungen.

Die Hauptkamera veröffentlicht zuerst die vollständige Geometrie mit höchstens
128×128 Farbpixeln. Danach lädt `TerrainDetailTiles` weltfest ausgerichtete
256×256-Farbkacheln von der Mitte nach außen und veröffentlicht jede fertige
Kachel über `TerrainSpatialView.setColorFrame`. `TerrainColorSurface` hält das
zusammengesetzte Farb-/Waldbild auf der GPU, übernimmt vorhandene Weltpixel bei
Kamerawechseln und lädt ausschließlich neue angenommene Kacheln hoch.
`terrain-texture-upload.ts` überträgt weiterhin bestätigte CPU-Pinselpatches und
Grundbilder. Die CPU-Quelle teilt die vorhandenen Pixel und belegt keine
zusätzliche GPU-Textur. Das verändert weder Höhen noch
Treffer, Objekte oder deren GPU-Puffer. Zuletzt wird die weite Kontexttextur auf
höchstens 512×512 Pixel verfeinert. `terrain-navigation-plan.ts` bleibt Besitzer
der beiden Geometrie-/Kontextanfragen; die feine Farbe dazwischen verwendet
`atlas:terrain-color` und den gemeinsamen Rasterkern in `terrain-color-raster.ts`.
Live-Pinsel veröffentlichen zunächst vollständige Höhen mit höchstens 64×64
Farbpixeln für Übersicht und Pinselbereich. `TerrainPresentation` fordert danach
die ursprüngliche Farbauflösung an. Diese Verfeinerung läuft in unterbrechbaren
Workerabschnitten hinter neuen Autoren- und Kameraanfragen. Beide Stufen tragen
ihre tatsächliche Quellenrevision; eine feinere Antwort derselben Revision darf
das erste Bild ersetzen, eine inzwischen überholte Antwort nicht. Die
perspektivische Ausgabe behält ihre jeweilige Detailauflösung.
[Native Teilmessung und offene Leistungsgrenze](../reference/atlas-progressive-brush-20261021/README.md).

Der Pinselabschluss wartet auf die letzte bestätigte vollständige Höhenübersicht,
aber nicht mehr auf deren feine Farben. Neue bestätigte Übersichten können
ältere Verfeinerung ersetzen. Teilantworten behalten ihre angeforderte Basis,
auch wenn zwischenzeitlich ein Detailbild erscheint. Nach Abschluss lädt der
normale Atlas die ausstehende Detailstufe weiter, einschließlich unveränderter
Quellenrevisionen. Objektaktualisierung und Terrainbereitschaft bleiben für
den nächsten Zug erforderlich. [Diagnose, Schutzregeln und echter Folgezug](../reference/atlas-brush-finish-20261022/README.md).

Die Farbkoordinaten liegen auf einem Zweierpotenzraster. Seine Auflösung
unterschreitet die bisherige zentrale 1024-Pixel-Dichte nicht; einschließlich
Randkacheln entstehen höchstens 9×9 Kacheln beziehungsweise 2304×2304 Pixel.
Ein 32-MiB-LRU hält abgeleitete Kachelpixel. Aktuell angenommene Kachelpuffer
und bis zu zwei zusammengesetzte GPU-Bilder benötigen zusätzlichen Speicher;
die LRU-Grenze ist keine Gesamt-RAM-Garantie. `TerrainColorFrame` hält als
Vorgänger ausschließlich Identität und Raster, keine rekursive Pufferhistorie.
[GPU-Besitz, Pixelgegenprobe und verbleibende Weltlatenz](../reference/atlas-gpu-detail-20261022/README.md).
Identität umfasst
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
und der Reliefschattierung frei. `LandscapeRasterizer.paintColorSteps` unterbricht
auch Pigmentmasken und kumulative Farbkomposition.
Auch das Höhengitter bietet inzwischen Unterbrechungspunkte: `readTerrainGridSteps`
und `TerrainProjectionCache.gridDataSteps` teilen kalte Felder und örtliche
Reparaturen in abgeschlossene Leseblöcke. Unvollständige Gitter werden nicht
veröffentlicht; Cache-Invalidierung während einer Pause verwirft die laufende
Berechnung. Synchrone Autoren-/Sichtprüfungen konsumieren denselben Rasterkern
weiter vollständig. Der Worker prüft vor jeder Fortsetzung den Quellenstand.
Die 4.096-Sample-Blöcke sind keine garantierte Millisekundengrenze.
[landscape-pigment-coverage.ts](../../src/app/landscape-pigment-coverage.ts)
teilt Weltachsen, quadratische Achsabstände und Texturanteile zwischen
überlappenden Abdrücken eines Strichs. Float64-Weltkoordinaten und die bisherige
Float32-Akkumulation erhalten auch entfernte Texturen und Radierer.
[Pixelorakel und gepaarte Pinselprüfung](../reference/atlas-brush-coverage-20261021/README.md)
belegen diesen Kostenschritt. `landscape-record-stream.ts`
liest dazu begrenzte Seiten aus einem partiellen Farbindex und anschließend
jeweils einen Payload mit abgeschlossener SQL-Abfrage. Kein SQL-Iterator
überlebt einen Haltepunkt. Füllflächen benötigen keine Pinselstempel; konstante
Pigmentfarben bleiben außerhalb des Maskenpuffers. Deckende, ungefilterte
Polygonabschnitte setzen ihre RGBA-Bytes direkt; Transparenz und Land-/Wasserfilter
behalten die bisherige Komposition. [Randfallprüfung und gepaarte Farbmessung](../reference/atlas-opaque-spans-20261021/README.md)
belegen pixelgleiche Ausgabe mit weniger Rasterarbeit.
[Pixelorakel, Worker-Vergleich und native Gegenprobe](../reference/atlas-pigment-scheduling-20261021/README.md)
trennen geringere Auswahlwartezeit von weiterhin hoher vollständiger Ladezeit.
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

`terrain-dirty-rects.ts` fasst benachbarte invalidierte Blöcke zu Rechtecken
zusammen. Höhenabfragen bleiben innerhalb von 65.536 Samples; saubere Löcher
werden dabei nicht neu gelesen. Der Farbcache verwendet dieselbe Zusammenfassung
vor der Rasterung, hält aber weiterhin seine kleinen Invalidierungs-/Speicherblöcke.
So teilen große Änderungen ihre Quellabtastung und Beleuchtungsränder. Dies
begrenzt weder die gesamte Live-Latenz noch ersetzt es zeitlich aufgeteilte Farbarbeit.

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

### Farbkacheln nach Terrainänderungen

`TerrainChangeHistory` hält im Readonly-Worker höchstens 64 Quellenstände und 2048 Änderungsrechtecke. Eine Projektion kann die genaue Revision und Fence ihrer bisherigen Farbe angeben. Der Worker bestätigt alle seitdem betroffenen Flächen, auch wenn zwischenzeitliche Regionen- oder Live-Abfragen seinen normalen Cursor weitergeschaltet haben. Fehlende Historie, Neustart und globale Einstellungen verlangen eine vollständige Erneuerung.

`TerrainDetailTiles` besitzt Cache, Quellenkennung und das gehaltene Detailbild. Nur eine bestätigte Änderungskette innerhalb derselben Kampagne und Trassendarstellung erlaubt die Übernahme. Betroffene Kacheln einschließlich des gemeinsamen Rasterhalos werden entfernt und im gehaltenen Bild transparent; unveränderte Kacheln bleiben schon unter dem ersten Übersichtsschritt sichtbar. Live-Frames verwenden denselben Besitzer. Ihre frisch bestätigte Pinseltextur liegt als kleine, linear gefilterte GPU-Textur unter den weiterhin gültigen feinen Kacheln. Die UI vergrößert sie nicht mehr per CPU in das gehaltene Weltbild. Diese Zwischenfarbe ersetzt keine feine Kachel im Cache und wird nach dem Live-Frame wieder freigegeben. Alte Antworten dürfen den übernommenen Cache weder füllen noch zeichnen. Beim Loslassen endet zuerst die Schreibspur; die Anzeigespur übernimmt noch ihren letzten bestätigten Nachfolger, bevor sie geschlossen wird. Atlaswechsel widerruft sie weiterhin sofort. Ohne aktuelle Pinseltextur ersetzt die Übersicht geänderte Pixel, bis ihre feinen Kacheln eintreffen.

Eine Veröffentlichung von Gelände, Pose, Höhenlinien und Auswahl verwendet
`TerrainSpatialView.batch`: Zwischenstände verändern die Szene, reichen aber
keine weiteren vollständigen GPU-Zeichnungen ein. Nach der synchronen Gruppe
stimmen Kamera und Treffer mit dem veröffentlichten Stand überein. Explizite
Exportkacheln zeichnen weiterhin unmittelbar; fehlerhafte Gruppen malen keinen
halbfertigen Zwischenstand. Das ist keine zeitliche Entkopplung des Workers.

`terrainDetailBox` begrenzt die Arbeitsfläche auf höchstens drei Pinselradien
je Achse. Ihr gerasterter Weltanker bleibt bei kleinen Bewegungen stabil; der
gesamte Pinsel liegt vor dem weichen Texturrand. Die echte `TerrainSpatialView`
initialisiert den Detailbesitzer erst mit ihrem Renderer, damit lokale
Farbupdates einen Rechteck-Upload statt einzelner Zeilen-Uploads verwenden.
[Messung und GPU-Prüfung](../reference/atlas-live-color-20261021/README.md).

[Regressionen](../../tests/terrain-color-retention.test.mjs), [Worker mit echten Änderungen und Undo](../../tests/terrain-projection-service.test.mjs) und [Präsentationsfolge](../../tests/terrain-spatial-source.test.mjs) prüfen diese Grenzen. Die übrige Leistungs- und Großweltqualifikation bleibt offen.

### Küstenzeichnung

`terrain-coast.ts` zeichnet nach der Reliefschattierung eine schmale Kontur aus den kanonischen Wasserentscheidungen des gemeinsamen zweifachen Rasters. Es hält kein zusätzliches Distanzfeld und verändert weder Höhen noch Wasserflächen. Nur Ausgabesamples werden gefärbt; deren Halo liefert die Nachbarn für nahtlose Einzelkacheln. Die Schleife gibt zwischen Zeilenpaketen den Worker frei. [Stilvergleich und Hauptatlas](../reference/atlas-coast-ink-20261021/README.md) halten den sichtbaren Gewinn und die verbleibende Vergrößerung grober Farbtexturen getrennt fest. Die Konturbreite ist bisher an Rasterpixel gebunden, nicht unter jeder Perspektive an logische Bildschirmpixel.

### Begrenzte Rasterabdeckung

Der Canvas-/Bereichsraster verwendet weiterhin höchstens vier Weltkacheln.
`landscapeRasterSlice` schneidet jede auf die angeforderte Abdeckung zu,
auf 128-Pixel-Blöcke derselben Weltauflösung gerundet. Der gemeinsame
Rasterhalo bleibt erhalten; Bilddaten und Cache-Invalidierung kennen
Breite und Höhe separat. Kleine Panbewegungen innerhalb derselben
Blockgrenzen verwenden dieselben Ausschnitte. Die SQL-Sampleauswahl
berücksichtigt rechteckige Raster auch bei sehr dünnen Farbflächen.

Völlig ebene Nachbarschaften benötigen weder Licht- noch Konturrechnung;
vorhandene Farben bleiben unverändert. Die Höhenanalyse wird weiterhin
berechnet. Diese Entlastung gilt auch für die normalen GPU-Farbtiles.
[Pixelvergleich, Messung und native Wiederherstellung](../reference/atlas-raster-slices-20261021/README.md)
belegen die Teilverbesserung; vollständige Lade-/Navigationsziele bleiben offen.

### Höhenabtastung ohne wiederholtes Einsammeln

`terrain-height-lattice.ts` sammelt pro Auflösung die tatsächlich benötigten Quellknoten. Viele Ausgabepixel teilen deren Werte und horizontale Zwischenwerte. Nur Zeilen mit Lücken werden mit dem geerbten Wert am jeweiligen Abfragepunkt neu ausgewertet; vollständige Nachbarzeilen bleiben auch in gemischten Zellen wiederverwendbar. Ein Band hält höchstens 16 Knoten je Ausgabesample und absoluter/additiver Ebene, keine vollständigen Autorenkacheln. Weltindizes bleiben Float64. `terrain-field-stream.ts` besitzt Bandgrenzen, SQL-Lebensdauer, Trassen und Wasser.

`terrain-interpolation.ts` besitzt die gemeinsame begrenzte kubische Rekonstruktion für `TerrainSampler` und Feldstream. Die Kurve erhält Knoten, plateauförmige Extrema und affine Innenbereiche. Fehlende absolute Knoten erben den gröberen Wert am Abfragepunkt; additive Lücken bleiben null. Die Reihenfolge ist immer x, dann y. Geometrie, Farbe, Wasserentscheidung und kanonische Abfragen verwenden denselben Kernel; sichtbare Treffer bleiben an die tatsächlich gezeichneten Netzdreiecke gebunden.

Ein Höhenknoten beeinflusst zwei Zellen in jeder Richtung. `bounds` liefert daher die abgeleitete 67-Pixel-Suchfläche; das gespeicherte 65-Pixel-Autorenpolygon und die Höhenwerte bleiben erhalten. Präzise Invalidierung und die geglättete Basispyramide berücksichtigen dieselbe Nachbarschaft. Schema 54 erweitert beim Öffnen alte Suchgrenzen und History-Zeilen atomar. Nur bekannte Fingerabdrücke werden angepasst; bestehende Undo-Konflikte bleiben Konflikte. Paketvorschau liest das Original, Übernahme migriert die temporäre Kopie. [Numerik, Migration und Anschlussprüfung](../reference/atlas-height-reconstruction-20261021/README.md) dokumentieren die Änderung.


### Höhenlinien auf dem vorhandenen Geländenetz

`terrain-contours.ts` zeichnet Höhenlinien im GPU-Material der gemeinsamen Atlasoberfläche. Standard ist „Automatisch“ (`-1`); `0` schaltet sie aus, positive Werte wählen feste Meterintervalle. Im Automatikmodus werden ineinander enthaltene Zweierintervalle ab einem Meter anhand des Kartenmaßstabs überblendet. Linien bleiben auf ihren ursprünglichen Höhen, auch bei Neigung und unterschiedlicher Entfernung zur Kamera. Die Eingabehöhen bleiben unveränderte Meterwerte; Überhöhung verändert weder Intervall noch Linienhöhe. Bildschirmableitungen halten die Strichbreite beim Zoomen/Neigen konstant und blenden unlesbar dichte Linien aus. Jede fünfte Linie wird hervorgehoben. Die Meereshöhe erzeugt keine zusätzliche Linie auf der Wasserfläche.

Die Höhenstaffel richtet sich nach Metern pro logischem Anzeigepixel: Bei 1 m/px werden 16-m-Stufen gewählt; bei anderem Maßstab werden die benachbarten Zweierintervalle zwischen 1 und höchstens 256 m überblendet. Die feste Obergrenze hält auch auf Weltmaßstab breite Höhenformen sichtbar. Das ist kein räumlicher Mindestabstand: Steile Hänge haben engere Linien als flache. Derselbe Maßstab verwendet dieselben Stufen unabhängig vom Gelände. Die frühere Steigungsreferenz ist entfernt. Das Material erhält die tatsächliche Renderer-Pixeldichte; der CPU-Rasterkern berücksichtigt seine zweifache Abtastdichte je Achse. Strichbreiten und Deckkräfte stehen gemeinsam in `terrain-contour-style.ts`. Kantenglättung bleibt auf physische Pixel bezogen. Die Ausgabe mit eigener Auflösung verwendet Pixeldichte 1. [Lesbarkeitsvergleich und Hauptatlas bei 100/200 %](../reference/atlas-contour-readability-20261021/README.md) prüfen die Auswahl und den Anschluss. Grobe kanonische Höhen erzeugen weiterhin eckige Konturen; ihre Geometrie wird hier nicht geglättet.

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

Bildkacheln in `AtlasSpatialScene` verwenden UVs mit Ursprung oben und
ungespiegelten Upload (`flipY=false`). Der gemeinsame Decoder liefert
`ImageBitmap`; diese Quellen ignorieren WebGLs Upload-Spiegelung. Eine
quellabhängige Mischung von UV-Konventionen spiegelt deshalb Karteninhalte.
[Asymmetrische native Pixelregression](../reference/atlas-image-orientation-20261021/README.md)
prüft Canvas, HTML-Bild und Bitmap bei senkrechter und geneigter Kamera.

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

Die perspektivische GM-Ausgabe übernimmt Landschaftskacheln mit
`content=objects`: Dichte Bestände enthalten ihre automatischen Bäume dort statt
in Einzelrecords. Nur Bodenraster entfallen zugunsten der Terrainprojektion.
Ein vollständiger Layer und unveränderter Quellenzaun bleiben Voraussetzung.
Die [Regression](../../tests/atlas-terrain-export.test.mjs) und der
[native PNG-Vergleich](../reference/atlas-image-orientation-20261021/README.md#folgekorrektur-automatischer-bewuchs-in-png)
belegen den Erhalt des Bestands, noch keine gleiche räumliche Detailstufe.

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


### Quellenübergabe nach bestätigten Terrainzügen

`TerrainSpatialUI.sync` hält die Revisionskennung getrennt von den übrigen
Projektionsinputs. Ein bereits veröffentlichtes Live-Gitter darf die neue Quelle
nur übernehmen, wenn die frische Region dieselbe Revision und Quellenkennung
bestätigt, der bisherige Quellenbesitzer übereinstimmt und die Abtastgeometrie
zum normalen Ladeplan passt. Kontext-, Kameraabdeckungs- oder Objektänderungen
verwerfen es weiterhin. Die Übernahme leert den Autorenrecord-Cache und setzt
die normalen Detailaufträge fort; sie führt keinen weiteren Mesh-Upload aus.
[Regressionen und native Folgezüge](../reference/atlas-live-source-handoff-20261022/README.md)
belegen den begrenzten Übergang und die weiterhin offenen Latenzen.


### Begrenzte Abtastfelder für Live-Farben

`TerrainProjectionCache.colorFieldSteps` verwendet den vorhandenen atomaren
Gittercache auch für exakte Wasserentscheidungen kleiner Live-Bilder bis
64 Pixel. `TerrainCache` hält dafür eine zweite LRU-Reihenfolge mit eigener
Obergrenze innerhalb desselben Gesamtbudgets; gewöhnliche Einträge ändern ihr
Verhalten ohne solche Felder nicht. `AtlasRegionReader.navigationTerrain` und
der normale Farblader geben diese Felder vor normaler Navigation wieder frei.
`liveTerrainSteps` umgeht diese Übergabe, damit feine Live-Antworten den nächsten
Pinselstand nicht entwerten. [Numerische, Speicher- und Bediennachweise](../reference/atlas-coarse-field-cache-20261022/README.md)
halten vermiedene Arbeit und noch offene Latenzen getrennt fest.

[Örtliche Bewuchslesungen](../reference/atlas-local-region-reads-20261022/README.md):
`readVegetationEnvironment` vereinigt globale Einstellungen und örtliche Bounds
über vorhandene Indizes, mit Zeilennummer zur Deduplizierung und Malreihenfolge.
Die volle Weltübersicht bleibt ein offener Engpass. Der erprobte freie Join
bei Raumtreffern wurde wegen einer Regression für große Einzelbestände verworfen.

[Waldsignatur im normalen Atlas](../reference/atlas-forest-integration-20261022/README.md): Der semantische Waldkanal folgt jetzt Farbe, Revision, Detailkacheln und lokalen Pinselpatches durch dieselben begrenzten Caches. Der Produktshader blendet weltverankerte Muster weich bis zu nahen Einzelbäumen aus; Hauptkamera und PNG-Ausgabe teilen die Darstellung. Gestaltung, volle Welt und Pentium-Leistung bleiben offen.

[Billigere Detailübernahme](../reference/atlas-detail-retention-20261022/README.md): Weltverankerte Zeilenkopien ersetzen die vollständige RGBA-Pixelschleife bei gleichem Raster; echte Maßstabwechsel übernehmen wiederholte Zeilen und gepackte Farbwerte. Extrem große Sampleindizes können nicht mehr in alte Bildbereiche überlaufen. Pixelgegenprobe und native Messungen sind getrennt dokumentiert; unmittelbare Weltbearbeitung bleibt offen.

[Gebündelte Bindungsmetadaten](../reference/atlas-binding-metadata-20261022/README.md): Grenzen und Scope-Namen kommen mit dem Bindungsread aus demselben Snapshot. Tausende separate Abfragen entfallen; Geometrie-Rtree, Geschosswahl, leere Autorrahmen und Ergebnisdarstellung bleiben erhalten. Die gesamte Wartezeit nach großen Strichen ist dadurch noch nicht nachweisbar kürzer; nicht unterbrechbare Regionsreads bleiben offen.

[Überholte Kameraausschnitte abbrechen](../reference/atlas-region-cancellation-20261022/README.md): Der normale Atlas ersetzt laufende Abfragen bei geänderter Zielauflösung oder verlassenem Puffer. Gemeinsame Abbruchsignale beenden alte Workerlesungen zwischen Objekten und erhalten den Weltindex. Ergebnisse, Auswahl und Export sind gegengeprüft; aktuelle Regionsreads und lange Zeichenpausen bleiben zu teuer.

[Tatsächliche Geometrie beim Zoom und einmalige Rasterlesung](../reference/atlas-geometry-stream-20261022/README.md): Automatische Raumgruppenmarker entfallen; subpixelkleine Geometrie bleibt per Suche erreichbar. Dichte Bereiche werden in einem Durchlauf gerastert, Raumstil-SQL wird pro Verbindung vorbereitet. Bildgleichheit des Rasterumbaus, normaler Atlas und große Welt sind getrennt geprüft. Mittlere dichte Geometrie, wiederholte Bereichsanfragen und unmittelbare Bearbeitung bleiben offene Engpässe.

[Laufende Bereichsanfragen erhalten](../reference/atlas-region-request-reuse-20261022/README.md): Gelände-Neuzeichnung und veraltete Terrainantworten ersetzen keine bereits passende Regionslesung mehr. Echte Kamera- und Grafikwechsel behalten ihren eigenen Aktualisierungsweg. Die große Weltprobe reduziert unbeabsichtigte Abbrüche; 3,84 Sekunden bis zur erneuten Bearbeitbarkeit und lange Rendererpausen bleiben deutlich über dem Ziel.

[Leere Objektraster auslassen](../reference/atlas-empty-object-tiles-20261022/README.md): Der dichte Weltmaßstab überspringt Rasterdurchlauf und PNG-Kodierung, wenn die vorhandenen Sichtbarkeitsregeln keine Objektpixel zulassen. Namen, Treffer, Referenzbilder und geschützte Bäume bleiben erhalten. Die isolierte Weltlesung sinkt von 622 auf 276 ms; 3,41 s bis zur erneuten Bearbeitbarkeit und Rendererpausen bleiben über dem Ziel.

[Unsichtbare Straßen später aufbauen](../reference/atlas-deferred-routes-20261022/README.md): Der normale Atlas erzeugt Geometrie sicher unsichtbarer Bodentrassen erst beim Heranzoomen aus aktuellen geladenen Daten. Geplante Trassen, Auswahl und hochaufgelöste Ausgabe bleiben erhalten. Die gemessenen Straßenaufbauten in langen Pinselabschluss-Aufgaben entfallen; Netz-/GPU-Arbeit und mehrsekündige Gesamtwartezeiten bleiben offen.

[Geländenetz und Shader wiederverwenden](../reference/atlas-terrain-mesh-reuse-20261022/README.md): Weltgrenzen und Bildgrößen ersetzen nicht mehr die ganze GPU-Szene. Topologie, Texturen und Draftpuffer besitzen getrennte Lebenszyklen; numerisches Picking kopiert keine Rendergeometrie. Sieben native GPU-Vergleiche bleiben pixelgleich, die längste gemessene Weltaufgabe sinkt von 311 auf 169 ms. Mehrsekündige Bearbeitungsfreigabe und Zielgeräteprüfung bleiben offen.

[Gruppen- oder räumlichen Index zuerst lesen](../reference/atlas-owner-candidate-cost-20261022/README.md):
`AtlasRegionReader.candidates` begrenzt die Größenprüfung auf 129 Einträge.
Kleine Raumgruppen beginnen im Gruppenindex, große Sammlungen im Rtree; beide
verwenden identische räumliche Grenzen. Die Regression prüft viele Gebäude mit
überlappenden lokalen Koordinaten sowie Wachstum zum großen Einzelbesitzer.

## Gelände-Radierer und Pinselgeometrie

Der Gelände-Radierer entfernt die tatsächliche Vegetationsfläche samt ihrem
Bodenauftrag. Er erzeugt keine dauerhafte Freihaltemaske.
`vegetation-erase.ts` berechnet die Restfläche; der bestehende Speicherbefehl
übernimmt History, Revisionen und die atomare Aktualisierung.
`landscape-polygon-clipping.ts` kapselt robuste Integer-Geometrie: lokale
Koordinaten, direkte Verbreiterung runder Striche, begrenzte Pfadvereinfachung
und die Erhaltung von Löchern. Die übrigen Polygonoperationen werden dadurch
nicht pauschal ausgetauscht. [Fehler, Varianten und Prüfungen](../reference/atlas-terrain-eraser-20261022/README.md).

## Frühere Messungen und Versuche

Die folgenden Berichte beschreiben datierte Teilstände und offene Grenzen.
Sie ersetzen weder aktuelle Regressionen noch die Produktabnahme.

Zieländerung vom 20.10.2026: Die [Roadmap für den gemeinsamen räumlichen Atlas](../plans/maps/unified-spatial-atlas.md) ersetzt getrennte Drauf-/Kippdarstellung durch eine gemeinsame perspektivische Kamera. Der Anschluss nutzt die vorhandenen Atlaswerkzeuge; die folgenden Teilbelege ersetzen noch keine vollständige Produktabnahme.

[GPU-Varianten und verworfene Netzverdichtung](../reference/atlas-gpu-alternatives-20261022/README.md):
gepaarte Komponentenmessung, fast gleiche GPU-Bilder, aber kein belegter Gewinn
in der vollständigen Navigation und langsamerer erster Sculpt-Lauf. Der Prototyp
wurde entfernt; grundlegende Architekturalternativen bleiben ausdrücklich offen.

[Kartenrenderer-Vergleich](../reference/atlas-renderer-comparison-20261022/README.md):
MapLibre mit eigener Meterprojektion, lokale Welt- bis Gebäudeprobe und
kontrollierte CPU-/GPU-Messung. Kein Architekturwechsel angenommen;
Bearbeitung, Innenräume und gleichwertige Vollweltlast bleiben offen.

[Autorenwelt mit Küstenkomposition](../reference/atlas-world-authoring-coast-20261022/README.md):
normaler Atlas von Kontinenten bis zu sechs Gebäuden und 95 Räumen,
Neustart bestanden; sporadischer Freihalten-Fehler und visuelle Lücken offen.

[Zweite Architekturprobe mit deck.gl](../reference/atlas-deck-comparison-20261022/README.md):
gekacheltes Terrain und freie Kamera; synthetische Messung, Beschriftungs- und
Darstellungsgrenzen sowie korrigierte Fixturefehler. Kein Produktwechsel.

[Präsentationspfad und native Prüfplattform](../reference/atlas-presentation-platform-20261022/README.md):
X11-/Wayland-Gegenprobe mit voller Welt, Chromium-Trace und Korrektur des
erzwungenen X11-Teststarts. Lange Ausreißer und die Pentium-Qualifikation bleiben offen.

[Verworfener Ausschnittsgrößen-Cache](../reference/atlas-viewport-size-20261022/README.md):
erzwungene Layoutarbeit wanderte zu anderen Lesern; kein belastbarer Gesamtgewinn.
Produktversuch entfernt, native Größen-/Trefferregression und Rohvergleich erhalten.

[Styleinvalidierung bei der Navigation](../reference/atlas-style-invalidation-20261022/README.md):
vorhandener Atlaszustand ersetzt die globale CSS-Abfrage; gleiche Meldungstexte
behalten ihre DOM-Knoten. Weniger Layoutunterbrechungen und ein besserer
Navigationslauf; Sculpt, Eingabe-Pixel-Latenz und Pentium-Abnahme bleiben offen.

[Begrenzte Eingangsprojektion](../reference/atlas-scoped-entrances-20261022/README.md):
Weltantworten enthalten nur Eingänge gelieferter Raumgruppen und die aktuelle
Reiseauswahl. Kanonische Reiseprüfungen bleiben vollständig; 5.000 entfernte
Eingänge entfallen aus der Weltantwort. Native Reiseprobe und Größenvergleich.

Entwicklervertrag für die gemeinsame Atlasfläche. Code besitzt Implementierung
und veränderliche Budgets; diese Seite verbindet Zuständigkeiten und Schutzregeln.
Nach dem Codeeinstieg nur den betroffenen Abschnitt lesen; Zahlenbudgets direkt
beim genannten Besitzer nachschlagen. Fachumfang und Speichergrenze bleiben im [Runtimeplan](../../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md).

[Direkte Höhenarbeitsfassung und große native Welt](../reference/atlas-direct-draft-20261021/README.md): begrenztes geladenes Raster, GPU-Küsten und Rückkehr zur bestätigten Revision. 108.076 Landschaftsobjekte funktional geprüft; unmittelbare Reaktion und vollständige Detailverfeinerung bleiben offen.

[Grundflächen nach Farbsamples filtern](../reference/atlas-base-samples-20261021/README.md): Bildgleichheit und begrenzte Nutzdaten für die Weltübersicht; getrennte Phasenmessung und weiterhin fehlgeschlagene vollständige Detailverfeinerung.

[Kleine Indizes für Geländelesungen](../reference/atlas-terrain-kind-index-20261021/README.md): partielle Metadatenindizes für Höhen, Trassen und Seen, exakte Zeilennummern bei lokalen Änderungen und erneuter Autorenweg bis zum Gebäude.

[Cursor und Trassen wiederverwenden](../reference/atlas-render-reuse-20261021/README.md): dauerhafte Cursorressourcen, unveränderte Trassenmatrizen und Sichtbarkeitsprüfung nur bei geänderter Kamera; GPU-Bildvergleich und große Weltprobe.

[Farbkacheln im vorhandenen Cache halten](../reference/atlas-color-cache-context-20261021/README.md): kompakte Stil-/Straßenidentität statt wiederholter Metadaten je Pixelstück; Bildgleichheit, Cache-Druck und vollständige Weltansicht.

[Sichtbare Pinselreaktion messen](../reference/atlas-brush-response-measurement-20261021/README.md): Vergleich der Pinselinnenfläche zusätzlich zur kleinen Mitte, begrenztes asynchrones GPU-Auslesen und getrennte Profilingläufe. Die unmittelbare Reaktion der vollen Welt bleibt offen.

[Pinselanzeige unabhängig aktualisieren](../reference/atlas-brush-overlay-20261021/README.md): Hover und direkte Pinselgesten verwenden den bestehenden Overlay-Weg. Speicherstatus aktualisiert während einer aktiven GPU-Präsentation die Bedienelemente; die unveränderte Kartenszene bleibt erhalten. Abschluss und Canvas-Fallback veröffentlichen weiter vollständige Szenen.

Höhenvorschau und Schreibwünsche teilen außerdem [einen Animationsauftrag](../reference/atlas-brush-frame-20261022/README.md).
Stationäres Malen bleibt während laufender Speicherung sichtbar; deren Bestätigung
startet keinen zweiten Höhenaufbau im gleichen Frame. Der Bericht trennt die
beseitigte Doppelarbeit von weiterhin offenen Bildraten- und Latenzzielen.

[Glätten ohne erneutes Laden](../reference/atlas-smooth-ready-20261022/README.md):
Werkzeugwahl und Pinselradius gehören nicht zur Geometrieidentität. Verfügbare Höhen
und laufende Detailverfeinerung bleiben erhalten; frühe Gesten werden beim Wechsel
auf Smooth nicht mehr durch einen unnötigen Neuaufbau verworfen.

[Höhenlinien-Referenzvergleich](../reference/atlas-contour-reference-20261022/README.md):
Ein einzelner steiler Hang vergröbert das Intervall des ganzen Ausschnitts.
Mittelwert, Median und Variationsgewichtung sind mit gleicher Geometrie verglichen;
als Intervallgeber nach Nutzerkorrektur verworfen. Nächster Schritt: feste
Höhenstufen nur nach Kartenmaßstab auswählen; Produktregel mit 256-m-Obergrenze, native Gegenprobe und Vollweltgrenzen stehen im [Umsetzungsbericht](../reference/atlas-fixed-contours-20261022/README.md).

[Navigation gemeinsam zeichnen](../reference/atlas-navigation-frame-20261021/README.md): sofort aktuelle Kamerastrahlen, gemeinsame GPU-Zeichnung von Karteninhalt und Hilfsebene, Trefferfreigabe erst nach erfolgreichem Abschluss. Zwölf Kameraposen pixelgleich; große Welt weiterhin unter dem Leistungsziel.

[Navigation während des Pinselabschlusses](../reference/atlas-navigation-pending-20261021/README.md): nach Loslassen freie Kamera bei weiterhin geschütztem Schreibbesitzer. Ausdrückliches Verschieben benötigt keine geladenen Autorentreffer; Pose und Terrain-Verfeinerung besitzen getrennte Sperren. Verzögerte echte Commit-/Terrainantworten und der große Weltfall nativ geprüft.

[Aktuelle Kamera im selben Animationsschritt](../reference/atlas-camera-frame-latency-20261021/README.md): `AtlasCanvas` berechnet Zoom und zeichnet Karte/Hilfsebene in einem gemeinsamen RAF-Auftrag. Im großen Weltfall sinken Zeichnungen mit vorheriger Kamera von 65 auf null; Bildratenziel und vollständige Weltqualifikation bleiben offen.

[Landschaftsschreiben und gemischte Welt](../reference/atlas-landscape-write-cost-20261021/README.md): vier vorbereitete SQL-Programme je Verbindung begrenzen wiederholte Allokationen im Writer. Beim Öffnen wartet die Arbeitsfläche nicht mehr auf das erste Atlasbild; Autorentreffer behalten ihre eigene Freigabe. Die gemischte Probe enthält 100.000 Geländezuordnungen, 5.000 eingerichtete Gebäude und einen großen Dungeon. Sie legt weiterhin langsames erstes Terrain und eine Pause nach dem großen Pinselzug offen; sie ist keine vollständige Leistungsabnahme.

[Sicherungsprüfung im Hintergrund](../reference/atlas-backup-worker-20261021/README.md): die große Weltprobe identifizierte über eine Minute synchrone Snapshotprüfung im Hauptprozess. Die vollständige Prüfung läuft nun in einem Readonly-Worker; kanonische Schreib-/Historyarbeit bleibt ein gemessener Engpass.


## Eingangsmarker und Gebäudevolumen

`terrain-objects.ts` hält Eingänge als Höhenanker ohne Grundfläche. Der normale
Atlas zeichnet und trifft ihren vorhandenen Marker; `terrain-object-view.ts`
erzeugt ausschließlich Gebäudevolumen. Eine zusätzliche Eingangswand oder
Dachhöhe würde den Marker von seiner kanonischen Höhe versetzen.
[Native Gegenprobe, Höhenbearbeitung und Wiederöffnung](../reference/atlas-entrance-marker-20261023/README.md).
