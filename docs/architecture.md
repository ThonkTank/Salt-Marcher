# Architektur

`src/main.tsx` startet Atlas V7 in Tauri. React zeichnet auf Canvas; Rust besitzt
das Dokument in SQLite. Der [Produktvertrag](product-contract.md) definiert
Verhalten, Dateiformat und Grenzen. [README](../README.md) beschreibt Einrichtung
und Befehle, [Status](implementation/status.md) Prüfstand und offene Abnahmen.

## Dokument, Änderungen und Dateien

`DocumentWorker` besitzt den Dokumentthread mit begrenzter FIFO für Desktop und
Browsertests. `atlas/application` besitzt SQLite und Dokumentstatus; seine einzige
Commandliste verbindet Deserialisierung, Dispatch, Antworttypen und TypeScript-Export.
Native Dateidialoge laufen außerhalb des Workers; Session und Revision sichern
anschließende Dateioperationen ab.

Eine Änderung durchläuft dieselbe Berechnung für Vorschau und Commit:

1. Version prüfen und in `operations` den fachlichen Änderungssatz berechnen.
2. Gewässer nach Höhenänderungen zurückschneiden und betroffene Flussprofile nachführen.
3. Die angefragte Oberfläche einmal aus Grundhöhen, Änderungen, Flussbetten,
   Hausplattformen und Gewässern zusammensetzen.
4. Für Commit den normalisierten Änderungssatz einschließlich Indizes, Zählern
   und History atomar schreiben; erst danach Dokumentstatus veröffentlichen.

`Computed` normalisiert No-ops. `ChangeSet` trägt Vorher-/Nachherwerte für Objekte,
Feldpatches, Höhen, Bodenfarben, Regionen, Flüsse und Gewässer. Commit, Undo und
Redo verwenden denselben Schreibpfad. Patchidentität, Metadatenprädikate und
Änderungshinweise werden zentral abgeleitet.

`storage` hält Arbeitsdaten und History. Typisierte JSON-Header, Innenmetadaten und
Zellpayloads liegen getrennt; Headerabfragen teilen einen SQL-/JSON-Lesepfad.
Spatial-/Zellindizes und Übersichtspyramiden sind abgeleitete Arbeitsdaten.
Pose-, Metadaten- und Grundstücksnachführung laden keine Hauszellen.

`persistence` importiert einen strikt validierten, unveränderlichen Snapshot vor
Sessionwechsel und baut Arbeitsindizes neu auf. Export ersetzt das Ziel über eine
synchronisierte benachbarte temporäre Datei. Beide halten höchstens einen
vollständigen Hauszellpayload gleichzeitig. Unveränderte Autorentabellen werden
über einen gemeinsamen zeilenweisen SQL-Kopierpfad exportiert; Validierung und
Rekonstruktion beim Import bleiben bei den jeweiligen Fachmodulen. Höhenautoren
werden validiert direkt in die Kandidatentransaktion geschrieben. `terrain_store`
und `world_terrain_store` leeren und rekonstruieren ihre Höhenübersichten daraus
parentweise vor dem Flussimport. Nach dem Flussimport schreibt `persistence`
validierte Groundautoren direkt und `ground_store` baut alle 24 Übersichtsebenen
in der Kandidatentransaktion aus der jeweils abgeschlossenen unteren Ebene auf.
Der interaktive Pfad und der Wiederaufbau teilen dieselbe Rundung vormultiplizierter
Farbkanäle. Rust hält beim Ground-Wiederaufbau den aktuellen Parent und Child;
SQLite kann für die Sortierung temporären Speicher verwenden. `ImportIdentities` prüft globale
IDs und ihren gemeinsamen Höchstwert; zeilenweise Leser halten den Import
speicherbegrenzt. Eigene Datei-DTOs gibt es nur für
abweichende Strukturen, etwa flache Verbindungen oder ausgelassene Laufzeitwerte.

## Fachberechnung und lokale Speicherzugriffe

