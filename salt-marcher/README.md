# Salt Marcher Plugin

## Überblick
Salt Marcher erweitert Obsidian um einen Arbeitsbereich für hexbasierte Kampagnenkarten, Reiserouten und bestandsgeführte Referenzen. Beim Laden registriert das Plugin spezialisierte Workspaces für Kartographie, Begegnungen und eine bibliotheksartige Verwaltung, lädt automatisch die Terrain-Palette und hält sie per Dateiwächter aktuell. Zusätzlich werden Schnellzugriffssymbole im Ribbon sowie Befehle bereitgestellt, um die wichtigsten Ansichten direkt zu öffnen.

## Kernbereiche und Funktionen

### Cartographer Workspace
Der Cartographer-View stellt das Herzstück des Plugins dar: Eine kombinierte Kartenverwaltung mit dynamisch montiertem SVG-Renderer, Seitenleiste und Modusumschaltung. Beim Öffnen werden vorhandene Kartenblöcke aus der aktiven Datei geladen, ein flexibles `MapHeader`-Layout mit Dateiaktionen erstellt und per `MapManager` verwaltet (öffnen, neu anlegen, löschen, speichern). Die rechte Titelzone dient als Dropdown, um zwischen den Betriebsmodi zu wechseln.【F:salt-marcher/src/apps/cartographer/view-shell.ts†L40-L194】【F:salt-marcher/src/ui/map-header.ts†L1-L152】【F:salt-marcher/src/ui/map-manager.ts†L1-L96】

#### Travel-Modus
* initialisiert die Terrain-Palette aus `SaltMarcher/Terrains.md` und aktiviert eine reisefokussierte Oberfläche (`sm-cartographer--travel`).
* rendert Routen- und Token-Ebenen auf Basis der Hex-Geometrie und steuert sie über `createTravelLogic`.
* bietet Wiedergabe-, Stopp-, Reset- und Temporegler, inklusive Token-Geschwindigkeit und Uhrzeit.
* erlaubt Drag-&-Drop sowie Kontextmenüs zum Bearbeiten der Route; Hex-Klicks erweitern die Reise.
* speichert Token-Positionen zurück in die Karte und kann bei Zufallsereignissen automatisch den Encounter-View im rechten Bereich öffnen.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L1-L242】

#### Editor-Modus
* liefert eine erweiterbare Werkzeugleiste (aktuell: Terrain/Region-Brush) mit Such-Dropdowns.
* die Brush-Optionen bieten Radiuswahl, Regionszuweisung und Mal-/Lösch-Modus; die Regionen werden aus der Regionsliste geladen und live aktualisiert.
* Hex-Klicks schreiben Terrain- und Regionsdaten in die Karte, erzeugen fehlende Polygone und färben das Rendering unmittelbar ein.【F:salt-marcher/src/apps/cartographer/modes/editor.ts†L1-L161】【F:salt-marcher/src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts†L1-L167】

#### Inspector-Modus
* blendet eine Informations- und Bearbeitungsleiste ein, sobald eine Karte geladen ist.
* erlaubt die Auswahl einzelner Hexfelder, das Bearbeiten von Terrainzuweisung und Notiztexten und speichert Änderungen zeitverzögert ins Markdown, inklusive Aktualisierung der Kartenfarben.【F:salt-marcher/src/apps/cartographer/modes/inspector.ts†L1-L168】

### Library View
Die Library dient als zentrales Verwaltungswerkzeug für Kreaturen, Zauber, Terrains und Regionen.
* Beim Öffnen werden sämtliche Quellordner/-dateien garantiert angelegt und einmalig geladen, anschließend halten Dateiwächter alle Listen synchron.
* Eine Kopfleiste schaltet zwischen den Modi, darunter erlaubt eine Such- und Erstellen-Leiste sowohl Fuzzy-Suche als auch das direkte Anlegen neuer Einträge.
* **Creatures & Spells:** Listen Markdown-Dateien, öffnen sie bei Bedarf und nutzen modale Dialoge zum Erstellen neuer Dateien.
* **Terrains:** Bearbeitbare Tabelle mit Name, Farbe (per Color-Picker) und Bewegungsgeschwindigkeit; Änderungen werden sofort gespeichert und normalisiert.
* **Regions:** Pflegt Regionen mit Terrainreferenz (Dropdown mit Suche) und optionalen Encounter-Wahrscheinlichkeiten; Änderungen werden persistiert und können gelöscht werden.【F:salt-marcher/src/apps/library/view.ts†L1-L249】

