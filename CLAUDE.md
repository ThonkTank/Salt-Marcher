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
| **In-Session** | Session spielen | sessionState | SessionRunner, DetailView |

**Out-of-Session:** Der GM bereitet Inhalte vor. Alle Änderungen werden direkt im Vault persistiert. Keine zentrale State-Verwaltung nötig.

**In-Session:** Der GM führt eine aktive Session durch. Der sessionState ist der einzige State-Owner für Position, Zeit, Wetter und aktive Workflows.

### Datenfluss

```
┌─────────────────────────────────────────────────────────────┐
│ Views (Svelte)                                               │
│   $sessionState           ← subscribet auf State             │
│   Workflows               → orchestrieren State-Änderungen   │
└─────────────────────────────────────────────────────────────┘
                              ↓↑
┌─────────────────────────────────────────────────────────────┐
│ sessionState                                               │
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

**sessionState = State-Container (kein Controller)**
sessionState ist ein Svelte Store, kein Controller mit Methoden. Workflows lesen/schreiben State, Views subscriben.

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
  constants/
    EncounterConfig.ts  # Encounter-Konfiguration
  entities/
    creature.ts
    faction.ts
    factionEncounterTemplate.ts
  services/
    encounterGenerator/
      balanceEncounter.ts
      calcDifficulty.ts
      encounterGenerator.ts  # Ziel: sessionState für relevanten Kontext auslesen. Encou...
      encounterNPCs.ts
      groupGenerator.ts
    lootGenerator/
      lootGenerator.ts
    npcGenerator/
      npcGenerator.ts
  SessionRunner/
    encounterWorkflow.ts  # Ziel: Encounter generieren lassen, in DetailView anzeigen...
    sessionState.ts  # Ziel: Speichert alle Session-Zeit-State-Variablen.
docs/                  # Authoritative documentation (German)
  architecture/
    .task-claims.json
    constants.md  # D&D-Regeln, Lookup-Tabellen und Pure Utility Functions
    Development-Roadmap.md  # Aktueller Task
    Infrastructure.md  # [Orchestration.md](Orchestration.md), [Services.md](Servi...
    Orchestration.md  # Die Orchestration-Schicht koordiniert Workflows waehrend ...
    schemas.md  # Zod-basierte Entity-Definitionen und TypeScript-Typen
    Services.md  # Services sind **stateless Pipelines**, die von Workflows ...
    Testing.md  # [Orchestration.md](Orchestration.md), [Services.md](Servi...
  constants/
    CreatureSizes.md  # TODO: Inhalte extrahieren aus `docs/entities/creature.md`
    CreatureTypes.md  # TODO: Inhalte extrahieren aus `docs/entities/creature.md`
    Difficulty.md  # TODO: Inhalte extrahieren aus `docs/services/encounter/Di...
    LootRarity.md  # TODO: Inhalte extrahieren aus `docs/services/Loot.md`
    TimeSegments.md  # TODO: Inhalte extrahieren aus `docs/entities/creature.md`...
  entities/
    action.md  # [Library](../views/Library.md) (Creature-Editor), Presets...
    activity.md  # [Library](../views/Library.md) (Activity-Editor), Presets...
    creature.md  # [Library](../views/Library.md) (CRUD), Presets (bundled)
    culture-data.md  # [Faction](faction.md) (eingebettet)
    currency.md  # -
    encounter-instance.md  # [Encounter-Service](../services/encounter/Encounter.md) (...
    faction-encounter-template.md  # [Library](../views/Library.md), [Faction](faction.md)
    faction-presence.md  # [Cartographer](../views/Cartographer.md) (Praesenz-Vorber...
    faction.md  # [Library](../views/Library.md) (CRUD), [Encounter](../ser...
    item.md  # [Library](../views/Library.md)
    journal-entry.md  # Quest-Feature (auto), Encounter-Feature (auto), Travel-Fe...
    journal-settings.md  # User-Konfiguration (Settings-UI)
    journal.md  # [Journal-Feature](../features/Journal.md) (Auto-Generieru...
    LootContainer.md  # [Library](../views/Library.md), [Loot](../services/Loot.m...
    map.md  # [Cartographer](../views/Cartographer.md), [Library](../vi...
    npc.md  # [Encounter](../services/encounter/Encounter.md) (Generier...
    overworld-tile.md  # [Cartographer](../views/Cartographer.md) (Terrain/Danger-...
    path.md  # [Cartographer](../views/Cartographer.md) (Path-Tool)
    poi.md  # [Library](../views/Library.md) (CRUD), [Encounter](../ser...
    quest.md  # [Library](../views/Library.md) (CRUD)
    session.md  # sessionState (Session starten/beenden)
    shop.md  # [Library](../views/Library.md) (CRUD)
    terrain-definition.md  # [Library](../views/Library.md) (CRUD), Presets (bundled)
  features/
    Audio-System.md  # Kontextbasierte Hintergrundmusik und Umgebungsgeraeusche
    Character-System.md  # Verwaltung von Player Characters - Schema, HP-Tracking, I...
    Combat.md  # Initiative-Tracker und Condition-Management fuer D&D Kaempfe
    Dungeon-System.md  # Grid-basierte Dungeon Maps mit Fog of War, Lichtquellen u...
    Journal.md  # Single Source of Truth fuer Session-Journal und automatis...
    Map-Feature.md  # Single Source of Truth fuer Map-Typen, Map-Content und Mu...
    Map-Navigation.md  # Navigation zwischen Maps via EntrancePOIs
    NPC-Lifecycle.md  # Persistierung, Status-Uebergaenge und laufende NPC-Simula...
    Quest.md  # Objektiv-basierte Quests mit automatischer XP-Berechnung ...
    Time.md  # Backend-Feature fuer Kalender und Zeit-Verwaltung
    Travel.md  # Hex-Overland-Reisen - Routen-Planung, Animationen, Encoun...
  orchestration/
    CombatWorkflow.md  # Orchestration des Combat-Trackers
    EncounterWorkflow.md  # Orchestration der Encounter-Generierung und -Resolution
    RestWorkflow.md  # Orchestration von Short/Long Rest
    SessionState.md  # State-Container fuer alle In-Session-Daten
    TravelWorkflow.md  # Orchestration der Hex-Overland-Reise
  services/
    encounter/
      Balancing.md  # Encounter-Service (Step 6.1)
      Difficulty.md  # Encounter-Service (Step 5)
      Encounter.md  # Generiert kontextabhaengige Encounters basierend auf Posi...
      encounterDistance.md  # Encounter-Service (Step 4.5)
      groupActivity.md  # Encounter-Service (Step 4.1, 4.2)
      groupPopulation.md  # Encounter-Service (Step 3)
      groupSeed.md  # Encounter-Service (Step 2)
    NPCs/
      Culture-Resolution.md  # Kultur-Aufloesung fuer NPC-Generierung
      NPC-Generation.md  # Automatische NPC-Generierung
      NPC-Matching.md  # Existierenden NPC finden
    Inventory.md  # [Item](../entities/item.md), [Character-System](../featur...
    Loot.md  # [Item](../entities/item.md), [Encounter-System](encounter...
    Weather.md  # Stateless Service
  tools/
    update-refs-hook.md  # Automatisches Update von Markdown-Links und CLAUDE.md bei...
  views/
    Cartographer.md  # [Map-Feature](../features/Map-Feature.md), [Map](../entit...
    DetailView.md  # [Application](../architecture/Application.md), [SessionRu...
    Library.md  # [EntityRegistry](../architecture/EntityRegistry.md), [App...
    SessionRunner.md  # [Orchestration.md](../architecture/Orchestration.md)
  Example-Workflows.md  # [Data-Flow.md](architecture/Data-Flow.md), [Features.md](...
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

**Schema-Dokumentations-Orte:**

| Schema-Typ | Ort | Beispiele |
|------------|-----|-----------|
| **Persistente Entities** | `docs/entities/` | creature.md, faction.md, map.md |
| **Service I/O Schemas** | Inline im Service-Doc | EncounterContext, SeedSelection, EncounterGroup |
| **Orchestration State** | `docs/orchestration/` | SessionState, WorkflowState |

- `docs/entities/` enthält NUR Vault-persistierte Entities
- Service-interne Typen (Input/Output zwischen Steps) gehören in die Service-Dokumentation
- Orchestration-State gehört in die Workflow-Dokumentation

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
