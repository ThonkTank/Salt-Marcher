# Architecture Goals

Vision und Planung für SaltMarcher - ein allumfassendes GM-Werkzeug als Obsidian Plugin.

**System:** D&D 5e (nicht system-agnostisch)

---

## Vision

SaltMarcher ist ein integriertes Werkzeug für Game Masters, das alle Aspekte einer D&D-Kampagne an einem Ort verwaltet. Es automatisiert strikt algorithmische Regeln, bei denen der GM keine Kreativität aufwenden muss - nur mentale Energie zum Merken.

---

## Feature-Übersicht

### SessionRunner + DetailView (Hauptansicht)

Zwei parallele Views für Session-Management:

**SessionRunner (Center Leaf):**
- **Map-Panel** - Hex/Town/Grid mit Party-Token, Routen, Overlays
- **Quick-Controls** - Travel, Audio, Party-Status, Aktionen
- **Header** - Zeit, Wetter-Status, Quick-Advance

**DetailView (Right Leaf):**
- **Encounter** - Preview, Generierung, Quest-Encounters
- **Combat** - Initiative-Tracker, HP, Conditions
- **Shop** - Händler-Interface
- **Location/Quest/Journal/Party** - Kontextbezogene Details

→ **Details:** [SessionRunner.md](docs/application/SessionRunner.md), [DetailView.md](docs/application/DetailView.md)

### Cartographer (Map-Editor)

Visueller Editor für alle Map-Typen:

- Hex-Map-Erstellung mit Terrain-Painting
- Elevation und Klima-Brush
- Location-Marker setzen
- Town-Map-Import
- Grid-Map für Dungeons/Combat

→ **Details:** [Cartographer.md](docs/application/Cartographer.md)

### Almanac (Zeit & Events)

Kalender-Verwaltung und Session-Historie:

- Kalender-Definition (Gregorian, Harptos, Custom)
- WorldEvents (geplante Ereignisse, Deadlines, Vollmond)
- Journal (automatische Session-Historie)
- Timeline-Ansicht

→ **Details:** [Time-System.md](docs/features/Time-System.md), [Journal.md](docs/domain/Journal.md)

### Library (Entity-Verwaltung)

CRUD für alle Entity-Typen:

- Creatures, Items, Spells
- NPCs, Factions, Locations
- Terrain, Playlists, Quests
- Shops, Encounters

→ **Details:** [Library.md](docs/application/Library.md), [NPC-System.md](docs/domain/NPC-System.md), [Faction.md](docs/domain/Faction.md), [Quest.md](docs/domain/Quest.md), [Map.md](docs/domain/Map.md)

### Party Manager

Character-Tracking und Party-Konfiguration:

- Character-Daten (HP, AC, Level, Speed)
- Inventory und Encumbrance
- Transport-Modi (zu Fuß, beritten, Boot)
- Conditions und Status-Effekte

→ **Details:** [Character-System.md](docs/features/Character-System.md), [Inventory-System.md](docs/features/Inventory-System.md)

---

## Kern-Systeme

### Travel

Hex-basierte Overland-Navigation mit automatischem Zeit-Tracking. Die Party bewegt sich über die Karte, Zeit vergeht, Encounters können auftreten.

- Routen-Planung mit Waypoints
- Speed-Berechnung (Terrain × Weather × Encumbrance)
- Encounter-Checks pro 4-Stunden-Segment

→ **Details:** [Travel-System.md](docs/features/Travel-System.md)

### Encounter

6 Encounter-Typen mit Creature-centric Balancing:

| Typ | Beschreibung |
|-----|--------------|
| Combat | Kampf mit Kreaturen |
| Social | Interaktion mit NPCs |
| Passing | Etwas passiert in der Nähe |
| Trace | Spuren eines vergangenen Ereignisses |
| Environmental | Naturgefahren, Terrain-Herausforderungen |
| Location | Interessante Orte zum Erkunden |

