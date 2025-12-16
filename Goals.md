# Architecture Goals

Vision und Planung für SaltMarcher - ein allumfassendes GM-Werkzeug als Obsidian Plugin.

**System:** D&D 5e (nicht system-agnostisch)

---

## Vision

SaltMarcher ist ein integriertes Werkzeug für Game Masters, das alle Aspekte einer D&D-Kampagne an einem Ort verwaltet. Es automatisiert strikt algorithmische Regeln, bei denen der GM keine Kreativität aufwenden muss - nur mentale Energie zum Merken.

---

## Feature-Übersicht

### SessionRunner (Hauptansicht)

Die zentrale Spielansicht während einer Session:

- **Karten-Container** - Verschiedene Map-Typen (Hex, Town, Grid)
- **Travel-Tool** - Party-Token, Routen-Planung, animierte Reisen
- **Kalender** - Aktuelles Datum/Zeit, Events, Journal
- **Wetter** - Dynamisches Wetter mit mechanischen Auswirkungen
- **Encounter** - Begegnungssystem mit Preview und Balancing
- **Audio** - Automatische Musik und Ambience
- **Party-Tracker** - HP, AC, Conditions, Inventar

→ **Details:** [SessionRunner.md](docs/application/SessionRunner.md), [Travel-System.md](docs/features/Travel-System.md), [Weather-System.md](docs/features/Weather-System.md)

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

→ **Details:** [Encounter-Types.md](docs/features/Encounter-Types.md), [Encounter-Balancing.md](docs/features/Encounter-Balancing.md)

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

## Entity-Typen (MVP: 15 Typen)

| Entity | Beschreibung |
|--------|--------------|
| `creature` | Monster/NPC-Statblocks (Templates) |
| `character` | Player Characters |
| `npc` | Persistierte NPCs mit Persönlichkeit |
| `item` | Ausrüstung und Gegenstände |
| `faction` | Fraktionen (Culture embedded) |
| `location` | POIs (Points of Interest) auf Maps |
| `maplink` | Standalone Map-Links (ohne Location) |
| `terrain` | Custom Terrain-Definitionen mit Mechaniken |
| `track` | Audio-Tracks mit Mood-Tags (dynamisch ausgewählt) |
| `quest` | Quest-Definitionen |
| `shop` | Händler mit Inventar (MVP: Preisanzeige, GM passt Inventare manuell an) |
| `encounter` | Vordefinierte Encounter-Templates für Quests |
| `calendar` | Kalender-Definitionen |
| `map` | Karten (Hex, Town, Grid) |
| `journal` | Automatische Ereignis-Historie |
| `worldevent` | Geplante Kalender-Events |

**Post-MVP Entity-Typen:**

| Entity | Beschreibung |
|--------|--------------|
| `spell` | Zauber-Definitionen (D&D Beyond-level Character Management) |
| `playlist` | Manuelle Musik-Playlists (MVP nutzt dynamische Track-Auswahl) |

→ **Details:** [EntityRegistry.md](docs/architecture/EntityRegistry.md)

---

## Layer-Architektur

```
┌───────────────────────────────────────────────────────────────┐
│                      Application Layer                        │
│           (SessionRunner, ToolViews, UI Components)           │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                       Feature Layer                           │
│  State + Business Logic + StoragePorts                        │
│  (Map, Party, Time, Travel, Encounter, Combat, Quest, Audio)  │
└───────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────┐
│                     Infrastructure Layer                      │
│          (Vault Adapters, Rendering, External APIs)           │
└───────────────────────────────────────────────────────────────┘

Core: Schemas, Types, Events, Utils (shared across all layers)
```

→ **Details:** [Features.md](docs/architecture/Features.md), [Application.md](docs/architecture/Application.md), [Infrastructure.md](docs/architecture/Infrastructure.md)

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

| Ordner | Inhalt |
|--------|--------|
| `docs/architecture/` | Architektur-Layer Docs (Core, Features, Application, Infrastructure, EventBus, Conventions, EntityRegistry) |
| `docs/features/` | Feature-spezifische Docs (Travel, Weather, Combat, Quest, Time, etc.) |
| `docs/domain/` | Domain-Entity Docs (NPC, Faction, Location, Map-Navigation) |

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

### Architektur

