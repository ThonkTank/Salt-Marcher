# Straßen, Flüsse und Landschaftspinsel

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-28 (gemeinsame See-/Umlandanhebung; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Beauftragter Ausbau vom 19.10.2026. Städte, Symbole, Generator und Heightmap-Import sind ausgeschlossen. Die ursprüngliche Lieferung ließ bestehende Karten unverändert; die unten beschriebene Landmasken-Umstellung übernimmt nun explizite Gelände-/Wasserflächen.

## Bedienung und Daten

Für das neue Höhenmodell ergänzt [Geländegebundene Straßen und Flüsse](terrain-routes.md) einen gemeinsamen Planungseditor mit Start-/Zwischen-/Zielpunkten, begrenzten Erdarbeiten, Bauwerken und Schutz bei späteren Geländeänderungen. Die folgenden freien Linienfunktionen gelten weiterhin für Objekte ohne geplantes Höhenprofil.

Straßen und Flüsse speichern Weltmeter-Kontrollpunkte und optionale `line.version = 1`: Kurve, Farbe, Rauheit, Mäander, Quellverjüngung, Zufallsstart, Straßenmuster und Zeichenebene. Die zehn Straßenmuster bilden die sichtbaren Referenzvorschauen mit eigener Geometrie nach; proprietäre Assets werden nicht übernommen. Neue Vorgaben und ausgewählte Objekte besitzen getrennte Kontrollen. Umschalt-Klick erweitert die Auswahl derselben Verlaufsart; Ziehen verschiebt die ganze Auswahl. Breite/Stil lassen sich ausdrücklich gemeinsam anwenden. Punktaktionen bleiben erhalten. Teilen speichert angrenzende Tangenten und den bisherigen Verlaufabstand.

Land hinzufügen/radieren, Küste anheben/absenken und Süßwasser hinzufügen/radieren sind Wirkungen des Geländepinsels. Küstenänderungen betreffen nur den berührten Rand. Süßwasser gräbt ein Seebecken und füllt es gleichzeitig. Die Radierung entfernt Wasser und füllt ausschließlich den zugeordneten Seeabtrag wieder auf; spätere unabhängige Geländeänderungen bleiben erhalten. Eigenschaften und gezieltes Zurücksetzen verwenden freie metrische Flächen.

Gelände- und Wasserfarbe speichern `paint.version = 1` ohne Spielwerte: Ziel, Farbe, Deckkraft, Auftragsstärke, Spitze, Radius, Zufallsstart und Strichpunkte. Auftragsstärke akkumuliert innerhalb eines Strichs; Deckkraft begrenzt den gesamten Auftrag. Füllen verwendet die zusammenhängende angelegte Land-/Wasserfläche. Farbmasken richten sich nach der aktuellen Wasserverteilung. Die Pipette liest den sichtbaren Kartenpixel; die Palette bleibt lokal erhalten. Farbradierer beschneiden nur Farbflächen.

Pinselzüge schließen beim Loslassen ab. Punktfolgen schließen per Rechtsklick oder Enter ab. Escape verwirft, Backspace entfernt den letzten Entwurfspunkt; Texteingaben bleiben geschützt. Eine Transaktion bildet einen Undo-Schritt. Bei einem Schreibfehler bleiben Entwurf und einzelne Pinselzüge erhalten; ein erneuter Versuch verbindet getrennte Züge nicht miteinander.

Streckenmessung, Maßstabsleiste und reale Größenvergleiche verwenden denselben
Entfernungsformatierer: deutsche Zahlendarstellung und drei signifikante Stellen
für Meter/Kilometer und Meilen. Kleine positive Strecken werden dadurch nicht
auf null gerundet. Messung und Formatierung ändern keine Weltkoordinaten. Ein abgeschlossenes
Messergebnis bleibt bis zum Verwerfen oder Werkzeugwechsel sichtbar; der
automatische Hex-Hinweis überschreibt es nicht.
`tools/test-desktop-atlas-distance.mjs` prüft den integrierten metrischen Ablauf
mit Wegkorrektur, Messung, PNG-Ausgabe und Neustart. Die noch nicht integrierte
DnD-/Metrik-Umschaltung und weitere Live-Geometriemaße sind davon nicht abgenommen.

## Implementierung und Grenzen

`landscape-line.ts` erzeugt deterministische numerische Geometrie für Vorschau, Canvas, SVG-Adapter, Rasterübersicht, Export und genaue Abfragen. Bounds umfassen die erzeugte Kurve und ihre Breite. Datensätze ohne neue Optionen verwenden weiterhin ihre ursprünglichen Linien und Zeichenreihenfolgen. `landscape-brush.ts` speichert örtliche Polygonmasken; berechnet werden ausschließlich angeforderte Rasterkacheln. Es gibt keine weltgroße Farbfläche.

Die vorhandene SQLite-Schreibgrenze, Receipts, Undo/Redo, Archive und Wiederherstellung tragen die neuen optionalen Felder unverändert. Mehrfachbearbeitung und Radierung sind atomar. Kurven sind auf 2000 Kontrollpunkte begrenzt, Farbzüge auf 4000 Abdrücke, Füllen auf 10000 Autorenflächen. Extreme Pfeil-/Schraffurverläufe begrenzen die Anzahl ihrer Muster auf 2000; die Verteilung bleibt kameraunabhängig.

### Seebeckenpinsel

`terrain-lake-brush.ts` ist der gemeinsame reine Operator für Live-Entwurf und
kanonischen Worker. Radius und weicher Rand bestimmen die Form, Stärke in m/s
und tatsächliche Einwirkzeit den Abtrag, auch bei stillstehender Spitze. Der
Pegel wird am Anfang der Geste eingefroren: ein ausdrücklich eingegebener Pegel,
der Pegel einer dort vorhandenen Seefläche oder die Bodenhöhe des ersten Punktes.
Der frühere automatische Zuschlag von einem Meter entfällt.

Die Bodenhöhen bleiben ausschließlich in den vorhandenen Höhenkacheln. Das
Wasserobjekt trägt unter `lakeBed` die zugehörigen tatsächlich abgetragenen
Knotenanteile samt Kachelkennung und Auflösung als Herkunftsinformation. Die
Radierung nimmt alle betroffenen Auflösungen zurück und verkleinert Wasserfläche
und Herkunft gemeinsam. Sie wirkt im bestrichenen Bereich vollständig und
addiert den eigenen Abtrag zu den aktuellen Höhen. Ein abgeschlossener Zug
schreibt Höhe, Wasser und Herkunft atomar in genau einem Historyschritt; Queue,
Receipts und Recovery besitzen weiterhin Bestätigung und Wiederaufnahme.

Der sichtbare Wasserspiegel wird weiterhin durch Autorenfläche und Bodenhöhe
begrenzt. Eine Überlauf-/Einzugsgebietssimulation und das gemeinsame Anheben von
See und Umland sind spätere Arbeit. Gezielte Regressionen stehen in
`tests/atlas/terrain-brush.test.mjs`, `tests/atlas/landscape-brush.test.mjs` und
`tests/atlas/terrain-brush-draft.test.mjs`; die native Eingabeprobe ist
`tools/test-desktop-terrain-lakes.mjs`. Testverknüpfungen ersetzen keine Nutzerabnahme.

## Vergleich und Nachweise

Die ursprünglichen Fälle WD-005–007 und WD-009–012 bleiben erhalten. Wasserfarbe gehört zusätzlich zum vorhandenen WD-008. Kein ursprünglicher Abnahmestatus wird durch Implementierung oder Unit-Tests ersetzt.

| Paket | Bestehende Fälle | Gezielte Prüfung |
| --- | --- | --- |
| Kurvenbasis und Bearbeitung | WD-012.01–02 | Weltkoordinaten, Teilung ohne Kurvenwechsel, Verschieben, Batchkonflikt, Undo/Redo |
| Straßen | WD-011.01–02 | Zehn numerische Stile, getrennte Vorgaben, Ebene, lange schmale Verläufe |
| Flüsse | WD-010.01–03 | Breite, Quellverjüngung, deterministische Mäander, Kurvenabfrage und Endpunktanschluss |
| Land und Süßwasser | WD-005.01–02, WD-006.01–02, WD-009.01–02 | Küste erweitern/zurückdrängen, Radierung legt Originalgelände frei |
| Farbpinsel | WD-007.01–02, WD-008.01–02 | Drei Spitzen, getrennte Spielwerte, Wasser-/Landmaske, Auftragsstärke/Deckkraft, Füllen, Radieren, Archivkopie |

Automatische Regression: `tests/atlas/desktop-landscape-tools.test.mjs`, vorhandene Atlas-Region-/Frame-/Landschaftstests. Native Prüfung: `tools/test-desktop-landscape-tools.mjs` startet eine synthetische Kampagne in einem eigenen Datenordner und prüft echte Eingaben, Abschluss, Abbruch, Neustart, Bearbeitung und PNG-Ausgabe. `ATLAS_PACKAGE` richtet dieselbe Probe auf die installierte Kopie. Ergebnisse liegen unter dem durch `QA_EVIDENCE_DIR` bestimmten Verzeichnis.

Direkte Referenz: Wonderdraft 1.1.8.2 unter `/opt/Wonderdraft/Wonderdraft.x86_64`. Die isolierte Optionssitzung `/tmp/wonderdraft-options-bssu1c` zeigt erneut zehn Pfadvorschauen sowie Farbe, Breite, Rauheit und Zeichenebene (`path-options.png`). Dies ist ein Oberflächenbeleg. Die zuvor abgestürzte Wirkungsprobe bleibt fehlgeschlagen; die Optionssitzung liefert keinen abgeschlossenen Vorher-/Nachher-/Wiederöffnungsvergleich. Exakte Originalwirkungen von Rauheit, Mäanderabstand, Spitzen und Übergängen sowie vollständige grafische Gleichwertigkeit bleiben offen. Installation und bestandene Hostprüfungen allein schließen diese Paritätsabnahme nicht ab.


## Landmaske und vier Landpinsel · 19.10.2026

Dieser Ausbau ersetzt die oben beschriebene polygonbasierte Land-/Küstenbearbeitung. Unbearbeiteter Atlas ist Wasser. Land zeichnen, Land radieren, Fraktal erhöhen und Fraktal absenken bearbeiten eine gemeinsame kontinuierliche Maske; die Schwelle 32768 trennt Wasser von Land. Geografische Höhe bleibt unabhängig. Fraktale Pinsel wirken nach Einwirkzeit, auch ohne Bewegung und fern bestehender Küsten. Schnelles Streichen kann unter der sichtbaren Schwelle bleiben; diese Zwischenwerte bleiben gespeichert.

`land-mask.ts` enthält den gemeinsamen Pinselkern und verlustfreie 16-Bit-RLE-Kacheln mit 256 × 256 Werten. Weltkoordinaten und Zweierpotenz-Auflösungen erlauben unbegrenztes Schwenken und lokale Verfeinerung. Große Züge bearbeiten vorhandene feinere Kacheln mit. Kacheln sind normale `atlas_landscape`-Records mit `mask.version = 1`; ihre Rechtecke dienen ausschließlich der Bereichsabfrage. Die vorhandenen Transaktionen, History, Journale, Bereichsframes und Archive bleiben zuständig. Vorschauen lesen begrenzte Originalausschnitte ohne TEMP-Indexaufbau, damit der Quellen-Fence unverändert bleibt. Kamera und Export nutzen abgeleitete Raster, Punktabfragen die Originalwerte.

Vier direkte Schalter, getrennte Größen für Land und Radierer sowie gemeinsame Größe/Rauheit für die Fraktalpinsel. Rauheit 0,1–2, Vorgabe 1; Größen in Weltmetern. Loslassen speichert einen Undo-Schritt, Escape verwirft. Stationäre Eingaben und zusammengefasste Pointerereignisse behalten ihre tatsächlichen Zeitstempel. Ein gescheiterter Schreibversuch behält die unveränderte Eingabe zum Wiederholen.

Gezielte Regression: `tests/atlas/desktop-land-mask.test.mjs`. Native Probe: `tools/test-desktop-land-mask.mjs`, auch mit `ATLAS_PACKAGE` auf einer gepackten Installation. Originalvergleich: Wonderdraft 1.1.8.2, vier Pinsel einschließlich schneller/langsamer Bewegung, Halten, Undo/Redo, Wiederöffnen und offiziell extrahierter Maskendaten. Die Originalimplementierung ist unbekannt; Verhalten und Formwirkung werden verglichen, keine identischen Pixel oder vollständige Wonderdraft-Parität behauptet.


### Küstenkontur und unbemaltes Land

Landmasken zeigen eine neutrale Grundfläche ohne automatisch aufgetragene Geländefarbe. Die für Reisen verwendete Vorgabe „Ebene“ bleibt davon unabhängig; ausdrücklich gesetzte Geländearten und Farbpinsel behalten ihre Farben. Die schmale Küstenlinie und ein landseitiger Saum werden aus der wirksamen Land-/Wasserbelegung abgeleitet, auch um Binnengewässer, über Farbe und unter Flüssen/Objekten. Sie erzeugen keine gespeicherten Flächen oder zusätzlichen Undo-Schritte. Ein mitgelesener Rand um jede Darstellungskachel verhindert künstliche Küsten an Kachelgrenzen. Vorschau, Bereichsframe und PNG nutzen denselben Renderer. Die Anzeige erhält die 1024-Pixel-Landschaftskacheln; Bildvorlagen bleiben auf 512 Pixel begrenzt.

Referenz sind die lokal aufgenommenen Wonderdraft-Bilder aus `wonderdraft-four-land-brushes-20261019` und die offizielle Extraktion in `wonderdraft-land-format-20261019`: die unbemalte `ground.png` enthält ausschließlich transparentes RGBA (0,0,0,0); Küstenkontur und Grundtextur gehören zur Darstellung. SaltMarcher übernimmt keine Originaltexturen. Regressionen: `desktop-coast-render.test.mjs`, `desktop-atlas-canvas.test.mjs` und bestehende Landschafts-/Bereichstests; die native Pinselprobe prüft nun zusätzlich tatsächliche Fensterpixel für neutrale Fläche und schmale Küstenkante. Keine zusätzliche Datenmigration.

### Nachprüfung bewegter Originalpinsel

Der [Originalversuch mit 25 zeitgesteuerten Zügen](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/wonderdraft-moving-fractals-20261019/README.md) ergänzt die früheren stationären und kurzen Bewegungsproben: schnelle/langsame Geraden und S-Kurven, Umkehr und wiederholte Überfahrten für beide Fraktalpinsel sowie schnelle Land-/Radierzüge. Er belegt die Originalwirkung, keine SaltMarcher-Gleichwertigkeit. Die neue SaltMarcher-Diagnose `tools/test-desktop-fractal-strokes.mjs` scheiterte bereits am ersten Geschwindigkeitsvergleich: 700 ms vorgesehen, 53248 ms empfangen. Sie prüft nun die tatsächliche Dauer vor Wirkungsbehauptungen. Ursache und erfolgreicher Vergleich mit passenden Pinsel-/Streckenverhältnissen bleiben offen; daraus folgt keine abgeschlossene Bewegungsabnahme.


### Trennung von Landform und Farbe · 19.10.2026

Die aktuelle Bedienung ersetzt die oben beschriebenen vier Schalter und den gemischten Geländepinsel: **Land** besitzt Größe, Rauheit und Hinzufügen/Radieren. Rauheit 0 ist ein fester runder Pinsel ohne Abschwächung; positive Rauheit verwendet den zeitabhängigen Fraktalkern. **Farbe** besitzt einen eigenen Malen/Radieren-Schalter, Ziel Land/Wasser, drei Spitzen, Deckkraft, Auftragsstärke, Palette, Pipette und Füllen. Beide Werkzeuge merken ihre Größe getrennt. Eigenschaften und Süßwasser sind eigene Werkzeuge.

Neue Eigenschaftsflächen verändern Spielwerte, ohne Land zu erzeugen oder Farbe aufzutragen. Eigenschaftsauftrag und Zurücksetzen verwenden wie Süßwasser den gemeinsamen `brushFootprint`-Kern: runde Enden und verbundene Flächen auch bei weit auseinanderliegenden Eingabepunkten. Neue runde Eigenschaftsflächen verwenden damit dieselbe 24-Punkt-Kontur; gespeicherte Konturen werden nicht umgerechnet. Bestehende Gelände-/Farbdatensätze behalten ihre Darstellung. Neue Farbe (`paint.version = 2`) wird beim Auftrag auf die damals vorhandene Zielfläche begrenzt: über Wasser geführte Landfarbe färbt später erstelltes Land nicht nachträglich. Farbe auf entferntem und wiederhergestelltem Land bleibt erhalten. Der Farbradierer entfernt Pigment mit Spitze, Deckkraft und Auftragsstärke aus der eigenen Farbschicht; die Landmaske bleibt unverändert. Füllen bietet zusammenhängende Fläche oder alle Landflächen; Wasserfüllung bleibt auf geschlossene Seen begrenzt.

Getrennte Land-/Farbaufträge laufen durch dieselbe atomare Speichergrenze und History. Vorschaugeometrie und Rasterberechnung laufen in einem Browser-Worker; nur das fertige Bild wird im UI übernommen. Der eingeschränkte App-Protokollhandler gibt genau diese zusätzliche Workerdatei frei.

Zusätzliche Regression: `desktop-land-color-separation.test.mjs` prüft neutrale harte Landform, getrennte Eigenschaften, partielle Farbradierung, drei Spitzen, Zielmasken, spätere Landbildung, Wiederherstellung, Flächenfüllung, Vorschau/Commit, atomare Validierung und Format-/Archivübernahme. `test-desktop-land-mask.mjs` prüft außerdem den tatsächlichen Farbwerkzeugwechsel, Radierung, Fensterpixel, Undo/Redo und Abbruch. Die Bewegungsprobe verwendet native XTEST-Eingaben unabhängig von Chromium-Bestätigungen und protokolliert auch zusammengefasste Pointer-Samples; Zeitabweichungen werden weiterhin vor einer Wirkungsbewertung abgelehnt.


Lokaler Prüfstand dieser Umsetzung: 138 gezielte automatisierte Prüfungen bestanden, einschließlich bestehender Atlas-Regionen, Canvas und Desktopoberfläche; TypeScript für App/Desktop und beide Builds bestanden. Die native Quellprüfung `land-color-separation-20261019/ui-source/result.json` bestand elf Fälle mit normalem Programmende, einschließlich sichtbarer Farb-/Radierwirkung, Speichern, Fehlerwiederholung und PNG. Paketprüfung und Installation werden getrennt im lokalen `installation-source.json` dokumentiert; dies ist keine Integration nach `main` und kein exact-SHA-CI-Nachweis.

## Höhenanschluss R1 (Format 49)

Für neue Geländearbeit ersetzt [Relief-R1](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-relief-r1-20261019/README.md) die oben historisch beschriebene Landmasken-Autorenschaft durch metrische Höhenkacheln. Land-/Radierwerkzeuge, Vorschau und Küsten lesen denselben Höhenkern. Meeresspiegel liegt in den Landschaftseinstellungen; Süßwasser speichert einen begrenzten Bereich mit Wasserstand. Farbe bleibt getrennt. Format-47/48-Befunde und Wonderdraft-Vergleiche bleiben historische Belege, keine Abnahme der neuen Höhenwerkzeuge. Die [R2-Höhenbearbeitung](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-relief-r2-20261019/README.md) ergänzt Anheben, Absenken, Glätten, Zielhöhe, Grundschattierung und Höhenlinien. Die [gezeichnete Reliefoptik R4](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-relief-r4-20261020/README.md) ist lokal umgesetzt und geprüft. [R5](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-tilted-atlas-r5-20261020/README.md) ergänzt die integrierte gekippte Ansicht mit denselben drei Landpinseln; Objekte/Höhennutzer und abschließende Leistung/Ausgabe bleiben R6/R7.


## Aktuelle Landwerkzeuge · R2 Vereinheitlichung, 20.10.2026

Die historischen Landmasken- und Vierpinselbeschreibungen oben werden für die aktuelle Bedienung durch drei Werkzeuge ersetzt: **Land formen** (Erhöhen/Absenken, Stärke, Roughness, optionale Zielhöhe), **Land bemalen** (einschließlich Farbradierung) und **Glätten**. Größe und weicher Rand bleiben einstellbar. Zielhöhe begrenzt die gewählte Richtung, Roughness verändert die unregelmäßige Wirkung unabhängig davon. Land und Meer folgen weiterhin Höhe und Meeresspiegel; Farbaufträge ändern keine Höhen. Geländeart, Hexfüllung und Rücksetzung bleiben in der eigenen Gruppe Geländedaten.

Die aktuelle native Prüfung ist `tools/test-desktop-terrain-brush.mjs`: Insel aus leerem Meer, Hügel, Hochfläche, Bucht, Glätten, sichtbare Farbe/Radierung, History, Abbruch, Speicherfehler, Export und Neustart. `tools/test-desktop-terrain-height.mjs` und die Landaktion der Layoutprobe verwenden ebenfalls die neue Bedienung. Ältere Vierpinsel-/Fraktalproben dokumentieren historische Operationsverträge und sind keine Qualifikation der drei neuen Werkzeuge. [Prüfbeleg](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/terrain-land-tools-20261020/README.md).


Die begrenzte native UI-Qualifikation `tools/test-desktop-terrain-brush.mjs
--preview-only` prüft sichtbare Wasserbildung bei gedrücktem Zeiger vor dem
Speichern, Pointer-up sowie Pixel- und Datenwiederherstellung mit Undo/Redo.
Sie verwendet die aktuelle lokale Rastervorschau (`AtlasSurfaceDraft`), nicht
den veralteten Text „Vorschau“ am Höhenwert. Die separate Browserworker-Probe
belegt dessen Protokollanschluss. Der begrenzte Modus behauptet keine erneute
Abnahme sämtlicher oben genannter R2-Abläufe oder des Feindetailschutzes.

Die gemeinsame [Formatpolitik](../../project/contract/data-format.md) ersetzt frühere Schema- und Migrationsangaben.

## Direkte Terrainformpinsel · 27.10.2026

**Hügel**, **Berge** und **Schlucht** sind direkt wählbare Formwerkzeuge innerhalb
von Land formen. Radius, Stärke in Metern pro Sekunde und weicher Rand bleiben
änderbar, ohne die Formauswahl zu verlieren. Die anfängliche Stärke folgt dem
tatsächlichen Weltradius; nachträgliche Eingaben bleiben ausdrücklich gesetzt.
Erhöhen, Absenken und Aufrauen
wechseln zurück zum jeweiligen Grundpinsel; Glätten bleibt direkt erreichbar.
Die früheren gleichnamigen radialen Parameter-Vorlagen entfallen.

Der unveränderliche Höhenauftrag trägt `form` und einen festen Seed. Ein
räumlich gleichmäßig abgetasteter, an Kurven leicht geglätteter Korridor verbindet
die ganze Geste. Weltgebundene Kuppen füllen das Hügelfeld; Berge besitzen einen
positiven Hauptkamm mit breiten Hängen und begrenzt ungleichen Gipfeln; Schluchten
einen schmalen Boden mit seitlich auslaufenden Böschungen. Halten verstärkt die
bestehende Form, Folgezüge verwenden dasselbe Weltfeld. Überlappungen addieren
Höhe beziehungsweise Tiefe mit weichen Rändern. Eine Formgeste wird im Livebild
vollständig aus ihrer festen Ausgangsfläche berechnet und verwendet dieselbe
Auswertung wie der kanonische Writer. Bestehende additive Höhenbänder,
Sichtbarkeit, Trassenschutz und die Speichergrenze in Main bleiben zuständig.

Formzüge verteilen ihre Wirkzeit über die zusammenhängende überstrichene Fläche.
Haltezeiten ändern die Stärke der bestehenden Form; sie erzeugen keine einzelnen
Lochstempel. Erneutes Überstreichen verstärkt die Form, während Weltfeld und
Randprofil erhalten bleiben.

Gezielte numerische Belege: `tests/atlas/terrain-form-brush.test.mjs`
(Form, Kurven, Kreuzung, Folgezug, Eventdichte, Halten, Rand, Live/Writer und
Grundkorrekturen), `tests/atlas/terrain-scale-worker.test.mjs` (Worker, Store,
History und Wiederöffnung) sowie `tests/atlas/atlas-brush-size.test.mjs`
(tatsächliche Formauswahl und Parametereingaben). Der bestehende native Ablauf
`tools/test-desktop-atlas-terrain-stroke.mjs --forms --scale=1` beziehungsweise
`--scale=2` prüft direkte Formzüge, überlappende Anschlüsse, Wirkung vor Loslassen,
kanonische Daten, Grundkorrekturen, Undo/Redo und reguläre Wiederöffnung.
Funktionsbelege ersetzen weder die spätere Darstellungs-/LOD- und
Leistungsqualifikation noch Paket-, Integrations- oder Nutzerabnahme.

## See und Umland gemeinsam anheben · 28.10.2026

Ein normaler Höhenzug hebt den horizontalen Seepegel um den gemeinsamen,
über der vollständigen Autorenfläche belegten Höhenanteil an. Überlappende
Seezüge gleichen Pegels bilden dafür einen Wasserkörper. Gleichmäßige +4 m
verschieben Land, Becken und Pegel gemeinsam; Tiefe und Ufer bleiben erhalten.
Bei ungleichmäßiger Wirkung gilt eine konservative Untergrenze, bei bloßer
Teilabdeckung bleibt der Pegel stehen. Wasser breitet sich nicht außerhalb
der Autorenfläche aus; Überlauf wird nicht simuliert.

`terrain-lake-coupling.ts` prüft sämtliche geometrisch geschnittenen
Interpolationszellen der betroffenen Höhenbänder. Konstante Translationen
werden exakt erkannt; andere Zellen verwenden gültige Hermite-Untergrenzen,
keine repräsentativen Höhenstichproben. Nicht belegbare positive Anteile
werden nicht zugesagt. Die vorhandenen Autorenpakete laden vollständige
Seegruppen und angeschlossene Verläufe. Liveentwurf, Browserworker-Vorschau
und kanonischer Höhenwriter verwenden denselben Operator. Erst werden
geschützte Höhenänderungen bestimmt, dann der endgültige Pegel und der
gemeinsame Verlauf geprüft. Ein nicht erhaltbarer geschützter Anschluss
weist den gesamten Zug mutationsfrei ab.

Der bestehende Höhenauftrag speichert Höhe und See gemeinsam mit einem
Historyschritt. Additive Anhebung verändert den zugeordneten Seeabtrag
nicht: spätere Seeradierung füllt das Becken und erhält die Anhebung.
Bei ausgeschaltetem Feindetailschutz führt die bestehende Abschwächung
feiner Höhenbänder deren Abtragsanteile mit, damit Radierung nicht überfüllt.

Gezielte Regressionen stehen in `tests/atlas/terrain-brush.test.mjs`,
`tests/atlas/terrain-brush-draft.test.mjs`,
`tests/atlas/terrain-author-cache.test.mjs` und
`tests/atlas/terrain-route.test.mjs`; `tests/atlas/terrain-scale-worker.test.mjs`
prüft den tatsächlichen Worker und die gemeinsame Receipt-Wiederholung.
Der begrenzte native Ablauf
`tools/test-desktop-terrain-lakes.mjs --lift --scale=1` beziehungsweise
`--scale=2` prüft gemeinsame Livewirkung, kanonische Höhen/Pegel,
Undo/Redo, Fresh und nachfolgende Seeradierung sowie einen lokalen Ablauf
an großen Weltkoordinaten. Die vollständige Welt-bis-Raum-Qualifikation,
Leistung, Gestaltung, Paketlieferung und Nutzerabnahme bleiben getrennt.
