# Architektur

`src/main.tsx` startet den Atlas-Editor in Tauri. Der
[Produktvertrag](product-contract.md) definiert Verhalten, Format und Grenzen;
[README](../README.md) enthält Befehle und Abnahme,
[Status](implementation/status.md) den aktuellen Prüfstand.

## Dokument und Fachkern

Ein `DocumentWorker` besitzt einen Dokumentthread mit begrenzter FIFO.
Native Commands und Browser-Testadapter verwenden denselben Worker.
Dateidialoge laufen außerhalb des Threads am aufrufenden Fenster; ihre
Ergebnisse werden gegen Session und Revision geprüft.

`atlas/application/` enthält den Dokumentbesitzer `AtlasApplication` und seine
Kindmodule: `commands` für Dispatch, `storage` für Arbeitsdaten und History,
`persistence` für Dateiimport und -export. Nur diese Grenze besitzt SQLite und
Dokumentstatus. Headerabfragen teilen einen typisierten SQL-/JSON-Lesepfad;
Hausmetadaten und Zellpayloads werden erst bei Bedarf ergänzt.

`operations` berechnet Änderungen. Der operationslokale `PlanContext` hält
vorbereitete Straßen, räumliche Abfragen und Ownerheader. `EditPlan` bündelt
Geometrieänderungen, kleine Feldpatches und lokale ID-Vergabe; auch Posepatches
und ihre No-op-Prüfung gehören dorthin. `plans` komponiert abhängige Parzellen
und Hausheader und validiert den gemeinsamen Endzustand. `follow_parcel`
führt Häuser nach Straßen- und Parzellenänderungen ohne Zellzugriff mit.
Geometrie, Grundstücksableitung und Bebauung bleiben reine Fachberechnungen.
Vorschau und Commit verwenden dieselbe Berechnung und Fehlerübersetzung.

Der hauslokale `interior`-Solver kennt Räume, Zellen, Verbindungen und lokale
Zähler, aber weder SQL noch Weltkoordinaten. Der Atlas-Adapter erhält
Hausidentität, Placement und Metadaten und berechnet Konturen nach Zelländerungen.
Gründung, Bearbeitung und Import verwenden den gemeinsamen Validator.

## Speicherung

Arbeitsobjekte besitzen einen typisierten JSON-Header. Innenmetadaten und Zellen
liegen getrennt; Pose- und Metadatenänderungen laden keine Zellen. Räumliche
Indizes und der inkrementell gepflegte Zellindex sind abgeleitet.

Geometrie, Feldpatches, Indizes und History werden in einer Transaktion
angewendet. Erst nach deren Commit veröffentlicht die Anwendung den neuen
Status. Berechnung und History teilen denselben Änderungssatz; Vorschauheader
bleiben Berechnungsdaten. Undo/Redo verwendet dessen Vorher-/Nachherslices.
Änderungshinweise werden aus typisierten Objekten und Patches abgeleitet.

Persistenz verwendet die strikten Autorendatentypen des Fachkerns; eigene DTOs
bestehen nur bei abweichender Dateistruktur. Import validiert einen
unveränderlichen Snapshot vor dem Sessionwechsel. Export ersetzt das Ziel über
eine synchronisierte benachbarte temporäre Datei. Beide verarbeiten höchstens
einen vollständigen Hauszellpayload gleichzeitig. Das Dateischema steht
ausschließlich im Produktvertrag.

## Frontend und Zustandsbesitz

`AtlasApp` stellt die Oberfläche dar. `useAtlasEditor` bindet Dokument, Auswahl,
Werkzeuge, Workflow und Eingaben. `editorView` leitet Panel, Planungsgeometrie,
Grundstücksgriffe und Aktionsanzeige aus dem aktuellen Zustand ab.

- `documentQueue` besitzt bestätigten Dokumentstatus, serielle Writes,
  Dateireservierungen und den Abgleich unsicherer Ergebnisse. Angenommene Writes
  überleben Unmount. `useDocumentSession` bindet Queue und native Dateieffekte an React.
- `editorWorkflow` definiert Zustände und reine Übergänge. Gemeinsame Prädikate
  entscheiden Übernahme, Neuprüfung und die Zuordnung von Vorschauantworten.
  `EditorWorkflowController` besitzt Kandidaten, Timer, Reads und Übernahme.
  Er hält auch Entwurfsparzellenauswahl und letzte sichtbare Vorschau.
  `workflowOperations` besitzt Aufnahme und Neuprüfung fachlicher Operationen.
- `interaction` berechnet Gesten und Eingabeentscheidungen aus einem Snapshot;
  `useCanvasInput` übernimmt DOM-Koordinaten, Listener, Capture und Fokusverlust.
  Auswahlübergänge gehören zu `editorSelection`, Werkzeugvorgaben zu ihren Hooks.
