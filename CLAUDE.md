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

After cloning, the database is empty. Run `./crawl.sh` to populate monster data (requires `crawler.properties` — copy from `crawler.properties.example` and add a valid D&D Beyond session cookie). `crawl-items.sh` does the same for items (supports `--build-slugs` for slug-list-only mode). Without data the app starts but shows no creatures.

## Architecture

**Language:** Java (no modules), JavaFX UI, SQLite via raw JDBC. All JARs in `lib/` (sqlite-jdbc, jsoup, slf4j-api, slf4j-nop). JavaFX loaded from system `/usr/lib/jvm/openjfx`.

**Layer structure** (bottom-up):
- `src/entities/` — POJOs and records with **PascalCase public fields** (intentional convention, no getters/setters). Notable: `Creature.Intel` (not `Int`) to avoid Java keyword; `Creature.relationsLoaded` is a camelCase exception (boolean flag, not domain). `ChallengeRating` is an immutable class with factory `ChallengeRating.of(raw)`
- `src/database/DatabaseManager` — connection factory. `getConnection()` returns a fresh Connection with `PRAGMA foreign_keys=ON` and `journal_mode=WAL`; callers own it via try-with-resources. `setupDatabase()` uses idempotent `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` seeding. `database/dev/` has schema verification harness
- `src/repositories/` — all methods **static**, accept `Connection conn` as first parameter; callers (services) own the connection lifecycle via try-with-resources
- `src/services/` — all methods **static**, stateless business logic. Domain value objects live in `entities/`, not here
- `src/importer/` — HTML scrapers and bulk importers (run as standalone CLI via `crawl.sh`/`crawl-items.sh`, not from the app). `dev/` sub-package has parser harness mains
- `src/ui/` — JavaFX single-window app with sidebar navigation

