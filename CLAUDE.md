# CLAUDE.md - Arbeitsanweisungen für Salt Marcher

Dieses Dokument definiert, wie Claude Code mit diesem Repository arbeitet.

## Projekt-Kontext (PFLICHT - vor JEDER Aufgabe)

**STOPP.** Bevor du irgendetwas tust:

1. **[Goals.md](Goals.md) lesen** - Vision, Features, Entity-Typen, Architektur
2. Die Dokumentations-Referenz am Ende von Goals.md zeigt, wo Details stehen

Ohne diesen Kontext fehlt dir das Gesamtbild. Keine Ausnahmen.

## Soll vs. Ist (Dokumentation vs. Implementierung)

| Quelle | Beschreibt |
|--------|------------|
| `docs/features/`, `docs/domain/` | **Zielzustand** - Was das Feature können soll (Spezifikation) |
| `Development-Roadmap.md` | **Istzustand** - Was bereits implementiert ist |
| Roadmap → "Nicht im Scope" | Bewusste Lücken dieser Phase |
| Roadmap → "Backlog" | Alle bekannten Lücken zwischen Soll und Ist |

**Wichtig:** Feature-Docs beschreiben das vollständige Feature, auch wenn nur Teile davon implementiert sind. Prüfe die Roadmap für den tatsächlichen Implementierungsstand.

**Bei Diskrepanzen:** Wenn Code von der Dokumentation abweicht und diese Abweichung nicht in der Roadmap als "Nicht im Scope" oder "Backlog" vermerkt ist → Code an Dokumentation anpassen, nicht umgekehrt. Die Docs sind die Spezifikation.

**Bei Unklarheiten:** Wenn die Dokumentation unklar oder widersprüchlich ist → AskUserQuestion nutzen. Aber **nur** wenn die relevanten Docs (laut Feature-Routing-Tabelle) gründlich gelesen wurden. Fragen, deren Antwort in der Doku steht, sind Zeitverschwendung.

**Bei Teil-Implementierungen:** Ehrlich mit `TODO`, `FIXME`, `HACK` Kommentaren markieren. Lieber Stub + TODO als versteckte Halb-Implementierung, die niemandem auffällt. Das macht den Ist-Zustand im Code selbst transparent.

## Bei Implementierungsaufgaben

### Wann Leseliste erstellen?

| Situation | Leseliste? |
|-----------|:----------:|
| Aufgabe erfordert Code-Änderungen | ✓ |
| Aufgabe plant Code-Änderungen (auch im Plan-Mode) | ✓ |
| Hypothetische Fragen ("Was wäre wenn...", "Hättest du Fragen...") | ✓ |
| Reine Informationsfragen ("Was macht X?", "Wo ist Y?") | ✗ |
| Triviale Änderungen (Typo-Fix, einzelne Zeile) | ✗ |

**Kurzregel:** Im Zweifel → Leseliste erstellen.

### Warum Leseliste?

Die 15k+ Zeilen Dokumentation enthalten Architektur-Entscheidungen, die nicht im Code sichtbar sind. Ohne systematisches Lesen:
- Werden bereits geklärte Fragen erneut gestellt
- Werden Architektur-Entscheidungen übersehen
- Wird Code geschrieben, der nicht zur Dokumentation passt

**Die Leseliste ist kein Ritual - sie verhindert Rückfragen und Fehler.**

### Interaktion mit Plan-Mode

CLAUDE.md Phase 1 (Dokumentation lesen) hat **Vorrang** vor dem Plan-Mode-Workflow.

**Reihenfolge im Plan-Mode:**
1. Goals.md + Development-Roadmap.md lesen
2. Leseliste mit TodoWrite erstellen (≥7 Docs)
3. Leseliste abarbeiten
4. DANN erst Explore-Agents starten

### Phase 1: Dokumentation lesen (KEINE Tools außer Read)

**STOPP. Bevor du Task-Agenten, Explore-Agenten oder andere Tools verwendest:**

1. **Lies mit dem Read-Tool:**
   - [Goals.md](Goals.md) - Zentraler Einstieg
   - [Development-Roadmap.md](docs/architecture/Development-Roadmap.md) - Aktueller Task