| Fachkern                                          | Verantwortung und Anbindung                                                                                                                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interior`                                        | Reiner hauslokaler Solver für Räume, Zellen, Verbindungen und Zähler; ohne SQL oder Weltkoordinaten. Der Atlas-Adapter erhält Identität, Placement und Metadaten und berechnet Konturen nach Zelländerungen.                |
| `operations`, `PlanContext`, `EditPlan`           | Änderungen mit operationslokalen Straßen-/Spatial-/Headerabfragen berechnen; `plans` und `follow_parcel` komponieren abhängige Parzellen und Häuser und prüfen sie gemeinsam.                                               |
| `parcel_geometry`, `population`                   | Grundstücksableitung, Containment und Kollisionen; deterministische Front-/Tiefen-/Rasterposensuche mit gemeinsamem Versuchsbudget. Erst fertige Kandidaten reservieren Fläche und IDs.                                     |
| `road_roughness`, `road_terrain`                  | Rauheit aus der Grundkurve und begrenzte richtungsabhängige Routensuche. `road_terrain_store` liest natürliche Höhen und Wasser lokal, ohne Hausplattformen. Neue Nodes erhalten erst nach erfolgreicher Prüfung Autor-IDs. |
| `terrain`, `terrain_store`, `world_terrain_store` | Höhenraster, Pyramide und Plattformen aus Hausdachkonturen. Bestätigte Reads und Vorschauen teilen `surface_tiles`; optionale Höhen-/Fluss-/Gewässeränderungen überlagern den bestätigten Bestand.                          |
| `water`, `water_store`                            | Lokale Pegel und Flächen, Verschneidung mit dem Höhenraster, Pegelzusammenführung, Ufer und dauerhaftes Trockenlegen. Ein Gewässerstrich ergänzt denselben Höhenänderungssatz.                                              |
| `rivers`, `river_store`                           | Deterministische Routen, gemeinsame Knoten, Topologie und Profilsolver. Store lädt lokale Flüsse und verbundene Komponenten. Betten sind abgeleitet und verändern keine natürlichen Höhen.                                  |
| `ground`, `ground_store`                          | Reiner Farbauftrag auf vormultiplizierten RGBA-Pixeln; dünn belegte Autorenkacheln und Übersichtspyramide. Transport nutzt Base64, Dateien rohe BLOBs.                                                                      |
| `regions`, `region_store`                         | Multipolygonoperationen und Validierung; Katalog, Flächen und RTree. Revisiongebundener Readcache; Beziehungen entstehen aus Schnittflächen und werden nicht persistiert. Polygonkonvertierung wird mit Gewässern geteilt.  |
| `scenery`                                         | Reine Assetverteilung; Landschaftsstriche sind gewöhnliche Objektowner und verwenden gemeinsame Spatial-, Vorschau-, History- und Dateipfade.                                                                               |

Der Flussprofilsolver kombiniert natürliche Absenkung stromabwärts und Rückstau
stromaufwärts mit lokalen Pegelbedingungen. Unvereinbare feste Pegel liefern einen
Fachfehler. Oberflächenberechnung wendet Flussbetten vor Hausplattformen an;
Straßenrouting berücksichtigt Flusswasser und lokale Gewässer. Import rekonstruiert
Profile und Indizes aus Autorendaten.

## Mehrskalige Welt

`lod` besitzt Atlasansichten, Weltzoom, metrische Maßstabsleiste,
Kamerabegrenzung und Darstellungsregeln. Die reine, typisierte `LodDecision`
vereint benannte Ansicht, Inhaltsregeln und Stadt-, Höhen- und Bodenstufen.
`useAtlasEditor` hält die vorherige Entscheidung für die jeweiligen Rücklaufbereiche;
die Stadtstufe behält ihre eigene pixelbasierte Hysterese. Die physische Kamera
bleibt davon getrennt. Darstellung, Werkzeugfreigabe und Kachelanfragen erhalten
dieselbe Entscheidung. `tileRequest` begrenzt den
Ausschnitt auf die Welt und prüft das Kachelbudget vor der Koordinatenerzeugung;
Stadt, Höhen und Boden geben nur Ausgangsstufe, Kachelgröße und Höchststufe vor.
Die Bodenauflösung besitzt ebenfalls den Rücklaufbereich für Zoomwechsel.
Autorenauflösung und angefragte
Darstellungsauflösung sind getrennt: Ein Höhenstrich speichert seine Auflösung
beim Gestenbeginn. Kachelbudgets verändern nicht die Autorenauflösung.

`terrain::Grid` kombiniert lokale Werte und gröbere Autorenauflösungen.
`world_terrain_store` speichert diese dünn belegt; fehlende Werte sind die
Abdeckungsmaske. Feinere Werte überschreiben gröbere, fehlende Randwerte erben
sie. Übersichtstabellen halten Summen und Belegungsanteile je Quellauflösung.
Lokale Höhenverbraucher lesen dieselbe zusammengesetzte Oberfläche.
`surface_tiles` besitzt Hausplattformen in einem Cache für die jeweilige Anfrage.
Nach dem Füllen einer Kachel referenziert eine lokale RTree-Sicht diese Plattformen
in der Reihenfolge der Headerabfrage; konservative Einflussbounds filtern nur
Kandidaten, die gemeinsame Oberflächenformel prüft Dach und Übergang exakt.
Level 0 lädt benötigte Autorenlayer über das lokale Raster ohne Übersichtsvorbereitung.
Vorgeschlagene Höhen werden während der Fachberechnung in einer zurückgerollten
SQLite-Transaktion überlagert, damit Gewässer, Flüsse und Vorschau denselben
Stand lesen. Erst der normale Commit schreibt die gesamte Änderung atomar.

`map_tiles` wählt Features weiterhin je Kachel und Art mit eigenem SQL-Limit
und liest die vollständige Dichte unabhängig davon. Ein reiner Projektor
berechnet die Darstellung aus einem Objekt und der Zellgröße; ein ID-Cache lebt
nur während einer Anfrage mit festem Level. Wiederholte Treffer klonen das
projizierte Feature in jede Antwortkachel. SQL liefert weiterhin den Body; der
Cache hält eigene Keys und Features zusätzlich zu den Antwortkopien.

Ortschaften sind ausschließlich eine Regionskategorie. Die Kategorieoption
`markers` steuert kartografische Ortssymbole und gemeinsame Rangdarstellung;
Identität, Flächen, Beschriftung, History und Persistenz bleiben beim Regionskern.
Es gibt keinen zusätzlichen Siedlungsowner und keine eigene Bearbeitungsqueue.

## Editorzustand und Eingaben

`AtlasApp` rendert die Oberfläche; `useAtlasEditor` verbindet die Besitzer.
`toolScaleRestriction` in `editorView` projiziert die gemeinsame reine
Skalensperre für Bearbeitungsfreigabe und Bedienhinweise.
`editorScene` trennt die zuletzt sichtbare Szene von den für Interaktionen gültigen
Ownerdaten; `canEdit` projiziert die Bearbeitungsfreigabe. `editorInput` stellt
den Eingabesnapshot einschließlich Kachelanfragen und Regionsfreigabe zusammen.
Diese Funktionen in `editorView` besitzen keinen Zustand. Werkzeugwerte werden einmal in `useEditorTools`
aufgelöst und gemeinsam an Panels und Eingaben weitergegeben. Auch Änderungen
der Pinselgröße gehören zu diesem Besitzer, für Regionen zum Regionshook:

| Besitzer                                                    | Verantwortung                                                                                                                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documentQueue`, `useDocumentSession`                       | Bestätigter Status, serielle Writes, Dateireservierungen und Abgleich unsicherer Ergebnisse; React-/Dateianbindung.                                                                 |
| `editorWorkflow`, `EditorWorkflowController`                | Reine Zustandsübergänge sowie Lebensdauer von Entwürfen, Kandidaten, Vorschauen und Übernahmen. Flussentwürfe einschließlich unvollständiger Verläufe gehören demselben Controller. |
| `workflowOperations`                                        | Fachliche Aktionen erfassen und anhand frischer Header neu prüfen.                                                                                                                  |
| `interaction`, `useCanvasInput`                             | Reine Gestenberechnung; gemeinsame DOM-Koordinaten, Pointercapture, Tastatur und Fokusverlust für alle Werkzeuge, einschließlich Flussknoten.                                       |
| `editorSelection`, `useEditorTools`                         | Auswahlübergänge, Werkzeugvorgaben und Aktionen.                                                                                                                                    |
| `useRegions`, `useRivers`                                   | Fachliche Werkzeugauswahl, Einstellungen und Panelaktionen; keine eigenen Read- oder Vorschau-Lebenszyklen.                                                                         |
| `workflowView`, `editorView`, `roadDraft`, `parcelPlanning` | Ansichtsprojektionen und Entwurfsgeometrie. Exakte Parzellen und Konflikte bleiben in Rust. `workflowView` ist eine Funktion in `editorWorkflow`.                                   |
| `useCamera`                                                 | Navigation und Fit-Anfragekennung.                                                                                                                                                  |

