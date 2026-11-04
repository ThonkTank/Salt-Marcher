# Architektur

`src/main.tsx` startet Atlas V7 in Tauri. React zeichnet auf Canvas; Rust besitzt
das Dokument in SQLite. [Produktvertrag](product-contract.md): Verhalten, Format
und Grenzen; [README](../README.md): Einrichtung und Befehle;
[Status](implementation/status.md): geprüfter Stand und offene Arbeit.

## Rust: Dokument und Fachkern

| Besitzer                               | Verantwortung                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DocumentWorker`                       | Dokumentthread mit begrenzter FIFO, gemeinsam für Desktop und Browsertests                                   |
| `atlas/application`                    | SQLite und Dokumentstatus; `commands` dispatcht direkt zu Methoden und Reads                                 |
| `storage`                              | Arbeitsdaten, abgeleitete Indizes und History                                                                |
| `persistence`                          | Validierter Import und atomarer Export                                                                       |
| `map_tiles`, `terrain_store`           | Indizierte Stadtübersicht beziehungsweise Höhenraster und Höhenpyramide                                      |
| `operations`, `PlanContext`            | Änderungen berechnen; operationslokale Straßen-, Spatial- und Headerabfragen                                 |
| `EditPlan`, `plans`, `follow_parcel`   | Geometrie, Feldpatches und lokale IDs sammeln; abhängige Grundstücke/Häuser komponieren und gemeinsam prüfen |
| `interior`                             | Reiner hauslokaler Solver für Räume, Zellen, Verbindungen und Zähler, ohne SQL/Weltkoordinaten               |
| `terrain`, `scenery`, `road_roughness` | Reine Berechnung von Höhen/Plattformen, Assetverteilung und Straßenrauheit                                   |

`Computed` normalisiert Änderungen und No-ops. Vorschau und Commit teilen
Berechnung und Fehlerübersetzung. Commit, Undo und Redo verwenden denselben
Änderungssatz mit Vorher-/Nachherslices. Autorendaten, Indizes und History werden
atomar geschrieben; Status wird erst nach SQL-Commit veröffentlicht.
Patchidentität, Metadatenprädikate und Änderungshinweise werden zentral abgeleitet.

Der Atlas-Adapter des Innenraumsolvers erhält Hausidentität, Placement und
Metadaten und berechnet Konturen nach Zelländerungen. Gründung, Bearbeitung und
Import verwenden gemeinsame Validatoren. Pose- und Metadatenänderungen laden
keine Zellen; auch `follow_parcel` führt Häuser ohne Zellzugriff mit.

## Arbeitsdaten und Dateien

Typisierte JSON-Header, Innenmetadaten und Zellpayloads liegen getrennt.
Headerabfragen teilen einen SQL-/JSON-Lesepfad. Räumliche Indizes, Zellindex,
Stadtdichte- und Höhenpyramide sind abgeleitete Arbeitsdaten.

Persistenz nutzt strikte Autorendatentypen. Eigene DTOs gibt es nur für abweichende
Dateistrukturen, etwa flache Verbindungen oder ausgelassene Laufzeitwerte. Import
validiert einen unveränderlichen Snapshot vor dem Sessionwechsel und baut Indizes
neu auf. Export ersetzt das Ziel über eine synchronisierte benachbarte temporäre
Datei. Beide halten höchstens einen vollständigen Hauszellpayload gleichzeitig.
Native Dateidialoge laufen außerhalb des Workers; Session und Revision sichern
ihre Ergebnisse ab.

Landschaftsstriche sind normale Objektowner mit konkreten Assets und nutzen
Spatial-, Vorschau-, History- und Dateipfade. Höhen und Wasserstand nutzen dieselbe
Transaktion und History; Fundamente sind Headerpatches. Hausplattformen entstehen
aus Dachkonturen und Transform, niemals aus Hauszellen. `terrain_store` liest
Rasterregionen entlang des Strichs. Vorschau und bestätigte Oberflächenreads teilen
die Berechnung. Straßenrauheit wird stets aus der Grundkurve berechnet.

## React: Zustand und Eingaben

`AtlasApp` rendert die Oberfläche. `useAtlasEditor` verbindet die folgenden Besitzer:

| Besitzer                                         | Verantwortung                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `documentQueue`, `useDocumentSession`            | Bestätigter Status, serielle Writes, Dateireservierungen und Abgleich unsicherer Ergebnisse; React-/Dateianbindung |
| `editorWorkflow`                                 | Reine Zustandsübergänge und Zulassungsregeln; Kandidaten, Entwurfsparzellenauswahl und letzte Vorschau             |
| `EditorWorkflowController`, `workflowOperations` | Timer, Reads, Vorschau und Übernahme; fachliche Operationen erfassen und anhand frischer Header neu prüfen         |
| `interaction`, `useCanvasInput`                  | Reine Gestenberechnung einschließlich Pinselpfaden; DOM-Koordinaten, Listener, Capture und Fokusverlust            |
| `editorSelection`, `useEditorTools`              | Auswahlübergänge beziehungsweise Werkzeugvorgaben und Aktionen                                                     |
| `workflowView`, `editorView`                     | Vorschau/Fehler/Aktionen sowie Panel, Planungsgeometrie und Grundstücksgriffe projizieren                          |
| `roadDraft`, `parcelPlanning`                    | Kurvenentwürfe und Frontendprojektion der Planung; exakte Parzellen und Konflikte bleiben in Rust                  |
| `useCamera`                                      | Navigation und Fit-Anfragekennung                                                                                  |

Angenommene Writes gehören der Queue und überleben Unmount. Session-, Kontext-,
Interaktions- und Requestidentitäten verhindern die Übernahme alter Antworten.
`EditorActions` bündelt Planungsaktionen und Rückmeldungen. `Fields` teilt
Fokus-/Abbruch-/Übernahmelogik; `SelectField` rendert typisierte Auswahloptionen.
Werkzeugnamen und Symbole stehen in `ToolOptions`; dessen Werte und Aktionen
kommen direkt als `EditorTools` aus `useEditorTools`. CSS liegt bei Grundlayout,
Editor und Modal.

## Laden und Zeichnen

`PresentationLoader` besitzt Ladeplanung, Anfragegenerationen, Caches und einen
veröffentlichten Snapshot; `usePresentation` bindet bestätigte Eingaben,
Subscription und Lebensdauer an React. Kontext- und Viewportwechsel sind getrennt.
Alte Antworten werden auch nach A→B→A verworfen; ausstehende Reads und Fehler
erhalten die letzte vollständige Ansicht, die zugleich der Wiederverwendung dient.

`readScheduler` begrenzt physische Reads je Client über Remounts hinweg;
Darstellung, Fit und Ownerauflösung teilen ihn. `PreviewScheduler` hält eine
laufende und die neueste wartende Vorschau. `presentationCache` besitzt Stadt-
und Oberflächenkacheln, `TileCache` Innenraumkacheln und geteilte Reads.
`BudgetCache` übernimmt Verdrängung, `documentVersion` prüft Versionen und
Änderungshinweise. Fachliche Invalidierung bleibt beim jeweiligen Cache;
unbekannte Revisionssprünge verwerfen Wiederverwendung.

`map_tiles` nutzt eine per SQL-Trigger gepflegte Dichtepyramide und begrenzte,
vereinfachte Geometrien/Namen. Wichtige Orte haben einen eigenen Indexzugriff;
Innenmetadaten und Zellen bleiben außen vor. `roadHeader` und `objectHeader` liefern
exakte Ownerdaten auch in der Übersicht. Exakte Szenen werden erst im
Bearbeitungsmaßstab geladen; überladene Ausschnitte werden abgelehnt.

`canvasScene` bereitet Schichten, Auswahl, Beschriftungskandidaten und
Vorschauoberflächen rein vor. `AtlasCanvas` zeichnet in Layout-Effekten mit aktueller
Kamera und DPR; `canvasPaint` enthält zustandsfreie Zeichenfunktionen.
`TerrainPainter` besitzt den Rastercache, Innenraumgeometrie einen begrenzten
`Path2D`-Cache. `cityView` bestimmt Übersicht und Zoomübergänge, `cityPaint` und
`sceneryPaint` zeichnen Übersicht beziehungsweise Assets. `mapLabels` platziert
Namen in CSS-Pixeln über räumliche Belegung und stabile Weltanker.

## Transport und Prüfungen

Die Rust-Commandliste verbindet Deserialisierung, Ausführung, Antworttypen und
TypeScript-Export. `scripts/contracts.mjs` formatiert den Export im Speicher und
vergleicht oder schreibt Transporttypen. Fehler und Änderungshinweise werden
zusätzlich zur Laufzeit geprüft. Ein TypeScript-Projekt umfasst Produktcode,
Tests und Toolkonfigurationen.

Rusttests prüfen Fachregeln, Atomarität, Dateien und Zugriffspfade. Anwendungstests
liegen bei `application`, SQL-Prüfhelfer in `application_test_support`. TypeScript
prüft Queue, Workflow, Darstellung und Caches. Browsertests ergänzen DOM-/Canvas-
Integration mit echtem Worker und injizierten Transportverzögerungen/-fehlern.
Native Plattformabnahme erfolgt nach README. `.cargo/config.toml` hält gemeinsame
Ressourcenlimits für Cargo und Tauri; npm komponiert die Gesamtsuite sequenziell.