2. **Erstelle eine Leseliste mit dem TodoWrite-Tool:**

   1. Konsultiere die **Feature-Routing-Tabelle** unten
   2. Notiere alle Pflicht-Docs für deinen Task
   3. Füge hinzu: Conventions.md + Error-Handling.md
   4. Bei Events: + Events-Catalog.md

   ```
   Leseliste für [Task-Name]:
   - [ ] [Pflicht-Doc 1 aus Routing-Tabelle]
   - [ ] [Pflicht-Doc 2 aus Routing-Tabelle]
   - [ ] ...
   - [ ] Conventions.md
   - [ ] Error-Handling.md
   ```

   ❌ FALSCH: Docs raten ohne Routing-Tabelle
   ✅ RICHTIG: Routing-Tabelle → Pflicht-Docs → TodoWrite

3. **Arbeite die Leseliste ab** - Markiere jeden Todo als `completed` nach dem Lesen

→ **Feature-Routing-Tabelle:** Siehe [Anhang am Ende](#anhang-feature-routing-tabelle)

### Phase 2: Erst jetzt Code erkunden

Nach Abschluss von Phase 1 darfst du:
- Task/Explore-Agenten verwenden
- Code durchsuchen
- Implementieren

**Keine Rückfragen stellen**, die in den gelesenen Dokumenten bereits beantwortet sind.

→ **Bei offenen Fragen:**

1. Zuerst `docs/` mit Grep/Glob durchsuchen
2. Relevante Feature-Docs lesen (`docs/features/`, `docs/domain/`)
3. Nur wenn die Dokumentation keine Antwort gibt: User fragen

**Die 15K+ Zeilen Dokumentation sind die primäre Wissensquelle.** Fragen, deren Antwort in der Doku steht, verschwenden Zeit.

**Plan-Datei prüfen:** Falls eine Plan-Datei existiert (`.claude/plans/`), enthält sie geklärte Entscheidungen aus vorherigen Planungs-Sessions.

## Projekt-Übersicht

Salt Marcher is a D&D 5e world-building and session management tool built as an Obsidian plugin. It includes hex map editing, travel simulation, encounter generation, weather systems, and combat tracking.

**Aktueller Status:** Siehe [Development-Roadmap.md](docs/architecture/Development-Roadmap.md) für den Implementierungsstand. Das `Archive/`-Verzeichnis enthält frühere Alpha-Implementierungen nur als Referenz.

## Build-Kommandos

```bash
npm run dev         # Watch mode development (builds to Obsidian plugin folder)
npm run build       # Production build
npm run typecheck   # TypeScript type checking only
npm run lint        # ESLint with cycle detection
npm run test        # Run all Vitest tests
npx vitest run path/to/file.test.ts    # Run single test file
npx vitest run -t "test name pattern"  # Run tests matching pattern
```

Build output: Configured in `esbuild.config.mjs` → Obsidian vault plugins folder

**ESLint:** Uses `import-x/no-cycle: error` to enforce no cyclic dependencies between modules.

## Projektstruktur

```
src/                   # Source code
  core/                # Result, Option, EventBus, Schemas, Utils (128 tests)
  features/            # Feature layer (map, party, travel)
  infrastructure/      # Vault adapters, rendering
  application/         # SessionRunner, ViewModels
  main.ts              # Plugin entry point
docs/                  # Authoritative documentation (German)
  architecture/        # Layer docs, EventBus, Conventions, Error-Handling
  features/            # Feature specs (Travel, Weather, Encounter, Combat, etc.)
  domain/              # Entity docs (NPC, Faction, Location, Map, Quest, Journal)
  application/         # UI docs with wireframes (SessionRunner)
presets/               # Fixture data (maps, terrains)
Archive/               # Previous Alpha implementations - reference only
Goals.md               # Start here: high-level vision and feature overview (German)
```

## Architektur

### Layer Architecture

```
Application Layer (SessionRunner, Views, UI)
        ↓
Feature Layer (State + Business Logic + StoragePorts)
        ↓
Infrastructure Layer (Vault Adapters, Rendering)

Core: Schemas, Types, Events, Utils (shared across all layers)
```

### Key Patterns

- **MVVM**: ViewModels coordinate between UI and Features
- **EventBus**: Cross-feature communication via typed events
- **StoragePort**: Features define storage interfaces, Infrastructure implements adapters
- **Result Pattern**: `Result<T, AppError>` for all fallible operations
- **Factory Functions**: Export `createXxxOrchestrator()` not classes directly

### Feature Communication

| Operation Type | Method | Use When |
|---------------|--------|----------|
| **Query** | Direct feature call | Reading state, computed values, no side effects |
| **Command** | EventBus | State changes, cross-feature effects, workflows |

**Dependency Rule:** Upper layers may query lower layers directly; state changes propagate upward via events. No cycles allowed.

### Path Aliases (tsconfig.json)

```typescript
@core/*    → src/core/*
@shared/*  → src/application/shared/*
@/*        → src/*
```

## Haupt-Arbeitsmodi

| Workmode | Purpose |
|----------|---------|
| SessionRunner | Main play view (maps, travel, encounters, calendar, audio, combat) |
| Cartographer | Hex/grid map editor with terrain, elevation, climate tools |
| Almanac | Calendar and timeline management |
| Library | CRUD for all entities (creatures, items, spells, locations, etc.) |

## Entity-Typen

EntityRegistry manages 18 types: `creature`, `character`, `npc`, `faction`, `item`, `spell`, `terrain`, `location`, `maplink`, `map`, `track`, `quest`, `encounter`, `calendar`, `journal`, `worldevent`, `culture`, `shop`

## State-Kategorien

| Category | Storage | On Reload |
|----------|---------|-----------|
| Persistent | Vault JSON | Restored |
| Session | Memory | Reset to defaults |
| Resumable | Plugin data | Optional restore |

## Code-Konventionen

### Import Order
1. External packages (`obsidian`, `zod`)
2. Core imports (`@core/types/result`, `@core/events`)
3. Feature imports (`@/features/map`)
4. Relative imports (`./types`, `./services/brush`)

### Event Naming
| Category | Pattern | Example |
|----------|---------|---------|
| Command | `namespace:verb-noun-requested` | `travel:start-requested` |
| Domain | `namespace:past-participle` | `travel:started` |
| State-Sync | `namespace:state-changed` | `travel:state-changed` |
| Failure | `namespace:action-failed` | `map:load-failed` |

**Required:** All events MUST include `correlationId` for workflow tracing.

### TypeScript
- Use `Result<T, AppError>` for fallible operations, `Option<T>` for optional values
- Use branded types for IDs: `EntityId<'map'>` not `string`
- Return `Readonly<State>` from getters

### CRUD vs Workflow Rule

| Question | If Yes → |
|----------|----------|
| Has State Machine? | Workflow (EventBus) |
| Affects other Features? | Workflow (EventBus) |
| Synchronous & atomic? | CRUD (Direct call) |

Examples: Terrain painting = CRUD (isolated). Map loading = Workflow (affects Travel, Weather).

### Error Codes
| Category | Pattern | Example |
|----------|---------|---------|
| Not Found | `*_NOT_FOUND` | `MAP_NOT_FOUND` |
| Invalid | `INVALID_*` | `INVALID_COORDINATE` |
| Failed | `*_FAILED` | `SAVE_FAILED` |
| Conflict | `*_CONFLICT` | `VERSION_CONFLICT` |

## Prozess-Erwartungen

### Commit-Granularität
Pro logische Einheit committen:
- `feat(core): add Result<T,E> type with tests`
- `feat(core): add EventBus with publish/request`

### Autonomie-Level

| Kategorie | Verhalten |
|-----------|-----------|
| Code-Style, Implementierungsdetails | Autonom entscheiden |
| Kleine Doku-Korrekturen | Autonom |
| API-Design, neue Interfaces | Nachfragen |
| Architektur-Abweichungen | Nachfragen |
| Neue npm Dependencies | Nachfragen |

**Kurzregel:** Öffentliche API oder Architektur → Fragen. Sonst autonom.

### Alpha-Code Referenz
Alpha-Code (Archive/) so wenig wie möglich referenzieren. Die 15k Zeilen Dokumentation in `docs/` sind die Wahrheit, nicht der alte Code.

### Sprint-Pflicht (Plan-Mode)

**STOPP.** Bevor du ExitPlanMode aufrufst:

1. Development-Roadmap.md → "Aktiver Sprint" Sektion ausfüllen
2. Feature komplett definieren (ganz oder gar nicht)
3. "Nicht im Scope" explizit benennen

Ohne definierten Sprint keine Implementierung.

## Debug-Logging

1. Copy `.claude/debug.json.example` to `.claude/debug.json`
2. Reload plugin in Obsidian
3. View logs: `tail -f CONSOLE_LOG.txt`

## Dokumentations-Referenz

- **Goals.md**: Start here—vision, features, entity types, architecture diagram
- **docs/architecture/Conventions.md**: Coding standards, error handling, patterns
- **docs/architecture/Events-Catalog.md**: Single source of truth for all domain events
- **docs/features/**: Detailed feature specifications
- **docs/domain/**: Entity type documentation (Map, Quest, Journal, NPC, Faction, etc.)
- **docs/application/**: UI documentation with wireframes (SessionRunner, DetailView)

Alle Dokumentation ist auf Deutsch.

---

## Anhang: Feature-Routing-Tabelle

Konsultiere diese Tabelle und lies die zugeordneten Docs **VOR** dem Code.

### Features (Backend)

| Task | Pflicht-Docs | Wird gelesen von |
|------|--------------|------------------|
| **Time/Calendar** | Time-System.md, Journal.md, Events-Catalog.md | Travel, Weather, Audio, Encounter |
| **Travel** | Travel-System.md, Map-Feature.md, Time-System.md, Weather-System.md | SessionRunner |
| **Weather** | Weather-System.md, Time-System.md, Terrain.md | Travel, Audio, Encounter |
| **Encounter** | Encounter-System.md, Encounter-Balancing.md, NPC-System.md | Travel, Quest, Combat |
| **Combat** | Combat-System.md, Encounter-System.md, Character-System.md | SessionRunner |
| **Quest** | Quest-System.md, Quest.md, Encounter-System.md, Loot-Feature.md | SessionRunner |
| **Audio** | Audio-System.md, Time-System.md, Weather-System.md | SessionRunner |
| **Loot** | Loot-Feature.md, Item.md, Encounter-System.md | Quest |
| **Map (Feature)** | Map-Feature.md, Map.md, Terrain.md, Map-Navigation.md | Travel, Weather, Cartographer |
| **Dungeon** | Dungeon-System.md, Map-Feature.md, Combat-System.md | SessionRunner |
| **Party/Character** | Character-System.md, Inventory-System.md, Item.md | Travel, Combat, SessionRunner |
| **Inventory** | Inventory-System.md, Item.md, Character-System.md | Party, Shop, Loot |

### Domain-Entities

| Task | Pflicht-Docs | Wird gelesen von |
|------|--------------|------------------|
| **Creature/Monster** | Creature.md, EntityRegistry.md | Encounter, Combat, NPC |
| **NPC** | NPC-System.md, Creature.md, Faction.md | Encounter, Quest, Shop |
| **Faction** | Faction.md, NPC-System.md, POI.md | NPC, Encounter |
| **Location/POI** | POI.md, Map-Navigation.md, Map.md | Travel, Quest, Encounter |
| **Item** | Item.md, EntityRegistry.md | Inventory, Loot, Shop |
| **Terrain** | Terrain.md, Map.md | Map-Feature, Weather, Travel |
| **Path** | Path.md, Map.md, Map-Navigation.md | Map-Feature, Travel (post-MVP) |
| **Shop** | Shop.md, NPC-System.md, Item.md | Library |
| **Journal** | Journal.md, Time-System.md | SessionRunner, Almanac |
| **Map (Entity)** | Map.md, Map-Navigation.md, Terrain.md | Map-Feature, Cartographer |
| **Quest (Entity)** | Quest.md, Quest-System.md | Quest-Feature |

### Application Layer (UI)

| Task | Pflicht-Docs | Konsumiert |
|------|--------------|------------|
| **SessionRunner** | SessionRunner.md, Application.md, Data-Flow.md | Map, Travel, Time, Weather, Audio, Party |
| **DetailView** | DetailView.md, Application.md, Combat-System.md, Encounter-System.md | Encounter, Combat, Shop |
| **Cartographer** | Cartographer.md, Map-Feature.md, Map.md, Terrain.md | Map |
| **Library** | Library.md, EntityRegistry.md, Application.md | Alle Entities |
| **Almanac** | Time-System.md, Journal.md, SessionRunner.md | Time, WorldEvents |

### Architektur/Infrastruktur

| Task | Pflicht-Docs |
|------|--------------|
| **Neues Feature anlegen** | Features.md, EventBus.md, Events-Catalog.md, Conventions.md |
| **Event hinzufügen** | Events-Catalog.md, EventBus.md |
| **Neuer Entity-Typ** | EntityRegistry.md, Core.md, Infrastructure.md |
| **Vault/Storage** | Infrastructure.md, Core.md |
| **Error-Handling** | Error-Handling.md, Conventions.md |
| **Testing** | Testing.md, Conventions.md |
| **Architektur-Fragen** | Features.md, Data-Flow.md, Project-Structure.md, Application.md |
| **Layer-Grenzen** | Features.md, Application.md, Infrastructure.md |
| **Implementierungsstand** | Development-Roadmap.md |
| **Begriffe/Glossar** | Glossary.md |
| **Typische Workflows** | Example-Workflows.md |

### Immer lesen

Diese Docs sind bei JEDER Implementierungsaufgabe Pflicht:
- **Conventions.md** - Code-Standards
- **Error-Handling.md** - Fehlerbehandlung
- **Events-Catalog.md** - Wenn Events involviert