- `PresentationLoader` besitzt Ladeplanung, Anfragegenerationen, Tile-/Aggregatcaches
  und genau einen veröffentlichten Snapshot. Er erhält ausschließlich bestätigte
  UI-Eingaben. `usePresentation` bindet Lebensdauer und Subscription über
  `useSyncExternalStore` an React.
- `readScheduler` begrenzt physische Reads je Client, auch über Remounts.
  Darstellung, Fit und Ownerauflösung teilen ihn. Der Preview-Scheduler hält
  eine laufende und die neueste wartende Vorschau.
- `useCamera` besitzt Navigation und Fit-Anfragekennung. `AtlasCanvas` zeichnet
  veröffentlichte Daten in Layout-Effekten und übernimmt DPR-Anpassung.
  Innenraumgeometrie wird ohne DOM vorbereitet und als begrenzter `Path2D`-Cache gehalten.

Der Ladecontroller trennt Kontextwechsel von Viewportänderungen. Seine
Generation verwirft alte Antworten auch nach A→B→A; Anfragefolgen verhindern,
dass eine ältere Antwort einen neueren Snapshot überschreibt. Der veröffentlichte
Snapshot ist zugleich die Wiederverwendungsbasis. Fehler und ausstehende Reads
lassen die letzte vollständige Ansicht sichtbar.

`roadDraft` besitzt Kurvenentwürfe, `parcelPlanning` die Frontendprojektion und
Griffe. Exakte Parzellengeometrie und Konfliktentscheidungen liegen in Rust.
`EditorActions` bündelt Planungsaktionen und Rückmeldungen. Zahlen- und
Namensfelder teilen Fokus-, Abbruch- und Übernahmelogik in `Fields`; ihre
Validierung bleibt feldspezifisch. CSS liegt bei Grundlayout, Editor und Modal.

## Stadtübersicht und Beschriftung

`application/map_tiles` liefert ausschließlich Darstellungsdaten. Eine
transaktional gepflegte Dichtepyramide fasst Gebäude über 21 Auflösungen zusammen;
pro Gebäude werden Dach-Bounds-Fläche und Mittelpunkt eingetragen. Der Index ist
eine Näherung der Bebauungsdichte, keine zusätzliche Fachgeometrie. SQL-Trigger
halten Einfügen, Löschen, Poseänderungen, Import und History konsistent.
Räumliche Abfragen liefern zusätzlich begrenzte, vereinfachte Straßen-, Gelände-
und Hausgeometrie sowie Namen. Wichtige Orte besitzen einen eigenen Indexzugriff.
Innenmetadaten und Hauszellen gehören nicht zu diesem Lesepfad.

`PresentationLoader` besitzt auch den `CityCache`: weltverankerte Kacheln,
revisionsgleiche Veröffentlichung und ein konservativ auf 64 MiB begrenztes
LRU-Budget. Änderungshinweise invalidieren betroffene Kacheln einschließlich
Abfragerand; unbekannte Versionssprünge verwerfen den Cache. `cityView` bestimmt
Kachelauflösung und Navigationsübergänge, `cityPaint` zeichnet die Übersicht.
Exakte Szenen werden erst ab Bearbeitungsmaßstab geladen und bei mehr als 5.000
Objekten mit einem Hinweis zum weiteren Hineinzoomen abgelehnt.

`mapLabels` platziert Namen in CSS-Pixeln über alle sichtbaren Kacheln hinweg.
Eine räumliche Belegungstabelle verhindert Überlappungen; stabile Weltanker und
bevorzugte bisherige Platzierungen beruhigen die Darstellung beim Verschieben.
Die Beschriftung besitzt keine fachlichen Trefferflächen. Exakte Bearbeitung,
Hausinnenräume und Vorschau verwenden weiterhin die vorhandenen Datenpfade.

## Verträge und Prüfungen

Die Rust-Commandliste verbindet Deserialisierung, Antworttypen und TypeScript-
Export. `scripts/contracts.mjs` generiert oder prüft die Transporttypen;
strukturierte Fehler und Änderungshinweise werden zusätzlich zur Laufzeit geprüft.
Ein TypeScript-Projekt prüft Produktcode, Tests und Toolkonfigurationen gemeinsam.

Rusttests prüfen Fachregeln, Atomarität, Dateien und Zugriffspfade.
Anwendungstests liegen bei `application`; reine Testmethoden und SQL-Prüfhelfer
in `application_test_support`. TypeScript prüft Queue, Workflow, Ladecontroller,
Geometrie und Caches. Browsertests ergänzen echte React-/DOM-/Canvasintegration
mit dem Rust-Worker; Verzögerungen und Fehler werden am Testtransport injiziert.
Native Dateidialoge und Plattformverhalten werden nach README abgenommen.
