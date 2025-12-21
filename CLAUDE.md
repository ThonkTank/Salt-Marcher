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
| `Development-Roadmap.md` → Tasks | **Istzustand** - Status-Spalte zeigt Implementierungsstand |
| Tasks mit ⬜ | Noch nicht implementiert |
| Tasks mit ✅ | Implementiert und funktionsfähig |
| Tasks mit ⚠️ | Implementiert aber nicht funktionsfähig |
| Tasks mit 🔶 | Funktionsfähig aber nicht spezifikations-konform |

**Wichtig:** Feature-Docs beschreiben das vollständige Feature, auch wenn nur Teile implementiert sind. Die Tasks-Liste mit Status-Spalte zeigt den tatsächlichen Stand.

**Bei Diskrepanzen:** Code ↔ Dokumentation → Code an Dokumentation anpassen. Die Docs sind die Spezifikation.

**Bei Unklarheiten:** Wenn die Dokumentation unklar oder widersprüchlich ist → AskUserQuestion nutzen. Aber **nur** wenn die relevanten Docs (laut Feature-Routing-Tabelle) gründlich gelesen wurden. Fragen, deren Antwort in der Doku steht, sind Zeitverschwendung.

**Bei Teil-Implementierungen:** `TODO`, `FIXME`, `HACK` Kommentare im Code + Task in #Xa/#Xb aufteilen in der Roadmap.

## Bei Implementierungsaufgaben

### Task-zentrierter Workflow

