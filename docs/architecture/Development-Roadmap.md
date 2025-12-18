# Development Roadmap

> **Wird benoetigt von:** Aktueller Task

Implementierungsstrategie und aktueller Status für Salt Marcher.

---

## ✅ Implementiert

| Feature | Aspekte |
|---------|---------|
| Travel | Nachbar-Bewegung, State-Machine, Multi-Hex-Routen (Greedy), Terrain-Speed-Faktor, Weather-Speed-Faktor, Encumbrance-Speed-Faktor, Wegpunkt-UI, Routen-Visualisierung, Auto-Segment-Bewegung, Stunden-Encounter-Checks (12.5%), Auto-Pause bei Encounter, Zeit-basierte Token-Animation (1min/Tick), Path-Preview (Greedy), ETA-Anzeige |
| Weather | Terrain-basierte Generierung, Travel-Speed-Modifier, Persistenz |
| Encounter | 4 Typen, State-Machine, 6-Step Pipeline (inkl. Loot), NPC-Generator, Travel-Integration, XP-Berechnung, CR-Vergleich, Difficulty-System, XP-Budget, Gruppen-Multiplikatoren, Daily-XP-Tracking, Multi-Creature Combat |
| Combat | Initiative-Tracker, HP-Management, 14 Conditions, Concentration, Time-Integration, XP aus Creatures |
| Quest | State-Machine, 40/60 XP-Split, Encounter-Slot-Zuweisung, Resumable State |
| Party | Character-Schema, Party-Member-Management, getPartyLevel/Speed |
| Inventory | Item-Schema, InventorySlot, Encumbrance, Rations, Travel-Speed-Integration |
| Loot | Tag-Matching, XP-basiertes Budget (0.5 GP/XP), Encounter-Integration, loot:generated Event |
| Map | Hex-Map Rendering, Terrain-System, Weather-Ranges |
| UI | SessionRunner, DetailView, Time-Advance, Weather-Summary |

---

## 🔄 Aktiver Sprint

### ✅ Phase 14: Encounter Balancing + Multi-Creature Encounters (ABGESCHLOSSEN)

**User Story:**
> Als GM moechte ich ausgeglichene Multi-Creature-Encounters, damit Combat-Begegnungen zur Party-Staerke passen und die D&D 5e Balancing-Regeln korrekt angewendet werden.

**Implementiert:**
- [x] CR-Vergleich (trivial/manageable/deadly/impossible) - `compareCR()`
- [x] Difficulty-Wuerfel (Easy/Medium/Hard/Deadly) - `rollDifficulty()`
- [x] XP-Budget D&D 5e - `calculateXPBudget()`
- [x] Gruppen-Multiplikatoren - `getGroupMultiplier()`, `calculateEffectiveXP()`
- [x] Daily-XP-Budget-Tracking - `DailyXPTracker`, Reset bei Tageswechsel
- [x] Combat-Befuellung (Companion-Selection) - `selectCompanions()`
- [x] Typ-Ableitung (CR-basierte Wahrscheinlichkeits-Matrix) - `deriveEncounterType()` erweitert
- [x] Schema-Erweiterung - `EncounterInstance.difficulty`, `xpBudget`, `effectiveXP`
- [x] Service-Integration - Pipeline nutzt Balancing fuer Combat-Encounters

