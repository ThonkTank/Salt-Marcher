# CLAUDE.md - Arbeitsanweisungen für Salt Marcher

Dieses Dokument definiert, wie Claude Code mit diesem Repository arbeitet.

---

## 1. STARTUP (VOR Claim)

### Projekt-Kontext (PFLICHT - vor JEDER Aufgabe)

**STOPP.** Bevor du irgendetwas tust:

1. **[Goals.md](Goals.md) lesen** - Vision, Features, Entity-Typen, Architektur
2. **Task-Skripte nutzen** - Die Roadmap ist zu groß zum direkten Lesen:
   ```bash
   node scripts/task.mjs sort                # Top-Tasks anzeigen
   node scripts/task.mjs sort <keyword>      # Nach Keyword filtern
   node scripts/task.mjs show <ID>           # Task-Details + Dependencies
   ```

Ohne diesen Kontext fehlt dir das Gesamtbild. Keine Ausnahmen.

**⛔ ABSOLUT VERBOTEN:**
- Development-Roadmap.md **NIEMALS** direkt lesen (Read-Tool) - nur über CLI-Skripte!
- Tasks **NIEMALS** manuell editieren (Edit-Tool) - nur über CLI-Skripte!

### CLAIM-FIRST REGEL (KEINE AUSNAHMEN)

**STOPP.** Nach Task-Auswahl gilt:

1. `node scripts/task.mjs claim <ID>` ausführen
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
- ✅ Task mit Skript finden (`task.mjs sort`, `task.mjs show <ID>`)
- ✅ Task-ID notieren

**Schritt 2 (Claim) ist ein GATE.** Ohne erfolgreichen Claim kein Weitermachen.

**⚠️ AUCH IM PLAN-MODE:** Das Claim-Script ist von der Plan-Mode-Restriktion "keine Änderungen" ausgenommen. Claim MUSS erfolgen, bevor Docs gelesen oder Agents gestartet werden.

### FREMDE CLAIMS = ABBRUCH

**Eine Task mit Status 🔒 die dir nicht gehört ist TABU.**

**ABBRUCH. SOFORT. OHNE NACHDENKEN.**

Wenn `claim` fehlschlägt oder `task.mjs show` einen fremden Owner zeigt:

1. **ABBRECHEN** - Diese Task existiert für dich nicht mehr
2. **NÄCHSTE TASK** - `node scripts/task.mjs sort` ausführen
3. **WEITER** - Neue Task claimen

**Es gibt KEINE Ausnahmen. Es gibt KEINE Sonderfälle.**

**Mentales Modell:** Eine geclaime Task ist wie eine verschlossene Tür. Du klopfst nicht, du wartest nicht, du analysierst nicht warum sie zu ist. Du gehst zur nächsten Tür.

### Task finden und claimen

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TASK FINDEN                                              │
│    → node scripts/task.mjs sort [keyword]                   │
│    → node scripts/task.mjs show <ID>                        │
├─────────────────────────────────────────────────────────────┤
│ 2. TASK SOFORT CLAIMEN (GATE)                               │
│    → node scripts/task.mjs claim <ID>                       │
│    → ✅ Erfolg: Weiter zu Schritt 3                         │
│    → ❌ Fehler: ABBRUCH → Schritt 1 (KEINE weiteren Aktionen)│
├─────────────────────────────────────────────────────────────┤
│ 3. WORKFLOW FOLGEN (siehe Sektion 2)                        │
│    → Status der Task bestimmt den Workflow                  │
└─────────────────────────────────────────────────────────────┘
```

### Claim-System (Key-basiert)

Das Claim-System verwendet 4-Zeichen-Keys:

```bash
# Task claimen → Key merken!
node scripts/task.mjs claim 428
# Ausgabe: "Key: a4x2 (2h gültig)"

# Task freigeben (nur Key nötig, keine ID)
node scripts/task.mjs unclaim a4x2

