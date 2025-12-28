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

→ **Details:** [Time-System.md](docs/features/Time-System.md), [Journal.md](docs/entities/journal.md)

### Library (Entity-Verwaltung)

CRUD für alle Entity-Typen:

- Creatures, Items, Spells
- NPCs, Factions, Locations
- Terrain, Playlists, Quests
- Shops, Encounters

→ **Details:** [Library.md](docs/application/Library.md), [NPC.md](docs/entities/npc.md), [Faction.md](docs/entities/faction.md), [Quest.md](docs/entities/quest.md), [Map.md](docs/entities/map.md)

### Party Manager

Character-Tracking und Party-Konfiguration:

- Character-Daten (HP, AC, Level, Speed)
- Inventory und Encumbrance
- Transport-Modi (zu Fuß, beritten, Boot)
- Conditions und Status-Effekte

→ **Details:** [Character-System.md](docs/features/Character-System.md), [Inventory.md](docs/services/Inventory.md)

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

→ **Details:** [encounter/Encounter.md](docs/services/encounter/Encounter.md), [encounter/Difficulty.md](docs/services/encounter/Difficulty.md)

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
│   Schemas, Types, Konstanten, Utilities - Single-Concern      │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                        Infra Layer                            │
│       EventBus, Events-Catalog, Vault Adapters, Rendering     │
└───────────────────────────────────────────────────────────────┘

Quer: tools/ (Task CLI), prototypes/ (Experimente)
```

→ **Details:** [docs/application/](docs/application/), [docs/features/](docs/features/), [docs/services/](docs/services/), [docs/entities/](docs/entities/), [docs/constants/](docs/constants/), [docs/architecture/](docs/architecture/)

---

## Entwicklungs-Workflow (Prototype → Production)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. Schema   │ →  │ 2. CLI      │ →  │ 3. EventBus │ →  │ 4. Prod     │
│    Phase    │    │    Proto    │    │    Proto    │    │    Phase    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
   docs/entities/    prototype/        prototype/          src/
```

### 1. Schema-Phase
- Grundlegende Schemas in `docs/entities/` definieren
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

### Header-Standards

#### Feature-Dokumente (docs/features/, docs/services/)

```markdown
# Feature-Name

> **Verantwortlichkeit:** Was macht dieses Feature? (1 Satz)
> **Input:** Datentypen und Quellen (optional)
> **Output:** Resultat-Typ und Ziel (optional)
> **Schema:** Link zu Haupt-Schema in data/ (falls vorhanden)
>
> **Referenzierte Schemas:**
> - [schema.md](pfad) - Kurzbeschreibung
>
> **Verwandte Dokumente:**
> - [feature.md](pfad) - Kurzbeschreibung

Einleitender Absatz...
```

**Pflichtfelder:** `Verantwortlichkeit`
**Optionale Felder:** `Input`, `Output`, `Schema`, `Referenzierte Schemas`, `Verwandte Dokumente`

#### Schema-Dokumente (docs/entities/)

```markdown
# Schema: EntityName

> **Produziert von:** [Feature](pfad) (Aktion)
> **Konsumiert von:** [Feature1](pfad), [Feature2](pfad)

Kurzbeschreibung...
```

#### Index-Dokumente

Index-Dokumente (z.B. Encounter.md) haben ein spezielles Format:

```markdown
# System-Name

> **Modulare Dokumentation:**
> - [Step1.md](Step1.md) - Beschreibung
> - [Step2.md](Step2.md) - Beschreibung

Ueberblick...
```

### Ordner-Struktur

```
docs/
├── architecture/    # EventBus, Events-Catalog, Conventions, Error-Handling
├── application/     # ViewModels mit Sub-Ordnern
│   ├── SessionRunner/
│   ├── DetailView/
│   ├── Cartographer/
│   └── Library/
├── entities/        # Entity Schemas (1 Datei pro Typ)
│   ├── creature.md
│   ├── npc.md
│   └── ...
├── constants/       # D&D Regeln, Enums, Lookup-Tabellen
│   ├── TimeSegments.md
│   ├── Difficulty.md
│   └── ...
├── features/        # Stateful Features (Entscheider)
│   ├── Travel-System.md
│   ├── Combat-System.md
│   └── ...
├── services/        # Stateless Services (Folger/Helfer)
│   ├── encounter/
│   ├── NPCs/
│   └── ...
├── tools/           # Task CLI, Skripte
└── prototypes/      # Prototype-Dokumentation
```