→ **Details:** [Encounter-System.md](docs/features/Encounter-System.md), [Encounter-Balancing.md](docs/features/Encounter-Balancing.md)

### Weather

Dynamisches Wetter basierend auf Terrain und Zeit:

- Parameter: Temperatur, Wind, Niederschlag
- 6 Tages-Segmente mit Übergängen
- Weather-Events (Blizzard, Sturm, Hitzewelle)
- Mechanische Auswirkungen auf Travel und Encounter

→ **Details:** [Weather-System.md](docs/features/Weather-System.md)

### Quest

Objektiv-basierte Quests mit automatischer XP-Berechnung:

- 40/60 XP-Split (Sofort vs Quest-Completion)
- Encounter-Slots (Predefined, Quantum, Unspecified)
- Loot-Verteilung (Random, Located, Rewards)

→ **Details:** [Quest-System.md](docs/features/Quest-System.md)

### Combat

Initiative-Tracker mit Condition-Management:

- Initiative-Reihenfolge (GM trägt Werte ein)
- HP-Tracking (Damage/Heal)
- Conditions mit automatischen Reminders
- Start/End-of-Turn Effekte

→ **Details:** [Combat-System.md](docs/features/Combat-System.md)

### Audio

Kontextbasierte Musik und Ambience:

- 2 Layer (Music + Ambience)
- Tag-basiertes Mood-Matching
- Crossfade zwischen Tracks
- Dynamische Track-Auswahl (keine Playlists)

→ **Details:** [Audio-System.md](docs/features/Audio-System.md)

### Dungeon

Grid-basierte Dungeon-Maps mit Simulation:

- Fog of War und Licht
- Tile-Inhalte (Fallen, Türen, Treasure)
- Automatische Trigger
- Raum-Notizen

→ **Details:** [Dungeon-System.md](docs/features/Dungeon-System.md)

---

## Entity-Typen (MVP: 16 Typen)

| Entity | Beschreibung |
|--------|--------------|
| `creature` | Monster/NPC-Statblocks (Templates) |
| `character` | Player Characters |
| `npc` | Persistierte NPCs mit Persönlichkeit |
| `item` | Ausrüstung und Gegenstände |
| `faction` | Fraktionen (Culture embedded) |
| `poi` | Points of Interest auf Maps |
| `maplink` | Standalone Map-Links (ohne POI) |
| `terrain` | Custom Terrain-Definitionen mit Mechaniken |
| `track` | Audio-Tracks mit Mood-Tags (dynamisch ausgewählt) |
| `quest` | Quest-Definitionen |
| `shop` | Händler mit Inventar (MVP: Preisanzeige, GM passt Inventare manuell an) |
| `encounter` | Vordefinierte Encounter-Templates für Quests |
| `calendar` | Kalender-Definitionen |
| `map` | Karten (Hex, Town, Grid) |
| `journal` | Automatische Ereignis-Historie |
| `worldevent` | Geplante Kalender-Events |
| `party` | Party-Daten (aktive Charaktere, Position) |

**Post-MVP Entity-Typen:**

| Entity | Beschreibung |
|--------|--------------|
| `path` | Lineare Map-Features (Strassen, Fluesse, Schluchten, Klippen) |
| `spell` | Zauber-Definitionen (D&D Beyond-level Character Management) |
| `playlist` | Manuelle Musik-Playlists (MVP nutzt dynamische Track-Auswahl) |

→ **Details:** [EntityRegistry.md](docs/architecture/EntityRegistry.md)

---

## Layer-Architektur

```
┌───────────────────────────────────────────────────────────────┐
│                      Application Layer                        │
│     ViewModels: SessionRunner, DetailView, Cartographer       │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                       Feature Layer                           │
│  State + Business Logic + Orchestration                       │
│  (encounter/, travel/, weather/, combat/, quest/, audio/)     │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                        Data Layer                             │
│     Schemas, Types, Utilities (EncounterContext, Stats)       │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                        Infra Layer                            │
│       EventBus, Events-Catalog, Vault Adapters, Rendering     │
└───────────────────────────────────────────────────────────────┘

Quer: tools/ (Task CLI), prototypes/ (Experimente)
```

