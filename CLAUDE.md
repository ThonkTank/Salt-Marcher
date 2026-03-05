# CLAUDE.md

Project reference for both human contributors and Claude Code (claude.ai/code).

## Build & Run

No build tool — manual `javac`/`java` only. JavaFX via system package (`dnf install openjfx`).

```bash
# Compile (entry point pulls in all dependencies via -sourcepath)
javac --module-path /usr/lib/jvm/openjfx --add-modules javafx.controls \
  -cp lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar -sourcepath src -d out \
  src/ui/SaltMarcherApp.java

# Run (resources on classpath for CSS loading)
java --module-path /usr/lib/jvm/openjfx --add-modules javafx.controls \
  -cp "out:resources:lib/sqlite-jdbc.jar:lib/jsoup-1.17.2.jar:lib/slf4j-api.jar:lib/slf4j-nop.jar" \
  ui.SaltMarcherApp
```

Crawler scripts: `./crawl.sh` (monsters), `./crawl-items.sh` (items). Require `crawler.properties` (copy from `.example`, then `chmod 600 crawler.properties`).

No test framework — no test commands.

## Architecture

Strict layered architecture, top-to-bottom dependency only:

```
ui / importer          ← JavaFX panes, crawler/import pipeline
    ↓
services               ← stateless business logic (all static methods)
    ↓
repositories           ← data access (all static methods, try-with-resources)
    ↓
database               ← DatabaseManager: singleton connection with close-safe proxy
    ↓
entities               ← pure data containers, no logic
```

### Database Connection

`DatabaseManager.getConnection()` returns a **Java Proxy** that makes `close()` a no-op. This means try-with-resources is safe everywhere without closing the shared connection. Manual transactions (`setAutoCommit(false)`) only in batch importers.

### UI Navigation

`AppShell` provides a 4-zone layout. **Left column** (navigation-driven): control panel + main content. **Right column** (persistent): `InspectorPane` (stat blocks, top) + `ScenePane` (scene context, bottom). Sidebar navigation only switches the left column; the right column persists across view changes.

Views implement `AppView` and provide `getControlPanel()` and `getRoot()` for the left column. The right column is managed via injected callbacks (`setOnUpdateSceneContent`, `setOnRequestStatBlock`), not via the view interface.

- `SaltMarcherApp` is a thin bootstrap: creates `AppShell`, registers views, wires cross-view callbacks via setter methods
- `ui/encounter/` sub-package:
  - `EncounterView` owns the encounter workflow (builder → combat as sub-views), composed of:
    - `EncounterControls` (left control panel: filter sliders + `FilterPane` dropdown)
    - `MonsterListPane` (paginated creature table with add/stat-block actions)
    - `EncounterRosterPane` (slot list with generate/start-combat buttons)
    - `CombatTrackerPane` (turn tracker, shown during combat)
  - `PartyPopup` provides party CRUD via toolbar popup
- `ui/overworld/` sub-package:
  - `OverworldView` owns overworld travel, renders `HexMapPane` + `OverworldControls` (both placeholder)
- Adding a new view: add to `ViewId`, implement `AppView` in a feature sub-package, register in `SaltMarcherApp`

### UI Communication

Inter-pane wiring uses callback setters following the `setOn<Event>(FunctionalInterface)` convention. Internal wiring happens in view constructors; cross-view callbacks use setters wired in `SaltMarcherApp`. **Cross-view callbacks** (injected by `SaltMarcherApp`, may be null at construction time) always use a null-guard lambda: `id -> { if (cb != null) cb.accept(id); }`. **Internal callbacks** (always set before use) use direct method references.

- `AppShell.addPersistentToolbarItem(Node)` — adds always-visible toolbar items (e.g. `PartyPopup` trigger button), survives navigation
- `EncounterView` setters (wired in `SaltMarcherApp`): `setOnRefreshToolbar`, `setOnRefreshPanels`, `setOnRequestStatBlock`, `setOnEnsureStatBlock`, `setOnUpdateSceneContent`
- `encounterView.setFilterData(CreatureService.FilterOptions)` → passes filter data to `EncounterControls`, wires `encounterControls.setOnFilterChanged(monsterList::applyFilters)` directly on `EncounterControls` (no public `getFilterPane()` method)
- `monsterList.setOnAddCreature(Consumer<Creature>)` → `encounterView::onAddCreature`
- `rosterPane.setOnGenerate(Runnable)` / `setOnStartCombat(Runnable)`
- `partyPanel.setOnPartyChanged(Runnable)` → `encounterView::refreshPartyState`
- `trackerPane.setOnEndCombat(Runnable)` → switches back to builder (wired inside `EncounterView.startCombat()`)

All background work uses `javafx.concurrent.Task<T>` on daemon threads named `sm-<operation>`, always with `setOnFailed` error handler.

### Encounter Generation Pipeline

