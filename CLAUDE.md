# CLAUDE.md - Arbeitsanweisungen für Salt Marcher

Dieses Dokument definiert, wie Claude Code mit diesem Repository arbeitet.

## Projekt-Kontext (PFLICHT - vor JEDER Aufgabe)

**STOPP.** Bevor du irgendetwas tust:

1. **[Goals.md](Goals.md) lesen** - Vision, Features, Entity-Typen, Architektur
2. **Task-Skripte nutzen** - Die Roadmap ist zu groß zum direkten Lesen:
   ```bash
   node scripts/prioritize-tasks.mjs         # Top-Tasks anzeigen
   node scripts/task-lookup.mjs -s <keyword> # Nach Keyword suchen
   node scripts/task-lookup.mjs <ID> --deps  # Task-Details + Dependencies
   ```

Ohne diesen Kontext fehlt dir das Gesamtbild. Keine Ausnahmen.

**⛔ ABSOLUT VERBOTEN:**
- Development-Roadmap.md **NIEMALS** direkt lesen (Read-Tool) - nur über CLI-Skripte!
- Development-Roadmap.md **NIEMALS** manuell editieren (Edit-Tool) - nur über CLI-Skripte!

**CLI-Tools für Tasks:**
| Aktion | Befehl |
|--------|--------|
| Lesen | `node scripts/task-lookup.mjs <ID>` |
| Suchen | `node scripts/task-lookup.mjs -s <keyword>` |
| Priorisieren | `node scripts/prioritize-tasks.mjs` |
| Status ändern | `node scripts/update-tasks.mjs <ID> --status ✅` |
| Claimen | `node scripts/update-tasks.mjs <ID> --claim` |
| Neue Task | `node scripts/update-tasks.mjs --add ...` |
| Bug melden | `node scripts/update-tasks.mjs --add-bug "..."` |

## ⚠️ CLAIM-FIRST REGEL (KEINE AUSNAHMEN)

**STOPP.** Nach Task-Auswahl gilt:

1. `node scripts/update-tasks.mjs <ID> --claim` ausführen
2. NUR bei Erfolg: Weitermachen
3. Bei Fehler: **ABBRUCH** - Task vergessen, nächste suchen
   - ❌ KEINE Status-Prüfungen
   - ❌ KEINE Analysen
   - ❌ KEINE Wartezeit
   - ❌ KEIN Nachdenken über "warum"

**KEINE Aktionen vor dem Claim:**
- ❌ Keine Docs lesen (außer Goals.md)
- ❌ Keine Explore-Agents starten
- ❌ Keine Plan-Agents starten
- ❌ Kein Code schreiben
- ❌ Keine Leseliste erstellen

**Die einzigen erlaubten Schritte VOR dem Claim:**
- ✅ Goals.md lesen (einmal pro Session)
- ✅ Task mit Skript finden (`prioritize-tasks.mjs`, `task-lookup.mjs -s`)
- ✅ Task-ID notieren

**Schritt 2 (Claim) ist ein GATE.** Ohne erfolgreichen Claim kein Weitermachen.