→ **Details:** [docs/application/](docs/application/), [docs/features/](docs/features/), [docs/data/](docs/data/), [docs/infra/](docs/infra/)

---

## Entwicklungs-Workflow (Prototype → Production)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. Schema   │ →  │ 2. CLI      │ →  │ 3. EventBus │ →  │ 4. Prod     │
│    Phase    │    │    Proto    │    │    Proto    │    │    Phase    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
   docs/data/        prototype/        prototype/          src/
```

### 1. Schema-Phase
- Grundlegende Schemas in `docs/data/` definieren
- 100% saubere Definitionen: Nur Felder, Quelle, Konsumenten
- Eine Task pro Schema-Dokument

### 2. CLI-Prototype-Phase
- Feature-Prototypen in `prototype/` (CLI-basiert)
- Strikt unabhängig voneinander
- Verwenden Schemas aus Phase 1
- Manuelle Daten-Einspeisung statt Plugin-Integration

### 3. EventBus-Prototype-Phase
- Multi-Feature-Workflows per CLI simulieren
- z.B. Reise mit Random Encounter Generierung
- Prototypen kommunizieren via EventBus

### 4. Production-Phase
- Ausgereifte Prototypen nach `src/` kopieren
- An ViewModel/Production-EventBus anschließen
- Integration mit Obsidian-API

→ **Details:** [docs/prototypes/README.md](docs/prototypes/README.md)

---

## Event-Kommunikation

Features kommunizieren via typisiertem EventBus:

| Kategorie | Pattern | Beispiel |
|-----------|---------|----------|
| Command | `*-requested` | `travel:start-requested` |
| Domain | `*:changed`, `*:started` | `weather:changed` |
| State-Sync | `*:state-changed` | `travel:state-changed` |
| Failure | `*-failed` | `travel:failed` |

→ **Details:** [EventBus.md](docs/architecture/EventBus.md)

---

## Persistence

**Format:** JSON für alle Daten

**Vault-Struktur:**
```
Vault/
└── SaltMarcher/
    ├── maps/              # Karten
    ├── creatures/         # Kreaturen
    ├── items/             # Gegenstände
    ├── npcs/              # NPCs
    ├── factions/          # Fraktionen
    ├── playlists/         # Playlists
    ├── quests/            # Quests
    ├── almanac/           # Events, Journal, Kalender
    ├── parties/           # Party-Daten
    └── audio/             # Audio-Dateien
