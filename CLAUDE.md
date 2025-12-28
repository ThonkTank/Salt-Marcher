# CLAUDE.md

Arbeitsanweisungen für Claude Code im Salt Marcher Repository.

---

## 1. Projekt

### Vision

Salt Marcher ist ein Obsidian-Plugin für D&D 5e Game Masters. Es automatisiert strikt algorithmische Regeln, bei denen der GM keine Kreativität aufwenden muss - nur mentale Energie zum Merken.

**System:** D&D 5e (nicht system-agnostisch)

### Haupt-Arbeitsmodi

| Modus | Zweck |
|-------|-------|
| **SessionRunner** | Hauptansicht für Sessions: Map-Panel, Travel, Encounters, Combat, Zeit, Audio |
| **Cartographer** | Visueller Map-Editor: Hex-Painting, Elevation, Klima, Location-Marker |
| **Almanac** | Kalender-Verwaltung: WorldEvents, Journal, Timeline |
| **Library** | Entity-CRUD: Creatures, Items, NPCs, Factions, Quests, etc. |

### Kern-Systeme

| System | Beschreibung | Details |
|--------|--------------|---------|
| **Travel** | Hex-basierte Overland-Navigation mit Zeit-Tracking, Speed-Berechnung, Encounter-Checks | [Travel.md](docs/features/Travel.md) |
| **Encounter** | 6 Typen (Combat, Social, Passing, Trace, Environmental, Location) mit Creature-centric Balancing | [encounter/](docs/services/encounter/) |
| **Weather** | Dynamisches Wetter basierend auf Terrain und Zeit, 6 Tages-Segmente, Weather-Events | [Weather.md](docs/services/Weather.md) |
| **Quest** | Objektiv-basierte Quests, 40/60 XP-Split, Encounter-Slots, Loot-Verteilung | [Quest.md](docs/features/Quest.md) |
| **Combat** | Initiative-Tracker, HP-Tracking, Conditions mit automatischen Reminders | [Combat.md](docs/features/Combat.md) |
| **Audio** | 2-Layer (Music + Ambience), Tag-basiertes Mood-Matching, Crossfade | [Audio-System.md](docs/features/Audio-System.md) |
| **Dungeon** | Grid-basierte Maps mit Fog of War, Licht, Fallen, Türen, Treasure | [Dungeon-System.md](docs/features/Dungeon-System.md) |

---

## 2. Architektur

### Zwei-Modi-Konzept

| Modus | Zweck | State-Owner | Views |
|-------|-------|-------------|-------|
| **Out-of-Session** | Daten vorbereiten | Vault (direkte CRUD) | Library, Cartographer, Almanac |
| **In-Session** | Session spielen | SessionControl | SessionRunner, DetailView |

**Out-of-Session:** Der GM bereitet Inhalte vor. Alle Änderungen werden direkt im Vault persistiert. Keine zentrale State-Verwaltung nötig.

**In-Session:** Der GM führt eine aktive Session durch. Der SessionControl ist der einzige State-Owner für Position, Zeit, Wetter und aktive Workflows.

### Datenfluss

```
┌─────────────────────────────────────────────────────────────┐
│ Views (Svelte)                                               │
│   $sessionControl.state   ← subscribet auf State             │
│   sessionControl.method() → ruft Methoden auf                │
└─────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────┐
│ SessionControl                                               │
│   state = writable<SessionState>(...)                        │
│   - Party-Position, Zeit, Wetter                             │
│   - Travel-, Combat-, Encounter-Workflows                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Services (pure Pipelines)                                    │
│   encounterService.generate(context) → Result                │
│   weatherService.generate(input) → Weather                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Vault (Persistence)                                          │
│   Entities lesen, Journal schreiben, Session-State speichern │
└─────────────────────────────────────────────────────────────┘
```

### Kernprinzipien

**SessionControl = Single Source of Truth**
Für In-Session-Daten gibt es genau einen Owner. Kein EventBus - die UI subscribet direkt auf den Svelte Store.

**Services = Dumme Pipelines**
Services haben keinen eigenen State. Sie empfangen Input und liefern Output:
- Erlaubt: Input konsumieren, Output liefern, Vault lesen/schreiben
- Verboten: Queries an andere Services, eigene Entscheidungen, eigenen State

**Weiterführend:** [Orchestration.md](docs/architecture/Orchestration.md), [Services.md](docs/architecture/Services.md)

