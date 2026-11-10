# Architektur

`src/main.tsx` startet Atlas V7 in Tauri. React verarbeitet Eingaben und zeichnet
auf Canvas; Rust besitzt Dokument, Fachberechnung und SQLite. Der
[Produktvertrag](product-contract.md) definiert Verhalten, Format und Grenzen,
[README](../README.md) Einrichtung und Prüfablauf, [Status](implementation/status.md)
den zuletzt belegten Stand und offene Abnahmen.

Die folgenden V7-Besitzer und Zugriffspfade bleiben der Standard. Der gesonderte
[optionale P0-Versuch](#optionaler-atlas-p0-versuch) ergänzt einen begrenzten
Höhen- und Landschaftseditor, ohne den V7-Startpfad zu ersetzen.

## Besitzer und Datenfluss

| Besitzer                                     | Verantwortung                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DocumentWorker`                             | Dokumentthread und begrenzte FIFO für Desktop und Testbridge.                                                                                           |
| `atlas/application`                          | SQLite, Session, Revision, Änderungen und Dateigrenzen; eine Commandliste verbindet Dispatch und Typverträge.                                           |
| `interior`                                   | Reiner hauslokaler Solver für Räume, Zellen, Verbindungen und Zähler, ohne SQL oder Weltkoordinaten. Der Atlas-Adapter ergänzt Identität und Placement. |
| `documentQueue`, `useDocumentSession`        | Angenommene Writes, bestätigter Status, Dateireservierung und Abgleich unsicherer Ergebnisse; React-Anbindung.                                          |
| `editorWorkflow`, `EditorWorkflowController` | Entwürfe, unveränderliche Kandidaten, Vorschauen und Übernahme.                                                                                         |
| `PresentationLoader`, `presentationCache`    | Versionierte Reads, bestätigte Kacheln und Veröffentlichung sichtbarer Snapshots.                                                                       |
| `canvasScene`, `AtlasCanvas`                 | Reine Darstellungsprojektion, Ebenenreihenfolge und Zeichnen mit Kamera und DPR.                                                                        |

Der Hauptpfad lautet: Eingabe → Workflow/Queue → Dokumentworker → atomare Änderung
→ bestätigter Status und Darstellungskacheln → Präsentationscache → Canvas.
Native Dateidialoge liegen außerhalb des Workers; nach dem Dialog sichern Session
und Revision die Dateioperation ab. Beobachtungen des Zeichnens steuern keine
Dokumenttransaktion und keinen Workflowabschluss.

## Transaktionen, History und Dateien

`operations` berechnet Vorschau und Commit über denselben Fachpfad. `Computed`
normalisiert No-ops; `ChangeSet` enthält Vorher-/Nachherwerte für Objekte und
Feldpatches sowie Höhen, Boden, Regionen, Flüsse und Gewässer. Änderungen führen
abhängige Gewässer, Flussprofile und Oberflächen nach. Vorschauen überlagern
Autoren innerhalb einer zurückgerollten SQLite-Transaktion. Angeforderte
Oberflächenvorschauen schreiben dort auch die berechneten Gewässer und Flüsse
samt räumlichen Indizes vorübergehend. Ohne Oberflächenanfrage entfallen diese
zusätzlichen Writes. Commit, Undo und Redo
verwenden denselben Schreibpfad für Autoren, Indizes, Zähler und History; erst
nach erfolgreichem Abschluss wird die neue Revision veröffentlicht.

Direkte Höhenstriche besitzen `beginTerrainStroke`, `appendTerrainStroke` und
`endTerrainStroke`. Ihre Eingabefreigabe verwendet den bereiten Dokumentstatus,
nicht die Fertigstellung der Präsentationsreads nach einer Kamerabewegung.
Pfad, Autorenauflösung und Oberflächenanforderung entstehen aus der aktuellen
Kamera; Autorenwerte liest der Worker. Szenenabhängige Werkzeuge benötigen
weiterhin aktuelle Darstellungsdaten. `terrain_stroke` hält Identität, Paketfolge, Autorenauflösung
und Wegabtastungsrest. Jeder Abschnitt ist eine eigene abgeschlossene
SQL-Transaktion. Begin/Append antworten mit `TerrainAcknowledgement` aus Status
und optionalen geänderten Darstellungskacheln; End liefert Status. Die
Änderungshinweise derselben Transaktion berücksichtigen den Relief-Abtastrand.

Die temporäre History trennt Aktionskopf und geordnete Abschnittsdeltas.
Gewöhnliche Aktionen haben einen Abschnitt, direkte Striche mehrere unter
derselben Aktionsnummer. Undo verarbeitet sie rückwärts, Redo vorwärts in einer
gemeinsamen Transaktion. Eine transaktionale Schlüsselmenge prüft das
strichweite Kontrollwertlimit. Historybegrenzung und verworfene Redozweige
entfernen Abschnitte und Schlüssel per Fremdschlüssel-Kaskade. Die beobachtbaren
Abbruch-, Fehler- und Wiederholungsregeln stehen im Produktvertrag.

`storage` trennt Objekt-/Innenraumheader von Hauszellpayloads. Pose-, Metadaten-
und Grundstücksänderungen benötigen keine vollständigen Hauszellen.
`persistence` validiert einen unveränderlichen Importsnapshot vor Sessionwechsel;
Export ersetzt das Ziel über eine synchronisierte benachbarte temporäre Datei.
Beide Pfade halten höchstens einen vollständigen Hauszellpayload gleichzeitig.
Autorentabellen werden zeilenweise gelesen; `ImportIdentities` prüft globale IDs
und deren Höchstwert. Die Fachmodule validieren und rekonstruieren ihre Daten.

Arbeitsindizes sind abgeleitet und werden beim Import neu aufgebaut:
`terrain_blocks` vor dem Flussimport, die Bodenfarbpyramide nach dem Flussimport.
`ground_store` verwendet beim Wiederaufbau dieselbe Rundung vormultiplizierter
Farben wie bei interaktiven Writes. Elternraster entstehen vollständig aus vier
Kindquadranten; ein vorheriger Farb-Read des überschriebenen Elternrasters entfällt. Die Autorenkacheln tragen eine Auflösungsstufe.
Fehlende Kacheln erben vom nächsten gröberen Autor; vorhandene feinere Autoren
werden bei grobem Übermalen mit aktualisiert. Transparente Autoren und fehlende
Autoren sind auch in Historydeltas verschieden. `ground_lod` enthält ausschließlich
abgeleitete Übersichten; deren betroffene Vorfahren und vorhandene Nachfahren
werden nach Änderungen neu aufgelöst. Import hält Kachelschlüssel und jeweils
einen Eltern-/Kindfarbsatz, keine vollständige Sammlung aller Farbpixel.
SQLite kann Sortierspeicher benötigen.
Dateischema, gespeicherte Autoren und Importgrenzen sind ausschließlich unter
[Dateien und History](product-contract.md#dateien-und-history) festgelegt.

## Fachkerne und Zugriffspfade

| Module                                                                                | Aufgabe und Grenze                                                                                                                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operations`, `PlanContext`, `EditPlan`, `plans`, `follow_parcel`                     | Operationslokale Header-/Spatialabfragen; abhängige Änderungen gemeinsam planen und validieren.                                                    |
| `parcel_geometry`, `population`                                                       | Containment, Kollisionen und deterministische Rasterposensuche mit gemeinsamem Versuchsbudget; erst gültige Kandidaten reservieren Fläche und IDs. |
| `road_roughness`, `road_terrain`, `road_terrain_store`                                | Rauheit aus Grundkurven und begrenzte Routensuche; natürliche Oberfläche und Wasser lokal ohne Hausplattformen lesen.                              |
| `terrain`, `terrain_store`, `world_terrain_store`, `terrain_blocks`, `terrain_raster` | Höhenautoren, kanonische Oberfläche, räumlicher Index und fertige Raster.                                                                          |
| `water`, `water_store`                                                                | Pegel, Polygone, Ufer und Trockenlegen; Wasser- und Höhenänderungen bilden eine Aktion.                                                            |
| `rivers`, `river_store`                                                               | Routen, gemeinsame Knoten und Profile; lokale Flüsse samt verbundenen Komponenten laden.                                                           |
| `ground`, `landscape`, `ground_store`                                                 | Getrennte Pigment-/Landschaftsautoren mit gemeinsamen begrenzten Raster- und Pyramidenmechanismen.                                                 |
| `regions`, `region_store`                                                             | Katalog, Polygone, RTree und revisionsgebundene Reads; Beziehungen aus Schnittflächen ableiten.                                                    |
| `scenery`                                                                             | Deterministische Assetverteilung; Landschaftsstriche sind gewöhnliche Objektowner.                                                                 |

Straßenplanung, Flussplanung, Profilnachführung und Import verwenden denselben begrenzten
`terrain_blocks::Sampler` wie Oberflächenreads. Ein eigener Cache vollständiger
Höhenregionen und wiederholte Scans lokaler Override-Werte entfallen. Bei der
Nachführung sind lokale und grobe Autoren bereits in derselben Transaktion
geschrieben; der Sampler wird erst danach erzeugt. Beim Import ist der Blockindex
vor der Flussrekonstruktion aufgebaut. Während einer Abtastung ändern sich keine
Höhenautoren. Die Straßenplanung hält in ihren räumlich begrenzten Regionen nur
Gewässerdaten; natürliche Höhen teilen sich einen operationslokalen Blockleser
über alle Regionen und Wiederholungen der Routensuche.

Der Flussprofilsolver liest die natürliche Höhe einmal je gemeinsamem Netzknoten
und verwendet sie auch für den Einschnitt. Gewässerkontakt bestimmt weiterhin den
Wasserpegel. Der operationslokale `ContactReader` fragt weiterhin punktlokale
Kandidaten über den Gewässer-RTree ab. Solange deren Identitäten und die
überlappenden vorgeschlagenen Gewässer gleich bleiben, verwendet er dieselben
dekodierten Kontaktpolygone. Bei einer anderen Auswahl ersetzt er diese vollständig;
die bisherigen Konturlimits und die Vorschauüberlagerung gelten unverändert.
Der Leser lebt nur bei unveränderten Gewässerautoren innerhalb einer Berechnung.
Straßenregionen halten vorbereitete Seegeometrie anstelle der erneut umzuwandelnden
Autorenringe. Es gibt keinen dokumentweiten Kontaktcache.
Der Profilsolver verbindet Absenkung stromabwärts und Rückstau stromaufwärts
mit lokalen Pegeln. Flussbetten bleiben abgeleitet. Die Oberfläche wendet sie vor
Hausplattformen an; Straßenrouting berücksichtigt Flüsse und lokale Gewässer.
Ortschaften gehören zur Regionskategorie mit `markers`; Identität, Beschriftung,
History und Persistenz liegen beim Regionskern.

## Gelände und Mehrskaligkeit

`lod` besitzt Ansichten, Kamera-/Weltgrenzen, Maßstabsleiste und Darstellungsregeln.
`LodDecision` vereint Inhaltsregeln und technische Stadt-, Höhen- und Bodenstufen;
`useAtlasEditor` hält die jeweiligen Rücklaufbereiche. `tileRequest` begrenzt den
Ausschnitt vor der Koordinatenerzeugung. Autorenauflösung wird beim Strichbeginn
fixiert; Darstellungsauflösung folgt Kamera, DPR und Speicherbudget. Die
Darstellung wählt nominal vier CSS-Pixel je Kontrollwertschritt, unabhängig von
der Autorenauflösung; kleinere Kacheln begrenzen die Neuberechnung je Änderung.

Rust rekonstruiert die natürliche Oberfläche aus lokalen und gröberen absoluten
Kontrollwerten. Fehlende Werte mischen die gröbere Fläche über die positive
kubische B-Spline-Basis ein. `terrain_blocks` hält Höhenintervalle, Belegung und
Autorenbounds je Quellauflösung. SQL markiert geänderte Blöcke; vor dem nächsten
Read werden diese und ihre Eltern aktualisiert. Vorschau-Rollback und History
teilen diese Invalidierung. Höhenautoren benötigen keine Mittelwertpyramide.
Die festen SQL-Anweisungen werden für die gesamte Aktualisierung vorbereitet,
nicht erneut je Block und Vorfahr.

Der anfragegebundene `Sampler` liest Intervalle und Kontrollwerte über begrenzte
Caches für Indexknoten, 16×16-Blöcke und lokale Koeffizienten. Quellen außerhalb
ihrer Einflussbounds werden übersprungen. Der gehaltene Lesespeicher hängt vom
Darstellungsbudget ab. Konstante Kontrollwerte über einer identisch hohen
geerbten Fläche bleiben auch bei dünner Belegung exakt konstant; die
Polynomauswertung darf dort keine künstliche Steigung erzeugen. Für kleine
Ausschnitte grober Autoren prüft der Sampler zusätzlich höchstens vier
vollständig belegte konstante Spline-Abschnitte. Damit kann eine lokal ebene
Fläche trotz dünn belegtem oder unterschiedlich hohem Indexblock exakt erkannt
werden; fehlende Stützwerte behalten die konservative Intervallberechnung. `terrain_raster` unterteilt nichtkonstante Bereiche bis zur
Abtastauflösung und berechnet Relief, Wasserabdeckung und Höhenlinien aus der
kanonischen Oberfläche samt Flussbetten, Plattformen und lokalen Gewässern.
Gemeinsame Weltabtastpunkte und ein Pixelrand ermöglichen Kachelfilterung;
konstante Raster werden kompakt übertragen. Für natürliche Oberflächen ohne lokale
Gewässer, Flüsse oder Plattformen beweisen konservative Höhenintervalle die
vollständige Wasserabdeckung beziehungsweise Trockenheit einschließlich des
Antialiasing-Rands. Nur unentschiedene Küstenbereiche benötigen dichte Höhenknoten.
Die Intervallprüfung unterteilt bis zu begrenzten Rasterblöcken; exakte Knoten
werden an gemeinsamen Kanten innerhalb der Anfrage wiederverwendet. Relief und
Höhenlinien behalten ihre unabhängige, unveränderte Höhenabtastung. Bei abgeleiteten
Einflüssen bleibt die vollständige Abtastung erhalten. Binärdaten verwenden Base64.
Reliefgradienten verwenden das bereits berechnete 33×33-Höhenraster und
werten nur die 280 fehlenden Punkte des zweischrittigen Randes zusätzlich aus.
Daraus entstehen auch Fels-/Schneedeckung und Beleuchtung: ein 35×35-RGB-Gitter
mit einem Knoten Rand, bei konstanten Flächen ein einzelnes Tripel. Relief und
Bodenfarbkomposition interpolieren dieselben quantisierten Materialwerte. Es gibt
keine zusätzliche Höhenabfrage und keinen weiteren Cachebesitzer.

Land/Meer bestimmt exakte Abstände im überstrichenen Korridor. Ein temporärer
Segmentindex und zeilenweise Streckenbegrenzung liefern die Kandidaten für
Autorenreads und Höhenauftrag. Dieser Index lebt nur während eines Abschnitts.
Die optionale Küstenrauheit addiert zum exakten Wegabstand einen stetigen,
ortsgebundenen Einzug aus drei begrenzten Rauschfrequenzen. Koordinaten und Radius
werden gemeinsam in Autorenkoordinaten skaliert; die Form hängt nicht von
Ereignisanzahl, Abschnittsgrenzen oder Zufallszustand ab. Sie bleibt innerhalb des
vorhandenen Kandidatenkorridors. Rauheit null erhält den runden Auftrag exakt.
Der Wert gehört zum eingefrorenen Strichparameter, gespeichert werden weiterhin
nur die entstandenen Höhenautoren; es gibt keine zusätzliche Vorschau oder Cacheebene.
Die Reliefmodi Bergkette, Hügel und Schlucht nutzen denselben räumlich abgetasteten
Auftrag wie Anheben/Absenken. Stetiges, radiusnormiertes Ortsrauschen moduliert
positive Grat-/Kuppenprofile beziehungsweise ein negatives Schluchtprofil.
`featureHeight` bleibt beim Skalieren in Autorenkoordinaten in Welt-Fuß erhalten.
`featureBrush` übersetzt physische UI-Vorlagen aus Metern und wählt die
Autorenauflösung aus dem Radius. Der UI-Radius dieser Modi ist physisch; Cursor
und Transport rechnen ihn ausdrücklich um. Gewässer behalten ihren Pixelradius.
Fehlende grobe Autoren erben ausschließlich höhere Auflösungslevel, nicht die
Splinefläche bereits geschriebener Nachbarn ihres eigenen Levels. So erzeugen
Abschnittsgrenzen keinen zusätzlichen Höhenauftrag.
Lokale und grobe Pinsel sammeln die benötigten Autorenblöcke je Quellauflösung
für den gesamten Abschnitt. Zeilenmasken erhalten exakt die Vereinigung der
Lesebereiche samt Spline-Stützrand; überlappende Bereiche lesen denselben Block
nur einmal. Unbelegte Quellauflösungen werden vorher übersprungen. Blockreads
und Blattaktualisierungen verlangen ausdrücklich die vorhandenen räumlichen
SQL-Indizes: Ein bloßer Level-Filter darf keinen globalen Quellscan verursachen.
Allgemeine große Ausschnittreads enumerieren weiterhin keine leeren Blockflächen.

Höhenauftrag filtert Autoren außerhalb der Weltgrenze: lokal im Rasterkern,
bei groben Quellen nach Rückrechnung in Weltkoordinaten vor dem Delta.
Eingabepunkte und Arbeitsbudgets bleiben validiert. Der Canvas maskiert den
überstehenden Rand vollständiger Darstellungskacheln außerhalb der Welt;
die Statusleiste reserviert die Höhe ihrer Fehlerschaltfläche, damit deren
Verschwinden keinen begonnenen Strich durch einen Resize abbricht.

Die Gewässernachführung sucht zuerst betroffene Wasserflächen im vorhandenen
räumlichen Index. Ohne Treffer entfallen ihre Autorenreads. Andernfalls sammelt
sie die begrenzten Kachelbereiche samt Stützrand über denselben Blockleser wie
der Pinsel. Rasterlimits greifen vor den Höhenreads. Die Trockenlegung verwirft
betroffene Rasterzellen außerhalb der jeweiligen Gewässerbounds vor Abtastung
und Polygonaufbau; berührende Randzellen bleiben enthalten. Uferunterteilung,
kanonische Höhen und atomare History bleiben erhalten. Bei groben Änderungen
werden für belegte 16×16-Quellblöcke zunächst nur Gewässermetadaten abgefragt.
Der vier Schritte breite Spline-Einfluss jedes geänderten
Kontrollwerts wird mit den Gewässerbounds geschnitten; die Vereinigung der
betroffenen lokalen Rasterzellen bestimmt das Arbeitsbudget. Gewässerkonturen
werden anschließend einmal je ID geladen. Die Uferberechnung liest direkt die
kanonische Oberfläche aus tatsächlichen lokalen und groben Autorenwerten.
Gewässerüberlagerungen ersetzen IDs beider Deltaseiten und sortieren das
Ergebnis wie der normale Read. Damit ist dieselbe Überlagerung vor und nach
dem transaktionalen Schreiben eindeutig, auch wenn ein See geteilt wird.

Vorschau, bestätigte Höhenabschnitte und frische Reads verwenden denselben
`terrain_tiles`-Pfad ohne nachträgliche Deltaüberlagerung. Er liest den jeweiligen
transaktionalen Zustand und wählt Detail oder Übersicht ausschließlich nach der
Kachelstufe. Priorisierung, Geometriebudgets, Raster und Inhaltskennungen stimmen
damit auch nach Gewässerteilungen und Flussänderungen überein. Vorschau-Rollback
stellt Autoren und Indizes auch nach einem Oberflächenfehler gemeinsam wieder her.

Das natürliche 33×33-Relief-/Konturgitter verwendet denselben adaptiven
Rasterkern wie die dichte Wasserabtastung. Konservative Blockintervalle füllen
nachweislich konstante Bereiche ohne einzelne Höhenreads; alle übrigen Knoten
behalten ihre exakten Weltpositionen und kanonischen Höhen. Flussbetten und
Hausplattformen werden anschließend unverändert pro Knoten angewendet.
Es entsteht kein zusätzlicher Rastercache.

Leere `terrain_tiles`-Anfragen validieren weiterhin Stufe, Rasterbudget und
Höhenlinienabstand, liefern danach aber nur Status und leere Kachelliste. Die
Versionsprüfung des Präsentationscaches benötigt dafür weder Sampler noch
Autoren-/Blockindexzugriffe; nötige Indexpflege erfolgt beim nächsten Sampling.
`terrain_tiles` und der versionierte Punktread `surfacePoints` teilen Sampler,
Flussauswertung und Plattformaufbau. `SurfacePointReader` hält eine laufende
Anfrage und nur den neuesten wartenden Cursorpunkt. Überholte Antworten werden
verworfen. Oberflächenmathematik und Küstenabdeckung liegen ausschließlich in Rust.

`map_tiles` verwendet eine per SQL-Trigger gepflegte Dichtepyramide und begrenzte
Geometrie-/Namensabfragen je Kachel und Art. Der abgeleitete `map_houses`-RTree
verbindet räumliche Bounds mit der Sichtbarkeit nach Hausgröße beziehungsweise
Wichtiger-Ort-Markierung. Er ersetzt die getrennten globalen Hausfilter; ein
einfacher Objekttypindex unterstützt die übrigen Arten. Exakte Größenwerte und
Sortierschlüssel liegen als skalare Zusatzspalten im Hausindex. Der genaue
Größenvergleich korrigiert konservative RTree-Rundung. Erst nach Priorisierung
und Begrenzung auf 128 Treffer werden Hausheader gelesen und projiziert.
Transaktionale Trigger pflegen den Index bei Import, Writes und History;
Rollback stellt ihn mit den Autoren wieder her. Namensänderungen benötigen
keinen räumlichen Neuaufbau. Dichtekacheln lesen über 32 feste X-Werte jeweils den lokalen
Y-Bereich aus dem zusammengesetzten Primärschlüssel. Damit werden höchstens die
32×32 Zellen der Kachel gelesen, keine entfernten Zellen desselben Nord-Süd-Streifens.
Ein anfragegebundener ID-Cache vermeidet wiederholte Projektion.
Exakte Szenen laden im Bearbeitungsmaßstab; `roadHeader` und `objectHeader` liefern
Ownerdaten auch in Übersichten. Zu große exakte Ausschnitte werden abgelehnt.

## Landschaftsdeckung

`landscape` besitzt die semantischen Pinsel-/Transporttypen und die normierten
Wald-/Buschland-/Wiesen-/Felsgebietsgewichte. `landscape_tiles` und `landscape_lod`
sind von Bodenpigmenten getrennt. Der interne feste `RasterKind` im Rasterstore
teilt Vererbung, räumlich begrenzte Autorenreads, Halo und Pyramidenaufbau;
fachliche Validierung und Mischregeln bleiben getrennt. LandscapeStroke benutzt
den vorhandenen transaktionalen Vorschau-/Commit-/Historypfad. Persistenz speichert
nur Autoren und rekonstruiert Übersichten beim Öffnen.
Bei vollständig unbenutzten Rasterebenen genügt eine Autoren-Existenzprüfung:
Ohne Vorschauwerte liefert der Store leere Kacheln direkt, ohne Vererbungsreads
oder Haloaufbau. Argumentprüfung und die bestehenden Transportformate bleiben erhalten.

Der `PresentationLoader` lädt Landschaft als eigene versionierte Schicht über
seinen bestehenden WorldTileCache. Sie wird ausschließlich mit revisionsgleichem
Gelände kombiniert. Vorschaukacheln ersetzen nur betroffene Kacheln. Vollständig leere
Darstellungskacheln übertragen einen leeren Pixelstring; der Painter überspringt
sie vor Rasterallokation und Symbolarbeit. Explizit leere Autoren bleiben davon
unabhängig gespeichert. Es gibt
keinen zusätzlichen Dokumentworker oder unabhängigen Cachebesitzer. Der vorhandene
Rasterpainter hält begrenzte Landschaftsraster und zeichnet aus denselben Gewichten
ferne Farben, mittlere Blätterdächer beziehungsweise Signaturen und nahe Symbole. Zwischen 0,35 und 0,5
CSS-Pixeln pro Fuß beginnt die Überblendung zu nahen Symbolen. `landscapeLod`
begrenzt deren Anteil zusätzlich anhand einer kamerapositionsunabhängigen Obergrenze
der Kandidaten für die Viewportgröße; große Fenster behalten dadurch das
Blätterdach bis zur möglichen Detaildarstellung. Beide Bänder teilen sich
das Kandidatenbudget. Painter, Symbolprojektion und Kachelanfrager verwenden
dieselbe Auswahl; der Anfrager erhält bis zum Ende den groben Kronenrand.
Mittlerer Wald entsteht als durchgehendes, weltverankertes Kronenfeld aus den
Waldgewichten. Geringe Dichte öffnet Lücken, hohe Dichte schließt das Dach.
`forestCanopy` berechnet ausschließlich Darstellung; die Autoren bleiben unverändert.
Der bestehende Landschaftsrastercache hält das optionale 130×130-Kronenraster
einschließlich Halo im selben Bytebudget. Es entsteht erst im mittleren Band
und nur für Kacheln mit Waldanteil; Pan und Zoom verwenden es wieder.
Boden-, Landschafts- und Geländepainter prüfen über `rasterVisibility` vor
Decodierung, Nachbarschaftsabgleich und Rasteraufbau, ob der Kachelkörper den
Viewport berührt (mit einem Geräte-Pixel Rundungsrand). Unsichtbare Höhenlinien
werden ebenfalls übersprungen; ihr Prüfrand enthält zusätzlich die halbe
Strichbreite in Geräte-Pixeln. Geladene unsichtbare Kacheln bleiben im Präsentationscache; ihre
Zeichenraster entstehen erst beim Hineinschieben und werden beim Zurückschieben wiederverwendet.
Die Stadtübersicht verwendet dieselbe Kachelprüfung vor dem Durchlaufen der
Bebauungsdichtezellen; außerhalb des Viewports entfallen deren Rechteckaufträge.
Buschland, Wiese und Felsgebiet verwenden dort weiterhin aufrechte Gruppen
aus drei Zeichen im Vektorpainter.
Nahe Waldbäume verwenden vier eigene, unregelmäßige Federzeichnungs-Kronen mit
gebrochenen inneren Blattkonturen und gedeckter Lasur. Der Vektorpainter hält
höchstens vier feste Path2D-Zeichnungen; Pan und Zoom erzeugen keine neue
Kronengeometrie. Innere Konturen und Schraffur werden erst ab lesbarer
Bildschirmgröße gezeichnet. Bestehende dekorative Waldbäume nutzen denselben Painter.
Detailkandidaten hängen nur
von Weltkoordinaten ab und werden ausschließlich für den sichtbaren Ausschnitt
innerhalb eines festen Budgets erzeugt. Autoren enthalten keine generierten Bäume.

## Eingaben und Lebensdauer

`AtlasApp` verbindet über `useAtlasEditor` die Besitzer. `editorView`,
`workflowView`, `roadDraft` und `parcelPlanning` sind Projektionen. Werkzeugwerte
liegen in `useEditorTools`, Regionswerte in `useRegions`. `editorScene` trennt
sichtbare Daten von bearbeitbaren Ownerdaten; `editorInput` erzeugt den
Eingabesnapshot. Ein exakt ausgewählter Straßenheader ersetzt dort die
vereinfachte Übersichtsdarstellung. `canEdit` prüft die Bearbeitungsfreigabe.
Freier Doppelklick-Zoom darf aktuelle Außengeometrie im bereits geladenen Bereich
unter dem Anker verwenden, während ein vergrößerter Ausschnitt noch lädt. Diese
anfragefreie Projektion leiht vorhandene Geometrie und Bounds; sie gibt keine
Schreibaktionen oder Ziele außerhalb des bestätigten Bereichs frei.

`interaction` berechnet Gesten; `useCanvasInput` besitzt DOM-Ereignisse,
Koordinaten und Pointercapture. Bekannte Panelwechsel werden im Layoutschritt
ausgemessen; echte Größenänderungen brechen die alte Geste vor Veröffentlichung
des neuen Ausschnitts ab. `useCamera` erhält bei Fenster-/Panelgrößenwechseln
den Weltmittelpunkt anhand der letzten tatsächlich gemessenen Größe; die initiale
Platzhaltergröße löst keine Verschiebung aus. Bei einer durch Karten-Pointerdown
ausgelösten Auswahl bleibt stattdessen der Punkt unter dem Zeiger fest.
Doppelte Resize-Meldungen verändern weder Kamera noch Geste.
`useCanvasInput` übernimmt beim Karten-Pointerdown fokussierte Zahlenfelder
für Zeichenwerkzeuge synchron vor dem Eingabesnapshot. Der Auswahlmodus behält
seinen bisherigen Ablauf, damit ein Inspector-Write beim Fokusverlust die bereits
beabsichtigte Auswahl nicht verschluckt.
`editorSelection` besitzt Auswahlübergänge, `useCamera` Navigation und Fit-Identität. `useRivers` hält Flussauswahl und
Punktindex zusammen; `useRegions` projiziert Katalog, Ränge und Beziehungen.
Beide verwenden den gemeinsamen Workflow und Lesepfad.

Kandidaten tragen Version, Kontext und Identität. Inhaltsänderungen ersetzen sie;
Neuprüfung liest frische Header. Bei Hauszeichnungen entscheidet der Workflow
gemeinsam über abgeschlossene Pointergeste und aufgelösten Owner.
`DocumentQueue` besitzt angenommene Writes unabhängig vom Workflow und über
UI-Remounts hinweg. Der eigene Zustand `terrainGesture` hält für direkte
Höhengesten nur den letzten Punkt und die erfassten Gestendaten, ohne
Vorschaukandidat, Prüfphase oder veraltbare Basisrevision. Bestätigte Revisionen
setzen dieselbe Geste fort; Dokument-, Kontext- und exklusive Grenzen schließen
sie ab. Die Queue bündelt neue Punkte und sendet begrenzte Abschnitte seriell. Ein
angenommener Pfad reserviert seinen Abschluss vor nachfolgenden Aktionen.
Dateigrenzen und Unmount schließen den Rest ab. Gewässer behalten ihren
vollständigen Vorschaupfad. Die Bedienregeln stehen unter
[Vorschau und Nebenläufigkeit](product-contract.md#vorschau-und-nebenläufigkeit).

## Präsentation und Cachegrenzen

`usePresentation` und `usePresentationLayer` binden den `PresentationLoader` an
React. Gelände, Boden, Stadt, Regionskatalog/-ausschnitte und Flüsse laden als
versionierte Schichten unabhängig von der exakten Szene. Bei ausstehenden Reads
oder Fehlern bleibt der letzte vollständige Snapshot sichtbar; aktuelle
Bearbeitungsdaten werden getrennt freigegeben. Boden und Gelände werden nur bei
gleicher Dokumentversion kombiniert. Exakte Innenraumowner, Metadaten und Kacheln
werden gemeinsam veröffentlicht. Eine leere, nicht bearbeitbare Szene kann bereits
bereite Raster darstellen. Bestätigte Vorschauen enden mit frischer Darstellung.

Der Rasterdekoder hält konstante Relief-/Wasserflächen als 1×1-Bilder und
reserviert nur deren tatsächliche Rastergröße im bestehenden Budgetcache.
Bodenautoren enthalten zwei planare 64×64-RGBA-Ebenen für Boden und Fels;
Vererbung, Übersichtspyramide, Halo, History und Dateipersistenz führen beide
gemeinsam. Malen, Radieren und Pipette betreffen ausschließlich die gewählte Ebene.
Eine vollständig pigmentfreie Antwortkachel einschließlich beider Halos verwendet
wie Landschaft einen leeren Pixelstring. Der Painter überspringt sie vor Decodierung,
Materialabfrage und Canvas-Allokation; die Pipette liefert weiterhin die Grundfarbe.
Autoren und Pyramide behalten ihre vollständigen planaren Pixelwerte.
Bodenfarben verwenden je Zeichenaufruf einen Materialleser, der die aktuelle
Kachelreferenz über benachbarte Pixel hinweg wiederverwendet. Es entsteht kein
zusätzlicher persistenter Cache. Beschriftungen verwerfen unsichtbare und nach
Maßstab ausgeschlossene Kandidaten vor Schriftmessung und Platzierungsbudget.

`readScheduler` begrenzt physische Reads pro Client über Remounts hinweg;
Darstellung, Fit und Ownerauflösung teilen ihn. `PreviewScheduler` begrenzt
Vorschauen. Anfrageidentität, Version und Ausschnitt sichern Veröffentlichung und
Wiederverwendung; schnelle Navigationsänderungen werden vor dem Senden gebündelt.

`presentationCache` verwendet `WorldTileCache` mit fachlichen Adaptern für Stadt,
Gelände und Boden. `TileCache` besitzt Innenraumkacheln, `BudgetCache` Verdrängung,
`documentVersion` die Versionsprüfung. Invalidierungsränder bleiben beim Fachcache.
Gelände besitzt genau einen Cache pro Client; die Queue speist bestätigte
Antworten dort ein und hält keinen zweiten Kachelbestand. Schlüssel enthalten
Session, Koordinaten, LOD, Rasterauflösung und Höhenlinienabstand.

Rust liefert revisionsunabhängige SHA-256-Inhaltskennungen. Gleiche bestätigte
Inhalte behalten ihre Referenzen; ungültige Einträge dienen nur noch dem Vergleich.
Jede neue Geländerevision wird bestätigt. Sessionwechsel leeren den Bestand,
Revisionssprünge verlangen neue Reads; verspätete Antworten setzen ihn nicht zurück.
`cacheBudgets` definiert Transport- und Dekodierbudgets. Auch das Einspeisen von
Writes verdrängt überzählige Einträge. Aktive Snapshots können zusätzlich Daten halten.

## Zeichnen

`canvasScene` bereitet Schichten, Auswahl, Vorschauen und Beschriftungskandidaten
rein vor. Cityfeatures werden für den Painter dedupliziert; Auswahl und geöffnete
Owner beeinflussen die Beschriftungsprojektion. `AtlasCanvas` plant Basis- und
Overlayframes mit Kamera und DPR. Begrenzte `Path2D`-Caches halten Außen- und
Innenraumgeometrie; `mapLabels` platziert Namen über Weltanker und räumliche Belegung.
`prepareMaterialSampler` indiziert die Kacheln seiner aktuellen Höhenantwort
beim ersten Sample nach Rasterkoordinaten. Boden-, Blätterdach- und Assetzeichnung
verwenden diese lokale Zuordnung statt wiederholter linearer Kachelsuche;
reine Raster-Cachetreffer bauen keine Zuordnung auf. Sie endet mit dem Sampler.
`houseRoof` ergänzt ausschließlich einzelne rechteckige Dachkonturen mit
konstant vier Flächen und einem Linienzug, geclippt an der vorhandenen
Außenkontur. Zoom-/Größenblende begrenzen diese abgeleitete Nahdarstellung;
zusätzliche Geometriecaches oder Autorenwerte entstehen nicht.
`mapTypography` liefert die gemeinsame lokale Schriftdefinition für Vermessung
und Zeichnen von Objekt-, Straßen- und Regionsnamen, ohne Fontdownload oder
zusätzlichen Cache.
Der Außengeometriecache behält innerhalb seines unveränderten Byte-/Eintragsbudgets
bereits aufgenommene Objekte, solange Basis, Auswahl oder Vorschau sie benötigen.
Ein gemeinsamer Abgleich vor den Zeichenframes entfernt entfallene Referenzen;
seine temporäre Schlüsselmenge ist höchstens so groß wie der Cache. Überzählige
Objekte werden ohne Aufnahme gezeichnet, damit ein großer sichtbarer Bestand
nicht bei jedem Frame alle weiterhin benötigten Konturen gegenseitig verdrängt.
Sessionwechsel leeren den Cache; ersetzte Objektwerte erhalten neue Konturen.
`BudgetCache.retain` und `setIfFits` besitzen diesen begrenzten Abgleich und die
Aufnahme ohne Verdrängung. Der Flusszeichner verwendet dieselben Methoden für
seinen vorhandenen Pfadcache: entfallene Flussansichten geben Einträge frei.
Maßstabswechsel verwenden die Weltkontur weiter, sofern weder alter noch neuer
Maßstab eine Samplebreite auf die Mindestbreite von 1,5 CSS-Pixeln anhebt. Die
kleinste Autorenbreite entsteht beim ohnehin nötigen Konturaufbau; sonst ersetzt
der Zeichner den Pfad. Mehr sichtbare Flüsse als Cacheplätze verdrängen damit nicht
bei jedem Bild alle noch benötigten Flussbänder. Die normale LRU-Aufnahme anderer
Caches bleibt unverändert.

`TerrainPainter` zeichnet fertige Raster und Höhenlinien. Gemeinsame gerundete
Gerätepixelkanten vermeiden transparente Kachelnähte; der Quellhalo bleibt für die
Filterung erhalten. `terrainRaster` hält Bilder und bei Bedarf vorbereitete
Höhenlinienpfade gemeinsam nach Inhaltskennung, ohne Transportobjekte festzuhalten.
Relief, Materialien und Wasser werden erst für ihre tatsächliche Verwendung
dekodiert. Dekodierte Reliefbytes leben nur bis zur Bilderstellung; dauerhaft
bleiben das fertige Canvas und bei Bedarf die Materialbytes erhalten.
Linienpfade verwenden exakt die Workersegmente und benötigen keine
Neuberechnung beim Verschieben oder Zoomen. Ihre geschätzten Speicherkosten zählen
zum bestehenden Terrainrasterbudget; die optionale Aufnahme verdrängt keine
bereits gehaltenen Raster. Ohne freien Platz bleibt der Pfad nur für den aktuellen
Zeichenaufruf erhalten. Bodenfarben verwenden vorbereitete Reliefwerte
und einen eigenen Pixelhalo. Die Seenrasterung ordnet nicht horizontale Uferkanten einmal nach ihrer unteren
Y-Grenze. Pro aufsteigender Subpixelzeile bleiben nur kreuzende Kanten aktiv;
jede Kante ist einmal gespeichert. Schnittpunkte werden je Polygon einschließlich
seiner Löcher gepaart, überlagernde Pegel nehmen weiterhin das Minimum.
Die direkte Schnittformel vermeidet schrittweise Rundungsdrift, Halo und
Vierfachabtastung je Achse bleiben erhalten. Der Zeilenpuffer wird wiederverwendet.
Untergetauchte Flussbänder werden an Gewässerflächen
ausgeschnitten. `containsPolygon` liefert den gemeinsamen Außenring-/Lochtest.

## Entwicklung und Prüfungen

`scripts/contracts.mjs` generiert TypeScript ausschließlich aus Rust und
formatiert den Export vor Vergleich oder Schreiben. Ein TypeScript-Projekt umfasst
Produktcode, Tests und Konfiguration. Rusttests prüfen Fachmathematik, Paketaufteilung,
Transaktionen, Dateien und Zugriffspfade; TypeScript prüft Queue, Workflow und Caches.
Browsertests prüfen Gesten, sichtbare Ergebnisse und Integration mit echtem Worker.

`corePaths` und `buildCore.ts` bestimmen Build und Workerpfad, `coreTransport`
besitzt Prozess und JSONL-Transport. `browserContract` leitet typisierte Aufrufe
ab; `atlasRaw` ist die untypisierte Testgrenze. Dateipfade gehören isolierten
Fixtures. Nebenläufigkeitstests halten Antworten gezielt zurück; Debouncefälle
steuern die Browseruhr. Produkt- und Performance-Suite besitzen getrennte
Playwright-Konfigurationen. Befehle und Ressourcenlimits stehen im README.

Ein optionaler Canvas-Beobachter veröffentlicht im Harness `atlasPaint`:
angeforderte und abgeschlossene Basis-/Overlayzeichnungen mit Mount, Session,
Revision, Präsentations- und Kamerageneration. Er steuert keine Frameplanung.
Veraltete oder abgebrochene Zeichnungen bestätigen keine neuere Generation.
`dataReady` wartet auf bearbeitbare Daten, `writesSettled` unabhängig vom Mount
auf die Queue, `paintedReady` auf tatsächliche aktuelle Zeichnungen. `drawn`
erlaubt ausdrücklich veraltete Darstellungen in Tests mit gehaltenen Reads.

`scripts/terrain-performance.mjs` besitzt Release-Sicherung, Fingerprintprüfung
und sequenzielle Vergleichsläufe. Fixture-Erzeugung und Importvalidierung liegen
außerhalb der Messphase. Derselbe Testtreiber verwendet feste Pfade gegen beide
Artefaktstände. `atlas.terrain.confirmed` und `atlas.canvas.paint` liefern Zeiten;
Workerzeit enthält Queuearbeit und ist kein isoliertes Funktionsprofil. Berichte
und Sicherungen sind ignorierte Diagnoseartefakte. Zeitziele und native Abnahme
werden getrennt vom deterministischen CI-Gesamtcheck bewertet.

## Optionaler Atlas-P0-Versuch

`src/editor/main.tsx` und `desktop/` sind der gesonderte Electron-44.10.2-Einstieg
mit React-Panels, PixiJS 8.22.0 und SQLite. Der
[Produktvertrag](product-contract.md#optionaler-atlas-p0-versuch) beschreibt
Nutzerverhalten und Format; [Plan](implementation/atlas-rebuild-plan.md) und
[Status](implementation/status.md) trennen Auftrag und verifizierten Stand.

### Vier Besitzer

| Besitzer                                 | Verantwortung                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/EditorDocument`                   | Autoren, Quellenabdeckung, C1-Wirkungskonten und Reservierungen, aktive/abschließende Geste, Vorherbilder, History und das einzige Pendingjournal.                  |
| `EditorController` mit `brush.ts`        | Wirksame Einstellungen, physische Eingabe, kausaler Pinselpfad, aktueller Quellenbedarf, authentifizierte Renderbestätigungen und ein RAF; abgeleiteter UI-Zustand. |
| `render/WorldRenderer` mit `HeightField` | Kamera, begrenzte Darstellungskacheln, numerische Ressourcen, lokale Invalidierung, tatsächliche Submits und GPU-Abschlüsse.                                        |
| `ProjectSession`                         | Ein geordneter Writer, Projekt-/Savedmetadaten, Schreibfehler/Recovery, Dateisperre und der gemeinsame Dateiablauf.                                                 |

Die Projektsitzung hält keine zweite Änderungssammlung. Die Darstellung verändert
keine Autoren. Das Dokument kennt weder IPC noch Kamera oder eine Eingabeuhr;
es übernimmt validierte Geometrie und begrenzte Zeitaufträge. Annahmebedingungen,
C1-Konto und Quellen-/Arbeitsreserve liegen gemeinsam im Dokument, damit ein
fehlendes Quellen-, History- oder Speicherbudget vor der Wirkungsannahme auffällt.
`brush.ts` bleibt eine reine Zustandsentscheidung, keine Werkzeug-Servicehierarchie.
React hält nur noch nicht übernommene Feldtexte; Undo, Saved, Writing, Finishing, Loading und
Warteanzeige werden aus den Besitzern abgeleitet.

Main und Preload besitzen Fenster, native Dialoge und die typisierte IPC-Brücke.
Der SQLite-Store liegt im Utility-Prozess. Context Isolation und Sandbox bleiben
aktiv; der Renderer hat weder Node-Integration noch SQL-Zugriff.

### Integrierter C1-Eingabe- und Wirkungspfad

`beginTimedBrush`/`planTimedBrushWindow` in `brush.ts` verwenden die gemeinsame
monotone Ereignisuhr und erhalten die gelieferte Polylinie. Coalesced-Einzelpunkte
ersetzen ihr zusammenfassendes Ereignis. Gleiche Zeitstempel erhalten Geometrie;
bereits verbuchte Zeit wird nicht zurückgedreht oder nochmals verwendet.
Das terminale Fenster enthält das tatsächliche Up-Sample und dessen Ereigniszeit;
Handlerverzug erzeugt keine Haltezeit. Je Fenster bleibt das Zeitangebot auf
50 ms begrenzt, während der zulässige Weg vollständig erhalten bleibt.

`PrepaidBrush` hält je Stützstelle `max(F, T)`: einmalige räumliche Mindestwirkung
und kumulierte angenommene Zeitwirkung. Der Anfangsklick ist Teil dieser
Mindestwirkung. `BrushReservations` begrenzt angewandte plus reservierte noch
nicht quittierte Wirkung auf 50 ms der fixierten Rate. Materialisierung
verbraucht die schon gebuchte Reserve; ein Receipt erzeugt keine neue Wirkung.
Die unabhängige R1-Referenz importiert keinen Produktcode und kontrolliert
Inhalt, Anrechnung und positive räumliche Stärke.

`EditorDocument.admitBrushBatch` prüft Quellen einschließlich Halo, eindeutige
Eingabereihenfolge, Zellen, Kacheln und Quellen-/History-/Pendingbudget vor der
Annahme. Die Enumeration folgt dem Pinselstreifen. Kleine lokale Bereiche
verwenden höchstens 16.384 direkte Referenzplätze auf dieselben Angebote;
größere Bereiche behalten eine dünn besetzte Map. Diese begrenzten
JavaScript-Referenzen sind von den gezählten numerischen Reservierungspuffern
und einer Messung des gesamten Heaps zu unterscheiden.
Angenommene Quellen und bestätigte Leere bleiben gepinnt. Höchstens 127 offene
Punkte lassen den letzten Platz der gemeinsamen 128er-Grenze für Up frei;
es gibt keine zweite Stempelrestliste.

`advanceBrushGesture` materialisiert pro RAF eine begrenzte Zahl reservierter
Koeffizienten und kopiert jede dabei geänderte Quellkachel höchstens einmal.
Livequellen und ausgegebene Nachherpuffer bleiben danach unveränderlich.
Eine versiegelte Geste endet erst nach ihrer letzten Übernahme mit genau einem
History-/Pendingeintrag. Initialisierung und Historyabschluss sind interne Schritte
dieses C1-Wegs; ein weiterer direkter Höhen-Schreibweg ist nicht verfügbar.
Modell- und Integrationsfixtures verwenden dieselbe Annahme und Fortsetzung oder
ausdrücklich vorbereitete unveränderliche Quellen. Der aktive Editor besitzt
keine zweite Autorenautorität.

### Gemeinsame Quellen und Landschaft

`ChangeSet.patches` ist eine geschlossene Union mit `kind: "height" | "landscape"`.
Transaktionskennung, Sequenz, Vorher-/Nachherbilder, Pendingjournal und Undo/Redo
gehören weiterhin zu `EditorDocument`. `ProjectSession`, Preload und Store
transportieren den Diskriminator unverändert. Beide Quellarten teilen die
bestehenden Quellen-, Pending- und Historybudgets und dieselbe Schreibgrenze.

Landschaftsautoren sind 64×64-Zellen auf Stufen 0–24 mit `2^level` Fuß Abstand.
Die binäre Autorenmaske ist unabhängig von den vier Bytegewichten für Wald,
Buschland, Wiese und Felsgebiet; ihre Summe beträgt höchstens 255. Die feinste
explizite Halbintervallzelle gewinnt, auch wenn alle vier Werte null sind.
Die äußere Weltgrenze gehört zur letzten inneren Zelle. Beim ersten feinen
Eingriff wird der geerbte Wert ermittelt. Grobe Änderungen schreiben keine
feineren Autoren um. Höhen- und Landschaftsleere besitzen getrennte
Abdeckungsbelege; unbekannte Daten gelten niemals als leer.

Der Controller führt den Landschaftsstrich als Variante desselben Eingabezustands.
Der geometrische Pinsel erreicht seine Zielwerte in der inneren Radiushälfte;
im äußeren Ring fällt die Wirkung mit `[1 − (2d/R − 1)²]²` auf null ab.
Je Zelle zählt die höchste Wirkung desselben Strichs, nicht die Ereigniszahl.
Jeder neue Wegabschnitt wird vor dem Einreihen auf sichtbare Grundlage und
bekannte Quellen geprüft. Die aufgenommene Grundlage wird erweitert, die
Quellen des Wegs bleiben gehalten; seine umschließende Retentionsfläche löst
keine zusätzlichen Bereichsreads aus. Höchstens 127 offene Punkte lassen Platz
für Up. Je RAF übernimmt das Dokument einen begrenzten geometrischen Abschnitt.
Up versiegelt, der letzte Abschnitt schließt dieselbe Dokumentaktion ab.
History und Dateiaktionen warten auf deren Barriere. Vor Up restaurieren
Escape, Fokus-/Pointerverlust und Ansichtwechsel die gehaltenen Vorherwerte
über lokale Invalidierung, ohne History- oder Storeeintrag. Nach Up kann ein
solcher Eingabewechsel den versiegelten Abschluss nicht widerrufen.

`readLandscapeRegion` lädt selektiv die gewählte Autorenstufe und gröbere Stufen.
`readLandscapePresentation` liefert gröbere Autoren und numerische Übersichten
an festen 128×128-Texelzentren. Die Übersicht hält feinen Eigenbeitrag,
verbleibende Vererbung und die feinste Eigentümerstufe. Grobe Patches übergehen
feinere Gewinner; nur beim Entfernen eines Gewinners werden konkrete gröbere
Punktquellen abgefragt. Es gibt keinen Nachfahrenscan. `landscape.ts` enthält
die reine Zusammensetzung; `landscape-store.ts` Codec, begrenzten Übersichtscache
und räumliche Indizes. Autoren und Übersichten werden in derselben
SQLite-Transaktion auf denselben Sequenzstand gebracht.

`LandscapeView` ist ein begrenzter Darstellungscache unveränderlicher Basisreads
und eingefrorener Eingaben. Lokale Patches werden auf die gelesene Basis
projiziert. Fehlt beim Undo eine benötigte Vererbung, wird eine aktuelle
Storeübersicht angefordert; fremde Feinautoren werden dafür nicht nachgeladen.
Überholte Reads und fehlende Ergebnisse bleiben unbekannt. Ein Frame hält seine
Quellen bis zur Zeichnung; neu gestartete Vorbereitung verwendet dieselbe
Arbeitsübersicht und ihren Fortschritt erneut. Alle gehaltenen Puffer zählen
zum Darstellungsbudget, auch Pendingpuffer noch ohne fertigen Frame.

`HeightField` bereitet Landschaftsgewichte innerhalb desselben RAF-Budgets vor.
Die gemeinsame Farbkomposition mischt die Flächendeckung und maskiert sie an
der tatsächlich zusammengesetzten Wasseroberfläche. Der CPU-Ausnahmeweg liefert
Farbe und Landmaske aus derselben kanonischen Höhenrechnung. Upload, Komposition
und GPU-Abschluss belegen die vorhandenen Grafikplätze; Landschaft erhält keine
eigene Renderqueue. Volle Symbol- und Kronendachdarstellung gehört zu P4.

### Autoren, Übersicht und Quellenbedarf

Höhenautoren sind sparse 64×64-Float64-Kacheln auf Stufen 0–21. Positive kubische
B-Splines rekonstruieren relative Beiträge auf Abständen von `5 × 2^level` Fuß.
Erst die vollständige Summe mit Ozeangrundwert erhält das natürliche Höhenlimit.
`height.ts`, `height-grid.ts` und `overview.ts` bleiben gemeinsame Fachmathematik
und CPU-Referenz. Grobe Eingriffe schreiben feinere Autoren nicht um.

`readPresentation` liefert benötigte grobe Autoren und 128×128-Übersichten der
feineren Beiträge. Übersichten enthalten unbeschnittene, durch 32 skalierte
numerische Beiträge, keine Farben oder Ozeanhöhe. `readRegion(minLevel)` liefert
die exakten Quellen der benötigten Autorenstufe und gröberer Stufen. Der RTree
begrenzt Raum und Stufe vor der Enumeration; höchstens 512 Autorenkacheln gehören
zu einem Read oder einer atomaren Aktion. Autoren und betroffene Übersichtsvorfahren
werden in einer SQLite-Transaktion gepflegt.

Das Dokument unterscheidet vorhandene Quellen, bekannte Abwesenheit und unbekannte
Daten. Regionale Abdeckungsbelege bestätigen leere Bereiche, ohne für jeden
fehlenden Schlüssel einen Eintrag anzulegen. Residency folgt höchstens zwei
Bedarfen: Darstellungsausschnitt sowie vollständiger aktueller Werkzeugbereich
mit Halo. Aktive, angenommene noch nicht angewandte und unbestätigte Änderungen bleiben
einschließlich ihrer geprüften Quellen gepinnt. Nicht benötigte
bestätigte Quellen samt unnötigen Abdeckungsbelegen werden freigegeben.

Der Controller hält einen aktuellen `SourceDemand` und einen `SourceReadState`.
Der RAF startet höchstens den nächsten fehlenden Darstellungs- oder Werkzeugread;
der folgende Frame betrachtet den neuesten Bedarf. Der Zustand unterscheidet
idle, loading, failed sowie einen bereits erfüllten Bedarfsschlüssel. Eigene
`loadRequested`-/`viewLoadPending`-Flags und ein zweiter Navigationstoken entfallen.
Hover verändert den Werkzeugbedarf, nicht die Ansichtsgeneration des Renderers.

Nach jedem asynchronen Read werden Dokument, Session, Ansicht und Storesequenz
geprüft. Ein bereits überholter Storestand wird erneut gelesen. Übernahme und
Pendingprojektion erfolgen anschließend synchron, bevor ein Ack dafür benötigte
Patches freigeben kann. Fehlgeschlagene Reads bleiben sichtbar und werden über
den vorhandenen Retryweg erneut angefordert. Der optionale Diagnose-Sampler
verwendet denselben Readslot.

Präsentationsreads führen Quellen und Übersichten anhand ihres Inhalts zusammen.
Identische Daten verursachen weder neue Atlasuploads noch Invalidierung.
Zertifizierte leere Übersichten entfernen nur den konkret bestätigten Schlüssel.
Änderungen invalidieren nur betroffene lokale Kacheln; vergessene feine Autoren
entwerten keinen gröberen Gesamtanker, dessen Übersicht diesen Beitrag bereits
enthält. Übersichtsdaten bleiben auf den aktuellen Bedarf und behaltene Kacheln
begrenzt.

### Lokale Freigabe und Frameablauf

`localReadiness` kombiniert vollständige Quellen, lokal abgeschlossene Grafik
und Projekt-/Fehlerzustand. Eingabe und UI verwenden denselben Wert.
`WorldRenderer.inspectRegion` unterscheidet `outside`, `missing`, `stale` und
`current` anhand abgeschlossener GPU-Arbeit derselben Session und Ansicht.
Für Submitbelege verwendet die Diagnose getrennt `inspectSubmittedRegion`.
Außerhalb der Ansicht entsteht kein Bildbeleg.

Eine angenommene Geste hält eine authentische sichtbare Grundlage.
`inspectFoundation` prüft sie ohne Zustandsänderung; `acceptFoundation` erweitert
ihre nachgewiesene lokale Abdeckung ausdrücklich. Eigene spätere Autorenänderungen
entwerten diese Grundlage nicht. Neue kalte Orte, geänderte Ansicht,
Werkzeugvorbereitung, Session und Kontextverlust bleiben dagegen sperrend.
Der Controller prüft die einzelnen Rechtecke des aufgenommenen Wegs.
Nur exakt rechteckige Vereinigungen werden zusammengefasst; ein kaltes Inneres
einer L-Kurve wird dadurch nicht zusätzlich verlangt oder als gesehen erklärt.

Der Eingabezustand unterscheidet idle, blocked, active, finishing und den
gegebenenfalls versiegelten Landschaftsstrich. Beim Höhenpinsel reservieren
Down und Move zulässige Arbeit; Up reserviert seinen tatsächlichen Endpunkt.
Landschaft prüft Quellen und sichtbare Grundlage vor der Wegannahme und
Abschnitts- sowie Speicherbudgets vor der Mutation. Up versiegelt in beiden
Fällen die Eingabe vor Handler-Rückkehr. Die Autorenfortsetzung gehört
weiterhin derselben Dokumentaktion. Ihr Status ist sichtbar.

Der einzige Frameablauf ist gerichtet:

1. Die höchstens zwei ausstehenden GPU-Fences in Einreichungsreihenfolge ohne
   Wartezeit prüfen und vollständige passende Rückmeldung übernehmen.
2. Den nächsten fehlenden Quellenread starten.
3. Für Höhen ein kausales Haltefenster annehmen; höchstens eine begrenzte
   Autorenscheibe als Höhenzeitfenster oder Landschaftsabschnitt materialisieren.
4. Priorisierte Quellen und Übersichten in kleinen Schritten übernehmen. Erst
   vollständige Abhängigkeiten erlauben den eingefrorenen Renderstand.
5. Innerhalb desselben Vorbereitungsbudgets Deskriptoren und Projektionsstreifen
   vorbereiten, begrenzte Terrainpakete einreichen und fertige Farbe zeichnen.
6. Submitfakten, eventuellen Aktionsabschluss und abgeleitete Anzeige aktualisieren.

`freezeRender` hält einen unveränderlichen Quellen-/Übersichtsstand R bis zur
vollständigen Komposition und dem Fence der gezeichneten Szene. Neuere Änderungen
werden pro Quellschlüssel zu frühestem Vorherwert, neuestem Nachherwert und
vereinigtem Dirtybereich zusammengeführt. Ein vollständiger R-Receipt bleibt
auch bei bereits wartendem R+1 gültig. Der Controller paart ihn mit genau der
zugehörigen Wirkung: Session, Geste, Ansicht, Vorbereitung und eingefrorene
Revision müssen stimmen. Eine Teilkomposition, ein alter Beleg oder ein
anders vorbereiteter Stand gibt keine neue Wirkungsreserve frei.

Die lokale Wirkungsschranke ersetzt das frühere globale Dosisgate.
Ein ausgeschöpfter Ort darf einen anderen zulässigen Ort derselben Autorenkachel
nicht verwerfen. Bereits angenommene Arbeit geht bei GPU-Verzug nicht verloren.
`clientWaitSync(..., 0, 0)` fragt nur ab; es gibt keine Warteschleife oder `gl.finish`.
Es gibt einen Terrainplatz und einen Sceneplatz. Uploads, Allokationen und
Kopien belegen ebenfalls den Terrainplatz und erhalten Fence und Flush.
Eine Kamerabewegung kann fertige Farbkacheln verwenden, während das Terrainpaket
noch läuft; bei zwei belegten Plätzen bleibt nur der neueste Kamerawunsch stehen.
Der letzte Scene-Draw darf unmittelbar hinter dem letzten Terrainpaket stehen.
Erst sein Fence bestätigt den vollständigen lokalen Einfluss. Ein fehlgeschlagener
Poll gibt belegte Ressourcen nicht frei; ein späterer tatsächlicher Abschluss
oder Kontextverlust ermöglicht ihren Wiederaufbau. Sessionwechsel und Verdrängung
halten benutzte Ressourcen bis zu ihrem letzten Fence.

Die Diagnose ordnet eine angenommene Änderung ihrem tatsächlich vollständig
eingereichten Renderstand zu. Dafür prüft der Renderer die echte Scene-Receipt,
deren Revision und die vollständige sichtbare Bereichsabdeckung. Ein bereits
wartendes R+1 verhindert die Messung von R nicht; Teilpakete oder fremde Bereiche
liefern weiterhin keinen Beleg. Die normale Bereitschaftsprüfung verlangt
unverändert den neuesten passenden Inhalt.

Quellen und Übersichten werden vor teurer Vorbereitung räumlich ausgewählt.
Ein RAF teilt sein 2-ms-Vorbereitungsbudget und höchstens 128 Arbeitsschritte
zwischen Quellenübernahme, Übersichtsdeltas, Deskriptoren und Projektion auf.
Zeitprüfungen liegen zwischen kleinen Einheiten; Laufzeit- und GC-Ausreißer bleiben
Messgegenstände. Veraltete ungefertigte Übersichten werden vollständig verworfen;
ihre Basisversion wird erst nach atomarer Veröffentlichung fortgeschrieben.
Eine durch die gepinnten Autoren der aktiven Geste abgeglichene Rücklesung
erhält deren bereits belegte Grundlage; neue Bereiche bleiben bis zur begrenzten
Übernahme gesperrt. Gleichwertige eigene Inhalte entwerten bei dieser Übernahme
keine Grundlage. Entfernte Quellenfehler sperren keine
unabhängige lokale Gruppe. Hintergrundgruppen bearbeiten je eine vollständige
lokale Kachel und geben den Quellenstand danach wieder frei.

Der Pinselkreis ist ein DOM-Overlay. Seine Bewegung erzeugt keine Atlas-GL-Arbeit
und liefert keinen Terrainnachweis. Die begrenzten Zustände belegen noch keine
Hardwarelatenz.

### Feste numerische Basis und lokale Änderung

Eine Darstellungskachel hält zwei numerische RGBA32F-Texturen und ihre Farbkachel.
Je zwei Float32-Kanäle speichern hohen und niedrigen Anteil der ungeklemmten,
skalierten Gesamthöhe beziehungsweise des Beitrags der ausgewählten Autorenstufe.
Ein kalter Aufbau rekonstruiert die erforderlichen Autorenstufen und addiert
Übersicht plus Grundwert. Die aktive Stufe wird im selben Durchlauf als eigener
Beitrag festgehalten. Der anschließende Farbpass begrenzt erst die vollständige
Höhe und klassifiziert deren Farbe.

Für eine warme Kachel gilt `H_aktuell = H_basis + (C_aktuell − C_basis)`.
`C` ist die Projektion der aktiven Autorenstufe. Gesamtstand und damaliger
Stufenbeitrag gehören nachweislich zusammen. Jede Dosis und jedes gleichstufige
Undo/Redo wird gegen dieselbe Basis berechnet. Die Basis wird weder pro Dosis
noch pro Geste fortgeschrieben. Unveränderte Stufen werden dabei nicht erneut
rekonstruiert. Eine bereits in der Übersicht enthaltene aktive Stufe geht nur
mit ihrer Änderung ein. Die numerische Basis hält dafür keine Dokumentvorherbilder
und benötigt keinen zweiten Atlas aus Differenzquellen.

Der Controller meldet die benötigte Autorenstufe vor der Eingabe imperativ an
den Renderer. Bei einem Stufenwechsel kopiert eine warme Kachel ihre bereits
aktuelle Gesamthöhe und projiziert nur den neuen Stufenbeitrag. Eine kalte oder
ungültige Kachel baut Gesamthöhe und Beitrag kanonisch auf. Vorbereitung und
Abschluss besitzen zusätzlich zur Dokumentrevision eine eigene monotone Kennung:
Ein alter Fence derselben Revision bestätigt keine neue Werkzeugvorbereitung.
`localReadiness` bleibt eine reine Abfrage. Eine noch fehlende Vorbereitung ist
sichtbar wartend; abgewiesenes Down beginnt später keinen Strich automatisch.
Auch der kanonische Fallback gilt nach seinem tatsächlichen GPU-Abschluss als
vorbereitete Strategie. Pointerup erzeugt keinen Pflichtneuaufbau.

Die Zulassung berücksichtigt die absoluten Größen von Gesamthöhe, altem und
neuem Beitrag sowie die Fehler ihrer Projektion, Subtraktion und Addition.
Eine warme Übernahme behält das bisherige Fehlerbudget und zählt als tatsächlicher
Basiswechsel. Nach höchstens 32 solchen Übernahmen wird die Kachel kanonisch
erneuert; gleichstufige Gesten verbrauchen dieses Budget nicht. Starke Auslöschung
kann früher den vollständigen GPU-Pfad benötigen. Außerhalb des sicheren
GPU-Zahlenbereichs bleibt die kanonische Float64-Rekonstruktion erhalten.
Diese Auswahl verändert keine Autorenwerte.

Nur abgeleitete skalierte Beträge unter `1e-30` werden beim GPU-Encoding zu null.
Bei 22 Stufen und Rückskalierung 32 beträgt der zusätzliche kanonische Fehler
höchstens `7,04e-28` Fuß. Basis- und beide Beitragsfehler werden beim warmen Weg
mitgeführt; tatsächliche Basiswechsel übernehmen das Budget bis zum spätestens
nach 32 Wechseln erforderlichen Neubau. Die Darstellungstoleranz bleibt `1e-6`
Fuß. Räumliche Stufen-/Zeilen-/Spaltenmetadaten und lokale Magnituden werden bei
Quellenänderungen gepflegt; eine Displaykachel scannt nicht alle residenten Quellen.

Eine Basis darf den aktiven Beitrag aus einer residenten Teilmenge feiner Quellen
halten; unveränderte übrige Feinanteile bleiben in der Gesamtübersicht enthalten.
Die Teilmenge muss bis zur nächsten Aufnahme dieselbe bleiben. Import oder
Verdrängung einer Quelle dieser Stufe entwertet die betroffene Basis. Das gilt
auch für History, wenn ein vorhandener Vorherwert nicht mehr resident ist,
einschließlich eines Löschpatches. Neue lokal angelegte Quellen mit bestätigtem
Null-Vorherwert sind dagegen eine reguläre Änderung. Geänderte Übersichten und
andere relevante Autorenstufen entwerten den betroffenen Gesamtstand.

Die kubische Projektion ist separierbar: Ein horizontaler Pass berechnet jede
benötigte Viererzeile einmal in einer gepackten RG32F-Zwischentextur. Der vertikale
Pass gewichtet deren vier Zeilen in derselben Reihenfolge wie die kanonische
Rekonstruktion. Gewichte entstehen achsenweise in Float64; der Quellatlas enthält
vollständige kubische Halos. Feine Stufen dürfen eine größere lokale Seitentabelle
und mehr Zwischenzeilen benötigen. Absolute Weltkoordinaten werden vor
Float32-Transformationen relativ zur Kamera gebildet.

Dirtyrechtecke begrenzen die tatsächlich projizierten und gefärbten Pixel.
Nur der erste Live-Draw nach einer Basisaufnahme übernimmt zusätzlich unveränderte
Basispixel in das andere numerische Ziel. Spätere Dosen und gleichstufige Gesten
verwenden dieses Ziel weiter. Ein warmer Werkzeugwechsel braucht keinen Farbpass.
Die Kamera zeichnet behaltene Sprites ohne Höhenrekonstruktion; der Cursor
aktualisiert ausschließlich sein DOM-Overlay.

RG32F und RGBA32F werden mit Erweiterungsprüfung und tatsächlichen
1×1-Framebuffern einschließlich Wiederherstellung der GL-Bindings geprüft.
Fehlende Unterstützung und tatsächlich unsichere Zahlen verwenden den
kanonischen Float64-Weg in einem Worker. Der Controller besitzt `ComputeJobs`: zwei
aktive rechenintensive Jobs insgesamt, höchstens eine Ausnahmeprojektion und
pro Jobart nur den neuesten wartenden Wunsch. Lokale Arbeit hat Vorrang.
Abbruch entwertet das Resultat sofort; der Rechenplatz und seine Reserve bleiben
bis zum tatsächlichen Ende oder zur Abbruchbestätigung belegt.

Die Ausnahmeprojektion erhält unveränderliche lokale Quellen in bestätigten
32-KiB-Transfers. Aufbau und Rasterberechnung arbeiten in kleinen Abschnitten.
Ein weiterhin benötigter älterer Stand darf übernommen werden, während R+1
wartet; Session, Ansicht und konkrete Vorbereitungsidentität müssen stimmen.
Eine entfernte wartende Ausnahme belegt keine normale Rendergruppe. Ihre
Eingabepuffer, Worker-Kopien, Zwischenpuffer und Ergebnisse sind im gemeinsamen
Darstellungsbudget reserviert. Der diagnostische Lastworker verwendet dieselbe
Jobzulassung. Scheitert eine entfernte Vorbereitung, gibt sie ihre Rendergruppe
frei und behält ihre Dirtykennung. Derselbe fehlgeschlagene Eingabestand wird
nicht automatisch wiederholt; geänderte Abhängigkeiten oder „Erneut laden“
erlauben einen neuen Versuch. Andere lokale Quellen und Darstellungen laufen
weiter. Kontextverlust
entwertet Fence und Darstellungsbelege; Wiederherstellung überträgt Quellen und
baut Bilder neu auf. Erst passend abgeschlossene Arbeit gibt Eingabe wieder frei.

Uploadbereitschaft folgt den wirklichen Seiten und Texturen der einzelnen
Kachel. Entfernte Uploads sperren keine fertige lokale Komposition. `budgets.ts`
begrenzt Speicher, 4 MiB Upload pro Frame und Projektionsarbeit je Grafikpaket.
Der Projektionsanteil bleibt auf 20 gewichtete Paarprodukte je historischer
Arbeitseinheit normiert. Zusätzliche Basisadditionen, Farbe, Kopien und
Capture-Lesezugriffe werden mitgezählt; das Paketlimit bleibt unverändert. CPU-Quellseiten entstehen in achtzeiligen Abschnitten; Atlaswachstum kopiert
64 KiB je Schritt. GPU-Teilschritte umfassen höchstens 16 Pixelzeilen und jeweils
die vollständige Folge horizontal → numerisch → Farbe. Mehrere solche Schritte
dürfen innerhalb derselben unveränderten Arbeits- und Uploadgrenze liegen.
Ein Teilstreifen veröffentlicht keine neue Gesamtbasis oder vollständige
Renderbestätigung. Der aktuelle Werkzeugort wird zuerst bearbeitet. Die beiden numerischen 128²-Texturen kosten zusammen 512 KiB
je Kachel, bei 96 Kacheln 48 MiB. Hinzu kommen die variabel großen Zwischenzeilen,
Farbe, Quellspiegel, Deskriptoren, Gewichte und Fallbackbilder; alle sind erfasst.

### History, Persistenz und Datei

Eine abgeschlossene Geste erzeugt einen angenommenen `ChangeSet`. History und
Pendingjournal teilen unveränderliche Vorher-/Nachherpuffer; Liveautoren bleiben
getrennt. Leser dürfen die geliehenen Puffer weder verändern noch transferieren.
Datenkopien für einen ausdrücklich übertragbaren Snapshot bleiben notwendig.
`historyBytes` und `pendingBytes` sind getrennte logische Budgetgrößen und keine
addierbare Messung physisch gemeinsam genutzten Speichers.

`ProjectSession` sendet jeweils den nächsten Journaleintrag und prüft die
Quittung gegen genau diese Transaktion. Erst dann gibt das Dokument Pendingdaten
für Projektion und Wiederholung gemeinsam frei. Controller-Doppelmap,
Schreibzähler und eigene Promise-Warteschlange entfallen. Live-Revision,
Storesequenz und gespeicherte Dateisequenz bleiben getrennt.

Recovery prüft Session und Sequenz der Arbeitskopie und wiederholt ursprüngliche
Transaktionskennungen. Der Store erkennt gleiche Wiederholungen am Payloadhash;
ein verlorenes Ack führt nicht zur doppelten Anwendung. Bei Fehlern bleiben die
angenommenen Änderungen und der sichtbare Fehler erhalten.

`whenActionFinished` ist die gemeinsame Barriere für Undo/Redo, Save, Recovery
und Dateiaktionen. Sie wartet auf die vollständig materialisierte versiegelte
Aktion, bevor Writer oder Snapshot ihren Stand auswählen.
Neu, Öffnen und natives Schließen sperren Eingabe, versiegeln die aktive Geste und
warten auf diesen Abschluss sowie auf Writes. Der Host bietet danach Save/Discard/Cancel. Die Sperre hat
einen Besitzer; eine abgewiesene konkurrierende Aktion hebt sie nicht auf.
Fehlgeschlagener Save oder fehlende Editorbestätigung schließen das Fenster nicht.
Cancel und fehlgeschlagenes Open erhalten angenommene Arbeit und History.
Ein erfolgreicher Projektwechsel beziehungsweise Disposal invalidiert die alte
Fortsetzung; ausstehende Barrieren werden abgewiesen und alte Async-Antworten
können keine neue Sitzung verändern.

Save pinnt Sequenz S über eine zusätzliche reine SQLite-Leseverbindung,
schreibt eine synchronisierte temporäre Datei und veröffentlicht atomar.
Spätere Bearbeitung bleibt ungespeichert. Regionale Reads können während
asynchroner Snapshot-/Publishphasen die Mutationsqueue umgehen; synchrone
Transaktionen werden nicht halb gelesen. Die zusätzliche Snapshotverbindung
ist keine zweite Dokumentautorität.

### Diagnose und Prüfgrenze

Nur `ATLAS_P0_DIAGNOSTICS=1` aktiviert Journal, synthetischen Lastworker,
Performance-Marks und Störfälle. Der normale Editor verwendet dieselben
Freigabe- und Renderpfade ohne Diagnoseschnittstellen.

Schema 6 hält Eingabe, Annahme/Reservierung, Materialisierung, Versiegelung,
Aktionsabschluss und tatsächlichen Submit getrennt. Exakte Ordinalbereiche
belegen jede Reservierungsübernahme genau einmal; vollständige Render-Receipts
belegen nur ihre eingefrorene Wirkung. Ein bereits aktueller Endstand darf denselben früheren Submit zum
Abschluss verwenden; seine Zeit wird nicht umgeschrieben. GPU-Abschluss ist ein
zusätzlicher Produktfakt und ersetzt keine tatsächliche Bildschirmpräsentation.

`atlas-p0-evaluate.mjs` berechnet funktionale und Szenariofakten einmal pro Lauf.
Versuchsindizes referenzieren bereits interpretierte Gesten. Begrenztes Urteil
und native Abnahme verwenden dieselben Ergebnisse; die native Ebene ergänzt
Referenz, Präsentationszuordnung und Stichprobenumfang. Globale Vollständigkeit
für fehlende, doppelte und unzugeordnete Eingaben bleibt eine Pflichtprüfung.
Historische rote Journale bleiben rot; alte Schemas erhalten keine neue Bedeutung.

Der R4-Zweck desselben Runners verwendet eine feste kleine Matrix und zwei
frische Prozessgruppen. Die Inhaltsprüfung beobachtet höchstens 256 vorher
festgelegte Autorenstützstellen, ihre tatsächlichen Werte und die vorhandenen
C1-Konten. Sie lädt keine Quellen, verändert keine Bereitschaft und bildet
keinen zweiten Autorenstand. Annahme-, Materialisierungs-, Abschluss- und
Undo-Belege bleiben an Session und Geste gebunden. Beobachtungsarbeit erhält
eigene CPU-Zeiten und zählt im gemeinsamen Arbeitsbudget mit.

Die unabhängige Referenz erhält den vollständigen normalisierten Eingabestrom
und die beobachteten kausalen Fenster. Normale Zeitwirkung wird zusätzlich ohne
50-ms-Kappung bewertet. Ganze Sekunden verwenden konservative Grenzen aus
umgebenden Kontoständen. Belegen diese weder ausreichende Wirkung noch einen
Fehler, bleibt der betreffende Nachweis offen; eine ungenaue Abtastung wird
nicht als bewiesener Produktfehler ausgegeben. Der erste lokale Eingriff nach
Navigation verwendet den vorhandenen Bereitschaftsmonitor. Normale längere
Wege warten dagegen auf die tatsächlich vorhandene Bereitschaft ihrer ganzen
Spur. Beide Beobachtungen bleiben getrennt.

Die optionale GPU-Diagnose umschließt alle tatsächlich verwendeten WebGL-Befehle
eines Pakets vom ersten Befehl bis unmittelbar vor dessen vorhandener Fence.
Uploads, Allokationen, Freigaben und Kopien gehören damit zum selben Intervall
wie die Draws. Ein Diagnosebeobachter bindet die Query über das tatsächlich
erzeugte WebGLSync an die gleiche monotone Fence-ID wie das Terrain- oder
Scene-Ereignis. So zählt auch GL-Arbeit vor dem CPU-Paketmarker vollständig;
Zeitnähe ersetzt keine Identität. Queries werden erst nach Verfügbarkeit
ausgelesen; es entstehen keine zusätzlichen Produkt-Fences oder synchronen
GPU-Warteaufrufe. Die gemeinsame Auswertung verlangt eine eindeutige
Zuordnung sämtlicher Queries und Produktpakete.
Fehlende, mehrdeutige, unterbrochene oder doppelte Zuordnung liefert keinen
Paketnachweis. Der ältere reine Draw-Modus bleibt ausdrücklich enger begrenzt.

`height-draw` benennt Upload, tatsächlichen Submit und Arbeitsmengen getrennt:
kanonische Samples, Deltasamples, unveränderte Basiskopien, warme Basisaufnahmen,
kanonische Basisaufbauten, horizontale Samples, Farbsamples und zugelassene
Projektionsprodukte. Der Produktzähler beschreibt geplante gewichtete Produkte,
keine gemessene GPU-Instruktionszahl; leere Seiten dürfen Nullarbeit überspringen.
GL-Drawanzahl ist keine Pixelanzahl.
`gpu-completed` benennt den später abgefragten Abschluss mit derselben
Frame-/Session-/Ansichtskennung. Keines dieser Ereignisse beweist native Präsentation.

Smoke und GPU-Prüfung starten den echten Desktop und verwenden reale Projekte.
CPU-Referenz, sichtbare Pixel, History, Datei-/Prozessneustart, Kontextverlust,
feine Übersicht, wiederholte Ankerwechsel und Fehlerfälle prüfen die Änderung.
Der lange 512-Pixel-Verlauf und die einfache/22-Stufen-/statische Grafikmatrix
behalten ihre Eingaben und Grenzwerte. Instrumentierung kann Laufzeiten verändern.

Die native Traceanbindung bleibt offen: Der vorhandene Kandidat verbindet eine
exakte Terrainrevision nicht nachweislich mit ihrer ersten tatsächlichen
Präsentation. Vorprüfung und Auswertung bleiben deshalb fehlerschließend.
R4s tatsächlich sichtbarer Ergebnistakt ist ein eigener offener Messnachweis;
GPU-Paketzeit, RAF oder ein korrektes Endbild ersetzen ihn nicht. Das gemeinsame
R4-Urteil beschreibt die Erfüllung der Messanforderungen. Die begrenzte
Fortsetzung mit R5 folgt der ausdrücklichen
[Arbeitsentscheidung](implementation/status.md#arbeitsentscheidung).
Die native P0-Abnahme benötigt weiterhin sämtliche erforderlichen Inhalts-,
Zeit-, Ressourcen- und Hardwarebelege.
Native Umgebung, Referenz und vollständige Stichprobe stehen im
[Prüfvertrag](implementation/atlas-rebuild-plan.md#6-prüf--und-performancevertrag),
aktuelle Ergebnisse ausschließlich im Status.