### Encounter View
Der Encounter-View liefert aktuell eine strukturierte Platzhalteroberfläche und wird vor allem durch den Travel-Modus automatisch geöffnet, wenn unterwegs ein Ereignis ausgelöst wird. Damit steht sofort ein dedizierter Bereich für spätere Encounter-Verwaltung bereit.【F:salt-marcher/src/apps/encounter/view.ts†L1-L20】【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L125-L205】

### Datenhaltung & Synchronisation
* **Terrain-Datei:** `ensureTerrainFile` legt bei Bedarf `SaltMarcher/Terrains.md` mit Beispielpalette an, `watchTerrains` lädt Änderungen, aktualisiert globale Farben (`setTerrains`) und triggert Plugin-Events für UI-Komponenten.【F:salt-marcher/src/core/terrain-store.ts†L1-L86】
* **Regionen:** Analog verwaltet `ensureRegionsFile` (nicht gezeigt) die Regionsliste; Library-Updates lösen `salt:regions-updated` aus (siehe Brush-Tool).
* **Map-Daten:** `MapManager` und `MapHeader` kapseln die Dateiauswahl, `renderMap` im Cartographer lädt den ersten `hex3x3`-Block, montiert das SVG-Layering und informiert aktive Modi über Dateiwechsel.【F:salt-marcher/src/apps/cartographer/view-shell.ts†L96-L210】

### Layout-Editor-Integration
Bei installiertem „Layout Editor“-Plugin registriert Salt Marcher automatisch ein View-Binding, sodass die Cartographer-Karte innerhalb dieses Layout-Systems als Modul auswählbar ist. Aktivierung und Deaktivierung des Fremd-Plugins werden überwacht, um die Registrierung stabil zu halten.【F:salt-marcher/src/app/layout-editor-bridge.ts†L1-L83】

### Befehle & Ribbon-Einträge
Beim Laden registriert das Plugin die Cartographer-, Library- und Encounter-Views, richtet Ribbon-Icons (Kompass, Buch) ein und stellt Kommandos zum Öffnen der beiden wichtigsten Bereiche bereit. Alle Aktionen verwenden die zentrale Leaf-Verwaltung, um Ansichten im aktiven Workspace zu platzieren.【F:salt-marcher/src/app/main.ts†L1-L73】

## Zusammenspiel der Komponenten
* `SaltMarcherPlugin` initialisiert Terrains, setzt sie global und hält sie aktuell, sodass Cartographer-Modi und die Library konsistente Farbinformationen teilen.
* Die Cartographer-Modi greifen über `CartographerModeContext` auf gemeinsame Infrastruktur zu (App, Host-Container, MapLayer, RenderHandles, Hex-Optionen) und reagieren auf Dateiwechsel, wodurch UI-Elemente automatisch zwischen Karten synchronisiert werden.【F:salt-marcher/src/apps/cartographer/view-shell.ts†L52-L193】
* Library-Änderungen an Terrains oder Regionen feuern Events, die Editor-Tools (z. B. der Brush) abonnieren und dadurch Dropdowns aktuell halten.【F:salt-marcher/src/apps/cartographer/editor/tools/terrain-brush/brush-options.ts†L36-L111】

Gemeinsam entsteht so ein zusammenhängender Arbeitsbereich: Karten lassen sich erstellen, bearbeiten, inspizieren und für Reisen nutzen, während Bibliotheksdaten die Terrain- und Regionslogik unterstützen und Begegnungen direkt angebunden sind.