### Pflicht-Leseliste nach Layer

**BEVOR du mit einem Layer arbeitest, MUSST du das entsprechende Dokument lesen.**
Das gilt für JEDE Arbeit: Code schreiben, Fragen beantworten, Planung, Dokumentation.

| Layer | Code-Pfad | Pflicht-Dokument |
|-------|-----------|------------------|
| **Orchestration** | `src/session/` | [Orchestration.md](docs/architecture/Orchestration.md) + [docs/orchestration/](docs/orchestration/) |
| **Services** | `src/services/` | [Services.md](docs/architecture/Services.md) |
| **Schemas** | `src/schemas/` | [schemas.md](docs/architecture/schemas.md) |
| **Constants** | `src/constants/` | [constants.md](docs/architecture/constants.md) |
| **Views** | `src/views/` | [docs/views/](docs/views/) |
| **Infrastructure** | `src/infrastructure/` | [Infrastructure.md](docs/architecture/Infrastructure.md) |

**KEINE AUSNAHMEN.** Auch bei einfachen Fragen oder Planungsarbeit: Erst lesen, dann antworten.

### Projektstruktur

```
src/                   # Source code
  core/                # Data Layer: Schemas, Types, Konstanten, Utils
  features/            # Feature layer (map, party, travel)
  infrastructure/      # Vault adapters, rendering
  application/         # SessionRunner, ViewModels
  main.ts              # Plugin entry point
docs/                  # Authoritative documentation (German)
  architecture/
    .task-claims.json
    constants.md
    Development-Roadmap.md
    Infrastructure.md
    Orchestration.md
    schemas.md
    Services.md
    Testing.md
  constants/
    CreatureSizes.md
    CreatureTypes.md
    Difficulty.md
    LootRarity.md
    TimeSegments.md
  entities/
    action.md
    creature.md
    culture-data.md
    currency.md
    encounter-instance.md
    faction-encounter-template.md
    faction-presence.md
    faction.md
    item.md
    journal-entry.md
    journal-settings.md
    journal.md
    LootContainer.md
    map.md
    npc.md
    overworld-tile.md
    path.md
    poi.md
    quest.md
    session.md
    shop.md
    terrain-definition.md
  features/
    Audio-System.md
    Character-System.md
    Combat.md
    Dungeon-System.md
    Journal.md
    Map-Feature.md
    Map-Navigation.md
    NPC-Lifecycle.md
    Quest.md
    Time.md
    Travel.md
  orchestration/
    CombatWorkflow.md
    EncounterWorkflow.md
    RestWorkflow.md
    SessionControl.md
    TravelWorkflow.md
  services/
    encounter/
      Adjustments.md
      Difficulty.md
      Encounter.md
      Flavour.md
      Initiation.md
      Population.md
      Publishing.md
    NPCs/
      Culture-Resolution.md
      NPC-Generation.md
      NPC-Matching.md
    Inventory.md
    Loot.md
    Weather.md
  tools/
    update-refs-hook.md
  views/
    Cartographer.md
    DetailView.md
    Library.md
    SessionRunner.md
  Example-Workflows.md
presets/               # Fixture data (maps, terrains)
Archive/               # Previous Alpha implementations - reference only
Goals.md               # Start here: high-level vision and feature overview (German)
```

---

## 3. Konventionen

### Import Order

1. External packages (`obsidian`, `zod`)
2. Core imports (`@core/types/result`, `@core/events`)
3. Feature imports (`@/features/map`)
4. Relative imports (`./types`, `./services/brush`)

### TypeScript-Patterns

| Pattern | Verwendung |
|---------|------------|
| `Result<T, AppError>` | Für fallible Operationen |
| `Option<T>` | Für optionale Werte |
| `EntityId<'map'>` | Branded Types für IDs (nicht `string`) |
| `Readonly<State>` | Return-Typ für Getter |

### Error Codes

| Kategorie | Pattern | Beispiel |
|-----------|---------|----------|
| Not Found | `*_NOT_FOUND` | `MAP_NOT_FOUND` |
| Invalid | `INVALID_*` | `INVALID_COORDINATE` |
| Failed | `*_FAILED` | `SAVE_FAILED` |
| Conflict | `*_CONFLICT` | `VERSION_CONFLICT` |

### Dokumentations-Richtlinien

