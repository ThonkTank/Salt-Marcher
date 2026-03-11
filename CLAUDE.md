# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

Build tool is Gradle (Kotlin DSL) via wrapper. Use Gradle tasks as the primary interface.

```bash
# Compile
./gradlew build

# Run
./gradlew run
```

Crawler tasks:
```bash
./gradlew crawler                # monster crawl + import
./gradlew crawlerItemsPipeline   # item crawl + import
./gradlew crawlerItemsSlugs      # slug-list only
```

No test framework. No linter. Database is `game.db` (SQLite, auto-created on first run). Schema changes require deleting `game.db` and re-running `./scripts/crawl.sh` — there are no ALTER TABLE migrations.

**After every code change, recompile immediately** to catch errors early:
```bash
./gradlew build --console=plain 2>&1
```
Fix all errors before proceeding to the next change. The `2>&1` redirect shows compiler errors inline. Notes about "nicht geprüfte Vorgänge" (unchecked operations) are expected and can be ignored.

## First Run

After cloning, the database is empty. Run `./scripts/crawl.sh` to populate monster data (requires `crawler.properties` — copy from `crawler.properties.example` and add a valid D&D Beyond session cookie). `./scripts/crawl-items.sh` does the same for items (supports `--build-slugs` for slug-list-only mode). Without data the app starts but shows no creatures.

## Architecture

**Language:** Java (no modules), JavaFX UI, SQLite via raw JDBC. Build via Gradle wrapper (`./gradlew`) with Java 21 toolchain and OpenJFX plugin.

**Structure** (feature-first):
- `src/features/<feature>/{model,repository,service,ui}` — primary architecture by domain capability (Encounter, Party, Creature Catalog, Encounter Table, Calendar, Campaign State, World HexMap, Items)
- `src/database/DatabaseManager` — connection factory. `getConnection()` returns a fresh Connection with `PRAGMA foreign_keys=ON` and `journal_mode=WAL`; callers own it via try-with-resources. `setupDatabase()` uses idempotent `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` seeding
- `src/importer/` — crawler/import pipeline (run via `scripts/crawl.sh` / `scripts/crawl-items.sh` or Gradle crawler tasks)
- `src/ui/` — JavaFX shell/bootstrap plus shared UI-only components