**Jede Implementierung beginnt mit einer Task aus der Roadmap.**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TASK IDENTIFIZIEREN                                      │
│    → Roadmap → Tasks-Liste → Task #N finden oder anlegen    │
├─────────────────────────────────────────────────────────────┤
│ 2. SPEC LESEN                                               │
│    → Spec-Spalte der Task folgen (z.B. Travel-System.md#...)│
├─────────────────────────────────────────────────────────────┤
│ 3. IMP.-SPALTE PRÜFEN                                       │
│    → Welche Dateien sind betroffen? [neu] oder [ändern]?    │
├─────────────────────────────────────────────────────────────┤
│ 4. IMPLEMENTIEREN                                           │
│    → Code schreiben, testen                                 │
├─────────────────────────────────────────────────────────────┤
│ 5. ROADMAP UPDATEN                                          │
│    → Status ✅, Imp.-Verweise aktualisieren                 │
└─────────────────────────────────────────────────────────────┘
```

### Task-Existenz-Prüfung (PFLICHT)

**STOPP. Bevor du Code schreibst:**

1. Gibt es bereits eine Task (#N) für diese Arbeit?
   - **Ja** → Task-Nummer notieren, Spec-Spalte folgen
   - **Nein** → Task anlegen mit `[neu]`/`[ändern]` in Imp.-Spalte

2. Ist die Imp.-Spalte ausgefüllt?
   - **Ja** → Diese Dateien als Einstiegspunkt nutzen
   - **Nein** → Imp.-Spalte mit erwarteten Dateien befüllen

**Keine Implementierung ohne Task-Referenz.**

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

**WARNUNG:** Die Spec-Spalte ist nur ein Shortcut, kein Ersatz für die Feature-Routing-Tabelle. Wer nur die Spec-Spalte liest, übersieht kritische Abhängigkeiten.

### Leseliste-Format (mit Task-Referenz)

**PFLICHT: Mindestens 3 Architektur-Docs + alle Feature-Docs**

```
Leseliste für Task #N: [Beschreibung]

ARCHITEKTUR (wie):
- [ ] Conventions.md
- [ ] Error-Handling.md
- [ ] Events-Catalog.md (wenn Events involviert)
- [ ] [1-2 weitere aus Architektur-Baseline, z.B. Features.md, Data-Flow.md]

FEATURE (was):
- [ ] [Alle Docs aus Feature-Routing-Tabelle]
- [ ] Imp.-Spalte prüfen: [Dateien die betroffen sind]
```

**Reihenfolge:**
1. Architektur-Baseline konsultieren → mindestens 3 Docs wählen
2. Feature-Routing-Tabelle konsultieren → ALLE Pflicht-Docs der Zeile notieren
3. Spec-Spalte der Task als **Shortcut** nutzen (Anker-Link führt zur relevanten Sektion)

❌ FALSCH: Nur Feature-Docs lesen, Architektur-Baseline ignorieren
✅ RICHTIG: Architektur-Baseline (3+) → Feature-Routing-Tabelle → Spec-Spalte als Einstieg

### Interaktion mit Plan-Mode

CLAUDE.md Workflow hat **Vorrang** vor dem Plan-Mode-Workflow.

**Reihenfolge im Plan-Mode:**
1. Goals.md + Development-Roadmap.md lesen
2. Existierende Task(s) identifizieren (anlegen erst nach ExitPlanMode)
3. **Feature-Routing-Tabelle konsultieren** → ALLE Pflicht-Docs notieren
4. Leseliste mit TodoWrite erstellen (**≥5 Docs**, inkl. Task-Referenz falls vorhanden)
5. Leseliste abarbeiten (jeden Doc mit Read-Tool lesen)
6. DANN erst Explore-Agents starten
7. Nach ExitPlanMode: Fehlende Tasks in Roadmap anlegen

**Keine Abkürzungen:** Auch im Plan-Mode müssen alle Pflicht-Docs aus der Routing-Tabelle gelesen werden.

### Phase 1: Dokumentation lesen (KEINE Tools außer Read)

**STOPP. Bevor du Task-Agenten, Explore-Agenten oder andere Tools verwendest:**

1. **Lies mit dem Read-Tool:**
   - [Goals.md](Goals.md) - Zentraler Einstieg
   - [Development-Roadmap.md](docs/architecture/Development-Roadmap.md) - Task identifizieren

2. **Konsultiere die Architektur-Baseline** (siehe [Anhang](#architektur-baseline-immer-lesen)):
   - Wähle mindestens 3 relevante Architektur-Docs
   - Layer-Docs (Features.md, Application.md) sind fast immer relevant
   - Bei Events: EventBus.md, Data-Flow.md

3. **Konsultiere die Feature-Routing-Tabelle** (siehe [Anhang](#features-backend)):
   - Finde die Zeile, die zu deiner Task passt
   - Notiere **ALLE** Pflicht-Docs aus der "Pflicht-Docs" Spalte
   - Die Spec-Spalte der Task ist ein **Shortcut** (Anker-Link zur relevanten Sektion)

4. **Erstelle Leseliste mit TodoWrite:**
   - ARCHITEKTUR: Conventions.md + Error-Handling.md + 1-2 aus Baseline
   - FEATURE: ALLE Docs aus Routing-Tabelle
   - **Mindestens 3 Architektur-Docs + alle Feature-Docs**

5. **Arbeite die Leseliste ab** - Markiere jeden Todo als `completed` nach dem Lesen

❌ FALSCH: Nur Feature-Docs lesen, Architektur-Baseline ignorieren
✅ RICHTIG: Architektur-Baseline (3+) → Feature-Routing-Tabelle → Spec-Spalte als Einstieg

### Phase 2: Code erkunden und implementieren

Nach Abschluss von Phase 1:

1. **Imp.-Spalte als Einstiegspunkt:**
   - Prüfe welche Dateien in der Imp.-Spalte stehen
   - `[neu]` → Datei muss erstellt werden
   - `[ändern]` → Datei muss modifiziert werden
   - Keine Markierung → Datei existiert bereits

2. **Implementieren:**
   - Task/Explore-Agenten verwenden
   - Code schreiben und testen

3. **Roadmap updaten** (siehe PFLICHT: Roadmap-Updates)

**Keine Rückfragen stellen**, die in den gelesenen Dokumenten bereits beantwortet sind.

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

## Dev-Tools

### Task-Priorisierung

```bash
node scripts/prioritize-tasks.mjs                     # Top 10 aller Tasks/Bugs
node scripts/prioritize-tasks.mjs travel              # Keyword-Filter
node scripts/prioritize-tasks.mjs -n 5 --mvp          # Top 5 MVP-Tasks
node scripts/prioritize-tasks.mjs --status partial    # Nur 🔶 Status
node scripts/prioritize-tasks.mjs --prio hoch -n 0    # Alle hoch-prio
node scripts/prioritize-tasks.mjs --json quest        # JSON-Ausgabe
node scripts/prioritize-tasks.mjs -q travel           # Quiet: nur Tabelle
node scripts/prioritize-tasks.mjs bug --include-blocked  # Alle Bugs anzeigen
node scripts/prioritize-tasks.mjs --help              # Alle Optionen
```

Zeigt priorisierte Tasks und Bugs aus der Development-Roadmap.md.

**Bug-Unterstützung:**
- Bugs werden mit `bN` IDs angezeigt (z.B. `b1`, `b4`)
- Bug-Status-Propagation: Tasks die von Bugs referenziert werden → Status ⚠️
- Bugs sind implizit MVP=Ja und blockiert (wegen offener Deps)

**Filter-Optionen:**
- `-s, --status <status>` - Status-Filter (🔶, ⚠️, ⬜ oder: done, partial, broken, open)
- `--mvp` / `--no-mvp` - Nur MVP bzw. Nicht-MVP Tasks
- `-p, --prio <prio>` - Prioritäts-Filter (hoch, mittel, niedrig)
- `--include-done` - Auch ✅ Tasks anzeigen
- `--include-blocked` - Auch blockierte Tasks/Bugs anzeigen

**Output-Optionen:**
- `-n, --limit <N>` - Anzahl Ergebnisse (default: 10, 0 = alle)
- `--json` - JSON statt Tabelle
- `-q, --quiet` - Nur Tabelle, keine Statistiken

**Sortierkriterien:**
1. Status: 🔶 > ⚠️ > ⬜
2. MVP: Ja > Nein
3. Prio: hoch > mittel > niedrig
4. RefCount: Tasks/Bugs, von denen viele abhängen
5. Nummer: Niedriger = höhere Priorität

### Task-Lookup

```bash
node scripts/task-lookup.mjs 428                  # Task #428 Details
node scripts/task-lookup.mjs b4                   # Bug b4 Details
node scripts/task-lookup.mjs 428 --deps           # + Dependencies
node scripts/task-lookup.mjs 428 --dependents     # + Tasks/Bugs die davon abhängen
node scripts/task-lookup.mjs 428 -a               # Beides
node scripts/task-lookup.mjs 428 --tree           # Dependency-Baum
node scripts/task-lookup.mjs 428 --tree --depth 5 # Tieferer Baum
node scripts/task-lookup.mjs 428 --json           # JSON-Ausgabe
node scripts/task-lookup.mjs --help               # Alle Optionen
```

Zeigt Details zu einer Task oder Bug und ihre Abhängigkeiten.

**Suche nach Keyword:**
```bash
node scripts/task-lookup.mjs -s Travel            # Suche in Bereich/Beschreibung/Spec
node scripts/task-lookup.mjs -b Combat            # Nur im Bereich suchen
node scripts/task-lookup.mjs --spec Weather       # Nur in der Spec-Spalte suchen
node scripts/task-lookup.mjs -s Encounter -n 10   # Max 10 Ergebnisse
node scripts/task-lookup.mjs -s Quest --json      # JSON-Ausgabe
```

**Optionen:**
- `-d, --deps` - Voraussetzungen: Tasks/Bugs die erst erledigt sein müssen
- `-D, --dependents` - Blockiert: Tasks/Bugs die auf dieses Item warten
- `-a, --all` - Beides anzeigen
- `-t, --tree` - Rekursiver Dependency-Baum
- `--depth <N>` - Baum-Tiefe (default: 3)
- `--json` - JSON-Ausgabe
- `-q, --quiet` - Kompakte Ausgabe

**Such-Optionen:**
- `-s, --search <KEYWORD>` - Suche in Bereich, Beschreibung und Spec
- `-b, --bereich <KEYWORD>` - Suche nur im Bereich
- `--spec <KEYWORD>` - Suche nur in der Spec-Spalte
- `-n, --limit <N>` - Max. Ergebnisse (default: 20, 0 = alle)

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

## Test-Strategie

| Komponente | Stabilität | Test-Ansatz |
|------------|------------|-------------|
| Core | Hoch | 136 Unit-Tests (inkl. EventBus request()) |
| Features (Iteration) | Niedrig | Manuelles Testen |
| Features (Fertig) | Hoch | Automatisierte Tests nachziehen |

**Kriterium "Test-Ready":** User gibt Freigabe ("Feature ist fertig")

### Schema-Definitionen

| Ort | Inhalt |
|-----|--------|
| `docs/architecture/EntityRegistry.md` | Entity-Interfaces |
| `docs/architecture/Core.md` | Basis-Types (Result, Option, EntityId) |
| Feature-Docs | Feature-spezifische Typen |

Bei fehlenden oder unklaren Schemas: User fragen.

## Dokumentations-Workflow

### PFLICHT: Roadmap-Updates

**Nach jeder Implementierung MUSS die Roadmap aktualisiert werden.**

**TRIGGER → AKTION (automatisch, ohne Aufforderung)**

| Trigger | Pflicht-Aktion |
|---------|----------------|
| Task-Implementierung abgeschlossen | Status auf ✅ setzen, Imp.-Spalte mit `Datei:Funktion` befüllen |
| Implementierung funktioniert nicht | Status auf ⚠️ setzen, Problem in Beschreibung notieren |
| Implementierung weicht von Spec ab | Status auf 🔶 setzen, Abweichung in Beschreibung notieren |
| Nur Teil einer Task erledigt | Task in #Xa (✅) und #Xb (⬜) aufteilen |
| Bug behoben | Bug-Zeile aus der Bugs-Tabelle **löschen** |
| Neuer Bug entdeckt | Bug zur Bugs-Tabelle hinzufügen |
| Neue Task identifiziert | Task mit ⬜ Status hinzufügen, Imp.-Spalte mit `[neu]`/`[ändern]` markieren |

Diese Tabelle ist die einzige Quelle der Wahrheit für Roadmap-Updates. Keine Ausnahmen.

### Imp.-Spalte Format

```
datei.ts:funktionName()           ← existiert bereits
datei.ts:funktionName() [neu]     ← muss noch erstellt werden
datei.ts:funktionName() [ändern]  ← muss noch geändert werden
```

Nach Abschluss: `[neu]` und `[ändern]` Markierungen **entfernen**.

### Spec-Spalte Format

Verweise auf Spezifikationen sollten **wenn möglich auf spezifische Überschriften** zeigen:

| Format | Beispiel | Verwendung |
|--------|----------|------------|
| `Datei.md#überschrift` | `Travel-System.md#state-machine` | Bevorzugt - spezifischer Anker |
| `Datei.md` | `Travel-System.md` | Fallback - wenn keine passende Überschrift existiert |

**Anker-Konvention:**
- Überschriften werden zu Ankern: Kleinbuchstaben, Leerzeichen → Bindestriche, Umlaute → ae/oe/ue
- Beispiel: "### Transport-Modi" → `#transport-modi`
- Beispiel: "### Tagesreise-Berechnung" → `#tagesreise-berechnung`

### Beispiel: Task-Lifecycle

**Neue Task:**
| # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|---------|--------------|:----:|:----:|------|------|------|
| 100 | ⬜ | Travel | Wegpunkt-Drag&Drop | hoch | Ja | - | Travel-System.md | `TravelPanel.svelte:handleDrag()` [neu] |

**Nach Implementierung:**
| 100 | ✅ | Travel | Wegpunkt-Drag&Drop | hoch | Ja | - | Travel-System.md | `TravelPanel.svelte:handleDrag()` |

**Teil-Implementierung:**
| 100a | ✅ | Travel | Wegpunkt-Drag&Drop: Drag-Logik | hoch | Ja | - | Travel-System.md | `TravelPanel.svelte:handleDrag()` |
| 100b | ⬜ | Travel | Wegpunkt-Drag&Drop: Drop-Validierung | hoch | Ja | #100a | Travel-System.md | `TravelPanel.svelte:validateDrop()` [neu] |

### Beim Planen neuer Phase

1. "Aktiver Sprint" Sektion mit Template befüllen (siehe unten)
2. Tasks aus der Task-Liste auswählen und in den Sprint aufnehmen

### Aktiver-Sprint Template

```markdown
## 🔄 Aktiver Sprint

### Phase [N]: [Name]

**User Story:**
> Als [Rolle] möchte ich [Feature], damit [Nutzen].

**Tasks:**
- [ ] #X: [Beschreibung]
- [ ] #Y: [Beschreibung]
- [ ] ...

**Nicht im Scope:**
- Ausgeschlossenes Feature 1
- Ausgeschlossenes Feature 2
```

### Prinzipien

| Dokument | Enthält |
|----------|---------|
| **Roadmap** | Tasks-Liste + Bugs + Aktiver Sprint |
| **Events-Catalog.md** | Event-Definitionen + Implementierungs-Status |
| **Feature-Docs** | Spezifikation (Ziel-Zustand) |

### Alpha-Code Referenz
Alpha-Code (Archive/) so wenig wie möglich referenzieren. Die 15k Zeilen Dokumentation in `docs/` sind die Wahrheit, nicht der alte Code.

### Sprint-Pflicht (Plan-Mode)

**STOPP.** Bevor du ExitPlanMode aufrufst:

1. Development-Roadmap.md → "Aktiver Sprint" Sektion ausfüllen
2. Tasks aus der Tasks-Liste auswählen und referenzieren (#N)
3. Explizit benennen, welche Tasks **nicht** im Sprint sind

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

### Architektur-Baseline (IMMER lesen)

Bei JEDER Implementierung müssen **zusätzlich** zu den Feature-Docs diese Architektur-Docs gelesen werden:

| Kategorie | Docs | Wann relevant |
|-----------|------|---------------|
| Layer-Verständnis | Features.md, Application.md, Infrastructure.md | Immer |
| Datenfluss | Data-Flow.md, EventBus.md | Bei State-Änderungen, Cross-Feature-Kommunikation |
| Typen/Schemas | Core.md, EntityRegistry.md | Bei neuen Types, Interfaces, Entities |
| Struktur | Project-Structure.md | Bei neuen Dateien/Modulen |

**Leseliste-Minimum:** Mindestens 3 Architektur-Docs + alle Feature-Docs aus Routing-Tabelle

---

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

**Kern-Konventionen:**
- **Conventions.md** - Code-Standards
- **Error-Handling.md** - Fehlerbehandlung
- **Events-Catalog.md** - Wenn Events involviert

**Architektur-Verständnis (mindestens 3 wählen):**
- **Features.md** - Layer-Architektur, Feature-Struktur
- **Application.md** - UI-Layer, ViewModels, Workmodes
- **Data-Flow.md** - Wie Daten zwischen Layern fließen
- **EventBus.md** - Event-basierte Kommunikation, Request/Response
- **Infrastructure.md** - Vault-Adapter, Storage-Ports
- **Core.md** - Basis-Types (Result, Option, EntityId)
- **Project-Structure.md** - Verzeichnisstruktur, wo was hingehört