**Header-Standards für Feature-Docs:**
```markdown
# Feature-Name

> **Verantwortlichkeit:** Was macht dieses Feature? (1 Satz)
> **Input:** Datentypen und Quellen (optional)
> **Output:** Resultat-Typ und Ziel (optional)
> **Schema:** Link zu Haupt-Schema (falls vorhanden)
```

**Header-Standards für Schema-Docs:**
```markdown
# Schema: EntityName

> **Produziert von:** [Feature](pfad) (Aktion)
> **Konsumiert von:** [Feature1](pfad), [Feature2](pfad)
```

**Single Source of Truth:**
- Jedes System/Konzept hat eine autoritative Quelle
- Andere Docs referenzieren diese Quelle, wiederholen keine Details
- Bei Referenzen erlaubt: 1-2 Sätze Kontext + Link
- Bei Referenzen verboten: Vollständige Schemas kopieren, Code duplizieren

**Bei Diskrepanzen:** Code ↔ Dokumentation → Code an Dokumentation anpassen. Die Docs sind die Spezifikation.

---

## 4. Task-Workflow (PFLICHT)

### Projekt-Kontext

**STOPP. VOR jeder Aufgabe MUSST du:**

1. Task-Skripte nutzen (Roadmap ist zu groß zum direkten Lesen):

```bash
node scripts/task.mjs sort                # Top-Tasks anzeigen
node scripts/task.mjs sort <keyword>      # Nach Keyword filtern
node scripts/task.mjs show <ID>           # Task-Details + Dependencies
```

**ABSOLUT VERBOTEN:**
- Development-Roadmap.md direkt lesen (Read-Tool) - nur über CLI!
- Tasks manuell editieren (Edit-Tool) - nur über CLI!

### Claim-Gate (KEINE AUSNAHMEN)

**Nach Task-Auswahl SOFORT claimen - KEINE Analysen vorher:**

```bash
node scripts/task.mjs claim <ID>
# Ausgabe: "Key: a4x2 (2h gültig)"
```

- **Bei Erfolg:** Key merken, weitermachen
- **Bei Fehler:** ABBRUCH. Nächste Task suchen. KEINE Analysen. KEIN Warten. KEIN Nachdenken warum.

**Vor dem Claim ist NUR erlaubt:**
- Task mit Skript finden (`sort`, `show`)
- Task-ID notieren

**ALLES ANDERE IST VERBOTEN** bis der Claim erfolgreich ist.

### Status-Workflow-Zuordnung

| Status | Bedeutung | Workflow |
|:------:|-----------|----------|
| ⬜ | Noch nicht implementiert | `scripts/workflows/vorbereitung.txt` |
| 🟢 | Bereit zur Umsetzung | `scripts/workflows/umsetzung.txt` |
| 🔶 | Funktionsfähig aber nicht spezifikations-konform | `scripts/workflows/konformitaet.txt` |
| ⚠️ | Implementiert aber nicht funktionsfähig | `scripts/workflows/reparatur.txt` |
| 📋 | Fertig, wartet auf Review | `scripts/workflows/review.txt` |
| ⛔ | Blockiert (Dependencies fehlen) | ABBRUCH |
| 🔒 | Von anderem Agent geclaimed | ABBRUCH |
| ✅ | Implementiert und reviewed | ABBRUCH |

**PFLICHT nach dem Claim:**
1. Status der Task prüfen (steht in der Ausgabe)
2. Entsprechende Workflow-Datei lesen - **KEINE AUSNAHMEN**
3. Workflow Schritt für Schritt befolgen

---

## 5. CLI-Referenz

### Kurzübersicht

| Aktion | Befehl |
|--------|--------|
| Top-Tasks | `node scripts/task.mjs sort` |
| Keyword-Suche | `node scripts/task.mjs sort <keyword>` |
| Task-Details | `node scripts/task.mjs show <ID>` |
| Claimen | `node scripts/task.mjs claim <ID>` |
| Freigeben | `node scripts/task.mjs claim <key>` |
| Status ändern | `node scripts/task.mjs edit <ID> --status ✅ --key <key>` |
| Neue Task | `node scripts/task.mjs add --tasks '<JSON>'` |
| Neuer Bug | `node scripts/task.mjs add --bugs '<JSON>'` |
| Task löschen | `node scripts/task.mjs remove <ID>` |
| Bug resolven | `node scripts/task.mjs remove <ID> --resolve` |

### Sort-Filter