**⚠️ AUCH IM PLAN-MODE:** Das Claim-Script ist von der Plan-Mode-Restriktion "keine Änderungen" ausgenommen. Claim MUSS erfolgen, bevor Docs gelesen oder Agents gestartet werden. → Siehe [Plan-Mode Ausnahme](#%EF%B8%8F-plan-mode-ausnahme-claim-script)

## ⛔ FREMDE CLAIMS = ABBRUCH

**Eine Task mit Status 🔒 die dir nicht gehört ist TABU.**

**ABBRUCH. SOFORT. OHNE NACHDENKEN.**

Wenn `--claim` fehlschlägt oder `task-lookup.mjs` einen fremden Owner zeigt:

1. **ABBRECHEN** - Diese Task existiert für dich nicht mehr
2. **NÄCHSTE TASK** - `node scripts/prioritize-tasks.mjs` ausführen
3. **WEITER** - Neue Task claimen

**VERBOTENE AKTIONEN (führen zu Zeitverschwendung):**

| Aktion | Warum verboten |
|--------|----------------|
| `task-lookup.mjs <ID>` nochmal | Status wird sich nicht ändern |
| `--whoami` / `cat .my-agent-id` | Du weißt bereits dass es nicht deine ist |
| `--check-claim` | Irrelevant - nicht deine Task |
| Warten | Der andere Agent braucht 2h oder gibt auf |
| "Warum geclaimed?" analysieren | Zeitverschwendung |
| Bug-Details lesen | Nicht deine Baustelle |

**Es gibt KEINE Ausnahmen. Es gibt KEINE Sonderfälle.**

Der Claim-Mechanismus existiert genau dafür: Konflikte zu verhindern. Wenn eine Task geclaimed ist, arbeitet jemand daran. Ende der Geschichte.

**Mentales Modell:** Eine geclaime Task ist wie eine verschlossene Tür. Du klopfst nicht, du wartest nicht, du analysierst nicht warum sie zu ist. Du gehst zur nächsten Tür.

## Soll vs. Ist (Dokumentation vs. Implementierung)

| Quelle | Beschreibt |
|--------|------------|
| `docs/features/`, `docs/domain/` | **Zielzustand** - Was das Feature können soll (Spezifikation) |
| `Development-Roadmap.md` → Tasks | **Istzustand** - Status-Spalte zeigt Implementierungsstand |
| Tasks mit ⬜ | Noch nicht implementiert |
| Tasks mit ✅ | Implementiert und funktionsfähig |
| Tasks mit ⚠️ | Implementiert aber nicht funktionsfähig |
| Tasks mit 🔶 | Funktionsfähig aber nicht spezifikations-konform |
| Tasks mit 🔒 | Von einem Agenten geclaimed (in Bearbeitung) |

**Wichtig:** Feature-Docs beschreiben das vollständige Feature, auch wenn nur Teile implementiert sind. Die Tasks-Liste mit Status-Spalte zeigt den tatsächlichen Stand.

**Bei Diskrepanzen:** Code ↔ Dokumentation → Code an Dokumentation anpassen. Die Docs sind die Spezifikation.

**Bei Unklarheiten:** Wenn die Dokumentation unklar oder widersprüchlich ist → AskUserQuestion nutzen. Aber **nur** wenn die relevanten Docs (laut Feature-Routing-Tabelle) gründlich gelesen wurden. Fragen, deren Antwort in der Doku steht, sind Zeitverschwendung.

**Bei Teil-Implementierungen:** `TODO`, `FIXME`, `HACK` Kommentare im Code + Task in #Xa/#Xb aufteilen in der Roadmap.

## Bei Implementierungsaufgaben

### Task-zentrierter Workflow

**Jede Implementierung beginnt mit einer Task - gefunden über die Task-Skripte.**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TASK FINDEN                                              │
│    → node scripts/prioritize-tasks.mjs [keyword]            │
│    → node scripts/task-lookup.mjs -s <keyword>              │
├─────────────────────────────────────────────────────────────┤
│ 2. TASK SOFORT CLAIMEN ⚠️                                   │
│    → node scripts/update-tasks.mjs <ID> --claim             │
│    → ✅ Erfolg: Weiter zu Schritt 3                         │
│    → ❌ Fehler: ABBRUCH → Schritt 1 (KEINE weiteren Aktionen)│
├─────────────────────────────────────────────────────────────┤
│ 3. TASK DETAILS + DOCS LESEN                                │
│    → node scripts/task-lookup.mjs <ID> --deps               │
│    → Spec-Spalte → relevante Docs lesen                     │
├─────────────────────────────────────────────────────────────┤
│ 4. IMPLEMENTIEREN                                           │
│    → Code schreiben, testen                                 │
├─────────────────────────────────────────────────────────────┤
│ 5. TASK ABSCHLIESSEN                                        │
│    → node scripts/update-tasks.mjs <ID> --status ✅          │
└─────────────────────────────────────────────────────────────┘
```

→ Siehe [CLAIM-FIRST REGEL](#%EF%B8%8F-claim-first-regel-keine-ausnahmen) für Details.

### Task-Existenz-Prüfung (PFLICHT)

**STOPP. Bevor du Code schreibst:**

```bash
# 1. Task suchen
node scripts/task-lookup.mjs -s <keyword>
node scripts/prioritize-tasks.mjs <keyword>

# 2. Falls keine passende Task existiert → neue anlegen
node scripts/update-tasks.mjs --add --bereich X --beschreibung "..." --prio mittel

# 3. Task-Details abrufen (zeigt Spec, Imp, Deps)
node scripts/task-lookup.mjs <ID> --deps
```

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

**Reihenfolge (strikt, keine Abweichungen):**

| Schritt | Aktion | Gate? |
|:-------:|--------|:-----:|
| 1 | Goals.md lesen | - |
| 2 | Task mit Skript finden | - |
| **3** | **🔒 CLAIM** (`--claim`) | **JA** |
| 4 | Leseliste erstellen + abarbeiten | - |
| 5 | Explore-Agents starten | - |
| 6 | Plan schreiben | - |
| 7 | ExitPlanMode | - |
| 8 | Implementieren | - |
| 9 | Status setzen (`--status ✅`) | - |

**Schritt 3 ist ein GATE:** Bei Claim-Fehler → zurück zu Schritt 2. Kein Weitermachen ohne erfolgreichen Claim.

→ Siehe [CLAIM-FIRST REGEL](#%EF%B8%8F-claim-first-regel-keine-ausnahmen)

### ⚠️ Plan-Mode Ausnahme: Claim-Script

Das Claim-Script ist im Plan-Mode **erlaubt und PFLICHT**, obwohl es die Roadmap ändert:

```bash
node scripts/update-tasks.mjs <ID> --claim      # ERLAUBT im Plan-Mode
node scripts/update-tasks.mjs <ID> --unclaim    # ERLAUBT im Plan-Mode
node scripts/update-tasks.mjs <ID> --check-claim # ERLAUBT im Plan-Mode
```

**Begründung:**
- Claim ist kein Code-Edit, sondern ein Koordinations-Mechanismus
- Ohne Claim: Race Condition → mehrere Agenten planen/implementieren dieselbe Task
- Der Claim ist atomar (nur Status → 🔒) und reversibel

**Die Plan-Mode-Regel "keine Code-Änderungen" gilt NICHT für Claim-Operationen.**

**Konsequenz:** Wenn ein Agent im Plan-Mode ist und noch keine Task geclaimed hat:
1. Task suchen (readonly: `prioritize-tasks.mjs`, `task-lookup.mjs`)
2. **SOFORT claimen** (Ausnahme von Plan-Mode-Restriktion)
3. Erst dann: Docs lesen, Explore-Agents, Plan schreiben

### Phase 1: Task finden und claimen

1. **Goals.md lesen** (einmal pro Session)

2. **Task finden:**
   ```bash
   node scripts/prioritize-tasks.mjs [keyword]
   node scripts/task-lookup.mjs -s <keyword>
   ```

3. **🔒 CLAIM** (GATE):
   ```bash
   node scripts/update-tasks.mjs <ID> --claim
   ```
   - ✅ Erfolg → Weiter zu Phase 2
   - ❌ Fehler → **ABBRUCH dieser Task**
     - Task vergessen (existiert nicht mehr für dich)
     - Zurück zu Schritt 2 mit neuem Keyword
     - KEINE weiteren Aktionen zur abgebrochenen Task

→ Siehe [CLAIM-FIRST REGEL](#%EF%B8%8F-claim-first-regel-keine-ausnahmen) und [FREMDE CLAIMS = ABBRUCH](#-fremde-claims--abbruch)

### Phase 2: Dokumentation lesen

**Erst NACH erfolgreichem Claim:**

4. **Task-Details abrufen:**
   ```bash
   node scripts/task-lookup.mjs <ID> --deps
   ```

5. **Leseliste erstellen** (≥3 Architektur-Docs + alle Feature-Docs):
   - Architektur-Baseline konsultieren → [Anhang](#architektur-baseline-immer-lesen)
   - Feature-Routing-Tabelle konsultieren → [Anhang](#features-backend)
   - Leseliste mit TodoWrite erstellen

6. **Leseliste abarbeiten** - Markiere jeden Todo als `completed` nach dem Lesen

### Phase 3: Code erkunden und implementieren

Nach Abschluss von Phase 2:

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

**Aktueller Status:** Nutze `node scripts/prioritize-tasks.mjs` für den Implementierungsstand. Das `Archive/`-Verzeichnis enthält frühere Alpha-Implementierungen nur als Referenz.

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
- `-s, --status <status>` - Status-Filter (🔶, ⚠️, ⬜, 🔒 oder: done, partial, broken, open, claimed)
- `--mvp` / `--no-mvp` - Nur MVP bzw. Nicht-MVP Tasks
- `-p, --prio <prio>` - Prioritäts-Filter (hoch, mittel, niedrig)
- `--include-done` - Auch ✅ Tasks anzeigen
- `--include-blocked` - Auch blockierte Tasks/Bugs anzeigen
- `--include-claimed` - Auch 🔒 (geclaimed) Tasks anzeigen
- `--include-resolved` - Auch ✅ (gelöste) Bugs anzeigen

**Output-Optionen:**
- `-n, --limit <N>` - Anzahl Ergebnisse (default: 10, 0 = alle)
- `--json` - JSON statt Tabelle
- `-q, --quiet` - Nur Tabelle, keine Statistiken

**Sortierkriterien:**
1. MVP: Ja > Nein
2. Status: 🔶 > ⚠️ > ⬜ > 🔒
3. Prio: hoch > mittel > niedrig
4. RefCount: Tasks/Bugs, von denen viele abhängen
5. Nummer: Niedriger = höhere Priorität

### Task-Lookup

```bash
node scripts/task-lookup.mjs 428                  # Task #428 mit Dep-Trees
node scripts/task-lookup.mjs b4                   # Bug b4 Details
node scripts/task-lookup.mjs 428 --no-tree        # Flache Listen
node scripts/task-lookup.mjs 428 --no-deps        # Nur Dependents
node scripts/task-lookup.mjs 428 --no-dependents  # Nur Dependencies
node scripts/task-lookup.mjs 428 --depth 5        # Tieferer Baum (5 Ebenen)
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

**Optionen (Standard: deps + dependents + tree aktiviert):**
- `-d, --deps` - Voraussetzungen anzeigen (Standard: an)
- `-D, --dependents` - Blockierte Items anzeigen (Standard: an)
- `-a, --all` - Beides anzeigen
- `-t, --tree` - Rekursiver Baum (Standard: an)
- `--depth <N>` - Tiefe des Baums (default: 3)
- `--no-deps` - Voraussetzungen ausblenden
- `--no-dependents` - Blockierte Items ausblenden
- `--no-tree` - Flache Liste statt Baum
- `--json` - JSON-Ausgabe
- `-q, --quiet` - Kompakte Ausgabe

**Such-Optionen:**
- `-s, --search <KEYWORD>` - Suche in Bereich, Beschreibung und Spec
- `-b, --bereich <KEYWORD>` - Suche nur im Bereich
- `--spec <KEYWORD>` - Suche nur in der Spec-Spalte
- `-n, --limit <N>` - Max. Ergebnisse (default: 20, 0 = alle)

### Task-Updates

```bash
# Status ändern
node scripts/update-tasks.mjs 428 --status ✅

# Dependencies ändern / entfernen
node scripts/update-tasks.mjs 428 --deps "#100, #202"
node scripts/update-tasks.mjs 428 --no-deps          # Entfernt alle Dependencies

# Task claimen / freigeben / prüfen
node scripts/update-tasks.mjs 428 --claim
node scripts/update-tasks.mjs 428 --unclaim
node scripts/update-tasks.mjs 428 --check-claim      # Claim-Status prüfen
node scripts/update-tasks.mjs --whoami               # Zeigt eigene Agent-ID

# Neue Task anlegen
node scripts/update-tasks.mjs --add --bereich Travel --beschreibung "Neue Feature" --prio hoch
node scripts/update-tasks.mjs --add --bereich Map --beschreibung "Fix" --mvp Ja --spec "Map.md#anchor"

# Bug-Management
node scripts/update-tasks.mjs --add-bug "Beschreibung" --prio hoch --deps "#428"
node scripts/update-tasks.mjs --delete-bug b4

# Task splitten
node scripts/update-tasks.mjs 428 --split "Teil A fertig" "Teil B TODO"

# Vorschau ohne Änderungen
node scripts/update-tasks.mjs 428 --status ✅ --dry-run

# Output-Optionen
node scripts/update-tasks.mjs 428 --status ✅ --json   # JSON-Ausgabe
node scripts/update-tasks.mjs 428 --status ✅ --quiet  # Minimale Ausgabe
```

**Automatisches Verhalten:**
- **Multi-File-Sync**: Deps-Änderungen werden in alle Doc-Files synchronisiert
- **Bug-Propagation**: Neue Bugs setzen referenzierte Tasks automatisch auf ⚠️
- **Claim-Expire**: Claims verfallen nach 2 Stunden automatisch
- **Status entfernt Claim**: Status-Änderung (außer auf 🔒) entfernt den Claim automatisch

**Claiming-System:**
- `🔒` Status markiert geclaime Tasks
- Automatische Agent-ID (gespeichert in `.my-agent-id`)
- `task-lookup.mjs` zeigt Owner-Warnung bei geclaimten Tasks

**Optionen:**
- `--dry-run, -n` - Nur Vorschau, keine Änderungen
- `--json` - JSON-Ausgabe
- `--quiet, -q` - Minimale Ausgabe
- `--agent-id <id>` - Agent-ID explizit setzen (überschreibt `.my-agent-id`)

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
| Bug behoben | Bug-Status auf ✅ setzen (`--resolve-bug`) |
| Neuer Bug entdeckt | Bug zur Bugs-Tabelle hinzufügen |
| Neue Task identifiziert | Task mit ⬜ Status hinzufügen, Imp.-Spalte mit `[neu]`/`[ändern]` markieren |

Diese Tabelle ist die einzige Quelle der Wahrheit für Roadmap-Updates. Keine Ausnahmen.

### ⛔ PFLICHT: Task-Updates NUR über CLI

**ABSOLUTES VERBOT - KEINE AUSNAHMEN:**

| Aktion | ❌ VERBOTEN | ✅ ERLAUBT |
|--------|-------------|------------|
| Task lesen | Read-Tool auf Roadmap | `task-lookup.mjs <ID>` |
| Task suchen | Grep/Glob auf Roadmap | `task-lookup.mjs -s <keyword>` |
| Status ändern | Edit-Tool auf Roadmap | `update-tasks.mjs <ID> --status X` |
| Task anlegen | Edit-Tool auf Roadmap | `update-tasks.mjs --add ...` |
| Bug melden | Edit-Tool auf Roadmap | `update-tasks.mjs --add-bug "..."` |

**Warum?**
- Multi-Agent-Konsistenz: Manuelle Edits erzeugen Race Conditions
- Formatierung: CLI garantiert korrektes Tabellenformat
- Claim-System: Nur CLI kann Claims korrekt setzen/prüfen

Alle Task-Änderungen MÜSSEN über das `update-tasks.mjs` Tool erfolgen:

| Aktion | Kommando |
|--------|----------|
| Task claimen | `node scripts/update-tasks.mjs <ID> --claim` |
| Claim freigeben | `node scripts/update-tasks.mjs <ID> --unclaim` |
| Claim prüfen | `node scripts/update-tasks.mjs <ID> --check-claim` |
| Status ändern | `node scripts/update-tasks.mjs <ID> --status ✅` |
| Deps ändern | `node scripts/update-tasks.mjs <ID> --deps "#X, #Y"` |
| Deps entfernen | `node scripts/update-tasks.mjs <ID> --no-deps` |
| Neue Task | `node scripts/update-tasks.mjs --add --bereich X --beschreibung "..." [--prio X] [--mvp Ja] [--spec "..."]` |
| Bug melden | `node scripts/update-tasks.mjs --add-bug "Beschreibung" [--prio hoch] [--deps "..."]` |
| Bug lösen | `node scripts/update-tasks.mjs --resolve-bug b4` |
| Bug löschen | `node scripts/update-tasks.mjs --delete-bug b4` (Warnung, besser --resolve-bug) |
| Task splitten | `node scripts/update-tasks.mjs <ID> --split "Teil A" "Teil B"` |
| Eigene ID anzeigen | `node scripts/update-tasks.mjs --whoami` |
| Vorschau | Jedes Kommando mit `--dry-run` |

**Workflow:** Siehe [Phase 1](#phase-1-task-finden-und-claimen) und [CLAIM-FIRST REGEL](#%EF%B8%8F-claim-first-regel-keine-ausnahmen).

**Bei geclaimten Tasks:**
- `task-lookup.mjs` zeigt Owner an
- Wenn DU der Owner bist → Weiterarbeiten
- Wenn ANDERER Agent Owner → **TASK IST TABU**
  - ❌ KEINE weiteren Aktionen zu dieser Task
  - ❌ KEIN Warten
  - ❌ KEIN Analysieren
  - → SOFORT `prioritize-tasks.mjs` für nächste Task

**Auto-Expire:** Claims verfallen nach 2 Stunden automatisch.

### Multi-Agent-Setup

**PFLICHT für Claims:** Agent-ID muss gesetzt sein:

```bash
export CLAUDE_AGENT_ID="agent-$(openssl rand -hex 4)"
```

**Ohne Agent-ID schlagen `--claim` und `--unclaim` mit Fehler fehl.**

Die Agent-ID Priorität:
1. `CLAUDE_AGENT_ID` Umgebungsvariable (höchste Priorität)
2. `--agent-id <id>` CLI-Flag

~~`.my-agent-id` Datei~~ → **ENTFERNT** (verursachte Race Conditions bei Multi-Agent-Setups)

**Annahme:** Immer davon ausgehen, dass andere Agenten simultan arbeiten könnten.

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
| **Implementierungsstand** | `node scripts/prioritize-tasks.mjs` / `task-lookup.mjs` |
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
