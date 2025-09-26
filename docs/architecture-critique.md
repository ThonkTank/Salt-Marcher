# Salt Marcher Plugin – Strukturanalyse

## Purpose & Audience
Diese Strukturanalyse richtet sich an Maintainer:innen und Architekt:innen, die technische Schulden und größere Verbesserungsbedarfe des Plugins priorisieren wollen. Sie ergänzt die laufende Entwicklung um einen zentralen Blick auf Risiken, erledigte Maßnahmen und noch offene Arbeiten.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `../salt-marcher/overview.md` | Gesamtüberblick über Aufbau, Build-Pipeline und Integrationen des Plugins. | [`../salt-marcher/overview.md`](../salt-marcher/overview.md) |
| `../salt-marcher/docs/README.md` | Einstiegspunkt für alle Bereichsdokumente (Cartographer, Core, Library, UI). | [`../salt-marcher/docs/README.md`](../salt-marcher/docs/README.md) |
| `../salt-marcher/docs/cartographer/README.md` | Detaildokumentation zu Presenter, View-Shell und Travel-Modus. | [`../salt-marcher/docs/cartographer/README.md`](../salt-marcher/docs/cartographer/README.md) |
| `../salt-marcher/docs/core/README.md` | Übersicht über Persistenz-, Hex- und Terrain-Services. | [`../salt-marcher/docs/core/README.md`](../salt-marcher/docs/core/README.md) |

## Key Workflows
1. **Bewertung aktualisieren:** Prüfe nach jedem Merge die betroffenen Abschnitte und markiere erledigte Punkte mit einem ✅-Hinweis sowie Quellenangaben.
2. **Folgeaufgaben planen:** Verweise für offene Risiken auf passende TODO-Dateien (siehe `todo/`, sofern vorhanden) oder erstelle neue Items mit Kontext aus diesem Dokument.
3. **Quellen verlinken:** Ergänze bei neuen Feststellungen direkte Referenzen zu Code-Dateien oder Detail-Docs, damit Leser:innen Änderungen schnell nachvollziehen können.

## Linked Docs
- [Repository documentation hub](README.md) – Navigationsübersicht über alle Projektdokumente.
- [Repository overview](repository-overview.md) – Koordination und Verantwortlichkeiten auf Repo-Ebene.
- [Salt Marcher plugin overview](../salt-marcher/overview.md) – Architektur, Integrationen und Build-Schritte des Plugins.

## Standards & Conventions
- Halte Sprache und Status-Markierungen konsistent (✅ für erledigt, ungekennzeichnet für offen, nummerierte Maßnahmenliste am Ende).
- Bewerte Themen nach fachlichem Risiko und Wartungsaufwand; dokumentiere Entscheidungsgrundlagen sowie Folgeeffekte.
- Entferne erledigte Empfehlungen erst, wenn die zugrunde liegende Problembeschreibung samt Verweis eindeutig nachvollzogen werden kann.

## Assessment Overview

### 1. Architektur & Modularität
#### 1.1 Einstiegs- und Registrierungslogik
- ✅ Behoben (2024-04-09): `SaltMarcherPlugin` ist der einzige Entry Point. `src/apps/cartographer/index.ts` exportiert nur noch View- und Leaf-Helfer; Ribbon/Command-Registrierung liegt vollständig in `src/app/main.ts`.
- ✅ Behoben (2024-05-07): `CartographerView` delegiert Lifecycle & Dateiauswahl vollständig an `CartographerPresenter`; die View ist auf Obsidian-Wiring reduziert.【F:salt-marcher/src/apps/cartographer/index.ts†L1-L45】【F:salt-marcher/src/apps/cartographer/presenter.ts†L1-L254】