**DB storage conventions:** Multi-value fields stored as delimited strings — `KEY:value,KEY:value,...` (e.g. `SavingThrows = "CON:10,INT:12"`, `Senses = "darkvision:60"`). Junction tables (`creature_biomes`, `creature_subtypes`, `item_tags`) for many-to-many. `campaign_state` is a singleton row (id=1). No name-column indexes anywhere (leading-wildcard `LIKE` can't use B-tree).

### UI Shell Architecture

- **AppShell** — `BorderPane`: sidebar (left) | `mainSplit` (center). `mainSplit` is horizontal: `leftColumn` (VBox: controlPanel + contentArea) | `rightSplit` (vertical: InspectorPane + ScenePane). Divider positions saved per-ViewId and restored on navigate-back
- **AppView** interface: `getRoot()`, `getControlPanel()`, `getTitle()`, `getToolbarItems()`, `getIconText()` (sidebar symbol), `onShow()`/`onHide()` lifecycle hooks. SESSION views **must** return `null` from `getRightColumn()`; EDITOR views may override it to replace the right column
- **ViewId** enum + **ViewCategory** (SESSION vs EDITOR). Current views: ENCOUNTER, OVERWORLD (both SESSION), MAP_EDITOR (EDITOR). To add a new view: (1) add enum entry, (2) implement AppView, (3) call `shell.registerView()` in SaltMarcherApp
- **AppShell navigation:** `navigateTo()` saves dividers → `onHide()` → swaps content → restores dividers → `onShow()`. `refreshPanels()` swaps content only (safe for mode switches, no divider reset). `refreshToolbar()` rebuilds toolbar items only
- **InspectorPane** (top-right, persistent across SESSION views): `showStatBlock(id)` toggles (same ID hides, different ID shows); `ensureStatBlock(id)` always shows (used for auto-show on turn advance); `showContent(title, node)` for arbitrary content; cancels pending async loads on new requests
- **ScenePane**/**SceneHandle** — tabbed bottom-right area. Views register persistent tabs via `SceneHandle` at construction time. Tab bar auto-hidden when only 1 tab. `SceneHandle.setContent(node)` swaps content (e.g. roster→tracker on combat start)

### Cross-View Wiring (SaltMarcherApp.start)

- `EncounterViewCallbacks` record passes `shell::refreshToolbar`, `shell::refreshPanels`, `shell.getShowStatBlockHandler()`, `shell.getSceneRegistry()` — compile-time enforcement of required callbacks
- `PartyPopup.setOnPartyChanged(encounterView::refreshPartyState)` — party changes propagate to encounter difficulty
- Filter data loaded async on `sm-filter-load` thread, delivered via `encounterView.setFilterData()`
- `StatBlockPane` has 50-entry LRU cache (access-ordered `LinkedHashMap`, FX thread only)

### Encounter Subsystem (`ui/encounter/`)

Builder mode (EncounterRosterPane) ↔ combat mode (CombatTrackerPane), DifficultyMeter live-updates in both.

- **Mode switch:** `switchMode(COMBAT)` installs scene-level `KEY_PRESSED` filter; `switchMode(BUILDER)` removes it. Scene reference via `sceneProperty()` listener. `initialLoadDone` flag prevents double-loading on second `onShow()`
- **EncounterControls** (left panel): FilterPane + 4 SliderControls (Difficulty, Gruppen, Balance, Stärke). Sliders default to Auto (checked → passes -1 to generator). In combat mode, sliders hidden
- **EncounterGenerator** 3-phase algorithm: (1) select one creature per shape spec with 4-tier fallback filter, (2) fill slot counts via lowest-count greedy, (3) top up with filler/round-robin. Weighted selection uses coherence scoring (subtype match +5, type +3, biome +2, role +2, same-ID penalty -1)
- **CombatTrackerPane** keyboard shortcuts: Space/→ next turn, ↑↓ focus, F2 HP, I initiative, Enter stat block, Delete remove, Ctrl+D duplicate. HP bar colors: green ≥50%, yellow ≥25%, red <25%

### Overworld/Map Subsystem (`ui/overworld/`, `ui/mapeditor/`)

- **HexGridPane** (shared renderer in `ui/components/`): flat-top hexagons, axial coordinates (q, r), `HEX_SIZE = 48px`. `tilePolygons: Map<Long, Polygon>` for O(1) tile-ID lookup. Zoom 0.2–5.0×, pan via middle/left drag. `setReadOnly(true)` for HexMapPane; `setPaintMode(true)` for MapEditorCanvas
- **HexMapService** provides `loadFirstMapWithPartyAsync` (overworld, loads tiles + party position), `loadFirstMapAsync`/`loadMapAsync` (editor). `updatePartyTileAsync` debounces saves with 300ms delay via `ScheduledExecutorService`
- **MapEditorView** paint-and-flush: `dirtyTiles` map accumulates changes during paint stroke; `flushDirtyTiles()` batches in single transaction on `sm-save-terrain` thread. Canvas gets optimistic visual update immediately
- **TerrainType** enum lives in `ui/components/` (shared between HexGridPane and TilePropertiesPane)
- Forgotten Realms calendar (12×30 + 5 intercalary days). `CalendarService.ParsedCalendar.from(config)` parsed once, reused for many `fromEpochDay()` calls

## Key Conventions

- **Static methods everywhere** in repositories and services — no instance state
- **try-with-resources** for all JDBC connections, statements, result sets
- **CSS-only theming:** `resources/salt-marcher.css` is the single source of truth for design tokens (CSS variables on `.root`). `ThemeColors.java` has `Color` constants mirroring CSS variables for Canvas-only drawing — must be kept in sync manually
- **Async pattern:** `javafx.concurrent.Task` + `new Thread()` (daemon, named `sm-<operation>` e.g. `sm-filter-load`, `sm-encounter-gen`, `sm-combat-setup`, `sm-stat-block`, `sm-save-terrain`, with `setOnFailed` handler)
- **Callbacks:** `Consumer`/`Runnable` pattern; pane setters follow `setOn<Event>()` naming
- **UI naming:** `*View` = AppView impls, `*Pane` = Region subclasses, `*Popup` = popup controllers (not Region), `*Controls` = left-column control panels
- **Error logging:** `System.err.println` (no logging framework)
- **Language:** UI strings are German. Code identifiers, comments, and commit messages are English
