# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Crawler scripts: `./crawl.sh` (monsters), `./crawl-items.sh` (items). Require `crawler.properties` (copy from `.example`).

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

`AppShell` provides 3-column layout: control panel (left) | main content (center) | inspector (right). Sidebar navigation switches between `AppView` implementations. Each view provides content for all three zones via `getControlPanel()`, `getRoot()`, and `getInspectorContent()`. `ViewId` enum defines available views.

- `SaltMarcherApp` is a thin bootstrap: creates `AppShell`, registers views, wires cross-view callbacks via setter methods
- `EncounterView` owns the encounter workflow (builder → initiative → combat as sub-views)
- `PartyView` owns party CRUD
- Adding a new view: add to `ViewId`, implement `AppView`, register in `SaltMarcherApp`

### UI Communication

Inter-pane wiring uses callback setters following the `setOn<Event>(FunctionalInterface)` convention. Internal wiring happens in view constructors; cross-view callbacks use setters wired in `SaltMarcherApp`.

- `EncounterView` setters (wired in `SaltMarcherApp`): `setOnRefreshToolbar`, `setOnRefreshPanels`, `setOnToggleLayout`, `setOnRequestStatBlock`, `setOnEnsureStatBlock`, `setScene`
- `filterPane.setOnFilterChanged(Consumer<FilterCriteria>)` → `monsterList::applyFilters`
- `monsterList.setOnAddCreature(Consumer<Creature>)` → `encounterView::onAddCreature`
- `rosterPane.setOnGenerate(Runnable)` / `setOnStartCombat(Runnable)`
- `partyView.setOnPartyChanged(Runnable)` → `encounterView::refreshPartyState`
- `combatControls.setOnEndCombat(Runnable)` → switches back to builder

All background work uses `javafx.concurrent.Task<T>` on daemon threads named `sm-<operation>`, always with `setOnFailed` error handler.

### Encounter Generation Pipeline

1. `EncounterTemplate.generateShape()` → slot specs with role preferences and CR ranges
2. `EncounterGenerator.generateEncounter()` → fills slots with creatures from DB using 4-tier fallback filter, then scales counts to hit XP budget
3. `CombatSetup.buildCombatants()` → merges PCs + monsters with initiative rolls
4. `CombatTrackerPane` → turn-by-turn combat tracker (inspector section in EncounterView)

## Key Conventions

- **Entity fields: PascalCase** (`c.Name`, `c.CreatureType`, `c.Intel`). Intentional, not a mistake.
- **Repositories and services: all static methods**, no instance state.
- **DB columns: snake_case**, mapped manually in repositories.
- **CSS variables: `-sm-` prefix** in `resources/salt-marcher.css` (single source of design tokens).
- **ThemeColors** lives in `ThemeColors.java`: Canvas color constants (for `DifficultyMeter`) + shared CSS style helpers (`applyDifficultyStyle`, `controlSeparator`).
- **Error handling:** `System.err.println` in services/repos, `Alert` dialogs in UI. No custom exceptions.
- **Importer pattern:** SQL constants (`CREATURE_INSERT_SQL`, `ITEM_INSERT_SQL`) are `public static final` in repositories, shared with importers for bulk operations.
- **Delimited string formats** in DB: saves `"CON:+10,INT:+12"`, skills `"Stealth:+6"`, senses `"darkvision:60"`.
- **SQL safety:** user input always parameterized; dynamic column names validated against whitelists.
- **Stat block parser** supports both 2014 (`mon-stat-block__`) and 2024 (`mon-stat-block-2024__`) D&D Beyond HTML formats, auto-detected.

## Sensitive Data

The `.gitignore` protects: `game.db` (monster/item data), `data/` (crawled HTML), `crawler.properties` (session cookie), `lib/`, `out/`.
