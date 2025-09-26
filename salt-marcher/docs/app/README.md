# App Bootstrap

## Purpose & Audience
Dieses Dokument beschreibt das Bootstrap-Modul unter `src/app/`. Es richtet sich an Entwickler:innen, die verstehen möchten, wie das Plugin Views registriert, zentrale Datenflüsse initialisiert und Integrationen mit Obsidian oder Dritt-Plugins herstellt. Nutzerorientierte Workflows findest du im [Projekt-Wiki](../../wiki/README.md).

## Struktur
```
docs/app/
└─ README.md
```
Das Verzeichnis dokumentiert ausschließlich den Bootstrap-Layer. Detailentscheidungen zu Feature-Workspaces (Cartographer, Library, Encounter) werden in deren Bereichs-README behandelt.

## Bootstrap-Modul (`src/app/`)
```
src/app/
├─ main.ts                 # Einstiegspunkt, registriert Views/Commands und orchestriert Dateninitialisierung
├─ bootstrap-services.ts   # Service-Grenzen für Terrain-Bootstrap (Priming, Watcher, Logging)
├─ layout-editor-bridge.ts # Optionale Integration mit dem Layout-Editor-Plugin
└─ css.ts                  # Gebündeltes Stylesheet, das zur Laufzeit injiziert wird
```

## Verantwortlichkeiten
### View- und Command-Registration
`main.ts` registriert Cartographer-, Encounter- und Library-Views sowie die zugehörigen Ribbon-Icons und Befehle. Dadurch bleibt der Einstieg in alle Workspaces konsistent und der Bootstrap kontrolliert, welche `WorkspaceLeaf`-Instanzen geöffnet oder wiederverwendet werden.

### Terrain-Watcher & Initialisierung
`main.ts` delegiert das Terrain-Priming an `createTerrainBootstrap`. Der Service sorgt dafür, dass die Terrain-Datei existiert (`ensureTerrainFile`), initiale Daten geladen werden (`loadTerrains` + `setTerrains`) und Änderungen über `watchTerrains` beobachtet werden. Fehler bei Priming oder Watcher-Laufzeit werden protokolliert und verhindern nicht mehr das vollständige Laden des Plugins – die Defaults bleiben aktiv, bis Obsidian erneut ein `modify`/`delete`-Event liefert. Bei Problemen schreibt der Service strukturierte Fehlermeldungen in die Konsole, damit Tests (`tests/app/terrain-bootstrap.test.ts`, `tests/app/terrain-watcher.test.ts`) und manuelle QA dieselben Schnittstellen nutzen.

### Bootstrap Service Boundaries
`bootstrap-services.ts` kapselt die Terrain-spezifische Lifecycle-Logik und bietet einen `TerrainBootstrapHandle` mit `start()`/`stop()`. Dadurch bleibt `main.ts` auf View-Registrierung, Commands und Integrationen fokussiert, während Tests den Service isoliert mocken können. Fehlerbehandlung, Retry-Strategien und Logging lassen sich über die bereitgestellte Logger-Schnittstelle steuern.

### Layout-Editor-Bridge
`layout-editor-bridge.ts` kapselt die optionale Integration zum "Layout Editor"-Plugin. Beim Laden versucht der Bootstrap, eine View-Binding-Registrierung anzulegen und hält Listener bereit, um bei Aktivierung/Deaktivierung des Fremd-Plugins korrekt aufzuräumen. Fehler werden geloggt, damit Layout-Probleme sichtbar bleiben.

### CSS-Injektion
`main.ts` injiziert das gebündelte Stylesheet (`HEX_PLUGIN_CSS`) als `<style id="hex-css">` ins Dokument und entfernt es beim Entladen. Dadurch bleiben die Hex-spezifischen Styles isoliert, ohne dass separate CSS-Dateien im Vault verwaltet werden müssen.

## Offene Fragen: Bootstrap vs. Feature-Verantwortung
- Müssen zukünftige Einstellungen (z. B. automatisches Öffnen des Cartographer) über denselben Service konfigurierbar werden?
- Wann sollten Feature-spezifische Initialisierungen (z. B. Default-Layer-Konfigurationen) aus dem Bootstrap in die jeweiligen Workspaces verschoben werden?
- Welche Standards gelten für Dritt-Plugin-Integrationen (Layout Editor, potenziell weitere), damit sie testbar bleiben?

Diese Fragen werden im [To-Do: Plugin Bootstrap Review](../../todo/plugin-bootstrap-review.md) gebündelt und priorisiert.

## Standards & Abhängigkeiten
- Halte dich an den [Documentation Style Guide](../../style-guide.md) sowie die Obsidian-Plugin-Konventionen (Lifecycle `onload`/`onunload`).
- Bootstrap-Code muss ohne optionale Plugins lauffähig bleiben; Integrationen dürfen nur defensive Abhängigkeiten aufrufen.
- Asynchrone Initialisierung (Terrain-Laden) darf UI-Registrierungen nicht blockieren; Integrationstests decken das Priming/Watcher-Verhalten inzwischen mit Obsidian-Mocks ab (siehe oben).
