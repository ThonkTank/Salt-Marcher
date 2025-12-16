# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt-Kontext (PFLICHT - vor JEDER Aufgabe)

**STOPP.** Bevor du irgendetwas tust:

1. **[Goals.md](Goals.md) lesen** - Vision, Features, Entity-Typen, Architektur
2. Die Dokumentations-Referenz am Ende von Goals.md zeigt, wo Details stehen

Ohne diesen Kontext fehlt dir das Gesamtbild. Keine Ausnahmen.

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

2. **Erstelle eine Leseliste (mindestens 7 Docs) mit dem TodoWrite-Tool:**

   ```
   Leseliste für [Task-Name]:
   - [ ] Feature-Doc: docs/features/XXX.md         (1)
   - [ ] Layer-Doc: docs/architecture/XXX.md       (1)
   - [ ] Weitere: ...                              (3+)
   - [ ] Conventions.md                            (1)
   - [ ] Error-Handling.md                         (1)
   ────────────────────────────────────────────────
   Total: mindestens 7 Docs
   ```

   ❌ FALSCH: Nur 4-5 Docs auflisten, kein TodoWrite
   ✅ RICHTIG: TodoWrite mit 1 Feature + 1 Layer + 3 Weitere + 2 Pflicht = 7+

3. **Arbeite die Leseliste ab** - Markiere jeden Todo als `completed` nach dem Lesen

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

## Project Overview

Salt Marcher is a D&D 5e world-building and session management tool built as an Obsidian plugin. It includes hex map editing, travel simulation, encounter generation, weather systems, and combat tracking.

**Current Status:** Active development. Core infrastructure complete (128 tests), Travel-Minimal slice partially implemented. See [Development-Roadmap.md](docs/architecture/Development-Roadmap.md) for current progress. The `Archive/` directory contains previous Alpha implementations for reference only.

## Build Commands

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

## Project Structure

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

## Architecture

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

## Main Workmodes

| Workmode | Purpose |
|----------|---------|
| SessionRunner | Main play view (maps, travel, encounters, calendar, audio, combat) |
| Cartographer | Hex/grid map editor with terrain, elevation, climate tools |
| Almanac | Calendar and timeline management |
| Library | CRUD for all entities (creatures, items, spells, locations, etc.) |

## Entity Types

EntityRegistry manages 18 types: `creature`, `character`, `npc`, `faction`, `item`, `spell`, `terrain`, `location`, `maplink`, `map`, `track`, `quest`, `encounter`, `calendar`, `journal`, `worldevent`, `culture`, `shop`

## State Categories

| Category | Storage | On Reload |
|----------|---------|-----------|
| Persistent | Vault JSON | Restored |
| Session | Memory | Reset to defaults |
| Resumable | Plugin data | Optional restore |

## Code Conventions

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

## Debug Logging

1. Copy `.claude/debug.json.example` to `.claude/debug.json`
2. Reload plugin in Obsidian
3. View logs: `tail -f CONSOLE_LOG.txt`

## Documentation Reference

- **Goals.md**: Start here—vision, features, entity types, architecture diagram
- **docs/architecture/Conventions.md**: Coding standards, error handling, patterns
- **docs/architecture/Events-Catalog.md**: Single source of truth for all domain events
- **docs/features/**: Detailed feature specifications
- **docs/domain/**: Entity type documentation (Map, Quest, Journal, NPC, Faction, etc.)
- **docs/application/**: UI documentation with wireframes (SessionRunner)

All documentation is in German.
