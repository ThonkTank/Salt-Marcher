# Architektur

`src/main.tsx` startet Atlas V7 in Tauri. React verarbeitet Eingaben und zeichnet
auf Canvas; Rust besitzt Dokument, Fachberechnung und SQLite. Der
[Produktvertrag](product-contract.md) definiert Verhalten, Format und Grenzen,
[README](../README.md) Einrichtung und Prüfablauf, [Status](implementation/status.md)
den zuletzt belegten Stand und offene Abnahmen.

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
Autoren innerhalb einer zurückgerollten SQLite-Transaktion. Commit, Undo und Redo
verwenden denselben Schreibpfad für Autoren, Indizes, Zähler und History; erst
nach erfolgreichem Abschluss wird die neue Revision veröffentlicht.

Direkte Höhenstriche besitzen `beginTerrainStroke`, `appendTerrainStroke` und
`endTerrainStroke`. `terrain_stroke` hält Identität, Paketfolge, Autorenauflösung
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
Farben wie bei interaktiven Writes. SQLite kann Sortierspeicher benötigen.
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
| `ground`, `ground_store`                                                              | Farbauftrag auf dünn belegte RGBA-Autorenkacheln und deren Übersichtspyramide.                                                                     |
| `regions`, `region_store`                                                             | Katalog, Polygone, RTree und revisionsgebundene Reads; Beziehungen aus Schnittflächen ableiten.                                                    |
| `scenery`                                                                             | Deterministische Assetverteilung; Landschaftsstriche sind gewöhnliche Objektowner.                                                                 |

Der Flussprofilsolver verbindet Absenkung stromabwärts und Rückstau stromaufwärts
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
Darstellungsbudget ab. `terrain_raster` unterteilt nichtkonstante Bereiche bis zur
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

Land/Meer bestimmt exakte Abstände im überstrichenen Korridor. Ein temporärer
Segmentindex und zeilenweise Streckenbegrenzung liefern die Kandidaten für
Autorenreads und Höhenauftrag. Dieser Index lebt nur während eines Abschnitts.
Lokale und grobe Pinsel sammeln die benötigten Autorenblöcke je Quellauflösung
für den gesamten Abschnitt. Zeilenmasken erhalten exakt die Vereinigung der
Lesebereiche samt Spline-Stützrand; überlappende Bereiche lesen denselben Block
nur einmal. Unbelegte Quellauflösungen werden vorher übersprungen. Blockreads
und Blattaktualisierungen verlangen ausdrücklich die vorhandenen räumlichen
SQL-Indizes: Ein bloßer Level-Filter darf keinen globalen Quellscan verursachen.
Allgemeine große Ausschnittreads enumerieren weiterhin keine leeren Blockflächen.

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

`surface_tiles` und der versionierte Punktread `surfacePoints` teilen Sampler,
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
des neuen Ausschnitts ab. Doppelte Resize-Meldungen verändern keine Geste.
`editorSelection` besitzt Auswahlübergänge,
`useCamera` Navigation und Fit-Identität. `useRivers` hält Flussauswahl und
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
Bodenfarben verwenden je Zeichenaufruf einen Reliefleser, der die aktuelle
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

`TerrainPainter` zeichnet fertige Raster und Höhenlinien. Gemeinsame gerundete
Gerätepixelkanten vermeiden transparente Kachelnähte; der Quellhalo bleibt für die
Filterung erhalten. `terrainRaster` cached dekodierte Bilder nach Inhaltskennung,
ohne Transportobjekte festzuhalten. Bodenfarben verwenden vorbereitete Reliefwerte
und einen eigenen Pixelhalo. Untergetauchte Flussbänder werden an Gewässerflächen
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
