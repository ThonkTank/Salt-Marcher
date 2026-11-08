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

Der P0-Startpfad liegt in `src/editor/main.tsx` und `desktop/`. Electron 44.10.2
stellt das Fenster bereit, React die Bedienelemente und PixiJS 8.22.0 die
beibehaltene WebGL-Szene. Der Versuch umfasst den Höhenpfad des Neubauplans;
der vollständige F01–F19-Ausbau folgt erst nach dessen P0-Gate.

| Besitzer                                           | Verantwortung                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `EditorController`                                 | Effektive Einstellungen, Fehler, Kamera, Eingaben, abgeleitete lokale Freigabe, Gesten und geordnete Persistenzaufträge.       |
| `model/EditorDocument`                             | Live-Autoren, Gestentransaktionen, eigene Patches, lokale History, Quellenbereitschaft und Speicherbudgets.                    |
| `model/height.ts`, `height-grid.ts`, `overview.ts` | Gemeinsame Höhenmathematik, regelmäßiges Abtastraster und numerische Übersicht.                                                |
| `render/WorldRenderer`                             | Beibehaltene Pixi-Kacheln, lokale Invalidierung, priorisierte Rasteraufträge und Belege tatsächlich eingereichter Teilflächen. |
| `render/raster.worker.ts`                          | Rasterberechnung aus eigenen Quellkopien; keine zweite Dokumentautorität.                                                      |
| `desktop/main.ts`, `preload.ts`                    | Fenster, native Dialoge, Session-/Dateigrenzen und typisierte IPC-Brücke.                                                      |
| `desktop/store-process.ts`, `project-store.ts`     | SQLite-Arbeitskopie, räumliche Reads, Autoren-/Übersichtstransaktionen und Dateisnapshots im Utility-Prozess.                  |

React hält noch nicht übernommene Texte numerischer Eingabefelder; Blur oder
Enter übernimmt sie in den Controller. Werkzeugmodus, Größe, Stärke, Raster
und Laufzeitfehler haben dort einen wirksamen Zustand. Gespeichert/ungespeichert
folgt der Dokumentsequenz, gespeicherten Sequenz und aktiven Geste.
Der Renderer besitzt keine Node-Integration. Context Isolation und Sandbox sind
aktiv; Main und Renderer führen weder SQL noch Dateiexporte aus. Das Buildskript
prüft die SQLite-Bindung in der tatsächlichen Electron-Laufzeit und baut sie bei
unpassender ABI neu.

### Autoren und maßstabsgerechte Reads

