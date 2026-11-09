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

`src/editor/main.tsx` und `desktop/` bilden den gesonderten P0-Einstieg:
Electron 44.10.2, React-Panels und eine beibehaltene PixiJS-8.22.0-WebGL-Szene.
Der [Produktvertrag](product-contract.md#optionaler-atlas-p0-versuch) besitzt
Bedienverhalten, Format und Grenzen. Ausbau und Abnahme stehen im
[Neubauplan](implementation/atlas-rebuild-plan.md), aktuelle Ergebnisse im
[Status](implementation/status.md).

| Besitzer                                                   | Verantwortung                                                                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EditorController`                                         | Effektive Einstellungen, normalisierte Eingaben, Kamera, lokale Freigabe, Gesten, ausstehende Dosis und geordnete Persistenz; einziger Framekoordinator. |
| `brush.ts`                                                 | Drei Gestenzustände und reine Entscheidung über Zielpunkt, Zeitverbrauch, Warten und nächste Folgedosis.                                                 |
| `model/EditorDocument`                                     | Aktive Autoren, ausdrücklich übergebene Segmente, Gestentransaktionen, eigene Patches, lokale History, Quellenbereitschaft und Speicherbudgets.          |
| `model/height.ts`, `height-grid.ts`, `overview.ts`         | Kanonische Höhenmathematik und Lesebereiche, numerische Übersicht sowie CPU-Referenz für numerische Ausnahmefälle.                                       |
| `render/WorldRenderer`                                     | Beibehaltene Pixi-Kacheln, lokale Invalidierung, begrenzte Ressourcenübernahme und tatsächliche Submitbelege.                                            |
| `render/HeightField`, `height-field-data`, `height-shader` | Abgeleiteter numerischer GPU-Atlas, Kacheldeskriptoren samt kubischem Halo und gecachte GPU-Farbkacheln.                                                 |
| `render/height-atlas-upload`, `raster.ts`                  | Begrenzte Teiluploads des Höhenatlas sowie kanonischer Float64-Darstellungsfallback und gemeinsame Farbgrenzenregel.                                     |
| `observation.ts`                                           | Optionales Journal und lesende Zuordnung von Eingaben, Dosen, Commit und tatsächlichen Submits.                                                          |
| `desktop/main.ts`, `preload.ts`                            | Fenster, native Dialoge, Session-/Dateigrenzen und typisierte IPC-Brücke.                                                                                |
| `desktop/store-process.ts`, `project-store.ts`             | SQLite-Arbeitskopie, räumliche Reads, Autoren-/Übersichtstransaktionen und Dateisnapshots im Utility-Prozess.                                            |

React hält nur noch nicht übernommene Texte numerischer Felder; Blur oder Enter
übernimmt sie in den Controller. Werkzeugmodus, Größe, Stärke, Raster und
Laufzeitfehler besitzen dort einen wirksamen Zustand. Saved/Dirty folgt
Dokumentsequenz, gespeicherter Sequenz und aktiver Geste.

Der Renderer besitzt keine Node-Integration; Context Isolation und Sandbox sind
aktiv. Main und Renderer führen weder SQL noch Dateiexporte aus. Das Buildskript
prüft SQLite in der tatsächlichen Electron-Laufzeit und baut bei unpassender ABI neu.

### Quellen, Übersicht und Reads

Höhenautoren sind sparse 64×64-`Float64`-Kacheln mit relativen Restwerten auf
Stufen 0–21. Der gemeinsame Sampler rekonstruiert die positiven kubischen
B-Spline-Restfelder, addiert sie zum Ozean-Grundwert und begrenzt erst die fertige
Summe. Grobe Striche ändern ausschließlich ihre Autorenstufe. `height-grid.ts`
bleibt die CPU-Referenz für Darstellungswerte und den numerischen Ausnahmefallback;
bei Extremwerten erhält es die kanonische Akkumulationsreihenfolge.

`readPresentation` liefert benötigte grobe Autoren und numerische Übersichten
feinerer Beiträge. Deren 128×128 Weltabtastpunkte folgen dem Darstellungsraster,
auch am Weltrand ohne Stauchung. Sie speichern unbeschnittene, durch 32 skalierte
relative Beiträge; weder Farben noch Ozeangrundwert. Erst die Darstellung addiert
grobe Autoren und Grundwert und begrenzt die Summe. Quellen und Übersichten sind
verschiedene Typen.

Autoren und betroffene Übersichtsvorfahren werden in einer geordneten
SQLite-Transaktion gepflegt. Store und lokale Projektion teilen die reinen
Deltafunktionen. Der Übersichtsschreibcache ist auf 32 MiB begrenzt;
Aufbau-/Commit-/Readkosten bleiben beobachtbar. Format 24 speichert die abgeleiteten
Kacheln mit bestätigter Sequenz; Öffnen berechnet keine weltweite Übersicht neu.

`readRegion(minLevel)` liefert exakte Quellen der benötigten Autorenstufe und
gröberer Stufen. Raum und Stufe werden bereits im RTree begrenzt, vor der
Enumeration feiner Treffer. Höchstens 512 Autorenkacheln werden geliefert;
grobe Darstellung verlangt keine vollständige Feinquellenabdeckung.

Quellenbereitschaft gehört zu Ausschnitt und Stufen. Das Modell hält vorhandene
`ready`-Quellen und vorübergehend unbestätigte lokale Löschungen (`absent`).
Regionale Flächenbelege bestätigen gelesene Abwesenheit; ein fehlender Schlüssel
ohne Beleg ist `unknown` und benötigt keinen eigenen Metadateneintrag. Auch die
bestätigte leere Neuanlage beginnt mit einem gewöhnlichen Ganzweltbeleg.

Der Controller hält höchstens zwei Anforderungen aus Bereich und Mindeststufe:
Darstellung und vollständiger aktueller Werkzeugbereich einschließlich Halo.
Flächenbelege werden darauf geschnitten, bevor unbenötigte bestätigte Quellen
entfallen. Jeder verbleibende Beleg setzt voraus, dass alle positiven Quellen
seiner Stufen mit überlappendem kubischem Stützbereich noch resident sind.
Herauszoomen gibt auch feinere Quellen innerhalb des Weltbereichs frei. Die
entfernten Schlüssel werden zugleich aus dem numerischen GPU-Abbild entfernt; numerische
Übersichten bleiben davon getrennt. Aktive und unbestätigte Änderungen bleiben
gepinnt, bestätigte Löschmarker entfallen. Einträge und Flächenbelege sind in den
Ressourcenmetriken sichtbar.

Laufende Reads und Ladefehler gehören zum Controller. Der gemeinsame Ladeablauf
hält einen laufenden Read und den aktuellen Folgebedarf. Kamerabewegung und
aktueller Werkzeugbedarf fordern Daten unabhängig von Modellgesten an; ein während
des Lesens veränderter Werkzeugbereich wird vor dem nächsten Read neu bestimmt.
`scheduleLoad` setzt dafür einen Bedarfsmarker, den der einzige Framekoordinator
abnimmt. Die vorhandene Read-Schleife fasst Änderungen während eines Reads zum
aktuellen Folgebedarf zusammen.

Beide Lesezwecke teilen `readCurrent` für Session-/Navigations- und Sequenzprüfung.
Überholt ein Persistenz-Ack den gelesenen Stand, wird neu gelesen. Auch das Modell
verwirft Antworten unterhalb seiner bestätigten Sequenz vor jeder Mutation;
entfernte Einzelmetadaten müssen alte Reads deshalb nicht dauerhaft abwehren.
Gültige Antworten
werden synchron übernommen: Zwischen Prüfung, Übernahme und lokaler
Patchprojektion liegt kein `await`, in dem das Ack benötigte Patches freigeben
könnte. Eigene aktive/unbestätigte Patches werden auf den gelesenen Stand
projiziert; bestätigte Patches bleiben nicht dauerhaft erhalten. Das Pendingbudget
zählt dafür Vorher-/Nachherwerte einschließlich Löschungen; Gesten reservieren
künftigen Patchumfang vor Mutation, Acks geben ihn frei.

### Lokale Freigabe und Frameablauf

`localReadiness` verbindet Quellenabdeckung und tatsächlich eingereichtes lokales
Terrain zu einem abgeleiteten Zustand. Eingabe, Cursor/Status und lesende Diagnose
verwenden denselben Wert. `WorldRenderer.inspectRegion` prüft die zuletzt wirklich
eingereichte Ansicht und die Kachel-Submitstempel. Es liefert `outside` für einen
vollständig unsichtbaren Bereich, `missing` für eine fehlende eingereichte
Grundlage, `stale` für eine vorhandene Grundlage mit offenen lokalen Änderungen
und `current` für den aktuellen eingereichten Bereich. `outside` ist kein
Submitbeleg. Der sichtbare Wirkbereich umfasst bei Bewegung das Segment;
unsichtbare Halos benötigen Quellen, keine eigene Darstellung. Die genaue
Gesten- und Wartesemantik steht im Produktvertrag.

Kameraänderungen und Resize bereiten die neue Kachelauswahl synchron vor.
Quellenantworten beginnen oder reaktivieren keine Geste. `BrushState` unterscheidet
`idle`, `blocked` mit physisch noch gehaltener Taste und `active` mit einem
`BrushStroke`. Der Strich hält Segmentanker, jüngste Zeigerposition und letzten
untersuchten Zeitpunkt. `brushTarget` wählt den zu prüfenden Zielpunkt;
`decideBrushFrame` liefert rein die nächste begrenzte Dosis oder Warteentscheidung.
Bei eigenem Feedback aktualisiert die Entscheidung den Anker, verbraucht aber
Wartezeit und Weg ohne spätere Nachholung. Fehlende Quellen oder Terrain beenden
die Geste; der Controller erhält die Sperre bis zum Loslassen. Eine gültige
Down-Eingabe wendet die nominale Press-Dosis synchron an, damit Down/Up zwischen
zwei Frames einen kurzen Klick behalten.

Der Controller hält die noch nicht dargestellte Dosis unabhängig vom Gestenzustand
in `awaitingDose`. Sie überlebt Pointerup und verhindert weitere unsichtbare
Dosen. Ein aktueller lokaler Submit gibt sie frei; vollständiges Verlassen der
Ansicht macht sie für die Rückkopplung gegenstandslos, ohne einen Submit zu
behaupten. Das Modell erhält ausschließlich
`applySegment(from, to, elapsedMs)`. Es führt keinen eigenen Segmentanker und
kennt weder Uhr noch Frameplanung. Controller und Modell verwenden dieselbe
reine Funktion `heightBrushReadBounds` für Segment und Quellenhalo.

Der einzige RAF gehört dem Controller. Er startet zusammengefassten Ladebedarf
und ruft `WorldRenderer.renderFrame` auf. Diese Methode lädt geänderte numerische
Ressourcen im bestehenden Budget hoch, komponiert betroffene Farbkacheln und
zeichnet die Szene. Ausschließlich nach der tatsächlichen Zeichnung gibt sie
einen `FrameSubmission` zurück. Der Controller
übergibt den Beleg an die Beobachtung, löst passende Rückkopplung und berechnet die
lokale Freigabe. Erst danach entscheidet er über die nächste Halte-/Bewegungsdosis
und reicht deren Patches weiter. Dadurch entwertet die nächste Änderung einen
fertigen Stand nicht vor dessen Darstellung. Der Renderer besitzt weder einen
eigenen RAF noch einen Callback zur Eingabefreigabe. Ein Rasterworker und seine
Batch-/Resultatwarteschlange gehören nicht mehr zum interaktiven Höhenpfad.

Angenommene Abschnitte liefern eigene Patches nur für geänderte Quellen. Der
numerische Atlas ist ein abgeleitetes GPU-Abbild; `EditorDocument` bleibt der
einzige Besitzer bearbeiteter Werte. Quellen werden einschließlich ihres
kubischen Nachbarrands gepackt. Zwei `Float32`-Anteile bewahren den hohen und
niedrigen Anteil von Koeffizienten, Splinegewichten und Übersichtswerten.
Deskriptoren wählen für eine Darstellungskachel alle relevanten der 22 Stufen.
Die CPU berechnet die kubischen Gewichte der 128 Positionen jeder Achse einmal
in `Float64`; der Shader verwendet diese lokalen Indizes und Gewichte. Absolute
Weltkoordinaten und eine erneute kubische Gewichtsauswertung je Pixel entfallen
im Shader. Die Addition und einmalige Höhenbegrenzung folgen derselben
Felddefinition wie Modell und numerische Übersichten.

Dirtybereiche bestimmen die betroffenen Darstellungskacheln. Der Shader komponiert
deren 128×128-Farbbild in eine beibehaltene GPU-Textur; Kamera-, Cursor- und
Overlayframes zeichnen anschließend diese Sprites. Ein unveränderter Bildinhalt
führt deshalb nicht erneut alle kubischen Höhenabfragen aus. Geänderte Atlaszeilen,
Deskriptoren und Übersichten werden innerhalb des Uploadbudgets übertragen.
Solange notwendige Ressourcen noch fehlen, bleibt das bisherige Farbbild bestehen;
es erhält keinen aktuellen lokalen Submitstempel. Ressourcen und numerische
Abbilder sind keine zusätzliche Vorschau oder spätere Autorenübernahme.

Ein verlorener WebGL-Kontext entwertet sofort alle Darstellungsbelege und sperrt
neue Zeichnungen. Nach Wiederherstellung werden sämtliche numerischen Ressourcen
erneut innerhalb des Uploadbudgets übertragen und alle Farbkacheln neu aufgebaut.
Erst ein erfolgreicher neuer Draw gibt den jeweiligen Bereich wieder frei.
Die CPU-Autorenwerte und gespeicherten Quellen bleiben dabei erhalten.

Für endliche Werte außerhalb des sicher auf der GPU darstellbaren Zahlenbereichs
verwendet allein die betroffene Farbkachel den kanonischen `Float64`-Sampler und
`rasterize`. Das bewahrt insbesondere die Akkumulationsreihenfolge extrem großer,
sich aufhebender Beiträge. Der Fallback schreibt keine Autoren, und gewöhnliche
Pinseländerungen durchlaufen keinen zusätzlichen CPU-Rasterpfad. Dieselbe
Darstellungsregel in CPU-Fallback und Shader setzt Höhen innerhalb `1e-6` Fuß
der Farbgrenzen 0 und 12 auf die Grenze. Die GPU-Auswertung ist auf dieser
Höhengenauigkeit mit der CPU-Referenz zu vergleichen; beliebig nahe an einer
Bandgrenze können unterschiedliche Rundungen die Farbentscheidung beeinflussen.
Exakte Abfragen und gespeicherte Werte werden dadurch nicht gerundet.

Ein aktueller lokaler Submit verlangt den vollständigen sichtbaren Prüfbereich.
Offene Dirtyrechtecke zählen nur, soweit sie diesen Bereich überlappen;
unveränderte Kacheln dürfen einen älteren Revisionsstempel behalten. Frame,
Session und Ansicht müssen zum tatsächlichen Submit gehören. `exactRevision`
bezeichnet eine in diesem Submit vollständig aktuelle Ansicht;
`submittedRevision` hält den letzten solchen Stand. Lokale Kachelstempel können
bereits eine aktuelle Teilansicht belegen. Geänderte Freigabe und Pointerup können
einen Overlayframe anfordern, auch ohne neue Modellrevision. Kameraoffsets werden vor der
GPU-Übergabe abgezogen. `budgets.ts` begrenzt Quellen, History, Pendingdaten,
CPU-/GPU-Darstellungen und Uploadbytes je Frame.

### History, Persistenz und Datei

Gestenabschluss fasst Abschnitte zu einer Undo-Aktion zusammen. Vorherbilder
bleiben lokal, Nachherbilder gehen an den Store; Undo/Redo teilen den Patchpfad.
Die gemeinsame Grenze von 512 Autorenkacheln je atomarer Aktion gilt vor der
Modellmutation sowie an Host und Store. Der Store prüft Session, Sequenz und
Transaktionsidentität: identische Wiederholungen werden bestätigt, widersprüchliche
abgelehnt. Live-Revision, Arbeitskopie und gespeicherte Sequenz bleiben getrennt.

Neu, Öffnen und natives Schließen verwenden dieselbe Renderer-Vorbereitung:
Eingabe sperren, aktive Geste abschließen und ausstehende Writes abwarten. Erst
der bestätigte lokale Stand erreicht Save/Discard/Cancel im Host. Abbruch oder
fehlende Rendererbestätigung halten das Fenster und Dokument offen. Eine
Besitzkennung verhindert, dass eine abgewiesene parallele Aktion die Sperre eines
anderen Dateivorgangs aufhebt.

Bei Schreibfehlern bleiben die bestehenden begrenzten ChangeSets bis zur
Bestätigung erhalten. Der sichtbare Persistenzfehler bleibt unabhängig von
anderen UI-Aktionen bestehen. Wiederherstellung liest zuerst Session und Sequenz
der Arbeitskopie und sendet erhaltene Transaktionskennungen über denselben
idempotenten Commitpfad. Er prüft auch den Payloadhash; ein verlorenes Ack kann
keine zweite Anwendung auslösen. Erst der vollständige Abgleich setzt die
Schreibqueue zurück. Ausdrückliches Verwerfen erlaubt den Projektwechsel auch
bei ausgefallenem Store; ein fehlgeschlagener Rettungsversuch erhält die Änderungen.

Speichern fixiert einen SQLite-Lesesnapshot und veröffentlicht ihn über eine
synchronisierte temporäre Datei mit atomarem Rename. `readRegion` und
`readPresentation` laufen synchron auf derselben Arbeitskopie im selben
Utility-Prozess. Während asynchroner Snapshot-/Publishphasen umgehen sie die
Mutationsqueue; Commit, Dateivorgänge und Projektlebenszyklus bleiben geordnet.
Synchrone Transaktionen werden nicht halb gelesen. Reads dürfen wartende Writes
überholen und benennen deshalb ihre tatsächliche Session/Sequenz. Gemeinsame
Antwortprüfung und lokale Projektion verhindern Rückfälle auf ältere Daten.
Es gibt dafür weder eine zweite SQLite-Verbindung noch eine zweite Dokumentautorität.

### Diagnose und Prüfgrenze

Ausführliche Beobachtung, synthetischer Sampling-Lastworker und Renderstörungen
entstehen nur mit `ATLAS_P0_DIAGNOSTICS=1`. Der Normalstart besitzt keine
`atlasObserve`-Anbindung, Host-Diagnose, Atlas-Performance-Marks oder Belastungs-UI.
Produktfreigabe und Renderabschluss hängen nicht von Diagnose ab.

`Observation` erhält Fakten vom Controller und tatsächliche `FrameSubmission`s.
Nur bei eingeschalteter Diagnose hält es offene Zuordnungen für Dosen, Commit und
Navigation. Der Controller besitzt die Eingabe-IDs. Jede angenommene Dosis liefert
einen `brush-interval` mit Modellzeit `at`, Projektionsabschluss `projectedAt`,
Segment, angenommener Zeit und Eingabe-IDs. Ein fehlender Projektionsabschluss
bleibt mit `projectedAt: null` sichtbar und erhält keinen Dosis-Submitbeleg.
`brush-submit` verbindet eine erfolgreich projizierte Dosis über
Session, Geste, Intervall und Revision mit einem tatsächlichen `submit` derselben
Ansicht und desselben Frames. Der Abschluss einer geänderten Geste per Pointerup
liefert `commit`; dessen `edit-submit` bindet auch die Dokumentsequenz.
Die Beobachtung liest regionale
Submitbelege und abgeleitete Bereitschaft, verändert aber weder Produktzustand
noch Frameplanung.

Journal und Laufberichte verwenden Schema 4. `extractSubmissionEvidence` in
`scripts/atlas-p0-evaluate.mjs` verbindet Eingabe, Dosis oder Commit, lokalen
Beleg und tatsächlichen Frame. Sammler, Wiederholung gespeicherter Journale und
Zeitzerlegung verwenden diese Extraktion; Navigation und kalte Freigabe teilen
ebenfalls eine Extraktion. `evaluateAttempt` und `evaluateScenario` besitzen die
gemeinsamen Versuchs- und Szenarioregeln. `scenario.evaluation` hält das eine
abgeleitete Szenariourteil; Inhalts- und Messfakten bleiben davon getrennt.
Fehlende Eingaben, Identitäten, Bereiche oder Zeitstempel werden als fehlende
Nachweise erhalten. Historische Journale einschließlich Schema 3 werden mit ihrem
damaligen Harnessstand ausgewertet; ihre Rasterworker-Messgrößen erhalten keine
Kompatibilitätsdeutung als aktuelle GPU-Zeitstufen.

`height-draw` erfasst Uploadbeginn, Uploadende und den tatsächlichen Szenen-Submit
in derselben Rendereruhr samt hochgeladenen Bytes, betroffenen Kacheln und
Fallback-Samples. Die Zeitzerlegung verbindet diese Fakten mit Eingaben,
Halteschritten und Pointerup. Sie erfindet keine Workerzeiten für den ersetzten
Rasterweg. Fehlende oder widersprüchliche Zeitstempel bleiben als unvollständiger
Nachweis sichtbar. Diese Uhren belegen keine native Präsentation.

Zustandsabfragen übertragen kein Journal. Monotone Ereignis-/Storecursor und
referenzierte Intervalle vermeiden Journalvollkopien pro Versuch. Ergebnisse
werden nach jedem Szenario mit Auswertung gesichert; ein atomarer Laufindex
enthält auch Fehler und fehlende Fälle. Produktquellen, Harness, Fixture und
Build besitzen getrennte Identitäten. Vorprüfung erfolgt vor Fixtureerzeugung;
Traces entstehen nur auf ausdrückliche Anforderung.

Der Gestenbeobachter prüft Eingabevorhandensein und lokale Commit-Submission
innerhalb derselben Rendererabfrage. Das Gestenjournal wird erst nach dieser
Submission oder nach einem ausdrücklichen Timeout übertragen. Seine Serialisierung
darf den noch ausstehenden Pointerup-Frame nicht selbst verzögern; fehlende
Eingaben, No-ops und ausstehende Ergebnisse bleiben im Ergebnis erhalten.

Der einzige Tracerecorder verwendet Electron Debugger/CDP und speichert den
rohen JSON-Stream, bevor uint64-Framekennungen verlustfrei gelesen werden.
Die kleine Präsentationsprobe aktiviert zusätzlich Chromium-Tracebilder.
Screenshotquelle und Framefolge werden nur mit vollständigen Reportern des
beobachteten Atlas-Renderers verglichen. Diese Verbindung bleibt ein Kandidat:
die Trace liefert keine gemeinsame Identität für Screenshot und seinen
Copy-/Refresh-Vorgang; die erste Präsentation einer exakten Terrainrevision ist
damit nicht bewiesen. Drei unabhängige Terrainbereiche sowie Drop-/Delay-Kontrollen
und Erholung prüfen den begrenzten Bildnachweis. Fehlende, mehrdeutige oder nur
zeitlich benachbarte Verbindungen erzeugen keinen akzeptierten Präsentationswert.

Smoke und Messsammlung teilen Prozessstart und Pixelerfassung. Der kurze CI-Smoke
prüft Normalstart ohne Diagnose, reale Eingaben/Dateien, einen echten Rendererhänger
und Fehler im Dateilebenszyklus. Ein separater Paketcheck prüft den tatsächlichen
ASAR-Inhalt und startet das gepackte Programm. Die Paketgrenze erlaubt nur
Renderer-/Desktopbuild und benötigte SQLite-Module, unabhängig von Sparse Checkout.
Die Typen des Auswerters werden direkt aus seinem geprüften JavaScript/JSDoc
abgeleitet; eine parallele manuelle Signaturdatei entfällt.

Kurze Probe und vollständige Sammlung teilen Gesten und Inhaltsprüfer. Echte
Eingaben, angenommene/verfallene Dosis, lokale Modelländerung und Render-Submit
bleiben unterscheidbar; Beobachtung setzt keine Bereitschaft. Gemessene Gesten
enthalten keine Screenshot-/Warmup-Pausen. Analytische Werte, räumlich getrennte
Pixelproben, History und gespeicherte Feindaten ergänzen den Inhaltstest.
Lastnachweise verlangen echte Sessionfortschritte und Überlappung mit erfolgreich
beendeten Dateioperationen. Der synthetische Worker ersetzt keine späteren Fachjobs.

`atlas-p0-gpu-check.mjs` prüft tatsächliche Editorpixel gegen die vorhandene
CPU-Rekonstruktion einschließlich gespeicherter numerischer Übersicht. Fälle an
beiden Farbgrenzen, an negativen Kachel- und Weltgrenzen, mit allen 22 Stufen und
extremer endlicher Auslöschung ergänzen die normalen Bedienprüfungen. Die
Autorenabfragen bleiben unverändert; die gemeinsame kleine Farbgrenzenregel wird
innerhalb und außerhalb ihres Bands geprüft. Ein separater 512-Pixel-Verlauf
prüft lange Bewegung, tatsächliche Zwischenbilder, Haltewirkung, Hänger und
abwechselnd feinere/grobere Autorenstufen. Der feste kurze 512-Pixel-Zeitfall und
seine Ziele werden dadurch nicht ersetzt.

Das verbindliche Szenarienmanifest, Stichproben, Fehlerkontrollen und native
Präsentationsanforderungen stehen im
[Prüfvertrag](implementation/atlas-rebuild-plan.md#6-prüf--und-performancevertrag).
Befehle stehen im README, vorhandene Nachweise und offene Implementierungs- oder
Umgebungsgrenzen ausschließlich im Status. Fehlende Präsentationszuordnung darf
nicht aus Submission- oder RAF-Zeiten ergänzt werden.