#### 1.2 Cartographer-Shell
- ✅ Behoben (2024-05-07): State-Logik liegt nun im `CartographerPresenter`, während `view-shell.ts` ausschließlich DOM-Komposition + Callback-Wiring übernimmt. Presenter-Tests decken Mode-Wechsel & File-Reaktionen ab.【F:salt-marcher/src/apps/cartographer/presenter.ts†L1-L254】【F:salt-marcher/src/apps/cartographer/view-shell.ts†L1-L146】【F:salt-marcher/tests/cartographer/presenter.test.ts†L1-L139】
- Die Modi werden im Presenter über `provideModes` fest verdrahtet (`createTravelGuideMode`, `createEditorMode`, `createInspectorMode`). Erweiterungen oder Konfigurationen erfordern weiterhin Codeänderungen statt deklarativer Registrierung.【F:salt-marcher/src/apps/cartographer/presenter.ts†L60-L70】【F:salt-marcher/src/apps/cartographer/presenter.ts†L89-L94】
- `CartographerPresenter` serialisiert Modewechsel über eine manuell verkettete `modeChange`-Promise; ohne dediziertes Cleanup/Finally-Handling bleibt die Wartbarkeit des Queues fragil, sobald Modi komplexeres Error-Handling benötigen.【F:salt-marcher/src/apps/cartographer/presenter.ts†L82-L85】【F:salt-marcher/src/apps/cartographer/presenter.ts†L187-L205】

#### 1.3 Map-Layer-Adapter
- ✅ Behoben (2024-05-10): `createMapLayer` nutzt nun das typsichere `RenderLayerOptions`-Alias zu `HexOptions` und kapselt `ensurePolys` ohne `any`-Casts. Die Adapter-Übersicht dokumentiert das Protokoll.【F:salt-marcher/src/apps/cartographer/travel/ui/map-layer.ts†L5-L69】【F:salt-marcher/docs/cartographer/map-layer-overview.md†L1-L68】

#### 1.4 Travel-Mode-Kapselung
- ✅ Behoben (2024-05-31): `createTravelGuideMode` trennt Wiedergabe, Interaktionen, Layer-Aufbau und Datei-Cleanup in dedizierte Controller/Helper. Gemeinsamer State wird über klar definierte `cleanupFile`-/`disposeFile`-Pfade geräumt.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L18-L201】
- ✅ Behoben (2024-05-31): Terrain-Aktualisierung erfolgt über `ensureTerrains` plus Workspace-Listener (`subscribeToTerrains`) statt Einmal-Flag; damit werden externe Änderungen wieder eingelesen.【F:salt-marcher/src/apps/cartographer/modes/travel-guide.ts†L64-L92】

#### 1.5 Library-View
- ✅ Behoben (2024-05-31): `LibraryView` delegiert Rendering und Lifecycle je Modus an spezialisierte `ModeRenderer`-Klassen (`CreaturesRenderer`, `SpellsRenderer`, `TerrainsRenderer`, `RegionsRenderer`) und vermeidet doppelte UI-Pfade.【F:salt-marcher/src/apps/library/view.ts†L15-L141】
- ✅ Behoben (2024-05-31): Der View verwaltet keine ungenutzte `cleanups`-Sammlung mehr; Cleanup-Hooks liegen in den Renderer-Basisklassen (`registerCleanup`).【F:salt-marcher/src/apps/library/view.ts†L15-L141】

### 2. Funktionalität & Datenfluss
#### 2.1 Hex-Rendering
- ✅ Behoben (2024-05-31): `HexScene.ensurePolys` passt ViewBox und Overlay bei jeder neuen Koordinate an, sodass nachgeladene Tiles sichtbar bleiben.【F:salt-marcher/src/core/hex-mapper/render/scene.ts†L63-L145】
- ✅ Behoben (2024-05-31): `renderHexMap` räumt Interaktions- und Kamera-Controller explizit über `destroy()` auf, womit Listener-Leaks vermieden werden.【F:salt-marcher/src/core/hex-mapper/hex-render.ts†L95-L183】【F:salt-marcher/src/core/hex-mapper/render/interactions.ts†L117-L147】

#### 2.2 Eingaben & Persistenz
- ✅ Behoben (2024-05-31): Interaktions-Delegates liefern explizite Outcomes (`handled`/`default`), sodass Tools ohne Event-Abbruch Standardaktionen verhindern können.【F:salt-marcher/src/core/hex-mapper/hex-render.ts†L138-L177】【F:salt-marcher/src/core/hex-mapper/render/interactions.ts†L45-L114】
- ✅ Behoben (2024-05-31): Terrain-Persistenz arbeitet mit Debounce (`SAVE_DEBOUNCE_MS`) und `flushSave`, wodurch Inputs gesammelt und entkoppelt vom UI-Thread geschrieben werden.【F:salt-marcher/src/apps/library/view/terrains.ts†L9-L118】

