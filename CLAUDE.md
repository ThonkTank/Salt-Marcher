# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

No build tool (no Maven/Gradle). Manual javac/java with JavaFX and SQLite JDBC.

```bash
# Compile
javac --module-path /usr/lib/jvm/openjfx --add-modules javafx.controls \
  -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar -sourcepath src -d out src/ui/SaltMarcherApp.java

# Run
java --module-path /usr/lib/jvm/openjfx --add-modules javafx.controls \
  -cp "out:resources:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar" \
  ui.SaltMarcherApp
```

To compile a standalone harness (e.g. importer dev tools):
```bash
javac -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar -sourcepath src -d out src/importer/dev/DevStatBlockHarness.java
java -cp "out:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar" importer.dev.DevStatBlockHarness
```

No test framework. No linter. Database is `game.db` (SQLite, auto-created on first run). Schema changes require deleting `game.db` and re-running `./crawl.sh` — there are no ALTER TABLE migrations.

## First Run

After cloning, the database is empty. Run `./crawl.sh` to populate monster data (requires `crawler.properties` — copy from `crawler.properties.example` and add a valid D&D Beyond session cookie). Without data the app starts but shows no creatures.

## Architecture

**Language:** Java (no modules), JavaFX UI, SQLite via raw JDBC. All JARs in `lib/`.

**Layer structure** (bottom-up):
- `src/entities/` — POJOs with PascalCase fields (intentional convention)
- `src/database/DatabaseManager` — connection factory (`getConnection()` returns a fresh, closeable Connection; callers own it via try-with-resources). No migration ladder — `setupDatabase()` uses idempotent CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE seeding. `database/dev/` has schema verification harness
- `src/repositories/` — all methods **static**, accept `Connection conn` as first parameter; callers (services) own the connection lifecycle via try-with-resources
- `src/services/` — all methods **static**, stateless business logic. Domain value objects (Encounter, EncounterSlot) live in `entities/`, not here
- `src/importer/` — HTML scrapers and bulk importers (run as standalone CLI, not from the app). `dev/` sub-package has parser harness mains
- `src/ui/` — JavaFX single-window app with sidebar navigation

**UI shell architecture:**
- `AppShell` manages a two-column layout: left (nav sidebar + controls + content) and right (InspectorPane + ScenePane, persistent across views)
- `AppView` interface: `getRoot()`, `getControlPanel()`, `getTitle()`, `getToolbarItems()`, `getIconText()` (sidebar symbol), `onShow()`/`onHide()` lifecycle hooks. SESSION views **must** return `null` from `getRightColumn()`; EDITOR views may override it to replace the right column
- `ViewId` enum + `ViewCategory` (SESSION vs EDITOR) — to add a new view: add enum entry, implement AppView, register in SaltMarcherApp
- `ScenePane`/`SceneHandle` — tabbed right-column area; views register persistent tabs via SceneHandle at construction time
- Views push content to ScenePane via `setOnUpdateSceneContent(Consumer<Node>)` callback
- `ui/components/` — reusable widgets (DifficultyMeter, HexGridPane, StatBlockPane, SearchableFilterButton, etc.). `TerrainType` is a shared enum used by both `HexGridPane` (`ui/components/`) and `TilePropertiesPane` (`ui/mapeditor/`); it lives here so neither package owns it

**Encounter subsystem** (`ui/encounter/`): builder mode (EncounterRosterPane) ↔ combat mode (CombatTrackerPane), DifficultyMeter live-updates in both.

**Overworld/map subsystem** (`ui/overworld/`, `ui/mapeditor/`): hex grid with axial coordinates (q, r). `HexGridPane` (shared hex renderer) lives in `ui/components/`. `HexMapService` provides async loading helpers (`loadFirstMapAsync`, `loadMapAsync`) used by both `HexMapPane` and `MapEditorCanvas`. Forgotten Realms calendar (12×30 + 5 intercalary days). Campaign state singleton (id=1) in DB.

**Map editor** (`ui/mapeditor/`): EDITOR-category view with `MapEditorCanvas`, `TilePropertiesPane`, `MapEditorControls`, and `EditorTool` enum. Overrides `getRightColumn()` with its own properties panel.

## Key Conventions

- **Static methods everywhere** in repositories and services — no instance state
- **try-with-resources** for all JDBC connections, statements, result sets
- **CSS-only theming:** `resources/salt-marcher.css` is the single source of truth for design tokens (CSS variables on `.root`). `ThemeColors.java` has dynamic helpers
- **Async pattern:** `javafx.concurrent.Task` + `new Thread()` (daemon, named `sm-<operation>`, with `setOnFailed` handler)
- **Callbacks:** `Consumer`/`Runnable` pattern; pane setters follow `setOn<Event>()` naming
- **UI naming:** `*View` = AppView impls, `*Pane` = Region subclasses, `*Popup` = popup controllers (not Region), `*Controls` = left-column control panels
- **Error logging:** `System.err.println` (no logging framework)
- **Language:** UI strings are German. Code identifiers, comments, and commit messages are English