Höhenautoren sind sparse 64 × 64 große `Float64`-Kacheln mit relativen Restwerten
auf Stufen 0–21; der Abstand beträgt `5 × 2^level` Fuß. Der gemeinsame Sampler
rekonstruiert vorhandene Stufen mit dem positiven kubischen B-Spline aus dem
V7-Kern, addiert alle Restfelder zum Ozean-Grundwert und begrenzt erst die fertige
Summe. Grobe Striche verändern ausschließlich ihre Autorenstufe.
`height-grid.ts` verwendet dieselbe Mathematik und nutzt horizontale Beiträge
zwischen Zeilen des regelmäßigen Rasters wieder. Extremwerte behalten die
kanonische Akkumulationsreihenfolge. Die beobachtbaren Grenzen stehen im
[P0-Produktvertrag](product-contract.md#optionaler-atlas-p0-versuch).

`readPresentation` liefert die für eine Darstellungsstufe nötigen groben Autoren
und numerische Übersichtskacheln der feineren Beiträge. Deren 128 × 128 feste
Weltabtastpunkte folgen dem Darstellungsraster; am Weltrand wird das Raster nicht
gestaucht. Die Übersicht enthält unbeschnittene, durch 32 skalierte relative
Höhenbeiträge, keine Farben und keinen Ozeangrundwert. Erst beim Rasterisieren
kommen grobe Autoren und Grundwert hinzu; danach erfolgt die einzige Begrenzung.
Eine veränderte Küste kann dadurch auch in der Übersicht neu entstehen.

Autoren und betroffene Übersichtsvorfahren werden in derselben geordneten
SQLite-Transaktion gepflegt. Der Übersichtsschreibcache ist auf 32 MiB begrenzt;
Aufbau-, Commit-, Read- und Writekosten bleiben beobachtbar. Der Store verwendet
dieselben reinen Deltafunktionen wie die lokale Projektion. Beim Öffnen wird
keine vollständige numerische Übersicht aus allen Autoren neu gerechnet.
Das eigenständige P0-Format 24 speichert die abgeleiteten Kacheln und ihren
bestätigten Sequenzstand; frühere Versuchsformate werden nicht migriert.

Exakte lokale Bearbeitung fordert über `readRegion(minLevel)` nur die nötige
Autorenstufe und gröbere Stufen an. Die räumliche und die Stufenbegrenzung liegen
im SQLite-RTree selbst. Ein äußerer Stufenfilter nach vollständiger Enumeration
feiner Treffer ist nicht der verwendete Pfad. Die Grenze von 512 gelieferten
Autorenkacheln bleibt bestehen; grobe Darstellung verlangt keine vollständige
Feinquellenabdeckung. Unbestätigte Feinwerte bleiben ausdrücklich unbekannt.

Quellenbereitschaft gehört zu Ausschnitt und Quellenstufen. `unknown`, `loading`,
`ready`, `absent` und `error` bleiben verschieden. Bestätigte entfernte Autoren
können aus dem Cache fallen; aktive und unbestätigte Änderungen bleiben erhalten.
Der gemeinsame Ladeablauf hält einen laufenden Read und den aktuellen Folgebedarf.
Zeigerbewegung, geänderte Pinselgröße und ein abgewiesener Druck können benötigte
lokale Quellen auch ohne Modellgeste anfordern. Eine Read-Antwort beginnt oder
reaktiviert keine Geste.

Beide Lesezwecke verwenden `readCurrent` für dieselbe Session-/Navigations- und
Sequenzprüfung. Hat eine Persistenzbestätigung den gelesenen Stand überholt,
wird erneut gelesen. Eine gültige Antwort wird unmittelbar synchron übernommen;
zwischen Prüfung und Übernahme beziehungsweise Patchprojektion liegt kein weiteres
`await`, in dem eine Bestätigung die noch benötigten Patches freigeben könnte.
Lokale noch unbestätigte und aktive Patches werden auf den zurückgegebenen
Sequenzstand projiziert. Bestätigte Patches bleiben dafür nicht dauerhaft erhalten.
Das Pendingbudget zählt die für diese Projektion gehaltenen Vorher- und
Nachherwerte, einschließlich Löschungen. Aktive Gesten reservieren ihren
künftigen Patchumfang vor der Mutation; eine Bestätigung gibt ihn wieder frei.

### Lokale Freigabe und Eingaben

`localReadiness` leitet einen gemeinsamen Zustand für Eingabeannahme, Cursor,
Status und lesende Diagnose ab. Nötige Quellen und Halos müssen vorhanden oder
bestätigt leer sein. Die Pinselfläche muss das Fenster mit positiver Fläche
schneiden. Der sichtbare Wirkbereich der nächsten Dosis, bei Bewegung einschließlich
des Segments vom letzten angenommenen zum aktuellen Punkt, muss im normalen
Renderpfad gezeichnet sein. Unsichtbare Teile des Eingriffs einschließlich seiner
Halos benötigen keine eigene Darstellung; fremde fehlende Bildschirmkacheln
sperren den lokalen Bereich nicht.

`regionDisplayed` prüft dazu die tatsächlichen Submitstempel der Kacheln und die
zuletzt eingereichte Ansicht. Vorbereitete Kacheln, hochgeladene Pixel oder eine
bereits geänderte Kamera vor dem nächsten Render genügen nicht. Eine bereits
gezeichnete Grundlage bleibt während einer eigenen noch ausstehenden Dosis
erkennbar; deren aktuelle Darstellung ist eine getrennte Rückkopplungsbedingung.
Kameraänderungen und Resize bereiten die neue Kachelauswahl synchron vor,
bevor ein Read für den übrigen Ausschnitt oder Navigationsrand abgeschlossen ist.
Die eigentliche Freigabe folgt anschließend dem lokalen Renderfortschritt,
auch im Normalstart ohne Diagnoseanbindung.

Noch ungezeichnete Flächen erhalten eine Schraffur; Cursor und Status zeigen
fehlende Bereitschaft sowie Ladefehler an. Ein Druck vor Freigabe erzeugt weder
Modellgeste noch vorgemerkte Dosis. Nach einer abgewiesenen oder wegen fehlender
Grundlage beendeten Geste ist ein neuer Druck nötig. Bei noch gehaltener Taste
erscheint der Hinweis zum Loslassen und erneuten Drücken. Quellen-Promises halten
keine Geste am Leben. Eine aktive Höhengeste besitzt den letzten angenommenen
Punkt, höchstens einen neuesten Zeigerpunkt und eine noch nicht dargestellte
Dosis; ältere noch nicht angenommene Punkte werden mit einem Grund verworfen.

### Änderung, Darstellung und Datei

Die Pinselstärke ist eine Rate. `applyPoint(point, elapsedMs)` integriert
ausschließlich die ausdrücklich angenommene Dauer entlang des Segments; bei
Stillstand wirkt derselbe Kern am festen Ort weiter. Ein Nullintervall setzt nur
den Startpunkt. Der reine Fachkern besitzt keine Uhr und keine Bildratenlogik.
Der Controller begrenzt jeden Schritt auf höchstens 50 ms Dosis und wartet vor
dem nächsten auf die aktuelle Darstellung des vorherigen Bereichs; diese
Schranke gilt auch über schnelle aufeinanderfolgende Gesten. Ein kleiner
Pressimpuls von 1/60 Sekunde erhält kurze Klicks. Wartezeit auf Darstellung sowie
Zeit oberhalb der Schrittgrenze verfällt. Der gültige Pressimpuls verwendet
denselben Freigabe-/Dosisvertrag wie Folgeframes und wird synchron angenommen;
auch Down und Up zwischen zwei Frames bleiben ein wirksamer kurzer Klick.
Während des Wartens auf eine eigene Dosis bleibt die Geste bestehen und setzt
nach der Rückmeldung am aktuellen Ort fort, ohne ausgelassene Wege oder Zeit
nachzuholen. Fehlen dagegen
neu benötigte Quellen oder die gezeichnete Grundlage für den nächsten Abschnitt,
endet die Geste vor diesem Abschnitt. Pointerup und Abbruch nehmen keine weitere
Dosis an. Eine verzögerte Darstellung bereits angenommener Änderungen bleibt möglich.
Bei einem ausdrücklichen Ortswechsel kann die Darstellungsverpflichtung für
einen vollständig verlassenen Bereich enden. Das wird gesondert beobachtet;
der Inhalt bleibt im Modell und wird bei Rückkehr aktuell dargestellt.

Ein angenommener Gestenabschnitt verändert das lokale Modell direkt und liefert
eigene Patches ausschließlich für geänderte Quellen. Diese gehen an Renderer
und Worker; vollständige Ausschnittskopien je Eingabe entfallen. Der Abschluss
fasst die Abschnitte zu einem Undo-Schritt zusammen. Vorherbilder bleiben lokal;
nur Nachherbilder gehen an den Store. Undo/Redo verwenden denselben Patchpfad.
Die gemeinsame Grenze von 512 Autorenkacheln je atomarer Aktion gilt bereits
vor der Modelländerung und erneut an Host und Store. Ein abgewiesener Abschnitt
verändert nichts; der vorher angenommene Teil bleibt abschließbar und umkehrbar.
Der Store prüft Session, Sequenz und Transaktionsidentität: identische
Wiederholungen werden bestätigt, widersprüchliche Wiederholungen abgelehnt.
Live-Revision, Arbeitskopie und ausdrücklich gespeicherte Sequenz sind getrennt.
Speichern fixiert einen SQLite-Lesesnapshot und veröffentlicht ihn über eine
synchronisierte temporäre Datei mit atomarem Rename; spätere Änderungen können
währenddessen weiterlaufen.

`readRegion` und `readPresentation` werden synchron im selben Utility-Prozess
und auf derselben Arbeitskopie beantwortet. Sie können während eines asynchronen
Snapshots oder Dateipublish antworten, ohne auf dessen Ende in der gemeinsamen
Queue zu warten. Commits, Save-Phasen,
Projektwechsel und Schließen bleiben gemeinsam geordnet; synchrone Transaktionen
werden nicht halb gelesen. Ein Read kann einen wartenden Write überholen und
benennt deshalb seine tatsächliche Session und Sequenz. Die gemeinsame
Antwortprüfung und lokale Patchprojektion schützen vor einem Rückfall auf einen
überholten Stand. Es gibt keinen zweiten SQLite-Besitzer und keine zusätzliche
Verbindung für diese Priorisierung.

Darstellungskacheln mit 128 × 128 Pixeln sind von Autorenkacheln getrennt.
Ein gemeinsamer Veröffentlichungsschritt übernimmt gültige Ergebnisse,
zeichnet sie und bestätigt die dadurch aktuelle Region. Er läuft bei Eingang
einer Rasterantwort und im normalen RAF. Fertige Ergebnisse warten damit nicht
pauschal auf den nächsten RAF; Übernahmezeit und Uploads teilen sich weiterhin
dieselben Budgets pro RAF-Intervall. Die dazwischen ausgeführte CPU-Arbeit bleibt
in der Framebilanz enthalten. Nur der normale RAF nimmt nach der Veröffentlichung
höchstens einen begrenzten Folgeimpuls am aktuellen Ort an und wählt Rasteraufträge
aus dem neuen Bedarf. Eine schnelle Antwort erzeugt keine zusätzliche Dosis.
Damit kann die nächste Änderung den gerade fertig gewordenen Stand nicht vor
seiner Darstellung wieder entwerten. Ein zweiter Gesten-RAF und Dispatch mitten
in einer Folge von Pinselabschnitten entfallen. Lokale Dirtybereiche begrenzen
Rasterarbeit und Uploads.

Der vorhandene Dispatcher priorisiert die angenommene lokale Änderung, den für
die Werkzeugfreigabe benötigten Bildaufbau und anschließend übrige sichtbare
Kacheln. Der Werkzeugort beziehungsweise die Ansichtsmitte geben kalten Kacheln
eine räumliche Priorität. Ein neuer Bedarf ersetzt den alten; es entsteht keine
zusätzliche Auftragsqueue. Lokale Ergebnisse werden nicht im selben Batch hinter
unabhängigem Bildaufbau zurückgehalten. Damit ein dauerhaft gehaltener Pinsel den
übrigen Bildaufbau nicht verdrängt, erhält nach vier konkurrierenden lokalen
Batches höchstens eine Restkachel ein eigenes begrenztes Paket; danach gilt
wieder die lokale Priorität.

Ein Worker verarbeitet
höchstens einen begrenzten Batch mit 16 Kacheln und 131.072 Pixeln gleichzeitig.
Innerhalb dieses Batches benötigen die Teilaufgaben keinen erneuten Hauptthread-
Roundtrip und verwenden denselben Quellstand. Der Batch enthält keine asynchrone
Unterbrechung, die neuere Quellen unter alten Revisionsangaben einmischen könnte.
Neuere Änderungen werden pro Kachel
als weiterer Dirtybereich zusammengefasst. Je Kachel gibt es nur einen noch nicht
übernommenen Auftrag. Ein passendes fertig berechnetes Rechteck wird vollständig
übernommen, auch wenn inzwischen weitere Eingaben vorliegen. Sein Quellstand
muss mindestens so neu sein wie der bereits angezeigte Stand; Session und Token
müssen passen. Alle neueren Änderungen bleiben für den Folgeauftrag vorgemerkt.
So werden echte berechnete Zwischenstände sichtbar, statt überlappende Ergebnisse
während eines laufenden Strichs fortwährend zu verwerfen. Die sichtbare Revision
ersetzt das frühere reine Bereitschafts-Flag. Wenige frühe Ergebnisse sind kein
hinreichender Nachweis kontinuierlicher Bearbeitung.

Ein exakter lokaler Submit wartet nur auf die betreffende Region. Eine teilweise
aktuelle Kachel bestätigt keinen noch offenen Bereich. Das getrennte Diagnose-
Receipt `input-covered` zeigt lediglich die vollständige Versionsabdeckung einer
Eingabe und die kleinste/größte sichtbare Kachelrevision. Ein solcher Zwischenstand
kann unterschiedliche Revisionen enthalten; er ist kein Nachweis einer gemeinsam
aktuellen Region. Er ersetzt weder `edit-submit` noch dessen unveränderte
50-ms-Prüfung. `submittedRevision` und `exactRevision` bestätigen weiterhin nur
den neuesten vollständig dargestellten Modellstand. `submission()` und die
lokalen Kachelstempel erfassen dagegen auch einen tatsächlich eingereichten,
lokal brauchbaren Teilviewport. Submitcallbacks können bei geänderter Freigabe
einen weiteren Overlayframe anfordern. Pointerup fordert auch
dann einen tatsächlichen Frame an, wenn die letzte Live-Revision schon sichtbar
war. Kameraoffsets werden vor der GPU-Übergabe abgezogen; Session, Revision und
monotone Tokens schützen vor überholten Ergebnissen. `budgets.ts` begrenzt
Quell-, History-, Präsentations-, GPU- und Pending-Speicher sowie Arbeit pro Frame.

### Diagnose und gemeinsamer Prüfablauf

Ausführliche Beobachtung und der synthetische Sampling-Lastworker entstehen nur
beim Start mit `ATLAS_P0_DIAGNOSTICS=1`. Der normale Start hat weder `atlasObserve`
noch Host-Diagnose, Ereignisjournal, Atlas-Performance-Marks oder Belastungs-UI.
Auch künstliche Renderstörungen sind an diesen Diagnosestart gebunden.
Beobachtung setzt niemals Bereitschaft oder Renderabschluss.

Zustandsabfragen übertragen kein Journal. Diagnose liest monotone Ereignis- und
Storecursor; Rohereignisse werden einmal je Prozess gesichert. Ein Szenarioablauf
liefert ein Ergebnis und seine sofortige Auswertung. Der atomare Laufindex nennt
geplante, laufende, abgeschlossene und fehlgeschlagene Fälle; ein Abbruch behält
Teilbelege und fehlende Fälle. Der Bericht referenziert Ereignisintervalle, statt
vergangene Save-Aktivität in jedem Versuch zu vervielfachen. Traces entstehen nur
mit `--trace`. Produktquellen, Prüfprogramm, Fixture und ausgeführter Build werden
getrennt identifiziert; die Umgebungsprüfung läuft vor der Fixtureerzeugung.

Die kurze Probe und `--full` verwenden dieselben realen Eingaben und Inhaltsprüfer.
Zeitlich gemessene bewegte Gesten laufen mit festen Eingabeintervallen ohne
Screenshots oder zusätzliche Wartephasen innerhalb der Geste. Analytische
Höhenproben, getrennte Bildpunkte und gespeicherte Feindaten-Digests ergänzen die
Zuordnung von Eingabe, Modell, Commit und tatsächlichem Render-Submit.
Zwei Zwischenstände verlangen zwei verschiedene Frames vor Pointerup und bleiben
eine Mindestkontrolle. Zusätzlich werden sämtliche Eingaben, offene Rückstände
und die längste Aktualisierungspause während weiterer Eingaben ausgewertet.
Das Pinseljournal trennt echte Mausereignisse, den nominalen Pressimpuls,
angenommene Halte-/Bewegungsintervalle und ausdrücklich verworfene Wartezeit.
Es prüft die Dosisgrenze und die tatsächliche Darstellung eines Schritts vor dem
nächsten sowie ausdrücklich beendete Darstellungsverpflichtungen bei einem
Ortswechsel. Absichtlich nicht angenommene Eingaben erhalten einen Grund und keine
erfundene Modelländerung oder Renderbestätigung.
Eine unveränderte Revision nach Loslassen ersetzt dessen Commit-/Submit-Zuordnung
nicht. Hintergrundreads gelten nicht allein aufgrund ihrer Existenz als
Kamerablockade; maßgeblich ist die beobachtete Eingabe-/Kamerareihenfolge.

Kalte Fälle unterscheiden Quellenbereitschaft (`sources-ready`) und die wirkliche
Produktfreigabe (`input-ready`). Der erste danach ausgelöste Strich verwendet
denselben Ablauf und dieselben Live-/50-ms-Kriterien wie ein warmer Strich.
Navigation, Ladezeit und Verzögerung zwischen Freigabe und Eingabe bleiben im
Journal und in den Gesamtzeiten enthalten. Frühe abgewiesene Eingaben werden
separat auf sichtbares Warten, ausbleibende Wirkung und einen späteren gültigen
neuen Gestenbeginn geprüft. Eine nachträglich angenommene Dosis ist keine
erfolgreiche Erholung dieses Vorabfalls.

`--full` verlangt drei unabhängige Gruppen mit je 100 Strichen pro warmem Fall,
34 kalten Ortswechseln mit Bearbeitung pro kaltem Fall und mindestens 30 Sekunden
Navigation mit beziehungsweise ohne Raster. Kalte Fälle beginnen nach normalem
Projektöffnen in einem ungeladenen Anwendungsausschnitt; sie behaupten keinen
geleerten Betriebssystem-Dateicache. Pflichtfälle, Fehlversuche und Timeouts
bleiben erhalten. Teilauswahl verkleinert das Abnahmemanifest nicht.

Scaling verwendet echte SQLite-Projekte mit 32, 1.024 und 9.000 Quellkacheln,
entsprechend 1, 32 und 281,25 MiB dekodierter ursprünglicher Autoren. Die größte
Menge überschreitet das aktive Quellbudget von 256 MiB. Gleiche Übersichten,
grobe Bearbeitung, Küsten-/Reliefpixel, Detailrückkehr, History, Save und
Prozessneustart müssen funktionieren. Vollständige Fine-Digests prüfen, dass
grobe Änderungen die feinen Autoren nicht umschreiben. Reads während einzelner
Zoomstufen, aktive Speicherstände und Übersichtspflege werden getrennt erfasst.

Der Busy-Fall verwendet eine Datei mit 9.008 echten Quellen und zweiter Küste.
Seine Speicherlast stammt aus diesem Inhalt. Der Sampling-Worker arbeitet auf
einem exakten Ausschnitt; bei grober Ansicht wird dafür ein begrenzter lokaler
Bereich geladen. Er gehört zur Projektsession und wird beim Wechsel abgebrochen.
Busy-Prüfungen verlangen tatsächlichen Fortschritt der aktuellen Session und
Überlappung mit erfolgreich beendeten Save-/Publishintervallen. Ein aktives Flag
allein reicht nicht. Dieser Lastfall ersetzt keine späteren produktiven Fachjobs.

Die Störungen `ignore-zoom`, `pointerup-render`, `delay-render` und `drop-render`
müssen die jeweiligen Prüfungen scheitern lassen; derselbe normale Pfad muss
sich erholen. Fehlende Inhalte, Ereignisverlust, überschrittene Budgets und
fehlende Lastüberlappung verhindern das funktionale PASS.
Submission und RAF bleiben Diagnosewerte. Native Leistung verlangt eine
qualifizierte Referenz sowie die Zuordnung von Atlas-Generation zur tatsächlich
präsentierten Canvas-/Compositorressource. Befehle stehen im README;
vorhandene Belege und offene Abnahmen ausschließlich im Statusdokument.