**Nicht im Scope (bewusst ausgeklammert):**
- Fraktions-Territorium-Gewichtung (#11 teilweise) - Faction-Feature noch nicht implementiert
- Weather-Integration (#25) - Post-MVP
- Social/Trace/Passing erweiterte Befuellung (#24) - nur Combat-Fokus
- Multi-Gruppen-Encounters (#29) - Post-MVP

---

_Bereit fuer naechste Phase._

## ⬜ Backlog

| # | Bereich | Aspekt | Prio | MVP? | Deps | Referenz |
|--:|---------|--------|:----:|:----:|------|----------|
| 1 | **BUG** | Uhr im SessionRunner nur bei Stunden-/Segment-Ende aktualisiert | hoch | Ja | - | [Travel-System.md](../features/Travel-System.md) |
| 2 | **BUG** | Random Encounter setzt Party auf letztes Hex zurueck, Segment-Progress verloren | hoch | Ja | - | [Travel-System.md](../features/Travel-System.md) |
| 3 | **BUG** | Mehrere Kreaturen gleicher Art werden im Encounter-Panel einzeln aufgelistet statt gruppiert mit Anzahl | niedrig | Nein | - | [DetailView.md](../application/DetailView.md) |
| 4 | Travel | Wegpunkt/Token Drag&Drop | mittel | Ja | - | [Travel-System.md](../features/Travel-System.md) |
| 5 | Travel | A* Pathfinding | niedrig | Nein | - | [Travel-System.md](../features/Travel-System.md) |
| 6 | Travel | Pfad-Integration (Strassen, Fluesse) | niedrig | Nein | #5 | [Travel-System.md](../features/Travel-System.md) |
| 7 | Travel | Pfad-Barrieren (blocksMovement) | niedrig | Nein | #6 | [Travel-System.md](../features/Travel-System.md) |
| 7b | Travel | Animations-Geschwindigkeit Slider (GM-Einstellung) | niedrig | Nein | - | [SessionRunner.md](../application/SessionRunner.md) |
| 8 | Weather | Weather-Events (Blizzard etc.) | mittel | Nein | - | [Weather-System.md](../features/Weather-System.md) |
| 9 | Weather | GM Override | mittel | Ja | - | [Weather-System.md](../features/Weather-System.md) |
| 10 | Weather | UI-Anzeige | hoch | Ja | - | [Weather-System.md](../features/Weather-System.md) |
| 11 | Encounter | Tile-Eligibility (Filter + Gewichtung) | hoch | Ja | #76* | [Encounter-System.md](../features/Encounter-System.md) |
| 12 | Encounter | Kreatur-Auswahl (gewichtete Zufallsauswahl) | hoch | Ja | #11 | [Encounter-System.md](../features/Encounter-System.md) |
| 13b | Encounter | Typ-Ableitung (Faction-Relation Matrix) | mittel | Ja | #76 | [Encounter-System.md](../features/Encounter-System.md) |
| 14 | Encounter | Variety-Validation (Monotonie-Vermeidung) | mittel | Ja | - | [Encounter-System.md](../features/Encounter-System.md) |
| 15 | Encounter | 4 Typen (Combat/Social/Passing/Trace) | hoch | Ja | - | [Encounter-System.md](../features/Encounter-System.md) |
| 16 | Encounter | NPC-Instanziierung bei Encounter | hoch | Ja | #15 | [Encounter-System.md](../features/Encounter-System.md) |
| 17 | Encounter | CreatureSlot-Varianten (Concrete, Typed, Budget) | mittel | Ja | - | [Encounter-System.md](../features/Encounter-System.md) |
| 24 | Encounter | Social/Trace/Passing Befuellung (vereinfacht) | mittel | Ja | #15 | [Encounter-Balancing.md](../features/Encounter-Balancing.md) |
| 25 | Encounter | Weather im Context | mittel | Ja | #11 | [Encounter-System.md](../features/Encounter-System.md) |
| 26 | Encounter | Environmental/Location Typen | mittel | Nein | #15 | [Encounter-System.md](../features/Encounter-System.md) |
| 27 | Encounter | Pfad-basierte Creature-Pools | mittel | Nein | #11 | [Encounter-System.md](../features/Encounter-System.md) |
| 28 | Encounter | Faction-Territory Population | mittel | Nein | #11, #76 | [Encounter-System.md](../features/Encounter-System.md) |
| 29 | Encounter | Multi-Gruppen-Encounters | niedrig | Nein | - | [Encounter-System.md](../features/Encounter-System.md) |
| 31 | Combat | Death Saves UI | niedrig | Nein | - | [Combat-System.md](../features/Combat-System.md) |
| 32 | Combat | Grid-Positioning | mittel | Nein | - | [Combat-System.md](../features/Combat-System.md) |
| 33 | Combat | Legendary/Lair Actions | niedrig | Nein | - | [Combat-System.md](../features/Combat-System.md) |
| 34 | Dungeon | Grid-Map (5-foot Tiles) | mittel | Ja | - | [Dungeon-System.md](../features/Dungeon-System.md) |
| 35 | Dungeon | Fog of War | mittel | Ja | #34 | [Dungeon-System.md](../features/Dungeon-System.md) |
| 36 | Dungeon | Raum-Definitionen | mittel | Ja | #34 | [Dungeon-System.md](../features/Dungeon-System.md) |
| 37 | Dungeon | Tile-Contents (Traps, Treasure) | mittel | Ja | #34 | [Dungeon-System.md](../features/Dungeon-System.md) |
| 38 | Dungeon | Basic Lighting (Bright/Dim/Dark) | mittel | Ja | #34 | [Dungeon-System.md](../features/Dungeon-System.md) |
| 39 | Dungeon | Trap-Trigger (Passive Perception) | mittel | Ja | #37 | [Dungeon-System.md](../features/Dungeon-System.md) |
| 40 | Dungeon | Creature Tokens | mittel | Ja | #34 | [Dungeon-System.md](../features/Dungeon-System.md) |
| 41 | Dungeon | Sound-Propagation | niedrig | Nein | #36 | [Dungeon-System.md](../features/Dungeon-System.md) |
| 42 | Dungeon | Multi-Level 3D | niedrig | Nein | #34 | [Dungeon-System.md](../features/Dungeon-System.md) |
| 43 | Quest | Quest-Editor | mittel | Nein | - | [Quest-System.md](../features/Quest-System.md) |
| 44 | Quest | Reputation-Rewards | niedrig | Nein | - | [Quest-System.md](../features/Quest-System.md) |
| 45 | Quest | Hidden Objectives | niedrig | Nein | - | [Quest-System.md](../features/Quest-System.md) |
| 46 | Party | XP-Verteilung System | hoch | Ja | - | [Character-System.md](../features/Character-System.md) |
| 47 | Party | Character-UI | hoch | Ja | - | [Character-System.md](../features/Character-System.md) |
| 48 | Inventory | Equipped-Items (AC/Damage) | niedrig | Nein | - | [Inventory-System.md](../features/Inventory-System.md) |
| 49 | Inventory | Inventory-UI | hoch | Ja | - | [Inventory-System.md](../features/Inventory-System.md) |
| 50 | Inventory | Automatischer Rationen-Abzug | mittel | Ja | - | [Inventory-System.md](../features/Inventory-System.md) |
| 51 | Map | Multi-Map-Navigation | niedrig | Nein | - | [Map-Feature.md](../features/Map-Feature.md) |
| 52 | Map | Cartographer (Editor) | mittel | Teilw. | - | [Cartographer.md](../application/Cartographer.md) |
| 53 | UI | Debug-Panel | niedrig | Nein | - | [SessionRunner.md](../application/SessionRunner.md) |
| 54 | UI | Transport-Wechsel UI | mittel | Ja | - | [SessionRunner.md](../application/SessionRunner.md) |
| 55 | UI | Audio Quick-Controls | hoch | Ja | - | [SessionRunner.md](../application/SessionRunner.md) |
| 56 | Time | Calendar-Wechsel | niedrig | Nein | - | [Time-System.md](../features/Time-System.md) |
| 57 | Events | Siehe Status-Spalten | - | - | - | [Events-Catalog.md](Events-Catalog.md) |
| 58 | Loot | Hoard-System | hoch | Nein | - | [Loot-Feature.md](../features/Loot-Feature.md) |
| 59 | Loot | Budget-Tracking ueber Zeit | mittel | Ja | #63 | [Loot-Feature.md](../features/Loot-Feature.md) |
| 60 | Loot | GM-Override (Loot anpassen) | mittel | Ja | #61 | [Loot-Feature.md](../features/Loot-Feature.md) |
| 61 | Loot | Loot-UI (Verteilungs-Modal) | mittel | Ja | - | [Loot-Feature.md](../features/Loot-Feature.md) |
| 62 | Loot | Creature defaultLoot (Chance-System) | hoch | Ja | - | [Loot-Feature.md](../features/Loot-Feature.md) |
| 63 | Loot | Level-basierte Gold/XP-Ratio (DMG-Tabelle) | hoch | Ja | - | [Loot-Feature.md](../features/Loot-Feature.md) |
| 64 | Loot | Schulden-System (Soft-Cap Item weglassen) | hoch | Ja | #63 | [Loot-Feature.md](../features/Loot-Feature.md) |
| 65 | Loot | Basis Loot-Tags (currency, weapons, armor, etc.) | hoch | Ja | - | [Loot-Feature.md](../features/Loot-Feature.md) |
| 66 | Loot | Item-Auswahl nach Tags (gewichtete Wahrscheinlichkeit) | mittel | Ja | #65 | [Loot-Feature.md](../features/Loot-Feature.md) |
| 67 | Loot | Treasure-Markers (GM-platziert, auto-fill) | mittel | Nein | #58 | [Loot-Feature.md](../features/Loot-Feature.md) |
| 68 | Loot | Soft-Cap Item-Downgrade (Platte → Kette) | mittel | Nein | #64 | [Loot-Feature.md](../features/Loot-Feature.md) |
| 69 | Loot | Rarity-System / Magic Item Tracking (DMG-Empfehlung) | mittel | Nein | - | [Loot-Feature.md](../features/Loot-Feature.md) |
| 70 | Loot | Faction defaultLoot | niedrig | Nein | #62 | [Loot-Feature.md](../features/Loot-Feature.md) |
| 71 | Loot | Automatische Loot-Verteilung (Party-Inventar) | niedrig | Nein | #61 | [Loot-Feature.md](../features/Loot-Feature.md) |
| 72 | Faction | Faction-Schema (Kern-Entity) | hoch | Ja | - | [Faction.md](../domain/Faction.md) |
| 73 | Faction | CultureData eingebettet (Naming, Personality, Quirks) | hoch | Ja | #72 | [Faction.md](../domain/Faction.md) |
| 74 | Faction | Hierarchische Kultur-Vererbung (Merge-Logik) | mittel | Ja | #73 | [Faction.md](../domain/Faction.md) |
| 75 | Faction | Bundled Basis-Fraktionen (Humanoids, Goblins, etc.) | mittel | Ja | #72 | [Faction.md](../domain/Faction.md) |
| 76 | Faction | POI-basiertes Territory / Praesenz-Berechnung | mittel | Ja | #72 | [Faction.md](../domain/Faction.md) |
| 77 | Faction | Dynamische Faction-Interaktionen | niedrig | Nein | #76 | [Faction.md](../domain/Faction.md) |
| 78 | Faction | Diplomatie-System (Allianzen, Feindschaften) | niedrig | Nein | #77 | [Faction.md](../domain/Faction.md) |
| 79 | NPC | NPC-Schema (Kern-Entity) | hoch | Ja | #72 | [NPC-System.md](../domain/NPC-System.md) |
| 80 | NPC | NPC-Generierung (aus Faction-Kultur) | hoch | Ja | #73, #79 | [NPC-System.md](../domain/NPC-System.md) |
| 81 | NPC | NPC-Persistierung (EntityRegistry) | hoch | Ja | #79 | [NPC-System.md](../domain/NPC-System.md) |
| 82 | NPC | Existierende NPC-Auswahl (Match-Algorithmus) | mittel | Ja | #81 | [NPC-System.md](../domain/NPC-System.md) |
| 83 | NPC | NPC-Status-Tracking (alive/dead) | mittel | Ja | #79 | [NPC-System.md](../domain/NPC-System.md) |
| 84 | NPC | Explizite NPC-Location via POI | mittel | Ja | #79 | [NPC-System.md](../domain/NPC-System.md) |
| 85 | NPC | NPC Stat-Overrides (Creature-Editor UI) | hoch | Nein | #79 | [NPC-System.md](../domain/NPC-System.md) |
| 86 | NPC | NPC-Routen (Haendler, Patrouillen) | mittel | Nein | #84 | [NPC-System.md](../domain/NPC-System.md) |
| 87 | NPC | NPC-Schedules (Tagesablauf-basierte Location) | mittel | Nein | #84 | [NPC-System.md](../domain/NPC-System.md) |
| 88 | NPC | homeLocation (Heimat-Tile mit Radius-Bonus) | niedrig | Nein | #84 | [NPC-System.md](../domain/NPC-System.md) |
| 89 | NPC | Faction-lose NPCs (Einsiedler, Wanderer) | niedrig | Nein | #79 | [NPC-System.md](../domain/NPC-System.md) |
| 90 | NPC | NPC-Agency (Runtime-Bewegung) | niedrig | Nein | #86 | [NPC-System.md](../domain/NPC-System.md) |
| 91 | Audio | 2 Audio Layer (Music + Ambience) | hoch | Ja | - | [Audio-System.md](../features/Audio-System.md) |
| 92 | Audio | Track Entity mit Tags | hoch | Ja | #91 | [Audio-System.md](../features/Audio-System.md) |
| 93 | Audio | Basic Playback (HTML5 Audio) | hoch | Ja | #91 | [Audio-System.md](../features/Audio-System.md) |
| 94 | Audio | Volume Control pro Layer | hoch | Ja | #91 | [Audio-System.md](../features/Audio-System.md) |
| 95 | Audio | Manual Override (Track waehlen) | mittel | Ja | #92 | [Audio-System.md](../features/Audio-System.md) |
| 96 | Audio | Mood-Matching (Location + Combat) | mittel | Ja | #92 | [Audio-System.md](../features/Audio-System.md) |
| 97 | Audio | Crossfade | mittel | Ja | #93 | [Audio-System.md](../features/Audio-System.md) |
| 98 | Audio | Auto-Switch bei Context-Aenderung | mittel | Nein | #96 | [Audio-System.md](../features/Audio-System.md) |
| 99 | Audio | Weather-Matching (Ambience) | niedrig | Nein | #96 | [Audio-System.md](../features/Audio-System.md) |
| 100 | Creature | CreatureDefinition Schema | hoch | Ja | - | [Creature.md](../domain/Creature.md) |
| 101 | Creature | Basis-Statistiken (CR, HP, AC) | hoch | Ja | #100 | [Creature.md](../domain/Creature.md) |
| 102 | Creature | terrainAffinities + activeTime | hoch | Ja | #100 | [Creature.md](../domain/Creature.md) |
| 103 | Creature | preferences (Gewichtung) | mittel | Ja | #100 | [Creature.md](../domain/Creature.md) |
| 104 | Creature | lootTags | hoch | Ja | #100 | [Creature.md](../domain/Creature.md) |
| 105 | Creature | Auto-Sync mit Terrain | mittel | Ja | #100 | [Creature.md](../domain/Creature.md) |
| 106 | Creature | Vollstaendiger D&D 5e Statblock | mittel | Nein | #101 | [Creature.md](../domain/Creature.md) |
| 107 | Creature | Legendary Actions | niedrig | Nein | #106 | [Creature.md](../domain/Creature.md) |
| 108 | Item | Item-Schema (Kern-Entity) | hoch | Ja | - | [Item.md](../domain/Item.md) |
| 109 | Item | Tags fuer Loot-Matching | hoch | Ja | #108 | [Item.md](../domain/Item.md) |
| 110 | Item | Waffen-Properties (damage, properties) | hoch | Ja | #108 | [Item.md](../domain/Item.md) |
| 111 | Item | Ruestung-Properties (armorClass) | hoch | Ja | #108 | [Item.md](../domain/Item.md) |
| 112 | Item | Currency-Items (Gold, Silber, etc.) | hoch | Ja | #108 | [Item.md](../domain/Item.md) |
| 113 | Item | isRation Flag | mittel | Ja | #108 | [Item.md](../domain/Item.md) |
| 114 | Item | Rarity-System | mittel | Nein | #108 | [Item.md](../domain/Item.md) |
| 115 | Item | Artifact-Level Items | niedrig | Nein | #114 | [Item.md](../domain/Item.md) |
| 116 | Journal | JournalEntry Schema | hoch | Ja | - | [Journal.md](../domain/Journal.md) |
| 117 | Journal | Auto-Generierung (Quest, Encounter) | hoch | Ja | #116 | [Journal.md](../domain/Journal.md) |
| 118 | Journal | Manuelle Notizen (GM Quick-Note) | hoch | Ja | #116 | [Journal.md](../domain/Journal.md) |
| 119 | Journal | Entity-Linking (Clickable References) | mittel | Ja | #116 | [Journal.md](../domain/Journal.md) |
| 120 | Journal | Session-Grouping | mittel | Nein | #116 | [Journal.md](../domain/Journal.md) |
| 121 | Journal | Travel-Logging | mittel | Nein | #117 | [Journal.md](../domain/Journal.md) |
| 122 | Journal | WorldEvent-Logging | niedrig | Nein | #117 | [Journal.md](../domain/Journal.md) |
| 123 | Map | BaseMap Schema | hoch | Ja | - | [Map.md](../domain/Map.md) |
| 124 | Map | OverworldMap | hoch | Ja | #123 | [Map.md](../domain/Map.md) |
| 125 | Map | Map-Loading/Unloading | hoch | Ja | #123 | [Map.md](../domain/Map.md) |
| 126 | Map | TownMap (Strassen-basiert) | mittel | Nein | #123 | [Map.md](../domain/Map.md) |
| 127 | Map | DungeonMap (Grid-basiert) | mittel | Nein | #123 | [Map.md](../domain/Map.md) |
| 128 | Map-Nav | EntrancePOI-Schema | hoch | Ja | - | [Map-Navigation.md](../domain/Map-Navigation.md) |
| 129 | Map-Nav | Tile Content Panel | hoch | Ja | #128 | [Map-Navigation.md](../domain/Map-Navigation.md) |
| 130 | Map-Nav | Betreten-Button | hoch | Ja | #129 | [Map-Navigation.md](../domain/Map-Navigation.md) |
| 131 | Map-Nav | History via Journal | mittel | Ja | #116, #130 | [Map-Navigation.md](../domain/Map-Navigation.md) |
| 132 | Map-Nav | Bidirektionale Links (zwei POIs) | mittel | Ja | #128 | [Map-Navigation.md](../domain/Map-Navigation.md) |
| 133 | Map-Nav | Multi-POI-Tiles | mittel | Nein | #129 | [Map-Navigation.md](../domain/Map-Navigation.md) |
| 134 | POI | POI-Schema (Basis) | hoch | Ja | - | [POI.md](../domain/POI.md) |
| 135 | POI | EntrancePOI | hoch | Ja | #134 | [POI.md](../domain/POI.md) |
| 136 | POI | LandmarkPOI | hoch | Ja | #134 | [POI.md](../domain/POI.md) |
| 137 | POI | Map-Icon-Rendering | mittel | Ja | #134 | [POI.md](../domain/POI.md) |
| 138 | POI | TrapPOI | mittel | Nein | #134 | [POI.md](../domain/POI.md) |
| 139 | POI | TreasurePOI | mittel | Nein | #134 | [POI.md](../domain/POI.md) |
| 140 | POI | ObjectPOI | niedrig | Nein | #134 | [POI.md](../domain/POI.md) |
| 141 | POI | Custom POI-Icons | niedrig | Nein | #137 | [POI.md](../domain/POI.md) |
| 142 | Path | PathDefinition Schema | mittel | Nein | - | [Path.md](../domain/Path.md) |
| 143 | Path | PathType (road, river, ravine, cliff, trail) | mittel | Nein | #142 | [Path.md](../domain/Path.md) |
| 144 | Path | movement (defaultModifier, blocksMovement) | mittel | Nein | #142 | [Path.md](../domain/Path.md) |
| 145 | Path | transportModifiers + requiresTransport | mittel | Nein | #144 | [Path.md](../domain/Path.md) |
| 146 | Path | encounterModifier | mittel | Nein | #142 | [Path.md](../domain/Path.md) |
| 147 | Path | Bidirektionale Tile-Sync | mittel | Nein | #142 | [Path.md](../domain/Path.md) |
| 148 | Path | Travel-Integration | mittel | Nein | #144 | [Path.md](../domain/Path.md) |
| 149 | Path | Cartographer Path-Tool | mittel | Nein | #142 | [Path.md](../domain/Path.md) |
| 150 | Path | directional (Stroemung) | niedrig | Nein | #143 | [Path.md](../domain/Path.md) |
| 151 | Path | environmentModifier (Licht, Wetter) | niedrig | Nein | #142 | [Path.md](../domain/Path.md) |
| 152 | Quest-E | QuestDefinition Schema | hoch | Ja | - | [Quest.md](../domain/Quest.md) |
| 153 | Quest-E | Objectives (kill, collect, visit) | hoch | Ja | #152 | [Quest.md](../domain/Quest.md) |
| 154 | Quest-E | EncounterSlots | hoch | Ja | #152 | [Quest.md](../domain/Quest.md) |
| 155 | Quest-E | Rewards (Item, XP) | hoch | Ja | #152 | [Quest.md](../domain/Quest.md) |
| 156 | Quest-E | Deadline-Tracking | mittel | Ja | #152 | [Quest.md](../domain/Quest.md) |
| 157 | Quest-E | Reputation-Rewards | mittel | Nein | #155 | [Quest.md](../domain/Quest.md) |
| 158 | Quest-E | Prerequisites (Quest-Ketten) | mittel | Nein | #152 | [Quest.md](../domain/Quest.md) |
| 159 | Quest-E | Hidden Objectives | niedrig | Nein | #153 | [Quest.md](../domain/Quest.md) |
| 160 | Shop | Shop-Entity Schema | hoch | Ja | - | [Shop.md](../domain/Shop.md) |
| 161 | Shop | Inventar-Management | hoch | Ja | #160 | [Shop.md](../domain/Shop.md) |
| 162 | Shop | Location-Zuordnung | mittel | Ja | #160 | [Shop.md](../domain/Shop.md) |
| 163 | Shop | Kauf-Interaktion | hoch | Ja | #161 | [Shop.md](../domain/Shop.md) |
| 164 | Shop | Verkauf-Interaktion | hoch | Ja | #161 | [Shop.md](../domain/Shop.md) |
| 165 | Shop | Dynamisches Restock | niedrig | Nein | #161 | [Shop.md](../domain/Shop.md) |
| 166 | Shop | NPC-Haendler | niedrig | Nein | #160 | [Shop.md](../domain/Shop.md) |
| 167 | Terrain | TerrainDefinition Schema | hoch | Ja | - | [Terrain.md](../domain/Terrain.md) |
| 168 | Terrain | movementCost + encounterModifier | hoch | Ja | #167 | [Terrain.md](../domain/Terrain.md) |
| 169 | Terrain | nativeCreatures | hoch | Ja | #167 | [Terrain.md](../domain/Terrain.md) |
| 170 | Terrain | Auto-Sync mit Creatures | mittel | Ja | #169 | [Terrain.md](../domain/Terrain.md) |
| 171 | Terrain | climateProfile + weatherRanges | hoch | Ja | #167 | [Terrain.md](../domain/Terrain.md) |
| 172 | Terrain | Custom Terrains | mittel | Ja | #167 | [Terrain.md](../domain/Terrain.md) |
| 173 | Terrain | Default-Terrain Presets | mittel | Ja | #167 | [Terrain.md](../domain/Terrain.md) |
| 174 | Terrain | Terrain-Icons | niedrig | Nein | #167 | [Terrain.md](../domain/Terrain.md) |
| 175 | DetailView | Encounter-Tab | hoch | Ja | - | [DetailView.md](../application/DetailView.md) |
| 176 | DetailView | Combat-Tab | hoch | Ja | - | [DetailView.md](../application/DetailView.md) |
| 177 | DetailView | Shop-Tab | hoch | Ja | #160 | [DetailView.md](../application/DetailView.md) |
| 178 | DetailView | Location-Tab | mittel | Ja | - | [DetailView.md](../application/DetailView.md) |
| 179 | DetailView | Auto-Open Encounter | hoch | Ja | #175 | [DetailView.md](../application/DetailView.md) |
| 180 | DetailView | Auto-Open Combat | hoch | Ja | #176 | [DetailView.md](../application/DetailView.md) |
| 181 | DetailView | Quest-Tab | mittel | Nein | - | [DetailView.md](../application/DetailView.md) |
| 182 | DetailView | Journal-Tab | mittel | Nein | #100 | [DetailView.md](../application/DetailView.md) |
| 183 | DetailView | Keyboard-Shortcuts | niedrig | Nein | - | [DetailView.md](../application/DetailView.md) |
| 184 | Library | Tab-Navigation | hoch | Ja | - | [Library.md](../application/Library.md) |
| 185 | Library | Browse-View (List) | hoch | Ja | #184 | [Library.md](../application/Library.md) |
| 186 | Library | Search | hoch | Ja | #185 | [Library.md](../application/Library.md) |
| 187 | Library | Entity-Cards | hoch | Ja | #185 | [Library.md](../application/Library.md) |
| 188 | Library | Quick Filters | mittel | Ja | #185 | [Library.md](../application/Library.md) |
| 189 | Library | Create Modal | hoch | Ja | #184 | [Library.md](../application/Library.md) |
| 190 | Library | Edit Modal | hoch | Ja | #189 | [Library.md](../application/Library.md) |
| 191 | Library | Delete mit Confirm | hoch | Ja | #189 | [Library.md](../application/Library.md) |
| 192 | Library | Tree-View (Locations) | mittel | Nein | #185 | [Library.md](../application/Library.md) |
| 193 | Library | Grid-View | niedrig | Nein | #185 | [Library.md](../application/Library.md) |
| 194 | Library | Bulk-Actions | niedrig | Nein | #185 | [Library.md](../application/Library.md) |
| 195 | Library | Import/Export | niedrig | Nein | - | [Library.md](../application/Library.md) |
| 196 | DetailView | Bug: "Start combat" Button lädt Encounter nicht in Combat-View und öffnet sie nicht | hoch | Ja | #175 | [DetailView.md](../application/DetailView.md) |
| 197 | Travel | Waypoint einfügen (Klick auf Route) | mittel | Ja | #4 | [SessionRunner.md](../application/SessionRunner.md) |
| 198 | Travel | Waypoint löschen (Rechtsklick) | mittel | Ja | - | [SessionRunner.md](../application/SessionRunner.md) |
| 199 | Combat | CombatEffect Processing (Start/End-of-Turn) | hoch | Ja | - | [Combat-System.md](../features/Combat-System.md) |
| 200 | Combat | Condition-Duration Auto-Removal | hoch | Ja | #199 | [Combat-System.md](../features/Combat-System.md) |
| 201 | Combat | Combat ↔ Calendar Handoff (Zeit vorruecken) | hoch | Ja | - | [Combat-System.md](../features/Combat-System.md) |
| 202 | Combat | Post-Combat Resolution Flow (3-Phasen) | hoch | Ja | - | [DetailView.md](../application/DetailView.md) |
| 203 | Combat | XP-Summary Phase mit GM-Adjustment | hoch | Ja | #202 | [DetailView.md](../application/DetailView.md) |
| 204 | Combat | Quest-Assignment Phase (60% XP-Pool) | hoch | Ja | #202 | [DetailView.md](../application/DetailView.md) |
| 205 | Combat | Loot-Distribution Phase | hoch | Ja | #202 | [DetailView.md](../application/DetailView.md) |
| 206 | Combat | Resumable Combat State | mittel | Nein | - | [Combat-System.md](../features/Combat-System.md) |
| 207 | Combat | Lair Actions (separat) | niedrig | Nein | #33 | [Combat-System.md](../features/Combat-System.md) |
| 208 | Combat | Reaction-Tracking | niedrig | Nein | - | [Combat-System.md](../features/Combat-System.md) |
| 209 | Combat | Spell Slot Tracking | niedrig | Nein | - | [Combat-System.md](../features/Combat-System.md) |
| 210 | Map | Visibility-System (Overlay) | mittel | Nein | - | [Map-Feature.md](../features/Map-Feature.md) |
| 211 | Map | Sichtweiten-Berechnung (Wurzel-Formel) | mittel | Nein | #210 | [Map-Feature.md](../features/Map-Feature.md) |
| 212 | Map | Sicht-Blockierung (Line-of-Sight) | mittel | Nein | #211 | [Map-Feature.md](../features/Map-Feature.md) |
| 213 | Map | Weather-Visibility-Modifier | mittel | Nein | #210 | [Weather-System.md](../features/Weather-System.md) |
| 214 | Map | Time-Visibility-Modifier (Tageszeit) | mittel | Nein | #210 | [Time-System.md](../features/Time-System.md) |
| 215 | POI | Height-Feld fuer Fernsicht | mittel | Nein | #210 | [POI.md](../domain/POI.md) |
| 216 | Party | Character-Sinne (senses) Schema | mittel | Nein | - | [Character-System.md](../features/Character-System.md) |
| 217 | Party | Darkvision Nacht-Modifier-Bypass | mittel | Nein | #214, #216 | [Character-System.md](../features/Character-System.md) |
| 218 | Party | Erweiterte Sinne (Blindsight, Tremorsense, TrueSight) | niedrig | Nein | #216 | [Character-System.md](../features/Character-System.md) |
| 219 | Creature | Creature-Sinne (senses) Schema | mittel | Nein | - | [Creature.md](../domain/Creature.md) |
| 220 | Encounter | Creature-Sichtweite fuer Encounter-Trigger | niedrig | Nein | #219 | [Encounter-System.md](../features/Encounter-System.md) |
| 221 | Map | Visibility Performance-Caching | niedrig | Nein | #210 | [Map-Feature.md](../features/Map-Feature.md) |
| 222 | UI | Visibility-Toggle im Map-Panel | mittel | Nein | #210 | [SessionRunner.md](../application/SessionRunner.md) |
| 223 | POI | glowsAtNight-Feld fuer nachtleuchtende POIs | mittel | Nein | #214 | [POI.md](../domain/POI.md) |
| 224 | UI | Sichtbare POIs hervorheben (Glow/Umrandung) | mittel | Nein | #210 | [Map-Feature.md](../features/Map-Feature.md) |

**Deps-Legende:** `#N*` = Teilweise Dependency (Basis-Funktionalitaet ohne, vollstaendige Implementierung mit Dependency)

---

## Test-Strategie

| Komponente | Stabilität | Test-Ansatz |
|------------|------------|-------------|
| Core | Hoch | ✅ 136 Unit-Tests (inkl. EventBus request()) |
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

---

## Dokumentations-Workflow

### Bei Phase-Abschluss

1. **Implementiert aktualisieren:**
   - Neue Aspekte zur Feature-Zeile hinzufuegen

2. **Backlog pflegen:**
   - Implementierte Items aus dem Backlog entfernen
   - Neue entdeckte Luecken hinzufuegen

3. **Event-Status aktualisieren:**
   - Events-Catalog.md → Status-Spalte auf ✅ setzen

4. **Aktiver Sprint** leeren

### Beim planen neuer Phase

1. "Aktiver Sprint" Sektion mit Template befuellen (siehe unten)
2. NICHT DIE TEMPLATE-STRUKTUR VERAENDERN!

### Aktiver-Sprint Template

```markdown
## 🔄 Aktiver Sprint

_[Status-Zeile, z.B. "Phase X abgeschlossen. Bereit fuer Phase Y."]_

### Phase [N]: [Name]

**User Story:**
> Als [Rolle] moechte ich [Feature], damit [Nutzen].

**Scope (siehe [Feature-Doc.md](../features/Feature-Doc.md)):**
- [ ] Komponente 1
- [ ] Komponente 2
- [ ] ...

**Implementierungs-Fortschritt:**

| Komponente | Status | Anmerkung |
|------------|--------|-----------|

**Nicht im Scope:**
- Ausgeschlossenes Feature 1
- Ausgeschlossenes Feature 2
```

### Prinzipien

| Dokument | Enthält |
|----------|---------|
| **Roadmap** | Phasen-Uebersicht + Implementiert + Backlog |
| **Events-Catalog.md** | Event-Definitionen + Implementierungs-Status |
| **Feature-Docs** | Spezifikation (Ziel-Zustand) |

---

## Verwandte Dokumentation

| Thema | Dokument |
|-------|----------|
| Core-Types | [Core.md](Core.md) |
| Events | [Events-Catalog.md](Events-Catalog.md) |
| Layer-Struktur | [Project-Structure.md](Project-Structure.md) |
| Error-Handling | [Error-Handling.md](Error-Handling.md) |
| Conventions | [Conventions.md](Conventions.md) |
| Testing | [Testing.md](Testing.md) |