# Edit bei geclaimter Task erfordert Key
node scripts/task.mjs edit 428 --status ✅ --key a4x2
```

**Wichtig:**
- Key gilt 2 Stunden, dann automatisch freigegeben
- Bei Edit ohne Key auf geclaime Task → Fehler
- Key aufbewahren bis Task abgeschlossen

**Annahme:** Immer davon ausgehen, dass andere Agenten simultan arbeiten könnten.

### PFLICHT: Task-Updates NUR über CLI

**ABSOLUTES VERBOT - KEINE AUSNAHMEN:**

| Aktion | ❌ VERBOTEN | ✅ ERLAUBT |
|--------|-------------|------------|
| Task lesen | Read-Tool auf Roadmap | `task.mjs show <ID>` |
| Task suchen | Grep/Glob auf Roadmap | `task.mjs sort <keyword>` |
| Status ändern | Edit-Tool auf Roadmap | `task.mjs edit <ID> --status X` |
| Task anlegen | Edit-Tool auf Roadmap | `task.mjs add --task --doc <path> ...` |
| Bug melden | Edit-Tool auf Roadmap | `task.mjs add --bug ...` |

**Warum?**
- Multi-Agent-Konsistenz: Manuelle Edits erzeugen Race Conditions
- Formatierung: CLI garantiert korrektes Tabellenformat
- Claim-System: Nur CLI kann Claims korrekt setzen/prüfen

---

## 2. NACH DEM CLAIM → WORKFLOW FOLGEN

Nach erfolgreichem Claim bestimmt der **Status der Task** den zu folgenden Workflow.

### Status-Workflow-Zuordnung

| Status | Workflow-Datei | Bedeutung |
|:------:|----------------|-----------|
| ⬜ | `scripts/workflows/vorbereitung.txt` | Task für Umsetzung vorbereiten |
| 🟢 | `scripts/workflows/umsetzung.txt` | Deliverables implementieren |
| 🔶 | `scripts/workflows/konformitaet.txt` | Code spezifikationskonform machen |
| ⚠️ | `scripts/workflows/reparatur.txt` | Bug beheben |
| 📋 | `scripts/workflows/review.txt` | Implementation prüfen |
| ⛔ | ABBRUCH | Task blockiert (Dependencies fehlen) |
| 🔒 | ABBRUCH | Task von anderem Agent geclaimed |
| ✅ | ABBRUCH | Task bereits abgeschlossen |

**Nach dem Claim:**
1. Status der Task prüfen (steht in der Ausgabe von `--claim`)
2. Entsprechende Workflow-Datei lesen
3. Workflow Schritt für Schritt befolgen

**Die Workflows enthalten:**
- Leselisten-Anforderungen (Architektur-Baseline + Feature-Docs)
- Status-spezifische Schritte
- Templates für Beschreibung/Imp-Spalte
- Abschluss-Kommandos

---

## 3. PROJEKT-REFERENZ (IMMER)

### Projekt-Übersicht

Salt Marcher is a D&D 5e world-building and session management tool built as an Obsidian plugin. It includes hex map editing, travel simulation, encounter generation, weather systems, and combat tracking.

**Aktueller Status:** Nutze `node scripts/task.mjs sort` für den Implementierungsstand. Das `Archive/`-Verzeichnis enthält frühere Alpha-Implementierungen nur als Referenz.

### Build-Kommandos

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

### Projektstruktur

```
src/                   # Source code
  core/                # Result, Option, EventBus, Schemas, Utils
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

### Path Aliases (tsconfig.json)

```typescript
@core/*    → src/core/*
@shared/*  → src/application/shared/*
@/*        → src/*
```

### Haupt-Arbeitsmodi

| Workmode | Purpose |
|----------|---------|
| SessionRunner | Main play view (maps, travel, encounters, calendar, audio, combat) |
| Cartographer | Hex/grid map editor with terrain, elevation, climate tools |
| Almanac | Calendar and timeline management |
| Library | CRUD for all entities (creatures, items, spells, locations, etc.) |

### Entity-Typen

EntityRegistry manages 17 types: `creature`, `character`, `npc`, `faction`, `item`, `map`, `poi`, `maplink`, `terrain`, `quest`, `encounter`, `shop`, `party`, `calendar`, `journal`, `worldevent`, `track`

### Debug-Logging

1. Copy `.claude/debug.json.example` to `.claude/debug.json`
2. Reload plugin in Obsidian
3. View logs: `tail -f CONSOLE_LOG.txt`