#### 2.3 Ereignisverkettungen
- ✅ Behoben (2024-05-31): `watchTerrains` stellt beim Delete-Event die Datei wieder her, lädt die Palette und löst das Workspace-Event aus, bevor Listener informiert werden.【F:salt-marcher/src/core/terrain-store.ts†L76-L103】
- ✅ Behoben (2024-05-31): Das Encounter-Gateway lädt Module vorab und zeigt Notices bei Fehlern, statt Encounter-Events stumm zu verlieren.【F:salt-marcher/src/apps/cartographer/modes/travel-guide/encounter-gateway.ts†L1-L36】

### 3. Robustheit & Fehlertoleranz
- `CartographerPresenter` ignoriert das vom Shell-Controller übergebene `ModeSelectContext`/`AbortSignal`. Selbst wenn der Mode-Wechsel vom UI abgebrochen wird, laufen `setMode` und asynchrone Aufräum-/Enter-Schritte weiter und riskieren Race-Conditions.【F:salt-marcher/src/apps/cartographer/presenter.ts†L112-L205】【F:salt-marcher/src/apps/cartographer/view-shell.ts†L77-L119】【F:salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts†L1-L37】
- ✅ Behoben (2024-05-31): Standard-Klicks lassen sich nun über das Interaction-Delegate blockieren; `saveTile` wird nur bei explizitem `"default"`-Outcome ausgeführt.【F:salt-marcher/src/core/hex-mapper/hex-render.ts†L138-L183】【F:salt-marcher/src/core/hex-mapper/render/interactions.ts†L45-L114】
- ✅ Behoben (2024-05-31): `MapManager.deleteCurrent` fängt `deleteMapAndTiles`-Fehler ab und informiert den Nutzer via Notice.【F:salt-marcher/src/ui/map-manager.ts†L77-L93】

### 4. Sauberkeit & Codequalität
- Namensgebung und Kommentare wechseln zwischen Englisch und Deutsch (z. B. englische Fehlermeldungen neben deutschsprachigen Notices), was Konsistenz und Lesbarkeit beeinträchtigt.【F:salt-marcher/src/ui/map-manager.ts†L1-L93】【F:salt-marcher/src/apps/library/view.ts†L46-L140】
- Dateien wie `renderHexMap` überschreiten 300 Zeilen und beinhalten sowohl Rendering als auch Input-Handling. Ein Aufsplitten (Renderer, InteractionController) würde die „<500 Zeilen“-Vorgabe des Projekt-Guides unterstützen.【F:salt-marcher/src/core/hex-mapper/hex-render.ts†L1-L183】

### 5. Empfohlene Maßnahmen
1. **Presenter abort-aware machen:** `CartographerPresenter.setMode` sollte das `ModeSelectContext`-Signal respektieren, um abgebrochene Modewechsel deterministisch zu stoppen.【F:salt-marcher/src/apps/cartographer/presenter.ts†L112-L205】【F:salt-marcher/src/apps/cartographer/view-shell/mode-controller.ts†L1-L37】
2. **Mode-System modularisieren:** Eine deklarative Registry/API für `provideModes` einführen, damit zusätzliche Modi ohne Core-Änderung ladbar sind.【F:salt-marcher/src/apps/cartographer/presenter.ts†L60-L94】
3. **Mode-Queue robuster gestalten:** Die `modeChange`-Promise durch eine explizite State-Machine mit Fehler-/Finally-Behandlung ersetzen, bevor weitere Modi komplexere Lifecycle-Schritte erfordern.【F:salt-marcher/src/apps/cartographer/presenter.ts†L82-L205】
4. **Renderer modularisieren:** `renderHexMap` weiter aufteilen (Rendering, Input, Camera) und Testbarkeit erhöhen, um die Dateigröße zu reduzieren.【F:salt-marcher/src/core/hex-mapper/hex-render.ts†L1-L183】
5. **Terminologie vereinheitlichen:** UI-Texte und Kommentare sollten konsequent in einer Sprache gehalten werden, um Mischformen wie in `MapManager` und `LibraryView` zu vermeiden.【F:salt-marcher/src/ui/map-manager.ts†L1-L93】【F:salt-marcher/src/apps/library/view.ts†L46-L140】