| Dokument | Inhalt |
|----------|--------|
| [Core.md](docs/architecture/Core.md) | Schemas, Types, Utils |
| [Features.md](docs/architecture/Features.md) | Feature-Pattern, State Machines, Dependency-Graph |
| [Application.md](docs/architecture/Application.md) | MVVM, ViewModels |
| [Infrastructure.md](docs/architecture/Infrastructure.md) | Adapters, Vault-Integration, State-Persistenz |
| [EventBus.md](docs/architecture/EventBus.md) | Event-Patterns, Naming-Konvention |
| [Events-Catalog.md](docs/architecture/Events-Catalog.md) | Single Source of Truth fuer alle Events |
| [EntityRegistry.md](docs/architecture/EntityRegistry.md) | Entity-Verwaltung, Creature-Hierarchie |
| [Conventions.md](docs/architecture/Conventions.md) | Naming, Error Handling |
| [Error-Handling.md](docs/architecture/Error-Handling.md) | Error-Propagation, Fehlerbehandlung |
| [Glossary.md](docs/architecture/Glossary.md) | Begriffsdefinitionen |
| [Data-Flow.md](docs/architecture/Data-Flow.md) | Datenfluss-Diagramme |
| [Testing.md](docs/architecture/Testing.md) | Test-Patterns, Mock-Strategien |
| [Development-Roadmap.md](docs/architecture/Development-Roadmap.md) | Aktueller Implementierungs-Status |
| [Project-Structure.md](docs/architecture/Project-Structure.md) | Ordnerstruktur, Modul-Organisation |

### Application-Docs

| Dokument | Inhalt |
|----------|--------|
| [SessionRunner.md](docs/application/SessionRunner.md) | Hauptansicht, Panels, Workflows |
| [Cartographer.md](docs/application/Cartographer.md) | Map-Editor, Tools, Layer |
| [Library.md](docs/application/Library.md) | Entity-CRUD, Views |

### System-Docs

| Dokument | Inhalt |
|----------|--------|
| [Map-Feature.md](docs/features/Map-Feature.md) | Map-Typen, Multi-Map-Verhalten |
| [Encounter-Feature.md](docs/features/Encounter-Feature.md) | Typen, Balancing, NPC-Instanziierung |
| [Travel-System.md](docs/features/Travel-System.md) | Hex-Navigation, Speed-Berechnung |
| [Weather-System.md](docs/features/Weather-System.md) | Wetter-Generierung, Events |
| [Encounter-Types.md](docs/features/Encounter-Types.md) | 6 Encounter-Typen |
| [Encounter-Balancing.md](docs/features/Encounter-Balancing.md) | CR-Berechnung, Gewichtung |
| [Quest-System.md](docs/features/Quest-System.md) | Objectives, 40/60 XP-Split |
| [Combat-System.md](docs/features/Combat-System.md) | Initiative, Conditions |
| [Audio-System.md](docs/features/Audio-System.md) | Track-Tags, Mood-Matching |
| [Dungeon-System.md](docs/features/Dungeon-System.md) | Grid-Maps, Fog of War, Licht |
| [Time-System.md](docs/features/Time-System.md) | Kalender, WorldEvents, JournalEntries |
| [Character-System.md](docs/features/Character-System.md) | PC-Schema |
| [Inventory-System.md](docs/features/Inventory-System.md) | Items, Encumbrance |
| [Loot-Feature.md](docs/features/Loot-Feature.md) | Tag-Matching, Generierung |

### Entity-Docs

| Dokument | Inhalt |
|----------|--------|
| [Creature.md](docs/domain/Creature.md) | Creature-Schema, Templates |
| [NPC-System.md](docs/domain/NPC-System.md) | NPC-Generierung, Auswahl |
| [Faction.md](docs/domain/Faction.md) | Fraktionen, Territory, eingebettete Kultur |
| [POI.md](docs/domain/POI.md) | Points of Interest, Sub-Maps, Verlinkung |
| [Map.md](docs/domain/Map.md) | Map-Schema, Typen |
| [Map-Navigation.md](docs/domain/Map-Navigation.md) | Map-Links, Navigation, History |
| [Item.md](docs/domain/Item.md) | Item-Schema, Kategorien |
| [Shop.md](docs/domain/Shop.md) | Händler, Inventar |
| [Terrain.md](docs/domain/Terrain.md) | Terrain-Typen, Mechaniken |
| [Quest.md](docs/domain/Quest.md) | Quest-Schema, Objectives |
| [Journal.md](docs/domain/Journal.md) | Automatische Ereignis-Historie |

### Sonstiges

| Dokument | Inhalt |
|----------|--------|
| [Example-Workflows.md](docs/Example-Workflows.md) | Typische Nutzungs-Szenarien |

---

*Implementierungs-Details siehe jeweilige Dokumentation*