1. `EncounterTemplate.generateShape()` → slot specs with role preferences and CR ranges
2. `EncounterGenerator.generateEncounter(EncounterRequest)` → fills slots with creatures from DB using 4-tier fallback filter, then scales counts to hit XP budget. `EncounterRequest` is a record carrying partySize, avgLevel, creatureTypes, subtypes, biomes, difficulty, groupCount, balance, strength.
3. `CombatSetup.buildCombatants()` → merges PCs + monsters with initiative rolls
4. `CombatTrackerPane` → turn-by-turn combat tracker (inspector section in EncounterView)

## Key Conventions

- **UI file naming convention:** `*View` = top-level `AppView` implementations registered with `AppShell`; `*Pane` = all other UI regions that **extend `Region` or a subclass** (control panels, sub-panes, persistent panels); `*Popup` = popup-backed controllers that do NOT extend `Region` (expose `getTriggerButton()` instead); `*Controls` = left-column control panels for a view (considered a sub-category of Pane). **Exception:** single-control widgets in `ui/components/` may use functional suffixes (`*Button`, `*Selector`, `*Control`) instead of `*Pane` when they represent one interactive element rather than a layout region (e.g. `SearchableFilterButton`, `CrRangeSelector`, `SliderControl`). Do NOT self-apply `"control-panel"` CSS class inside `*Controls` classes — `AppShell` applies it to the container.
- **Importer file naming convention:** `Dev*Harness` files (e.g. `DevStatBlockHarness.java`, `DevItemParserHarness.java`) are **manual verification harnesses**, not production code. They live in `src/importer/dev/` (separate sub-package) and are not part of any automated pipeline. Do not extract or invoke them from production code.
- **Entity fields: PascalCase** (`c.Name`, `c.CreatureType`, `c.Intel`). Intentional, not a mistake.
- **Repositories and services: all static methods**, no instance state. Within `services/`, `*Service` classes (`CreatureService`, `PartyService`) are **thin facade wrappers** — UI goes through them instead of calling repositories directly. All other service classes (`EncounterGenerator`, `XpCalculator`, etc.) are **computation/logic engines** with no repository access.
- **DB columns: snake_case**, mapped manually in repositories.
- **CSS variables: `-sm-` prefix** in `resources/salt-marcher.css` (single source of design tokens).
- **ThemeColors** lives in `ui/components/ThemeColors.java`: Canvas color constants (for `DifficultyMeter`) + shared CSS style helpers (`applyDifficultyStyle`, `controlSeparator`).
- **Error handling:** `System.err.println` in services/repos. In UI: `Alert` dialogs for synchronous user-initiated operations (validation failures, confirmations); `System.err.println` in `setOnFailed` handlers for background `Task`s (Alerts are inappropriate for async failures). Every `setOnFailed` handler must log `task.getException().getMessage()` to `System.err`. No custom exceptions. **Error log format:** `ClassName.methodName(): ` + `e.getMessage()`. Error messages to `System.err` use English (they are developer-facing, not UI strings).
- **Importer pattern:** SQL constants (`CREATURE_INSERT_SQL`, `ITEM_INSERT_SQL`) are `public static final` in repositories, shared with importers for bulk operations.
- **Delimited string formats** in DB: saves `"CON:+10,INT:+12"`, skills `"Stealth:+6"`, senses `"darkvision:60"`. Exception: `Creature.Biomes` and `Creature.Subtypes` are `List<String>` stored in junction tables `creature_biomes` / `creature_subtypes` (legacy `biomes`/`subtype` columns kept for backward-compat only).
- **SQL safety:** user input always parameterized; dynamic column names validated against whitelists.
- **Stat block parser** supports both 2014 (`mon-stat-block__`) and 2024 (`mon-stat-block-2024__`) D&D Beyond HTML formats, auto-detected.
- **Keyboard shortcuts in buttons:** Use `_X` mnemonic prefix to underline the shortcut letter (e.g. `"_Weiter"` renders as <u>W</u>eiter and enables Alt+W). JavaFX `mnemonicParsing` is `true` by default on `Button`. Apply to all primary action buttons where a letter shortcut makes sense. Non-letter shortcuts (Space, F2, Enter) belong in `Tooltip` text only — never in a separate reference table in the UI.

## Language Policy

UI strings are German. Code identifiers, comments, Javadoc, CLAUDE.md, and commit messages are English. Existing German comments are acceptable but new comments should prefer English.

## Review Backlogs

`REVIEW_BACKLOG.md` files in each source package track known issues by severity (`[MAJOR]`, `[MEDIUM]`, `[MINOR]`, `[LOW]`). Fix items before adding new code in the same area. Remove entries once resolved.

## First Run

After cloning, you need the D&D Beyond data. Run `./crawl.sh` (requires `crawler.properties` with a valid session cookie — see `crawler.properties.example`). The crawler uses `--build-slugs` mode to discover creature URLs, then fetches each stat block. Without data, the app starts with an empty database and shows no creatures.

## Sensitive Data

The `.gitignore` protects: `game.db` (monster/item data), `data/` (crawled HTML), `crawler.properties` (session cookie), `lib/`, `out/`.