### Dokumentations-Referenz

- **Goals.md**: Start here—vision, features, entity types, architecture diagram
- **docs/architecture/Conventions.md**: Coding standards, error handling, patterns
- **docs/architecture/Events-Catalog.md**: Single source of truth for all domain events
- **docs/features/**: Detailed feature specifications
- **docs/domain/**: Entity type documentation (Map, Quest, Journal, NPC, Faction, etc.)
- **docs/application/**: UI documentation with wireframes (SessionRunner, DetailView)

Alle Dokumentation ist auf Deutsch.

---

## 4. CODE-REFERENZ (IMMER)

### Soll vs. Ist (Dokumentation vs. Implementierung)

| Quelle | Beschreibt |
|--------|------------|
| `docs/features/`, `docs/domain/` | **Zielzustand** - Was das Feature können soll (Spezifikation) |
| `Development-Roadmap.md` → Tasks | **Istzustand** - Status-Spalte zeigt Implementierungsstand |

**Status-Bedeutungen:**
| Status | Bedeutung |
|:------:|-----------|
| ⬜ | Noch nicht implementiert |
| 🟢 | Bereit zur Umsetzung (vorbereitet) |
| 📋 | Fertig, wartet auf Review |
| ✅ | Implementiert, reviewed und funktionsfähig |
| ⚠️ | Implementiert aber nicht funktionsfähig |
| 🔶 | Funktionsfähig aber nicht spezifikations-konform |
| 🔒 | Von einem Agenten geclaimed (in Bearbeitung) |
| ⛔ | Blockiert - Dependencies nicht erfüllt |

**Bei Diskrepanzen:** Code ↔ Dokumentation → Code an Dokumentation anpassen. Die Docs sind die Spezifikation.

**Bei Unklarheiten:** Wenn die Dokumentation unklar oder widersprüchlich ist → AskUserQuestion nutzen.

### Architektur

**Layer Architecture:**
```
Application Layer (SessionRunner, Views, UI)
        ↓
Feature Layer (State + Business Logic + StoragePorts)
        ↓
Infrastructure Layer (Vault Adapters, Rendering)

Core: Schemas, Types, Events, Utils (shared across all layers)
```

**Key Patterns:**
- **MVVM**: ViewModels coordinate between UI and Features
- **EventBus**: Cross-feature communication via typed events
- **StoragePort**: Features define storage interfaces, Infrastructure implements adapters
- **Result Pattern**: `Result<T, AppError>` for all fallible operations
- **Factory Functions**: Export `createXxxOrchestrator()` not classes directly

**Feature Communication:**
| Operation Type | Method | Use When |
|---------------|--------|----------|
| **Query** | Direct feature call | Reading state, computed values, no side effects |
| **Command** | EventBus | State changes, cross-feature effects, workflows |

**Dependency Rule:** Upper layers may query lower layers directly; state changes propagate upward via events. No cycles allowed.

### Code-Konventionen

**Import Order:**
1. External packages (`obsidian`, `zod`)
2. Core imports (`@core/types/result`, `@core/events`)
3. Feature imports (`@/features/map`)
4. Relative imports (`./types`, `./services/brush`)

**Event Naming:**
| Category | Pattern | Example |
|----------|---------|---------|
| Command | `namespace:verb-noun-requested` | `travel:start-requested` |
| Domain | `namespace:past-participle` | `travel:started` |
| State-Sync | `namespace:state-changed` | `travel:state-changed` |
| Failure | `namespace:action-failed` | `map:load-failed` |

**Required:** All events MUST include `correlationId` for workflow tracing.

**TypeScript:**
- Use `Result<T, AppError>` for fallible operations, `Option<T>` for optional values
- Use branded types for IDs: `EntityId<'map'>` not `string`
- Return `Readonly<State>` from getters

**Error Codes:**
| Category | Pattern | Example |
|----------|---------|---------|
| Not Found | `*_NOT_FOUND` | `MAP_NOT_FOUND` |
| Invalid | `INVALID_*` | `INVALID_COORDINATE` |
| Failed | `*_FAILED` | `SAVE_FAILED` |
| Conflict | `*_CONFLICT` | `VERSION_CONFLICT` |

### CRUD vs Workflow Rule

| Question | If Yes → |
|----------|----------|
| Has State Machine? | Workflow (EventBus) |
| Affects other Features? | Workflow (EventBus) |
| Synchronous & atomic? | CRUD (Direct call) |

Examples: Terrain painting = CRUD (isolated). Map loading = Workflow (affects Travel, Weather).

### State-Kategorien

| Category | Storage | On Reload |
|----------|---------|-----------|
| Persistent | Vault JSON | Restored |
| Session | Memory | Reset to defaults |
| Resumable | Plugin data | Optional restore |

---

## 5. PROZESS-REFERENZ (IMMER)

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

### Test-Strategie

| Komponente | Stabilität | Test-Ansatz |
|------------|------------|-------------|
| Core | Hoch | ~280 Unit-Tests (inkl. EventBus request()) |
| Features (Iteration) | Niedrig | Manuelles Testen |
| Features (Fertig) | Hoch | Automatisierte Tests nachziehen |

**Kriterium "Test-Ready":** User gibt Freigabe ("Feature ist fertig")

**Schema-Definitionen:**
| Ort | Inhalt |
|-----|--------|
| `docs/architecture/EntityRegistry.md` | Entity-Interfaces |
| `docs/architecture/Core.md` | Basis-Types (Result, Option, EntityId) |
| Feature-Docs | Feature-spezifische Typen |

Bei fehlenden oder unklaren Schemas: User fragen.

---

## 6. DEV-TOOLS REFERENZ

### CLI-Tools Kurzübersicht

| Aktion | Befehl |
|--------|--------|
| Lesen | `node scripts/task.mjs show <ID>` |
| Suchen | `node scripts/task.mjs sort <keyword>` |
| Priorisieren | `node scripts/task.mjs sort` |
| Status ändern | `node scripts/task.mjs edit <ID> --status ✅` |
| Bulk-Edit | `node scripts/task.mjs bulk-edit <ID> <ID> [...] --status ✅` |
| Claimen | `node scripts/task.mjs claim <ID>` |
| Unclaimen | `node scripts/task.mjs unclaim <key>` |
| Neue Task | `node scripts/task.mjs add --task --doc <path> ...` |
| Bug melden | `node scripts/task.mjs add --bug ...` |
| Bulk-Add Tasks | `node scripts/task.mjs add --tasks '<JSON-Array>'` |
| Bulk-Add Bugs | `node scripts/task.mjs add --bugs '<JSON-Array>'` |
| Task löschen | `node scripts/task.mjs remove <ID>` |
| Task splitten | `node scripts/task.mjs split <ID> "A" "B"` |

### Task-Priorisierung (sort)

```bash
node scripts/task.mjs sort                        # Top 10 aller Tasks/Bugs
node scripts/task.mjs sort travel                 # Keyword-Filter
node scripts/task.mjs sort -n 5 --mvp             # Top 5 MVP-Tasks
node scripts/task.mjs sort --status partial       # Nur 🔶 Status
node scripts/task.mjs sort --status claimed -n 0  # Alle geclaimten Tasks
node scripts/task.mjs sort --prio hoch -n 0       # Alle hoch-prio
node scripts/task.mjs sort --domain Travel        # Nur Travel-Domain
node scripts/task.mjs sort --layer features       # Nur Feature-Layer
node scripts/task.mjs sort --sort-by status,prio  # Eigene Sortierung
node scripts/task.mjs sort --sort-by -number      # Neueste Tasks zuerst
node scripts/task.mjs sort --help                 # Alle Optionen
```

**Filter-Optionen:**
| Option | Beschreibung |
|--------|--------------|
| `-s, --status <X>` | Nur Tasks mit Status X (überschreibt include-Flags) |
| `-d, --domain <X>` | Nur Tasks mit Domain X (substring match) |
| `-l, --layer <X>` | Nur Tasks mit Layer X (exact match) |
| `--mvp` / `--no-mvp` | Nur MVP / Nur Nicht-MVP |
| `-p, --prio <X>` | Nur Tasks mit Priorität X |

**Sortier-Option:**
`--sort-by <kriterien>` - Komma-separierte Liste: `mvp`, `status`, `prio`, `refcount`, `number`, `domain`, `layer`
- Prefix `-` für absteigend (z.B. `-number` = neueste zuerst)
- Default: `mvp,status,prio,refcount,number`

### Task-Details (show)

```bash
node scripts/task.mjs show 428                    # Task #428 mit Dep-Trees
node scripts/task.mjs show b4                     # Bug b4 Details
node scripts/task.mjs show 428 --depth 5          # Tieferer Dep-Baum
node scripts/task.mjs show --help                 # Alle Optionen
```

### Task-Bearbeitung (edit)

```bash
# Status ändern
node scripts/task.mjs edit 428 --status ✅

# Dependencies ändern
node scripts/task.mjs edit 428 --deps "#100, #202"
node scripts/task.mjs edit 428 --no-deps

# Beschreibung/Bereich ändern
node scripts/task.mjs edit 428 --beschreibung "Neue Beschreibung"
node scripts/task.mjs edit 428 --bereich Travel

# Vorschau ohne Speichern
node scripts/task.mjs edit 428 --status ✅ --dry-run
```

### Bulk-Edit (bulk-edit)

```bash
# Mehrere Tasks gleichzeitig bearbeiten (min. 2 IDs)
node scripts/task.mjs bulk-edit 100 101 102 --status ✅

# Mit Keys für geclaime Tasks (Reihenfolge = Task-Reihenfolge)
node scripts/task.mjs bulk-edit 100 101 --status 🟢 --key a4x2 --key b5y3

# Dry-run
node scripts/task.mjs bulk-edit 100 101 102 --prio hoch --dry-run
```

**Verhalten:**
- **Partial Success**: Fehlerhafte Tasks verhindern nicht die Bearbeitung anderer
- **Keys**: Werden in Reihenfolge den Task-IDs zugeordnet
- Alle edit-Optionen verfügbar (--status, --deps, --prio, etc.)

### Claims (claim/unclaim)

```bash
node scripts/task.mjs claim 428                   # Task claimen → Key merken!
node scripts/task.mjs unclaim a4x2                # Claim freigeben (mit Key)
node scripts/task.mjs edit 428 --key a4x2 ...     # Edit mit Key bei geclaimter Task
```

### Neue Tasks/Bugs (add)

**ALLE Task-Felder sind Pflicht:**

```bash
# Neue Task erstellen (alle Felder erforderlich!)
node scripts/task.mjs add --task \
  -b Travel -l features \
  -m "Route-Validierung implementieren" \
  -d "#100, #101" \
  -s "Travel.md#Zustände" \
  -i "travel-engine.ts.validateRoute() [neu]"

# Multi-Domain und Multi-Layer (via Komma-Separator)
node scripts/task.mjs add --task \
  -b "SessionRunner, Encounter" \
  -l "application, features" \
  -m "Cross-Feature Integration" \
  -d "-" \
  -s "SessionRunner.md#Encounter-Integration" \
  -i "encounter-handler.ts.handleEncounter() [neu]"

# Neuen Bug erstellen (nur Roadmap, kein Layer/Domain/Specs/Impl nötig)
node scripts/task.mjs add --bug -m "Bug-Beschreibung" -p hoch -d "#428"

# Bulk-Add: Mehrere Tasks auf einmal (JSON-Array mit allen Pflichtfeldern)
node scripts/task.mjs add --tasks '[
  {
    "domain": "Travel", "layer": "features",
    "beschreibung": "Task A", "deps": "-",
    "specs": "Travel.md#API", "impl": "travel.ts.start() [neu]"
  }
]'

# Bulk-Add: Mehrere Bugs auf einmal
node scripts/task.mjs add --bugs '[
  {"beschreibung": "Bug A", "prio": "hoch", "deps": "#428"},
  {"beschreibung": "Bug B"}
]'
```

**Pflichtfelder (Task):**
| Flag | Beschreibung |
|------|--------------|
| `-b, --domain` | Domain (z.B. Travel, Map) - Multi via "," |
| `-l, --layer` | Layer (features, domain, application) - Multi via "," |
| `-m, --beschreibung` | Task-Beschreibung |
| `-d, --deps` | Dependencies ("-" wenn keine, z.B. "#100, #202") |
| `-s, --specs` | Spec-Referenzen (datei.md#abschnitt) - Multi via "," |
| `-i, --impl` | Impl-Referenzen (datei.ts.funktion() [tag]) - Multi via "," |

**Impl-Tags:** `[neu]` (nur Format geprüft), `[ändern]` / `[fertig]` (Datei + Funktion muss existieren)

**Speicherort-Auflösung:**
Der Speicherort wird automatisch aus Domain+Layer ermittelt (z.B. `docs/features/Travel.md`).

**Validierung:**
- `deps`: Referenzierte IDs müssen in der Roadmap existieren
- `specs`: Datei und Abschnitt (## oder ###) müssen existieren
- `impl [ändern]/[fertig]`: Datei und Funktion müssen in src/ existieren

**Bulk-Add Verhalten:**
- **Partial Success**: Fehlerhafte Items stoppen nicht die anderen
- **JSON-Pflichtfelder (Task)**: `domain`, `layer`, `beschreibung`, `deps`, `specs`, `impl`
- **JSON-Pflichtfelder (Bug)**: `beschreibung`

**Wichtig:** Tasks werden in der Roadmap + allen aufgelösten Docs gespeichert.

### Bug-System

**Bugs vs. Tasks - Wichtige Unterschiede:**

| Aspekt | Task | Bug |
|--------|------|-----|
| ID-Format | `#123` | `b123` |
| Speicherort | Roadmap + Doc-File | Nur Roadmap |
| Dependencies | Zeigt auf Vorbedingungen | Zeigt auf verdächtige Tasks |

**Bug-Dependencies funktionieren anders als Task-Dependencies:**

1. **Bug-Deps verweisen auf verdächtige Tasks**
   - Eine Bug-Dependency `-d "#428, #429"` bedeutet: "Diese Tasks könnten die Ursache sein"
   - NICHT: "Diese Tasks müssen fertig sein bevor der Bug bearbeitet werden kann"

2. **Zirkuläre Dependency für Nachvollziehbarkeit**
   - Wenn Bug `b5` mit `-d "#428"` erstellt wird:
     - Bug `b5` hat Dependency auf `#428`
     - Task `#428` bekommt automatisch Dependency auf `b5`
   - So sieht man bei der Task sofort: "Hier gibt es einen Bug"

3. **Automatische Cleanup bei Resolution**
   - `node scripts/task.mjs remove b5 --resolve`
   - Entfernt `b5` aus allen Task-Dependencies automatisch
   - Task `#428` verliert die `b5` Dependency

**Workflow bei Bug-Bearbeitung:**

```
1. Bug finden:     node scripts/task.mjs sort --status ⚠️
2. Bug claimen:    node scripts/task.mjs claim b5
3. Verdächtige Tasks prüfen (aus Dependencies)
4. Bug fixen
5. Bug resolven:   node scripts/task.mjs remove b5 --resolve
```

**Merke:** Bei Bugs bedeutet "Dependency" = "könnte die Ursache sein", nicht "muss vorher fertig sein".

### Löschen/Splitten (remove, split)

```bash
# Task oder Bug löschen
node scripts/task.mjs remove 428
node scripts/task.mjs remove b4

# Bug als gelöst markieren (statt löschen)
node scripts/task.mjs remove b4 --resolve

# Task in zwei Teile splitten
node scripts/task.mjs split 428 "Teil A fertig" "Teil B TODO"
```

**Automatisches Verhalten:**
- **Multi-File-Sync**: Deps-Änderungen werden in alle Doc-Files synchronisiert
- **Bug-Propagation**: Neue Bugs setzen referenzierte Tasks automatisch auf ⚠️ und fügen zirkuläre Dependency hinzu
- **Bug-Resolution**: `--resolve` entfernt den Bug automatisch aus allen Task-Dependencies
- **Blockiert-Propagation**: Status-Änderung propagiert ⛔ zu allen Dependents mit nicht-erfüllten Deps
- **Claim-Expire**: Claims verfallen nach 2 Stunden automatisch
- **Status entfernt Claim**: Status-Änderung (außer auf 🔒) entfernt den Claim automatisch