`editorWorkflow` definiert die zulässigen Operation-/Gestenpaare einmal für
Zustandstypen und Laufzeitprüfung. Seine Live-Pinselklassifikation verbindet
Pointerdown, Zoomsperre und fortlaufende Oberflächenvorschau. Der Controller
prüft Kandidaten auf der gemeinsamen Dokumentfreigabe; veraltete Einstellungen
behalten ihre Basis bis zur expliziten Neuprüfung. Die Operationserfassung liefert
getrennt typisierte Entwurfs- und Geometrieoperationen; der Controller übernimmt
diese Werte auch für Löschung und Populate ohne erneute Konstruktion.
Beim Hauszeichnen entscheidet
ein gemeinsamer Übergang über den Abschluss, sobald die Eigentümerabfrage
aufgelöst und der Pointer beendet ist; ein zweiter Abschlusszustand entfällt.

Die Queue übernimmt angenommene Writes unabhängig vom Workflow. Session-,
Kontext-, Kandidaten- und Anfrageidentitäten sichern die asynchronen Übergänge.
Die beobachtbaren Regeln für Abbruch, Übernahme und verspätete Antworten stehen
im [Produktvertrag](product-contract.md#vorschau-und-nebenläufigkeit).

`useRegions` memoisiert Rang- und Regionsprojektionen aus den jeweiligen
Katalog-, Summary- und Antwortreferenzen. Seine Ranghysterese bleibt sitzungsgebunden;
kleine Rang-ID-Folgen werden für gleichbleibende Anfragen stabilisiert. Fehlende
oder unsichtbare Regions- und Flusslisten verwenden gemeinsame unveränderliche
Leerlisten. `useRivers` reicht vorhandene Flussantwortlisten direkt weiter.

`useRivers` besitzt Flussauswahl und Punktindex gemeinsam. Ein Auswahlwechsel
setzt den Punkt auf den ersten vorhandenen Knoten; eine leere Liste hat keinen
ausgewählten Punkt. Nach Topologieänderungen wird der Index auf die verbleibende
Liste begrenzt, ohne ihn bei vorübergehend ausstehenden Reads zu verlieren.

`interaction` trennt die fachlichen Gestenzweige und erhält ihre Trefferpriorität.
Es entscheidet auch über Doppelklick, Tastatur, Mausrad und gehaltenen Pinselauftrag.
Tastatur und Mausrad teilen ihre Pinselwerkzeug-Klassifikation. `useCanvasInput` teilt
die Pointerauswertung für Down, Move und Up und besitzt ausschließlich die
DOM-Anbindung, keine Werkzeughooks. Auswahlaktionen verwenden direkt die Events
von `editorSelection`; der Editor übersetzt keine parallele Kommandoliste.
Pointercapture wird intern freigegeben, beim Abbruch zusammen mit dem Pointer.

`EditorActions` zeigt Planungsaktionen und Rückmeldungen; `Fields` teilt
Fokus-/Abbruch-/Übernahmelogik. Werkzeugnamen und Symbole stehen in `ToolOptions`,
Einstellungen kommen aus `useEditorTools`. CSS liegt bei Grundlayout, Editor und Modal.

## Laden und Zeichnen

`PresentationLoader` besitzt Ladeplanung, Anfragegenerationen, Caches und
veröffentlichte Snapshots. `usePresentation` und `usePresentationLayer` binden
bestätigte Eingaben, Subscription und Lebensdauer an React. Gelände, Boden,
Stadtübersicht, Regionskatalog, Regionsausschnitte und Flüsse verwenden denselben
versionierten Schichtlebenszyklus und laden unabhängig von der exakten Szene.
Regionskatalog, Regionsausschnitte und Flüsse laden nur bei sichtbarer Außenansicht,
auch wenn ihr jeweiliges Bearbeitungswerkzeug inaktiv ist.
Jede Schicht prüft Anfrageidentität und Version und hält bei ausstehenden Reads oder
Fehlern ihre letzte vollständige Ansicht. Bei unveränderten Gelände-, Boden- und effektiven Übersichtsreferenzen bleibt der
sichtbare Presentationwrapper erhalten; Lade- und Fehleränderungen werden weiterhin
publiziert. Boden und Gelände werden nur bei gleicher
Dokumentversion kombiniert; auch Vorschaukacheln werden versionsgleich gemischt.
Solange die exakte Szene noch fehlt, kann eine leere, nicht bearbeitbare Szene die
bereiten Raster darstellen. Exakte Header, aufgelöster Innenraumowner und dessen
Metadaten/Kacheln behalten ihren gemeinsamen Veröffentlichungspfad; ein überholter
Außenszenenread darf weiterhin als Zwischenstand dienen, wenn er den aktuellen
Ausschnitt vollständig abdeckt. Die Aktualitätsprüfung sperrt veraltete Daten für
Interaktionen und berücksichtigt Clientwechsel vor dem nächsten React-Effekt.
Bestätigte Vorschauen werden erst nach einer frischen Darstellung quittiert.

Ladekontexte verwenden diskrete Höhen-, Boden- und Stadtstufen. Ausschnitt und
Bearbeitungskontext bleiben gesondert geprüft. Rasche Ausschnitts-/Zoomänderungen
werden vor dem Absenden zusammengefasst; exakte Regions- und Flussreads dürfen einen
kleineren Ausschnitt abdecken. Begrenzte Übersichten dürfen dies nur, wenn die
Antwort nachweislich unter der jeweiligen Begrenzung blieb.

`readScheduler` begrenzt physische Reads je Client über Remounts hinweg; Darstellung,
Fit und Ownerauflösung teilen ihn. `PreviewScheduler` begrenzt Vorschauanfragen.
`presentationCache` hält Stadt-, Oberflächen- und Bodenfarbkacheln in einem
`WorldTileCache` mit drei fachlichen Adaptern. Client-/Revisionswechsel,
Anfragegeneration, fehlende Kacheln und Antwortprüfung haben einen gemeinsamen
Pfad. Die Adapter bestimmen räumliche Invalidierungsränder und Speicherbudgets;
Gelände bestätigt zusätzlich jede neue Revision, auch ohne fehlende Kacheln.
`TileCache` hält Innenraumkacheln mit geteilten Reads. `BudgetCache` übernimmt Verdrängung;
`documentVersion` prüft Versionen und Änderungshinweise. Fachliche Invalidierung
bleibt beim jeweiligen Cache; unbekannte Revisionssprünge verwerfen Wiederverwendung.

`map_tiles` nutzt eine per SQL-Trigger gepflegte Dichtepyramide mit begrenzten,
vereinfachten Geometrien/Namen. Wichtige Orte haben einen eigenen Indexzugriff.
Exakte Szenen werden erst im Bearbeitungsmaßstab geladen; `roadHeader` und
`objectHeader` liefern exakte Ownerdaten auch in der Übersicht. Überladene exakte
Ausschnitte werden abgelehnt, nicht still gekürzt.

`canvasScene` bereitet Schichten, Auswahl, Beschriftungskandidaten und
Vorschauoberflächen rein vor. Es dedupliziert die vollständigen Cityfeatures einmal
für den Citypainter und leitet davon getrennt die um Auswahl und geöffneten Owner
angepassten Beschriftungsfeatures ab. Der Painter sortiert nur eine eigene
Flächenauswahl; Dichte bleibt an die Übersichtskacheln gebunden. `useAtlasEditor` reicht diese vorbereitete Szene
memoisiert weiter; `editorView` projiziert auch Pinselradien aus Werkzeugvorgaben
oder der laufenden Geste. `AtlasCanvas` zeichnet in Layout-Effekten mit aktueller
Kamera und DPR in geplanten Animationsframes; zustandsfreie Painter zeichnen Geometrie.
Der Canvas-Besitzer teilt einen sitzungsgebundenen, begrenzten `Path2D`-Cache für
exakte Außengeometrie anhand unveränderlicher Objektidentität; Bearbeitungsdaten
bleiben unverändert. `TerrainPainter` besitzt den Rastercache, Innenraumgeometrie
einen eigenen begrenzten `Path2D`-Cache. Bodenfarben
verwenden einen Pixelhalo gegen Kachelnähte. Ihre Raster hängen von unveränderlichen
benachbarten Höhenkacheln einschließlich Relief-Abtastrand ab; neue Antwortwrapper
oder entfernte Änderungen verwerfen sie nicht. Höhenabfragen verwenden einen
schwach an die unveränderliche Oberfläche gebundenen Koordinatenindex. `mapLabels` platziert Namen in CSS-Pixeln
über räumliche Belegung und stabile Weltanker. Untergetauchte Flussbänder werden an
Gewässerflächen ausgeschnitten.

Regionen und Gewässer teilen `containsPolygon` im Modell: Außenring abzüglich
Löchern, mit dem bestehenden Ring-Treffertest. Die Fachansichten behalten ihre
jeweilige Auswahlreihenfolge.

## Entwicklung und Prüfungen

`scripts/contracts.mjs` formatiert den Rust-TypeScript-Export im Speicher und
vergleicht oder schreibt ausschließlich das generierte Verzeichnis. Fehler und
Änderungshinweise werden zusätzlich zur Laufzeit geprüft. Ein TypeScript-Projekt
umfasst Produktcode, Tests und Toolkonfigurationen.

Rusttests prüfen Fachregeln, Atomarität, Dateien und Zugriffspfade. TypeScript prüft
Queue, Workflow, Darstellung und Caches; Browsertests ergänzen DOM-/Canvas-Integration
mit echtem Worker und injizierten Transportverzögerungen/-fehlern. Native Abnahme
folgt dem README. Beide Testsuiten bauen den Rust-Worker über
`tests/support/buildCore.ts`; Playwright ruft ihn als globales Setup auf.
`corePaths` legt das projektlokale Cargo-Ausgabeverzeichnis und den Workerpfad
für Build und Start fest; `coreTransport` besitzt die Prozesslebensdauer.
`browserServer` definiert Testport und Editoradresse. Playwright startet seinen
eigenen Server ohne Wiederverwendung eines vorhandenen Servers.
`browserContract` leitet Testaufrufe und diskriminierte Aufrufprotokolle aus den
vorhandenen Commandtypen ab. Dateipfade gehören der isolierten Fixture;
`atlasRaw` bleibt die untypisierte Grenze für Transportinjektion und Negativtests.
Nebenläufigkeitstests verwenden gehaltene Antworten, ausstehende Transportarbeit
und sichtbare Abschlüsse; Debouncefälle steuern die Browseruhr. Echte Zeit bleibt
für gehaltenen Bodenauftrag und Live-Geländemessungen erhalten.
`tests/support/atlasFixtures.ts` liefert isolierte Workflowobjekte und Antworten,
`deferred.ts` steuerbare Promises. Gemeinsame Rust-Snapshots gehören in
`application_test_support`; Testmodule hängen nicht voneinander ab.
Playwright besitzt eine einzige Produktsuite ohne zusätzliche Projektauswahl.
npm komponiert die Gesamtsuite sequenziell; Cargo verwendet das
Lockfile. `.cargo/config.toml` hält gemeinsame Ressourcenlimits für Cargo und Tauri.