```bash
node scripts/task.mjs sort --status partial   # Nur 🔶
node scripts/task.mjs sort --mvp              # Nur MVP-Tasks
node scripts/task.mjs sort --domain Travel    # Nur Travel-Domain
node scripts/task.mjs sort --prio hoch        # Nur hohe Priorität
node scripts/task.mjs sort --help             # Alle Optionen
```

**Filter-Optionen:**
| Option | Beschreibung |
|--------|--------------|
| `-s, --status <X>` | Nur Tasks mit Status X |
| `-d, --domain <X>` | Nur Tasks mit Domain X |
| `-l, --layer <X>` | Nur Tasks mit Layer X |
| `--mvp` / `--no-mvp` | Nur MVP / Nur Nicht-MVP |
| `-p, --prio <X>` | Nur Tasks mit Priorität X |

### Task erstellen

```bash
node scripts/task.mjs add --tasks '[{
  "domain": "Travel",
  "layer": "features",
  "beschreibung": "Route-Validierung implementieren",
  "deps": "#100, #101",
  "specs": "Travel.md#Zustände",
  "impl": "travel-engine.ts.validateRoute() [neu]"
}]'
```

**Pflichtfelder:** `domain`, `layer`, `beschreibung`, `deps` (oder "-"), `specs`, `impl`

**Impl-Tags:** `[neu]` (nur Format geprüft), `[ändern]`/`[fertig]` (Datei + Funktion muss existieren)

### Bug-System

| Aspekt | Task | Bug |
|--------|------|-----|
| ID-Format | `#123` | `b123` |
| Dependencies | Zeigt auf Vorbedingungen | Zeigt auf verdächtige Tasks |

**Bug-Dependencies bedeuten:** "Diese Tasks könnten die Ursache sein" (NICHT: "müssen vorher fertig sein")

```bash
node scripts/task.mjs add --bugs '[{"beschreibung": "Bug-Beschreibung", "deps": "#428"}]'
node scripts/task.mjs remove b5 --resolve   # Bug resolven
```

### Automatisches Verhalten

- **Claim-Expire:** Claims verfallen nach 2 Stunden
- **Status entfernt Claim:** Status-Änderung (außer auf 🔒) entfernt den Claim
- **Bug-Propagation:** Neue Bugs setzen referenzierte Tasks auf ⚠️
- **Bug-Resolution:** `--resolve` entfernt den Bug aus allen Task-Dependencies
- **Blockiert-Propagation:** Status-Änderung propagiert ⛔ zu Dependents

---

## 6. Autonomie & Build

### Autonomie-Level

| Kategorie | Verhalten |
|-----------|-----------|
| Code-Style, Implementierungsdetails | Autonom entscheiden |
| Kleine Doku-Korrekturen | Autonom |
| API-Design, neue Interfaces | Nachfragen |
| Architektur-Abweichungen | Nachfragen |
| Neue npm Dependencies | Nachfragen |

**Kurzregel:** Öffentliche API oder Architektur → Fragen. Sonst autonom.

### Build-Kommandos

```bash
npm run dev         # Watch mode (builds to Obsidian plugin folder)
npm run build       # Production build
npm run typecheck   # TypeScript type checking
npm run lint        # ESLint with cycle detection
npm run test        # Run all Vitest tests
npx vitest run path/to/file.test.ts    # Single test file
```

**ESLint:** `import-x/no-cycle: error` - keine zyklischen Dependencies

### Test-Strategie

| Komponente | Stabilität | Test-Ansatz |
|------------|------------|-------------|
| Core/Schemas | Hoch | Unit-Tests |
| Features (Iteration) | Niedrig | Manuelles Testen |
| Features (Fertig) | Hoch | Automatisierte Tests nachziehen |

**Kriterium "Test-Ready":** User gibt Freigabe ("Feature ist fertig")

### Debug-Logging

1. Copy `.claude/debug.json.example` to `.claude/debug.json`
2. Reload plugin in Obsidian
3. View logs: `tail -f CONSOLE_LOG.txt`

### Commit-Granularität

Pro logische Einheit committen:
```
feat(core): add Result<T,E> type with tests
feat(session): add TravelWorkflow state machine
fix(encounter): correct XP calculation for mixed groups
```

### Automatische Referenz-Updates

Beim Verschieben von Dateien in `docs/` werden Markdown-Links automatisch aktualisiert (PostToolUse-Hook).

Dokumentation: [update-refs-hook.md](docs/tools/update-refs-hook.md)
