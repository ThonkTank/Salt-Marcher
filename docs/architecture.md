# Architektur

`src/main.tsx` startet Atlas V7 in Tauri. React verarbeitet Eingaben und zeichnet
auf Canvas; Rust besitzt Dokument, Fachberechnung und SQLite. Der
[Produktvertrag](product-contract.md) definiert Verhalten, Format und Grenzen,
[README](../README.md) Einrichtung und Prüfablauf, [Status](implementation/status.md)
den zuletzt belegten Stand und offene Abnahmen.

Die folgenden V7-Besitzer und Zugriffspfade bleiben der Standard. Der gesonderte
[optionale P0-Versuch](#optionaler-atlas-p0-versuch) ergänzt einen begrenzten
Höheneditor, ohne den V7-Startpfad zu ersetzen.

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

| Besitzer                                 | Verantwortung                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/EditorDocument`                   | Autoren, Quellenabdeckung, atomare Änderungen, aktive Vorherbilder, History und das einzige Journal angenommener, noch unbestätigter Änderungen.               |
| `EditorController` mit `brush.ts`        | Wirksame Einstellungen, physische Eingabe, zeitlicher Pinselpfad, aktuelle Quellenanforderung, eine ausstehende Dosis und ein RAF; abgeleiteter React-Zustand. |
| `render/WorldRenderer` mit `HeightField` | Kamera, begrenzte Darstellungskacheln, numerische Ressourcen, lokale Invalidierung, tatsächliche Submits und GPU-Abschlüsse.                                   |
| `ProjectSession`                         | Ein geordneter Writer, Projekt-/Savedmetadaten, Schreibfehler/Recovery, Dateisperre und der gemeinsame Dateiablauf.                                            |

Die Projektsitzung hält keine zweite Änderungssammlung. Die Darstellung verändert
keine Autoren. Das Dokument kennt weder IPC noch Kamera oder eine Eingabeuhr;
es integriert nur ausdrücklich übergebene Segmente und Zeiten.
`brush.ts` bleibt eine reine Zustandsentscheidung, keine Werkzeug-Servicehierarchie.
React hält nur noch nicht übernommene Feldtexte; Undo, Saved, Writing, Loading und
Warteanzeige werden aus den Besitzern abgeleitet.

Main und Preload besitzen Fenster, native Dialoge und die typisierte IPC-Brücke.
Der SQLite-Store liegt im Utility-Prozess. Context Isolation und Sandbox bleiben
aktiv; der Renderer hat weder Node-Integration noch SQL-Zugriff.

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
mit Halo. Aktive und unbestätigte Änderungen bleiben gepinnt. Nicht benötigte
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

`localReadiness` kombiniert vollständige Quellen, lokal abgeschlossene Grafik,
ausstehende eigene Dosis und Projekt-/Fehlerzustand. Eingabe und UI verwenden
zusammen denselben Wert. `WorldRenderer.inspectRegion` unterscheidet `outside`,
`missing`, `stale` und `current` anhand der abgeschlossenen GPU-Arbeit derselben
Session und Ansicht. Für reine Submitbelege verwendet die Diagnose getrennt
`inspectSubmittedRegion`. Außerhalb der Ansicht entsteht kein Bildbeleg.

`BrushState` unterscheidet idle, blocked und active. Der aktive Strich hält
festgelegte Pinselparameter, Zeit und höchstens 128 wartende Bewegungspunkte.
Eine Dosis integriert ihre vollständigen Teilstrecken und die Verweilzeit am
letzten Punkt. Das Dokument prüft Quellen und Budgets des ganzen Fensters vor
Mutation. Eine Dosis erzeugt einen Patchsatz und eine Revision.

Der einzige Frameablauf ist gerichtet:

1. Den ausstehenden GPU-Fence einmal ohne Wartezeit prüfen und passende lokale
   Rückmeldung übernehmen.
2. Den neuesten fehlenden Quellenbedarf starten.
3. Höchstens eine zulässige zeitabhängige Dosis annehmen.
4. Begrenzte Uploads und Komposition ausführen, die Szene zeichnen und einen
   Fence hinter diesem tatsächlichen Paket setzen.
5. Submitfakten und abgeleitete Anzeige aktualisieren. Eine erfolglose
   Zeichenchance verwirft alte Wartezeit und alten Weg; danach entsteht keine Dosis.

Ein erfolgreicher Submit erhält in diesem Zeichenversuch den wartenden
Kurvenverlauf und gibt selbst keine weitere Dosis frei. Eine folgende tatsächlich
erfolglose Zeichenchance verwirft weiterhin alte Wartezeit und alten Weg. Down, Move und Up
prüfen denselben Fence ebenfalls nicht blockierend; ein bereits fertiges
Move/Up zwischen zwei RAFs bleibt damit erhalten. `clientWaitSync(..., 0, 0)`
fragt nur ab; es gibt weder `gl.finish` noch eine Warteschleife. Ein offenes
Grafikpaket verhindert weitere Draw-Einreichungen, während neueste Kamera- und
Eingabewünsche erhalten bleiben.

`awaitingDose` überlebt Pointerup. Passender lokaler GPU-Abschluss gibt sie frei;
vollständiges Verlassen des Bereichs löst nur diese Rückkopplung, ohne einen
Submit zu erfinden. Fehlende neue Quellen oder sichtbare Grundlage beenden die
Geste und verlangen erneutes Drücken. Die genaue D10-/D11-Semantik steht allein
im Produktvertrag.

### Numerischer Anker und lokale Änderung

Eine Darstellungskachel hält zwei numerische RG32F-Texturen und ihre Farbkachel.
Die beiden Float32-Kanäle speichern hohen und niedrigen Anteil einer ungeklemmten,
skalierten Gesamthöhe. Ein kalter Aufbau rekonstruiert die erforderlichen
Autorenstufen und addiert Übersicht plus Grundwert. Der anschließende Farbpass
begrenzt erst das vollständige Ergebnis und klassifiziert dessen Farbe.

Für eine warme Geste gilt `H_aktuell = H_anker + S(A_aktuell − A_anker)`.
Der Gesamtanker gehört zum selben Stand wie die vom Dokument geliehenen
unveränderlichen Vorherbilder. Jede Dosis wird erneut gegen diesen festen Stand
berechnet, nicht auf die vorherige Dosis addiert. Die unveränderten übrigen Stufen
werden im gewöhnlichen Deltaweg nicht erneut rekonstruiert. Auch eine bereits
in der Übersicht enthaltene aktive Stufe geht nur mit ihrer Änderung ein.

Anker werden erst beim ersten tatsächlichen Eingriff übernommen. Unberührte
Kacheln fördern keinen unbenutzten Zielpuffer zum neuen Anker. Kalt während einer
Geste aufgebaute Kacheln bleiben für diese Geste kanonisch; ihr späterer Gesamtstand
wird nicht fälschlich mit Vorherbildern des Gestenbeginns kombiniert. Undo/Redo
verwenden dieselben Vorher-/Nachherpatches und denselben Darstellungsweg.
Pointerup erzwingt keinen zusätzlichen vollständigen Aufbau.

Die Deltaabkürzung prüft den Wertebereich ihrer Differenzen unabhängig vom
Autorenbereich. Ein konservatives Abweichungsbudget begrenzt Ankerübernahmen;
spätestens nach 32 Übernahmen wird die betreffende Kachel kanonisch erneuert.
Starke Auslöschung kann deshalb den vollständigen GPU-Pfad verwenden. Außerhalb
des etablierten sicheren GPU-Zahlenbereichs bleibt der kanonische Float64-Fallback
für die betroffene Kachel erhalten. Diese Auswahl verändert keine Autorenwerte.

Kubische Gewichte entstehen achsenweise in Float64. Quellatlas und Deltaatlas
enthalten vollständige kubische Halos; beim feinen Delta darf die lokale
Seitentabelle breiter als beim groben kanonischen Aufbau sein. Absolute
Weltkoordinaten werden vor Float32-Transformationen relativ zur Kamera gebildet.

Dirtyrechtecke begrenzen die tatsächlich geschatteten Pixel. Beim ersten
Delta-Draw einer Geste werden zusätzlich unveränderte Ankerpixel in das neue
numerische Ziel übernommen. Weitere Dosen bearbeiten nur ihr Rechteck. Der
Farbpass aktualisiert denselben Bereich; Kamera und Cursor zeichnen behaltene
Sprites ohne Höhenrekonstruktion.

RG32F-Unterstützung wird mit Erweiterungsprüfung und echtem 1×1-Framebuffer
einschließlich Wiederherstellung der GL-Bindings geprüft. Fehlende Unterstützung
verwendet den vorhandenen CPU-Fallback. Kontextverlust entwertet Fence und
Darstellungsbelege; Wiederherstellung überträgt Quellen und baut Bilder neu auf.
Erst passend abgeschlossene Arbeit gibt Eingabe wieder frei.

Uploadbereitschaft folgt den wirklichen Seiten und Texturen der einzelnen
Kachel. Entfernte ausstehende Uploads sperren keine fertige lokale Komposition.
`budgets.ts` begrenzt Speicher, 4 MiB Upload pro Frame und Sample-/Stufenarbeit
je Grafikpaket. Der aktuelle Werkzeugort wird zuerst bearbeitet. Die beiden
numerischen 128²-Texturen kosten zusammen 256 KiB je Kachel; sie sind im
GPU-Budget enthalten. Quellspiegel, Deltaatlas, Deskriptoren, Gewichte und
Fallbackbilder sind ebenfalls erfasst.

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

Neu, Öffnen und natives Schließen sperren Eingabe, beenden die aktive Geste und
warten auf Writes. Der Host bietet danach Save/Discard/Cancel. Die Sperre hat
einen Besitzer; eine abgewiesene konkurrierende Aktion hebt sie nicht auf.
Fehlgeschlagener Save oder fehlende Editorbestätigung schließen das Fenster nicht.

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

Schema 5 hält Eingabe → Dosis → tatsächlichen Submit sowie Pointerup/Commit
getrennt. Ein bereits aktueller Endstand darf denselben früheren Submit zum
Abschluss verwenden; seine Zeit wird nicht umgeschrieben. GPU-Abschluss ist ein
zusätzlicher Produktfakt und ersetzt keine tatsächliche Bildschirmpräsentation.

`atlas-p0-evaluate.mjs` berechnet funktionale und Szenariofakten einmal pro Lauf.
Versuchsindizes referenzieren bereits interpretierte Gesten. Begrenztes Urteil
und native Abnahme verwenden dieselben Ergebnisse; die native Ebene ergänzt
Referenz, Präsentationszuordnung und Stichprobenumfang. Globale Vollständigkeit
für fehlende, doppelte und unzugeordnete Eingaben bleibt eine Pflichtprüfung.
Historische rote Journale bleiben rot; alte Schemas erhalten keine neue Bedeutung.

`height-draw` benennt Upload, tatsächlichen Submit und Arbeitsmengen getrennt:
kanonische Samples, Deltasamples, unveränderte Ankerkopien, Farbsamples und
gewichtete Sample-/Stufenarbeit. GL-Drawanzahl ist keine Pixelanzahl.
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
Native Umgebung, Referenz und vollständige Stichprobe stehen im
[Prüfvertrag](implementation/atlas-rebuild-plan.md#6-prüf--und-performancevertrag),
aktuelle Ergebnisse ausschließlich im Status.