| Ordner | Inhalt |
|--------|--------|
| `docs/architecture/` | EventBus, Events-Catalog, Conventions, Error-Handling |
| `docs/application/` | ViewModels: SessionRunner, DetailView, Cartographer, Library |
| `docs/entities/` | Entity Schemas (1 Datei pro Typ) |
| `docs/constants/` | D&D Regeln, Enums, Lookup-Tabellen |
| `docs/features/` | Stateful Features (Entscheider) |
| `docs/services/` | Stateless Services (Folger/Helfer) |
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
| [EventBus.md](docs/architecture/EventBus.md) | Event-Patterns, Naming-Konvention |
| [Events-Catalog.md](docs/architecture/Events-Catalog.md) | Single Source of Truth für alle Events |
| [Conventions.md](docs/architecture/Conventions.md) | Naming, Error Handling |
| [Error-Handling.md](docs/architecture/Error-Handling.md) | Error-Propagation, Fehlerbehandlung |
| [Data-Flow.md](docs/architecture/Data-Flow.md) | Datenfluss-Diagramme |
| [Glossary.md](docs/architecture/Glossary.md) | Begriffsdefinitionen |

### application/ (ViewModels)

| Ordner | Inhalt |
|--------|--------|
| [SessionRunner/](docs/application/SessionRunner/) | Hauptansicht (Center), Quick-Controls, Map-Panel |
| [DetailView/](docs/application/DetailView/) | Detail-Ansichten (Right), Encounter, Combat, Shop |
| [Cartographer/](docs/application/Cartographer/) | Map-Editor, Tools, Layer |
| [Library/](docs/application/Library/) | Entity-CRUD, Views |

### entities/ (Entity Schemas)

| Dokument | Inhalt |
|----------|--------|
| [EntityRegistry.md](docs/architecture/EntityRegistry.md) | Entity-Verwaltung, 17 Entity-Typen |
| [Creature.md](docs/entities/creature.md) | Creature-Schema, Templates |
| [NPC.md](docs/entities/npc.md) | NPC-Schema, Persistierung |
| [Faction.md](docs/entities/faction.md) | Fraktionen, Territory, Kultur |
| [POI.md](docs/entities/poi.md) | Points of Interest, Sub-Maps |
| [Map.md](docs/entities/map.md) | Map-Schema, Typen |
| [Item.md](docs/entities/item.md) | Item-Schema, Kategorien |
| [Shop.md](docs/entities/shop.md) | Händler, Inventar |
| [Terrain.md](docs/entities/terrain-definition.md) | Terrain-Typen, Mechaniken |
| [Quest.md](docs/entities/quest.md) | Quest-Schema, Objectives |
| [Journal.md](docs/entities/journal.md) | Automatische Ereignis-Historie |

### constants/ (D&D Regeln & Enums)

| Dokument | Inhalt |
|----------|--------|
| [TimeSegments.md](docs/constants/TimeSegments.md) | Tages-Segmente (night, dawn, morning, etc.) |
| [Difficulty.md](docs/constants/Difficulty.md) | Encounter-Schwierigkeit (trivial → deadly) |
| [CreatureSizes.md](docs/constants/CreatureSizes.md) | Kreatur-Größen (tiny → gargantuan) |
| [CreatureTypes.md](docs/constants/CreatureTypes.md) | Kreatur-Typen (aberration, beast, etc.) |
| [LootRarity.md](docs/constants/LootRarity.md) | Loot-Seltenheit (common → legendary) |

### features/ (Stateful Systems)

| Dokument | Inhalt |
|----------|--------|
| [Travel-System.md](docs/features/Travel-System.md) | Hex-Navigation, Speed-Berechnung |
| [Weather-System.md](docs/features/Weather-System.md) | Wetter-Generierung, Events |
| [Combat-System.md](docs/features/Combat-System.md) | Initiative, Conditions |
| [Quest-System.md](docs/features/Quest-System.md) | Objectives, 40/60 XP-Split |
| [Time-System.md](docs/features/Time-System.md) | Kalender, WorldEvents, JournalEntries |
| [Audio-System.md](docs/features/Audio-System.md) | Track-Tags, Mood-Matching |
| [Dungeon-System.md](docs/features/Dungeon-System.md) | Grid-Maps, Fog of War, Licht |
| [Map-Feature.md](docs/features/Map-Feature.md) | Map-Typen, Multi-Map-Verhalten, Navigation |
| [Character-System.md](docs/features/Character-System.md) | PC-Schema, Party-Management |

### services/ (Stateless Services)

| Ordner/Dokument | Inhalt |
|-----------------|--------|
| [encounter/](docs/services/encounter/) | Pipeline, Typen, Balancing, Algorithmus |
| [NPCs/](docs/services/NPCs/) | NPC-Generation, Matching, Lifecycle, Culture |
| [Inventory.md](docs/services/Inventory.md) | Items, Encumbrance |
| [Loot.md](docs/services/Loot.md) | Tag-Matching, Generierung |

### tools/ (Entwicklung)

| Dokument | Inhalt |
|----------|--------|
| [Development-Roadmap.md](docs/architecture/Development-Roadmap.md) | Aktueller Implementierungs-Status |
| [Project-Structure.md](docs/architecture/Project-Structure.md) | Ordnerstruktur, Modul-Organisation |
| [Testing.md](docs/architecture/Testing.md) | Test-Patterns, Mock-Strategien |
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