**DB storage conventions:** Multi-value fields stored as delimited strings — `KEY:value,KEY:value,...` (e.g. `SavingThrows = "CON:10,INT:12"`, `Senses = "darkvision:60"`). Junction tables (`creature_biomes`, `creature_subtypes`, `item_tags`) for many-to-many. `campaign_state` is a singleton row (id=1). No name-column indexes anywhere (leading-wildcard `LIKE` can't use B-tree).

### UI Shell Architecture — Cockpit Layout

The shell uses a four-panel "cockpit" layout. Views project content into fixed panels:

```
+---toolbar------------------------------+
| side | Controls      | Details         |
| bar  | (top-left)    | (top-right)     |
|      |---------------+-----------------|
|      | Main          | State           |
|      | (bottom-left) | (bottom-right)  |
+------+---------------+-----------------+
```

- **Controls** — filters, sliders, tool palettes (`getControlsContent()`)
- **Main** — primary workspace: monster table, hex map, canvas (`getMainContent()`)
- **Details** — detail inspector: stat blocks, tile properties (`getDetailsContent()`)
- **State** — game state: encounter roster/tracker, travel info (`getStateContent()`)

Left column is a VBox (Controls takes natural height, Main fills rest — not resizable). Right column is a vertical SplitPane (Details / State — resizable). SplitPane items are set once and never mutated; content is swapped inside StackPane containers to preserve divider positions.

**SESSION views** (Encounter, Overworld) return `null` from `getDetailsContent()`/`getStateContent()` → shell shows its own **InspectorPane** and **ScenePane**, which persist across SESSION view switches. **EDITOR views** (MapEditor) override these to provide view-specific content (e.g. TilePropertiesPane in Details).

- **AppShell** — `BorderPane`: sidebar (left) | `mainSplit` (center, horizontal SplitPane: `leftColumn` | `rightSplit`). `leftColumn` is VBox: `controlsPanel` + `mainPanel`. `rightSplit` is vertical SplitPane: `detailsContainer` + `stateContainer`. Divider positions saved per-ViewId and restored on navigate-back
- **AppView** interface: `getMainContent()`, `getControlsContent()`, `getDetailsContent()`, `getStateContent()`, `getTitle()`, `getToolbarItems()`, `getIconText()`, `onShow()`/`onHide()`. Only `getMainContent()` and `getTitle()` are required; all others have defaults
- **ViewId** enum + **ViewCategory** (SESSION vs EDITOR). Current views: ENCOUNTER, OVERWORLD (both SESSION), MAP_EDITOR (EDITOR). To add a new view: (1) add enum entry, (2) implement AppView, (3) call `shell.registerView()` in SaltMarcherApp
- **AppShell navigation:** `navigateTo()` saves dividers → `onHide()` → `applyViewContent()` (swaps all 4 panels) → restores dividers → `onShow()`. `refreshPanels()` re-reads all 4 panels without touching SplitPane items (safe for mode switches). `refreshToolbar()` rebuilds toolbar only
- **InspectorPane** (shell-owned Details default, persistent across SESSION views): `showStatBlock(id)` toggles (same ID hides, different ID shows); `ensureStatBlock(id)` always shows (used for auto-show on turn advance); `showContent(title, node)` for arbitrary content; cancels pending async loads on new requests
- **ScenePane**/**SceneHandle** (shell-owned State default) — tabbed bottom-right area. Views register persistent tabs via `SceneHandle` at construction time. Tab bar auto-hidden when only 1 tab. `SceneHandle.setContent(node)` swaps content (e.g. roster→tracker on combat start)

### Cross-View Wiring (SaltMarcherApp.start)

- `EncounterViewCallbacks` record passes `shell::refreshToolbar`, `shell::refreshPanels`, `shell.getShowStatBlockHandler()`, `shell.getSceneRegistry()` — compile-time enforcement of required callbacks
- `PartyPopup.setOnPartyChanged(encounterView::refreshPartyState)` — party changes propagate to encounter difficulty
- Filter data loaded async on `sm-filter-load` thread, delivered via `encounterView.setFilterData()`
- `StatBlockPane` has 50-entry LRU cache (access-ordered `LinkedHashMap`, FX thread only)

### Encounter Subsystem (`src/features/encounter/`)

Builder mode (EncounterRosterPane) ↔ combat mode (CombatTrackerPane), DifficultyMeter live-updates in both.

- **Mode switch:** `switchMode(COMBAT)` installs scene-level `KEY_PRESSED` filter; `switchMode(BUILDER)` removes it. Scene reference via `sceneProperty()` listener. `initialLoadDone` flag prevents double-loading on second `onShow()`
- **EncounterControls** (left panel): FilterPane + 4 SliderControls (Difficulty, Gruppen, Balance, Stärke). Sliders default to Auto (checked → passes -1 to generator). In combat mode, sliders hidden
- **EncounterGenerator** 3-phase algorithm: (1) select one creature per shape spec with 4-tier fallback filter, (2) fill slot counts via lowest-count greedy, (3) top up with filler/round-robin. Weighted selection uses coherence scoring (subtype match +5, type +3, biome +2, role +2, same-ID penalty -1)
- **InitiativePane + CombatSetup** no pre-combat mob collapsing: initiative is entered per individual monster and CombatSetup creates only `MonsterCombatant` instances
- **CombatTrackerPane** runtime mob grouping: mobs are derived live from alive monsters sharing `(Creature-ID, initiative)` with threshold `>= 4`; canonical combat state remains individual monsters. This avoids identity-loss during merge/split while still giving shared-turn mob behavior (including spillover damage from lowest HP member forward)
- **CombatTrackerPane** keyboard shortcuts: Space/→ next turn, ↑↓ focus, F2 HP, I initiative, Enter stat block, Delete remove, Ctrl+D duplicate. HP bar colors: green ≥50%, yellow ≥25%, red <25%

### Overworld/Map Subsystem (`src/features/world/hexmap/`)

- **HexGridPane** (shared renderer in `src/features/world/hexmap/ui/shared/`): flat-top hexagons, axial coordinates (q, r), `HEX_SIZE = 48px`. `tilePolygons: Map<Long, Polygon>` for O(1) tile-ID lookup. Zoom 0.2–5.0×, pan via middle/left drag. `setReadOnly(true)` for HexMapPane; `setPaintMode(true)` for MapEditorCanvas. Party token: draggable `StackPane` overlay, snap-to-hex on drop, `onPartyTokenMoved` callback
- **HexMapService** provides `loadFirstMapWithPartyAsync` (overworld, loads tiles + party position), `loadFirstMapAsync`/`loadMapAsync` (editor). `updatePartyTileAsync` debounces saves with 300ms delay via `ScheduledExecutorService`. `updateMap()` handles name/radius changes in a transaction (grows or shrinks tile grid)
- **MapEditorView** paint-and-flush: `dirtyTiles` map accumulates changes during paint stroke; `flushDirtyTiles()` batches in single transaction on `sm-save-terrain` thread. Canvas gets optimistic visual update immediately. Anchored map dropdowns handle rename/resize and inline shrink confirmation without leaving fullscreen
- **TerrainType** enum lives in `src/ui/components/` (shared between HexGridPane and TilePropertiesPane)
- Forgotten Realms calendar (12×30 + 5 intercalary days). `CalendarService.ParsedCalendar.from(config)` parsed once, reused for many `fromEpochDay()` calls

## Key Conventions

- **Repository/service conventions:** repositories remain static (`Connection` passed in). Services are split by role:
  - utility services (`*Calculator`, `*Scoring`, `*Tuning`, `*Setup`, `*Classifier`, `*Generator`) are static-only and define a private constructor
  - stateful workflow/session services (`*ApplicationService`, `*Session`) are instance-based
  - `service/generation/internal` contains search collaborators; keep internals package-private where possible and expose only bridge APIs needed by `EncounterGenerator`
- **try-with-resources** for all JDBC connections, statements, result sets
- **CSS-only theming:** `resources/salt-marcher.css` is the single source of truth for design tokens (CSS variables on `.root`). `ThemeColors.java` has `Color` constants mirroring CSS variables for Canvas-only drawing — must be kept in sync manually
- **Async pattern:** `javafx.concurrent.Task` + `new Thread()` (daemon, named `sm-<operation>` e.g. `sm-filter-load`, `sm-encounter-gen`, `sm-combat-setup`, `sm-stat-block`, `sm-save-terrain`, with `setOnFailed` handler; guard cancellation via `if (!task.isCancelled())`)
- **Callbacks:** `Consumer`/`Runnable` pattern; pane setters follow `setOn<Event>()` naming
- **UI naming:** `*View` = AppView impls, `*Pane` = Region subclasses, `*Dropdown` = anchored, non-modal editor windows backed by `Popup`, `*Popup` = legacy popup controllers that have not been renamed yet, `*Controls` = left-column control panels, `*Canvas` = HexGridPane subclasses for specific contexts (e.g. `MapEditorCanvas`)
- **Editor window convention:** editor create/rename/edit/delete flows use anchored dropdown windows only; do not introduce modal `Dialog<>`, `Alert`, `TextInputDialog`, or other pop-up windows for editor workflows
- **Error logging:** `System.err.println` with format `ClassName.methodName(): message` (no logging framework)
- **Language:** UI strings are German. Code identifiers, comments, and commit messages are English