```

---

## MVP-Scope

### MVP-Matrix

| Feature | Status | Notiz |
|---------|:------:|-------|
| **Cartographer** (Hex-Editor) | ✓ MVP | Implementiert |
| **Travel** (Hex-Navigation) | ✓ MVP | Implementiert |
| **Time** (Kalender, Zeit) | ✓ MVP | Implementiert |
| **Encounter** (Generierung) | ✓ MVP | Combat + Social |
| **Map** (Overworld) | ✓ MVP | Hex-basiert |
| **Party** (Tracking) | ✓ MVP | HP, Position |
| **Weather** | ✓ MVP | Basic |
| **Combat** | ✓ MVP | Initiative-Tracker |
| **Quest** (40/60 XP Split) | ✓ MVP | Non-negotiable |
| **Loot** (Tag-Matching) | ✓ MVP | Basic |
| **Audio** (2 Layer) | ✓ MVP | Track-basiert |
| **NPC-Persistierung** | ✓ MVP | Lead-NPCs |
| Town-Maps | Post-MVP | Mittel |
| **Dungeon-Maps** | ✓ MVP | Niedrig |
| **Multi-Level-Dungeons** | ✓ MVP | Niedrig |
| Faction-Simulation | Post-MVP | Niedrig |

**Non-Negotiable MVP-Features:**
- 40/60 XP Split bei Quest-Encounters
- NPC-Wiedererkennung
- Event-basierte Kommunikation (EventBus)

---

## Dokumentations-Richtlinien

### Ordner-Struktur

```
docs/
├── infra/           # EventBus, Events-Catalog, Event-Patterns
├── application/     # ViewModels mit Sub-Ordnern
│   ├── SessionRunner/
│   ├── DetailView/
│   ├── Cartographer/
│   └── Library/
├── data/            # Grundlegende Schemas + Utilities
│   ├── EncounterContext.md
│   ├── CreatureStats.md
│   └── ...
├── features/        # Feature Sub-Directories
│   ├── encounter/
│   ├── travel/
│   ├── weather/
│   └── ...
├── tools/           # Task CLI, Skripte
└── prototypes/      # Prototype-Dokumentation
```

| Ordner | Inhalt |
|--------|--------|
| `docs/infra/` | EventBus, Events-Catalog, Event-Patterns, Conventions |
| `docs/application/` | ViewModels: SessionRunner, DetailView, Cartographer, Library |
| `docs/data/` | Grundlegende Schemas (EncounterContext, CreatureStats, EntityRegistry) |
| `docs/features/` | Feature-Directories (encounter/, travel/, weather/, combat/, quest/) |
| `docs/tools/` | Task CLI Dokumentation, Skripte |
| `docs/prototypes/` | Prototype-Dokumentation, Experimente |

### Single Source of Truth

Jedes System/Konzept hat **eine autoritative Quelle**. Andere Docs referenzieren diese Quelle, wiederholen aber keine Details.

**Prinzip:**
- Goals.md = "Was macht das Plugin?" (umfassend, high-level)
- System-Docs = "Wie funktioniert es?" (detailliert, technisch)

**Bei Referenzen erlaubt:**
- 1-2 Sätze Kontext
- High-Level Beschreibung
- "→ Details:" Link zur autoritativen Quelle

**Bei Referenzen nicht erlaubt:**
- Vollständige Schemas kopieren
- State-Definitionen wiederholen
- Code-Beispiele duplizieren

### Event-Pflege (Pflicht!)

**Events-Catalog.md ist Single Source of Truth für alle Domain-Events.**

| Regel | Beschreibung |
|-------|--------------|
| **Neue Events** | MÜSSEN zuerst im Events-Catalog definiert werden |
| **Feature-Docs** | Referenzieren Events nur, definieren keine neuen |
| **Event-Namen** | Folgen der Naming-Convention in EventBus.md |
| **Payloads** | Vollständige TypeScript-Interfaces im Catalog |

**Bei neuen Features:**
1. Events im Events-Catalog.md anlegen
2. Feature-Doc referenziert Catalog mit `→ Vollständige Event-Definitionen: [Events-Catalog.md](...)`
3. Keine Event-Definitionen im Feature-Doc duplizieren

### Goals.md Scope

Goals.md bleibt high-level und enthält:
- Feature-Übersichten mit kurzer Beschreibung
- Entity-Typ-Liste
- Architektur-Diagramm
- Dokumentations-Referenz

Goals.md enthält **nicht**:
- TypeScript Interfaces/Schemas
- Detaillierte State-Machines
- Code-Beispiele
- Implementierungs-Details

---

## Dokumentations-Referenz

### infra/ (Infrastructure)

| Dokument | Inhalt |
|----------|--------|
| [EventBus.md](docs/infra/EventBus.md) | Event-Patterns, Naming-Konvention |
| [Events-Catalog.md](docs/infra/Events-Catalog.md) | Single Source of Truth für alle Events |
| [Conventions.md](docs/infra/Conventions.md) | Naming, Error Handling |
| [Error-Handling.md](docs/infra/Error-Handling.md) | Error-Propagation, Fehlerbehandlung |
| [Data-Flow.md](docs/infra/Data-Flow.md) | Datenfluss-Diagramme |
| [Glossary.md](docs/infra/Glossary.md) | Begriffsdefinitionen |

### application/ (ViewModels)

| Ordner | Inhalt |
|--------|--------|
| [SessionRunner/](docs/application/SessionRunner/) | Hauptansicht (Center), Quick-Controls, Map-Panel |
| [DetailView/](docs/application/DetailView/) | Detail-Ansichten (Right), Encounter, Combat, Shop |
| [Cartographer/](docs/application/Cartographer/) | Map-Editor, Tools, Layer |
| [Library/](docs/application/Library/) | Entity-CRUD, Views |

### data/ (Schemas & Types)

| Dokument | Inhalt |
|----------|--------|
| [EntityRegistry.md](docs/data/EntityRegistry.md) | Entity-Verwaltung, 17 Entity-Typen |
| [EncounterContext.md](docs/data/EncounterContext.md) | Encounter-Kontext-Schema |
| [CreatureStats.md](docs/data/CreatureStats.md) | Creature-Statistiken, Combat-Stats |
| [Creature.md](docs/data/Creature.md) | Creature-Schema, Templates |
| [NPC.md](docs/data/NPC.md) | NPC-Schema, Persistierung |
| [Faction.md](docs/data/Faction.md) | Fraktionen, Territory, Kultur |
| [POI.md](docs/data/POI.md) | Points of Interest, Sub-Maps |
| [Map.md](docs/data/Map.md) | Map-Schema, Typen |
| [Item.md](docs/data/Item.md) | Item-Schema, Kategorien |
| [Shop.md](docs/data/Shop.md) | Händler, Inventar |
| [Terrain.md](docs/data/Terrain.md) | Terrain-Typen, Mechaniken |
| [Quest.md](docs/data/Quest.md) | Quest-Schema, Objectives |
| [Journal.md](docs/data/Journal.md) | Automatische Ereignis-Historie |

### features/ (Feature-Directories)

| Ordner | Inhalt |
|--------|--------|
| [encounter/](docs/features/encounter/) | Pipeline, Typen, Balancing, Algorithmus |
| [travel/](docs/features/travel/) | Hex-Navigation, Speed-Berechnung |
| [weather/](docs/features/weather/) | Wetter-Generierung, Events |
| [combat/](docs/features/combat/) | Initiative, Conditions |
| [quest/](docs/features/quest/) | Objectives, 40/60 XP-Split |
| [time/](docs/features/time/) | Kalender, WorldEvents, JournalEntries |
| [audio/](docs/features/audio/) | Track-Tags, Mood-Matching |
| [dungeon/](docs/features/dungeon/) | Grid-Maps, Fog of War, Licht |
| [map/](docs/features/map/) | Map-Typen, Multi-Map-Verhalten, Navigation |
| [character/](docs/features/character/) | PC-Schema, Party-Management |
| [inventory/](docs/features/inventory/) | Items, Encumbrance |
| [loot/](docs/features/loot/) | Tag-Matching, Generierung |

### tools/ (Entwicklung)

| Dokument | Inhalt |
|----------|--------|
| [Development-Roadmap.md](docs/tools/Development-Roadmap.md) | Aktueller Implementierungs-Status |
| [Project-Structure.md](docs/tools/Project-Structure.md) | Ordnerstruktur, Modul-Organisation |
| [Testing.md](docs/tools/Testing.md) | Test-Patterns, Mock-Strategien |
| [Task-CLI.md](docs/tools/Task-CLI.md) | Task-Management-Skripte |

### prototypes/ (Experimente)

| Dokument | Inhalt |
|----------|--------|
| [Prototype-CLI.md](docs/prototypes/Prototype-CLI.md) | CLI-Prototyp für Encounter-Pipeline |

### Sonstiges

| Dokument | Inhalt |
|----------|--------|
| [Example-Workflows.md](docs/Example-Workflows.md) | Typische Nutzungs-Szenarien |

---

*Implementierungs-Details siehe jeweilige Dokumentation*
