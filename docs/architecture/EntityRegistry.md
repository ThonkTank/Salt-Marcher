# EntityRegistry

> **Lies auch:** [Core](Core.md)
> **Wird benoetigt von:** Alle Entities

Zentrale Speicherung und Verwaltung aller persistenten Entities.

**Design-Philosophie:** EntityRegistry ist das einzige System fuer persistente Entity-Definitionen. Features nutzen es fuer Templates, Configs und persistente Daten. Feature-spezifische Runtime-Daten (z.B. Map-Tiles) gehen ueber StoragePorts.

---

## Architektur

### Hexagonales Pattern

```
┌─────────────────────────────────────────────────┐
│  Features / Application Layer                    │
│  - Nutzen EntityRegistryPort via Constructor     │
│  - Querying, Saving, Deleting                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  @core/types/entity-registry.port.ts            │
│  - Interface Definition                          │
│  - Entity-Type Mappings                          │
│  - Result/Error Types                            │
└─────────────────────────────────────────────────┘
                    △
                    │ implements
┌─────────────────────────────────────────────────┐
│  @infrastructure/vault-entity-registry.adapter  │
│  - JSON-File-basierte Implementation             │
│  - Vault/{plugin}/data/{entityType}/{id}.json   │
│  - Zod-Validierung bei Save                      │
└─────────────────────────────────────────────────┘
```

---

## Port Interface

```typescript
// @core/types/entity-registry.port.ts

// MVP Entity-Typen (20)
type EntityType =
  // Core Entities
  | 'creature'     // Monster/NPC-Statblocks (Templates, nicht Instanzen!)
  | 'character'    // Player Characters
  | 'npc'          // Benannte persistente Kreaturen mit Persoenlichkeit
  | 'faction'      // Fraktionen (Culture embedded)
  | 'item'         // Item-Definitionen (→ docs/domain/Item.md)
  // World Entities
  | 'map'          // Map-Definitionen
  | 'poi'          // Points of Interest (→ docs/domain/POI.md)
  | 'maplink'      // Standalone Map-Links (ohne POI)
  | 'terrain'      // Custom Terrain-Definitionen mit Mechaniken
  | 'feature'      // Environment-Features fuer Encounter-Balance (→ docs/features/encounter/Initiation.md)
  | 'activity'     // Creature-Activities fuer Encounter-Flavour (→ docs/features/encounter/Flavour.md)
  // Session Entities
  | 'quest'        // Quest-Definitionen
  | 'encounter'    // Vordefinierte Encounter-Templates
  | 'shop'         // Haendler mit Inventar
  | 'party'        // Party-Daten (aktive Charaktere, Position)
  // Time & Events
  | 'calendar'     // Kalender-Definitionen
  | 'journal'      // Journal-Entries (Arrivals, Events, etc.)
  | 'worldevent'   // Scheduled World Events (Kalender-Events)
  // Audio
  | 'track'        // Audio-Tracks mit Mood-Tags (→ docs/features/Audio-System.md)
  // Loot & Economy
  | 'lootcontainer'; // Persistente Loot-Instanzen (→ docs/domain/LootContainer.md)

// Post-MVP Entity-Typen
// | 'path'        // Lineare Features (Strassen, Fluesse, etc.) - Post-MVP
// | 'spell'       // D&D Beyond-level Character Management
// | 'playlist'    // Manuelle Musik-Kontrolle

interface EntityRegistryPort {
  /**
   * Einzelne Entity abrufen
   * @returns Entity oder null wenn nicht gefunden
   */
  get<T extends EntityType>(type: T, id: EntityId<T>): Entity<T> | null;

  /**
   * Alle Entities eines Typs abrufen
   */
  getAll<T extends EntityType>(type: T): Entity<T>[];

  /**
   * Entities filtern mit Predicate
   * Linear scan fuer MVP, Indizes bei Bedarf spaeter
   */
  query<T extends EntityType>(
    type: T,
    predicate: (entity: Entity<T>) => boolean
  ): Entity<T>[];

  /**
   * Entity speichern (Create oder Update)
   * - Validiert via Zod-Schema
   * - Speichert sofort (pessimistisch)
   * @returns Result mit Fehler bei Validierung oder IO-Problem
   */
  save<T extends EntityType>(
    type: T,
    entity: Entity<T>
  ): Result<void, ValidationError | IOError>;

  /**
   * Entity loeschen
   * @returns Result mit Fehler wenn nicht gefunden
   */
  delete<T extends EntityType>(
    type: T,
    id: EntityId<T>
  ): Result<void, NotFoundError | IOError>;

  /**
   * Pruefen ob Entity existiert
   */
  exists<T extends EntityType>(type: T, id: EntityId<T>): boolean;

  /**
   * Anzahl Entities eines Typs
   */
  count<T extends EntityType>(type: T): number;
}
```

---

## Entity-Type Mapping

```typescript
// Type-safe Entity Mapping (20 MVP Types)
type EntityTypeMap = {
  // Core Entities
  creature: CreatureDefinition;     // Template, NICHT Instanz
  character: Character;
  npc: NPC;                         // Benannte persistente Kreatur
  faction: Faction;                 // Culture embedded (→ docs/domain/Faction.md)
  item: Item;
  // World Entities
  map: MapDefinition;
  poi: POI;                         // Points of Interest (alle Typen)
  maplink: MapLink;                 // Standalone Map-Links (ohne POI)
  terrain: TerrainDefinition;       // Custom Terrains mit Mechaniken
  feature: Feature;                 // Environment-Features mit Modifiern
  activity: Activity;               // Creature-Activities mit XP-Modifiern
  // Session Entities
  quest: Quest;
  encounter: EncounterDefinition;   // Vordefinierte Encounter-Templates
  shop: ShopDefinition;             // Haendler mit Inventar
  party: Party;                     // Party-Daten (aktive Charaktere, Position)
  // Time & Events
  calendar: CalendarDefinition;
  journal: JournalEntry;
  worldevent: WorldEvent;
  // Audio
  track: Track;                     // Audio-Tracks mit Mood-Tags
  // Loot & Economy
  lootcontainer: LootContainer;     // Persistente Loot-Instanzen (Truhen, Horte)
  // Post-MVP:
  // path: PathDefinition;          // Lineare Features (→ docs/domain/Path.md)
};

type Entity<T extends EntityType> = EntityTypeMap[T];
```

---

## Creature-Hierarchie: Definition vs Instanz vs NPC

Ein haeufiger Stolperstein ist die Unterscheidung zwischen Kreatur-Typen:

| Begriff | Bedeutung | Persistenz | Beispiel |
|---------|-----------|------------|----------|
| `CreatureDefinition` | Template/Statblock | **EntityRegistry** | "Goblin", CR 1/4, 7 HP |
| `Creature` | Instanz in Encounter/Combat | **Runtime** (nicht persistiert) | "Goblin #1", aktuell 5 HP |
| `NPC` | Benannte persistente Instanz | **EntityRegistry** | "Griknak", Persoenlichkeit |

### CreatureDefinition (creature)

Template fuer Monster und NPCs - reine Spielwerte:

```typescript
interface CreatureDefinition {
  id: EntityId<'creature'>;
  name: string;           // "Goblin"
  cr: number;
  maxHp: number;
  ac: number;
  // ... vollstaendiger Statblock
  tags?: string[];        // Fuer Tile-Eligibility: ["humanoid", "tribal"]
}
```

### Creature (Runtime)

Temporaere Instanz waehrend Encounter/Combat - **NICHT** im EntityRegistry:

```typescript
// Existiert NUR im Feature-State (Combat, Encounter)
interface Creature {
  definitionId: EntityId<'creature'>;  // Referenz auf Template
  currentHp: number;                    // Aktueller Zustand
  conditions: Condition[];
  // ... Combat-State
}
```

### NPC (npc)

Benannte, persistente Kreatur mit Persoenlichkeit:

```typescript
interface NPC {
  id: EntityId<'npc'>;
  creature: CreatureRef;               // Referenz auf Statblock (mit type fuer Matching)
  name: string;                         // "Griknak der Hinkende"
  personality: PersonalityTraits;
  factionId: EntityId<'faction'>;      // Required: Jeder NPC gehoert zu einer Faction
  status: 'alive' | 'dead';
  currentPOI?: EntityId<'poi'>;        // Optional: Expliziter Aufenthaltsort

  // Tracking fuer Wiedererkennung
  firstEncounter: GameDateTime;
  lastEncounter: GameDateTime;
  encounterCount: number;
}

interface CreatureRef {
  type: string;                        // Kreatur-Typ (z.B. "goblin") - fuer NPC-Matching
  id: EntityId<'creature'>;            // Verweis auf Creature-Template
}

// Post-MVP: statOverrides?: CreatureStatOverrides;
// - Ermoeglicht individuelle Stat-Anpassungen
// - UI vom Creature-Editor wiederverwendet
```

> **Wichtig:** Ein NPC referenziert eine CreatureDefinition fuer seine Spielwerte. Die Persoenlichkeit und Geschichte sind NPC-spezifisch. Der `type` in CreatureRef wird fuer NPC-Matching bei Encounters benoetigt.

→ Detaillierte Dokumentation: [encounter/Encounter.md](../features/encounter/Encounter.md#npc-instanziierung)

---

## Neue Entity-Typen (MVP)

### Terrain (terrain)

Custom Terrain-Definitionen mit vollen Mechaniken. User kann eigene Terrains erstellen.

```typescript
interface TerrainDefinition {
  id: EntityId<'terrain'>;
  name: string;                           // "Fungal Wastes"
  movementCost: number;                   // 1.0 = normal, 2.0 = difficult terrain
  encounterModifier: number;              // Multiplikator fuer Encounter-Wahrscheinlichkeit
  climateProfile: {
    temperatureModifier: number;          // Offset in Grad
    humidityModifier: number;             // Offset in Prozent
    windExposure: 'sheltered' | 'normal' | 'exposed';
  };
  displayColor: string;                   // Hex-Farbe fuer Map-Rendering
  icon?: string;                          // Optional: Icon-Referenz
  nativeCreatures: EntityId<'creature'>[]; // Kreaturen die hier heimisch sind
  description?: string;
}
```

> **Encounter-Matching:** Statt `creature.preferredTerrain.includes(terrain)` wird `terrain.nativeCreatures.includes(creatureId)` geprueft. Dies ermoeglicht bidirektionale Zuordnung.

### Feature (feature)

Environment-Features fuer Encounter-Balance und Hazards. Features haben kreative Namen (z.B. "Dichte Dornen", "Schnappende Ranken") und koennen sowohl Balance-Modifier als auch Gefahren-Effekte definieren.

```typescript
interface Feature {
  id: EntityId<'feature'>;
  name: string;                      // "Dichte Dornen", "Schnappende Ranken", "Dunkelheit"
  modifiers?: FeatureModifier[];     // Encounter-Balance Modifier (optional)
  hazard?: HazardDefinition;         // Hazard-Effekte (optional)
  description?: string;
}

interface FeatureModifier {
  target: CreatureProperty;          // Welche Kreatur-Eigenschaft?
  value: number;                     // Wie stark? (z.B. -0.30, +0.15)
}

// Hardcodierte Kreatur-Eigenschaften
type CreatureProperty =
  // Bewegung
  | 'fly' | 'swim' | 'climb' | 'burrow' | 'walk-only'
  // Sinne
  | 'darkvision' | 'blindsight' | 'tremorsense' | 'trueSight' | 'no-special-sense'
  // Design-Rollen (MCDM)
  | 'ambusher' | 'artillery' | 'brute' | 'controller' | 'leader'
  | 'minion' | 'skirmisher' | 'soldier' | 'solo' | 'support';

// --- Hazard-System ---
interface HazardDefinition {
  trigger: HazardTrigger;
  effect: HazardEffect;
  save?: SaveRequirement;            // Rettungswurf (Ziel wuerfelt)
  attack?: AttackRequirement;        // Angriffswurf (Hazard wuerfelt)
}

type HazardTrigger = 'enter' | 'start-turn' | 'end-turn' | 'move-through';

interface HazardEffect {
  type: 'damage' | 'condition' | 'difficult-terrain' | 'forced-movement';
  damage?: { dice: string; damageType: DamageType };
  condition?: Condition;
  duration?: 'instant' | 'until-saved' | 'until-end-of-turn';
  movementCost?: number;
  direction?: 'away' | 'toward' | 'random';
  distance?: number;
}

interface SaveRequirement {
  ability: AbilityScore;
  dc: number;
  onSuccess: 'negate' | 'half';
}

interface AttackRequirement {
  attackBonus: number;
  attackType: 'melee' | 'ranged';
  onMiss?: 'negate' | 'half';
}
```

**Beispiel (nur Modifier):**
```json
{
  "id": "darkness",
  "name": "Dunkelheit",
  "modifiers": [
    { "target": "darkvision", "value": 0.15 },
    { "target": "blindsight", "value": 0.20 },
    { "target": "no-special-sense", "value": -0.15 }
  ]
}
```

**Beispiel (Modifier + Hazard):**
```json
{
  "id": "dense-thorns",
  "name": "Dichte Dornen",
  "modifiers": [{ "target": "skirmisher", "value": -0.10 }],
  "hazard": {
    "trigger": "move-through",
    "effect": { "type": "damage", "damage": { "dice": "1d4", "damageType": "piercing" } },
    "save": { "ability": "dex", "dc": 12, "onSuccess": "negate" }
  }
}
```

> **Feature-Quellen:** Features kommen aus Terrain (statisch), Weather/Time (dynamisch) und Indoor/Dungeon (Raum-Beleuchtung). Siehe [encounter/Initiation.md](../features/encounter/Initiation.md).

### Activity (activity)

Activities beschreiben, was Kreaturen gerade tun, wenn die Party sie antrifft. Sie beeinflussen Ueberraschung und Wahrnehmungsdistanz.

```typescript
interface Activity {
  id: EntityId<'activity'>;
  name: string;                    // "sleeping", "patrolling", "ambushing"
  awareness: number;               // 0-100, hoch = wachsam, schwer zu ueberraschen
  detectability: number;           // 0-100, hoch = leicht aufzuspueren
  contextTags: string[];           // Fuer Kontext-Filterung: "rest", "combat", "stealth"
  description?: string;
}
```

**Verwendung:**
- `awareness` → Ueberraschungs-Modifikator (hoch = schwer zu ueberraschen)
- `detectability` → InitialDistance-Modifikator (hoch = Party entdeckt frueher)

**Activity-Pool-Hierarchie:**
1. **Generische Activities** - Fuer alle Kreaturen (resting, traveling, sleeping)
2. **Creature-spezifische** - Per `creature.activities[]` referenziert
3. **Faction-spezifische** - Per `faction.culture.activities[]` referenziert

**Beispiele:**

| Activity | Awareness | Detectability | Beschreibung |
|----------|:---------:|:-------------:|--------------|
| sleeping | 10 | 20 | Tief schlafend, leise |
| resting | 40 | 40 | Entspannt, normal |
| patrolling | 80 | 60 | Wachsam, sichtbar |
| hunting | 90 | 30 | Wachsam, leise |
| ambushing | 95 | 10 | Max wachsam, versteckt |
| hiding | 90 | 5 | Wachsam, extrem versteckt |
| raiding | 60 | 90 | Chaos, sehr laut |
| war_chanting | 45 | 100 | Ritual, extrem laut |

→ Detaillierte Dokumentation: [encounter/Flavour.md](../features/encounter/Flavour.md)
→ Presets: [presets/activities/base-activities.json](../../presets/activities/base-activities.json)

### Shop (shop)

Haendler mit Inventar und Preismodifikatoren. Immer an einen NPC gebunden.

```typescript
interface ShopDefinition {
  id: EntityId<'shop'>;
  name: string;                           // "Grimmbart's Waffenschmiede"
  npcId: EntityId<'npc'>;                 // Pflicht: Shop gehoert zu NPC
  poiId?: EntityId<'poi'>;                // Optional: Fester Standort
  inventory: ShopItem[];                  // Verfuegbare Items
  buyMultiplier: number;                  // z.B. 1.0 = Listenpreis
  sellMultiplier: number;                 // z.B. 0.5 = halber Preis beim Verkauf
  description?: string;
  gmNotes?: string;
}

interface ShopItem {
  itemId: EntityId<'item'>;
  price?: number;                         // Override, sonst Item-Basispreis
  quantity: number | 'unlimited';         // MVP: immer 'unlimited'
}
```

**NPC-Bindung:**
- Shop ist immer an einen NPC gebunden (Haendler)
- Mit `locationId`: Spieler besuchen den Shop an der Location
- Ohne `locationId`: Spieler treffen den NPC in einem Encounter (wandernder Haendler)

**MVP-Scope:**
- Shop zeigt Preise an (via `shop-utils.ts`)
- Quick-Buy: GM waehlt Charakter → Item wird hinzugefuegt, Gold abgezogen
- Quick-Sell: GM waehlt Charakter-Item → Item entfernt, Gold hinzugefuegt
- Preis-Anpassung: Manueller Override oder Prozentsatz (Rabatt/Aufschlag)
- `quantity: 'unlimited'` fuer alle Shop-Items (kein Stock-Management)

**shop-utils.ts Funktionen:**
```typescript
calculateBuyPrice(item, shop, modifier?: number): number;  // modifier: 0.9 = 10% Rabatt
calculateSellPrice(item, shop, modifier?: number): number;
quickBuy(characterId, itemId, shopId, priceOverride?): void;
quickSell(characterId, itemId, quantity, shopId, priceOverride?): void;
```

> **Workflow:** GM oeffnet Shop → waehlt Item + Charakter → [Quick-Buy] → Item + Gold automatisch angepasst.

**Post-MVP Erweiterungen:**
- Automatische Transaktions-Logs (`economy:transaction-completed`)
- Stock-Tracking (begrenzte Mengen, `quantity: number`)
- Automatisches Restocking nach Zeit
- Crafting-Material-Dependencies
- Shop-Spezialisierungen

### Encounter (encounter)

Vordefinierte Encounter-Templates fuer Quest-System und manuelle Platzierung.

```typescript
interface EncounterDefinition {
  id: EntityId<'encounter'>;
  type: 'combat' | 'social' | 'passing' | 'trace' | 'environmental' | 'location';
  creatureSlots: CreatureSlot[];          // Flexible Kreatur-Spezifikation
  triggers?: {
    terrain?: EntityId<'terrain'>[];      // Nur auf diesen Terrains
    timeOfDay?: TimeSegment[];            // Nur zu diesen Tageszeiten
    weather?: WeatherCondition[];         // Nur bei diesem Wetter
    partyLevelRange?: [number, number];   // Nur fuer Party-Level
  };
  xpReward?: number;                      // Override, sonst aus Kreaturen berechnet
  loot?: LootTableRef | LootEntry[];
  isUnique?: boolean;                     // Kann nur einmal auftreten
  requiresQuestAssignment?: boolean;      // Erscheint nicht zufaellig
  description?: string;
}

interface CreatureSlot {
  // Drei Spezifikations-Level:
  creatureId?: EntityId<'creature'>;      // Konkrete Kreatur
  creatureType?: string;                  // z.B. "humanoid", "beast"
  crBudget?: number;                      // CR-Budget fuer Generierung
  count?: number | [number, number];      // Anzahl oder Bereich
}
```

> **NPC-Instanziierung:** NPCs werden erst bei Trigger generiert, nicht bei Definition. Encounter-Templates sind wiederverwendbar.

→ Detaillierte Dokumentation: [encounter/Encounter.md](../features/encounter/Encounter.md)

### LootContainer (lootcontainer)

Persistente Loot-Instanzen in der Welt - Schatzkisten, Drachenhorte, tote Abenteurer.

```typescript
interface LootContainer {
  id: EntityId<'lootcontainer'>;
  name: string;                           // "Alte Truhe", "Drachenhort", "Toter Abenteurer"

  // Ort
  locationRef: EntityId<'poi'>;           // Wo befindet sich der Container?

  // Inhalt (direkt, kein Template)
  goldAmount: number;                     // Konkreter Gold-Betrag
  items: EntityId<'item'>[];              // Konkrete Item-Instanzen

  // Status
  status: 'pristine' | 'looted' | 'partially_looted';

  // Optional: Sicherheit
  locked?: boolean;
  lockDC?: number;                        // DC zum Knacken
  trapped?: boolean;
  trapId?: EntityId<'poi'>;               // Verweis auf Trap-POI

  // Metadaten
  discoveredAt?: GameDateTime;
  description?: string;
  gmNotes?: string;
}
```

**Verwendung:**
- Bei Entity-Promotion: Drache wird NPC → Hort wird LootContainer
- Manuell platziert: GM erstellt Schatzkiste in Library
- Quest-Belohnungen: Quest verweist auf LootContainer
- POI-Integration: POI kann mehrere LootContainer referenzieren

**Status-Workflow:**
```
pristine → partially_looted → looted
    │              │
    └──────────────┴─→ (Party nimmt Teile oder alles)
```

→ Detaillierte Dokumentation: [LootContainer.md](../domain/LootContainer.md)

---

## Storage

### Dateistruktur

```
Vault/
└── SaltMarcher/
    └── data/
        ├── creature/              # CreatureDefinitions (Templates)
        │   ├── goblin-warrior.json
        │   └── wolf.json
        ├── character/             # Player Characters
        │   └── player-1.json
        ├── npc/                   # Benannte persistente NPCs
        │   ├── griknak.json
        │   └── merchant-bob.json
        ├── faction/               # Culture embedded in Faction
        │   ├── base-humanoids.json
        │   └── user-bloodfang.json
        ├── item/                  # Item-Definitionen
        │   └── longsword.json
        ├── map/
        │   └── overworld.json
        ├── poi/                   # Points of Interest (alle Typen)
        │   ├── bloodfang-entrance.json
        │   ├── dungeon-exit.json
        │   └── ancient-shrine.json
        ├── terrain/               # Custom Terrain-Definitionen
        │   ├── fungal-wastes.json
        │   └── crystal-plains.json
        ├── path/                  # Post-MVP: Lineare Features
        │   ├── old-trade-road.json
        │   └── silver-river.json
        ├── quest/                 # Quest-Definitionen
        │   └── clear-goblin-cave.json
        ├── encounter/             # Encounter-Templates
        │   ├── goblin-patrol.json
        │   └── bandit-ambush.json
        ├── shop/                  # Haendler
        │   ├── village-smith.json
        │   └── wandering-merchant.json
        ├── calendar/              # Kalender-Definitionen
        │   └── gregorian.json
        ├── track/                 # Audio-Tracks
        │   └── tavern-theme.json
        ├── journal/               # Journal-Entries
        │   └── entry-001.json
        ├── worldevent/            # Scheduled Events
        │   └── midwinter-festival.json
        └── lootcontainer/         # Persistente Loot-Instanzen
            ├── ancient-chest-001.json
            └── dragon-lair-hoard.json
```

### Dateiformat

Jede Entity wird als einzelne JSON-Datei gespeichert:

```json
// data/faction/user-bloodfang.json
{
  "id": "user-bloodfang",
  "name": "Blutfang-Stamm",
  "parentId": "base-goblins",
  "culture": {
    "naming": {
      "titles": ["Blutfang", "Schaedelsammler"]
    },
    "personality": {
      "common": [
        { "trait": "aggressive", "weight": 0.9 }
      ],
      "forbidden": ["cowardly"]
    }
  },
  "creatures": [
    { "creatureId": "goblin-warrior", "count": 20 }
  ],
  "controlledPOIs": ["bloodfang-cave"]
}
```

### Warum eine Datei pro Entity?

| Vorteil | Beschreibung |
|---------|--------------|
| **Sicherheit** | Korrupte Datei betrifft nur eine Entity |
| **Effizienz** | Nur geaenderte Entities werden geschrieben |
| **Git-freundlich** | Einzelne Aenderungen sind nachvollziehbar |
| **Backup** | User kann einzelne Entities wiederherstellen |

---

## Persistence-Timing

**Entscheidung:** Pessimistisches Speichern - sofort bei jeder Aenderung.

| Daten-Typ | Timing |
|-----------|--------|
| EntityRegistry-Entities | Sofort bei `save()` |
| Party-Position | Sofort bei Position-Aenderung |
| Map-Tiles (StoragePort) | Sofort bei Tile-Aenderung |
| Feature Session-State | Nicht persistiert |

### Begruendung

- **Verhindert Datenverlust** bei Crash/Plugin-Reload
- **Kein manueller Save-Button** noetig
- **JSON-File-Writes sind schnell** fuer einzelne Entities
- **User-Daten haben hoechste Prioritaet**

### Kein Auto-Save-Intervall

- Komplexer zu implementieren
- Dirty-Flag-Tracking ist fehleranfaellig
- Sofortiges Speichern ist sicherer

---

## Validierung

### Zod-Schema bei Save

```typescript
// @core/schemas/faction.schema.ts
import { z } from 'zod';

const FactionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  parentId: z.string().optional(),
  culture: CultureDataSchema,
  creatures: z.array(FactionCreatureGroupSchema),
  controlledPOIs: z.array(z.string()),
  description: z.string().optional(),
  gmNotes: z.string().optional()
});

// Im Adapter
save<T extends EntityType>(type: T, entity: Entity<T>): Result<void, ValidationError | IOError> {
  const schema = getSchemaForType(type);
  const parseResult = schema.safeParse(entity);

  if (!parseResult.success) {
    return err(new ValidationError(parseResult.error));
  }

  // Speichern...
}
```

### Keine Backwards-Migration

Fuer MVP keine automatische Schema-Migration. Bei Schema-Aenderungen:
1. Bundled Entities werden mit Plugin-Update aktualisiert
2. User-Entities muessen manuell angepasst werden
3. Breaking Changes werden in Release Notes dokumentiert

---

## Querying

### Predicate-basiert

```typescript
// Alle lebenden NPCs einer Fraktion finden
const bloodfangNPCs = entityRegistry.query('npc', npc =>
  npc.factionId === 'user-bloodfang' && npc.status === 'alive'
);

// Alle POIs auf einer Map
const mapPOIs = entityRegistry.query('poi', poi =>
  poi.mapId === 'overworld'
);

// Alle Eingaenge (EntrancePOIs) auf einer Map
const entrances = entityRegistry.query('poi', poi =>
  poi.mapId === 'overworld' && poi.type === 'entrance'
);

// Creature-Templates mit bestimmtem Tag
const undeadCreatures = entityRegistry.query('creature', c =>
  c.tags?.includes('undead')
);
```

### Performance

- **MVP:** Lineare Suche ueber alle Entities
- **Spaeter bei Bedarf:** In-Memory-Indizes fuer haeufige Queries

---

## Caching Strategy

### Unbounded In-Memory Cache

**Entscheidung:** Unbounded Cache fuer alle Entities + File-Watcher Invalidierung.

**Begruendung:**
- Typische Vault-Groesse: <1000 Entities gesamt
- Memory-Footprint: Vernachlaessigbar (JSON-Objekte)
- LRU-Cache waere Over-Engineering fuer diese Datenmenge

### Cache-Struktur

```typescript
interface EntityCache {
  // Map pro EntityType
  creatures: Map<EntityId<'creature'>, CreatureDefinition>;
  characters: Map<EntityId<'character'>, Character>;
  npcs: Map<EntityId<'npc'>, NPC>;
  // ... etc. fuer alle Entity-Typen
}
```

### Lifecycle

```
Plugin-Start
    │
    ├── Cache ist leer
    │
    ├── Erster Zugriff auf Entity-Typ
    │   └── Alle Entities dieses Typs aus Vault laden → Cache populieren
    │
    └── Nachfolgende Zugriffe
        └── Direkt aus Cache (O(1))
```

### Invalidierung via File-Watcher

Vault-Dateien koennen extern geaendert werden (anderer Editor, Git-Sync). File-Watcher stellt Cache-Konsistenz sicher.

```typescript
// Obsidian File-Watcher Integration
vault.on('modify', (file: TFile) => {
  if (file.path.startsWith('SaltMarcher/data/')) {
    const [entityType, entityId] = parseEntityPath(file.path);
    cache[entityType].delete(entityId);  // Invalidieren
    // Lazy Reload: Naechster Zugriff laedt frische Daten
  }
});

vault.on('delete', (file: TFile) => {
  if (file.path.startsWith('SaltMarcher/data/')) {
    const [entityType, entityId] = parseEntityPath(file.path);
    cache[entityType].delete(entityId);
  }
});
```

### Cache-Operationen

| Operation | Cache-Verhalten |
|-----------|-----------------|
| `get()` | Aus Cache lesen (lazy load falls nicht vorhanden) |
| `getAll()` | Alle aus Cache (lazy load falls Typ nicht geladen) |
| `save()` | Erst Vault schreiben, dann Cache aktualisieren |
| `delete()` | Erst Vault loeschen, dann aus Cache entfernen |
| File-Watcher Event | Cache fuer betroffene Entity invalidieren |

### Keine TTL / Expiration

- Cache-Entries haben keine Ablaufzeit
- Invalidierung erfolgt nur durch:
  1. Explizite `save()` / `delete()` Operationen
  2. File-Watcher Events (externe Aenderungen)
  3. Plugin-Reload (Cache wird geleert)

---

## Bootstrapping

Features erhalten EntityRegistryPort via Constructor Injection:

```typescript
// main.ts
const entityRegistry = new VaultEntityRegistryAdapter(app.vault, 'SaltMarcher');

const encounterFeature = new EncounterFeature(
  eventBus,
  entityRegistry,
  // ...
);

const npcFeature = new NPCFeature(
  eventBus,
  entityRegistry,
  // ...
);
```

---

## Error Handling

### Error Types

```typescript
class ValidationError extends Error {
  constructor(public zodError: ZodError) {
    super(`Validation failed: ${zodError.message}`);
  }
}

class NotFoundError extends Error {
  constructor(type: EntityType, id: string) {
    super(`Entity not found: ${type}/${id}`);
  }
}

class IOError extends Error {
  constructor(operation: 'read' | 'write' | 'delete', path: string, cause: Error) {
    super(`IO ${operation} failed for ${path}: ${cause.message}`);
  }
}
```

### Fehlerbehandlung

| Fehler-Typ | Strategie |
|------------|-----------|
| Validierung schlaegt fehl | Save abgelehnt, Error-Notification mit Details |
| Write fehlschlaegt | Retry 1x, dann Error-Notification, In-Memory-State bleibt |
| Read fehlschlaegt | Fallback auf Default oder leeren State |
| Entity nicht gefunden | NotFoundError zurueckgeben |

```typescript
// Beispiel-Nutzung
const result = entityRegistry.save('npc', npc);
if (result.isErr()) {
  if (result.error instanceof ValidationError) {
    notificationService.error(`NPC ungueltig: ${result.error.message}`);
  } else {
    notificationService.error(`NPC konnte nicht gespeichert werden`);
  }
}
```

---

## Entity-Deletion Cascades

Wenn Entities geloescht werden, muessen Referenzen beruecksichtigt werden.

### Deletion-Flow

```
entity:delete-requested
    │
    ├── EntityRegistry prueft Referenzen
    │   └── Alle Entity-Typen durchsuchen nach Referenzen auf zu loeschende Entity
    │
    ├── Referenzen gefunden?
    │   ├── JA → Modal: "Wird von X, Y referenziert. Trotzdem loeschen?"
    │   │        ├── User bestaetigt → Loeschen + Referenzen bereinigen
    │   │        └── User bricht ab → Deletion abgebrochen
    │   │
    │   └── NEIN → Entity direkt loeschen
    │
    └── entity:deleted (bei Erfolg) / entity:delete-failed (bei Abbruch)
```

### Referenz-Bereinigung (Soft-Cascade)

Wenn User das Loeschen trotz Referenzen bestaetigt:

| Referenzierte Entity | Referenz in | Bereinigung |
|---------------------|-------------|-------------|
| `creature` | `terrain.nativeCreatures[]` | Aus Array entfernen |
| `creature` | `encounter.creatureSlots[].creatureId` | Slot entfernen |
| `npc` | `shop.npcId` | Shop wird AUCH geloescht (Shop ohne NPC ist sinnlos) |
| `item` | `shop.inventory[].itemId` | Aus Inventar entfernen |
| `poi` | `faction.controlledPOIs[]` | Aus Array entfernen |
| `faction` | `npc.factionId` | NPC.factionId auf null setzen |

### Delete-Strategie

- **MVP:** Hard Delete (sofort aus Vault entfernt)
- **Post-MVP:** Soft Delete mit Papierkorb (30 Tage Aufbewahrung, dann endgueltig geloescht)

### Implementierung

```typescript
interface DeletionResult {
  deleted: boolean;
  references: EntityReference[];  // Gefundene Referenzen
  cascaded: EntityReference[];    // Bereinigte Referenzen (wenn geloescht)
}

interface EntityReference {
  entityType: EntityType;
  entityId: string;
  field: string;  // z.B. "nativeCreatures", "inventory"
}
```

---

## Ownership-Abgrenzung

### EntityRegistry vs StoragePort vs Feature-State

| Daten | Speicherung | Beispiel |
|-------|-------------|----------|
| Entity-Definitionen | EntityRegistry | Creature-Templates, Items, NPCs |
| Feature-spezifische persistente Daten | StoragePort | Map-Tiles, aktive Routes |
| Feature Runtime-State | Feature-State (nicht persistiert) | Combat-Instanzen, Weather |
| Session-temporaere Daten | Feature-State (nicht persistiert) | Party-Members |

### Beispiele

```
Creature-Template "goblin-warrior"
  → EntityRegistry (persistente Definition)

Goblin-Instanz im Combat
  → Combat-Feature State (temporaer, referenziert Template)

Map-Tile Terrain-Daten
  → Map-Feature StoragePort (persistiert, aber Feature-spezifisch)

Aktuelles Wetter
  → Weather-Feature State (computed, nicht persistiert)
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| EntityRegistryPort Interface | ✓ | | Core-Definition |
| VaultEntityRegistryAdapter | ✓ | | JSON-File-basiert |
| Zod-Validierung | ✓ | | Bei jedem Save |
| Predicate-Queries | ✓ | | Lineare Suche |
| Pessimistisches Speichern | ✓ | | Sofort bei Aenderung |
| In-Memory-Indizes | | niedrig | Performance-Optimierung |
| Schema-Migration | | niedrig | Automatische Updates |
| **path Entity-Typ** | | ✓ | Lineare Features (→ docs/domain/Path.md) |

---

*Siehe auch: [Features.md](Features.md) | [Infrastructure.md](Infrastructure.md) | [Core.md](Core.md) | [Path.md](../domain/Path.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1417 | 🔶 | Faction | features | Faction EntityRegistry Integration: 'faction' als Entity-Typ | hoch | Ja | #1400 | EntityRegistry.md#entity-type-mapping, Faction.md#schema | src/core/schemas/common.ts:46 (EntityType enum enthält 'faction') |
| 1516 | ✅ | Location/POI | features | POI EntityRegistry Integration: 'location'/'poi' als Entity-Typ (bereits vorhanden) | hoch | Ja | - | POI.md#schema, EntityRegistry.md#port-interface, EntityRegistry.md#entity-type-mapping | src/core/types/common.ts:20-21, src/core/schemas/common.ts:49-50 |
| 2800 | ✅ | Core/EntityRegistry | core | EntityRegistryPort Interface (get, getAll, query, save, delete, exists, count) | hoch | Ja | #2703 | EntityRegistry.md#port-interface, Core.md#branded-types | src/core/types/entity-registry.port.ts:EntityRegistryPort, Entity<T>, EntityTypeMap |
| 2801 | 🔶 | Core/EntityRegistry | core | EntityTypeMap mit allen 14 MVP Entity-Typen (creature, character, npc, faction, item, map, poi, terrain, quest, encounter, shop, calendar, journal, worldevent, track) | hoch | Ja | - | EntityRegistry.md#entity-type-mapping, Core.md#entitytype-union | src/core/types/common.ts:EntityType (18 Typen inkl. location, maplink, party), src/core/schemas/common.ts:entityTypeSchema - Mismatch: Spec sagt 14 MVP-Typen, Code hat 18 |
| 2802 | ✅ | Core/EntityRegistry | core | VaultEntityRegistryAdapter Implementation (JSON-File-basiert mit Vault/{plugin}/data/{entityType}/{id}.json) | hoch | Ja | - | EntityRegistry.md#storage, Infrastructure.md#adapter-pattern | src/infrastructure/vault/entity-registry.adapter.ts:createVaultEntityRegistryAdapter(), EntityCache, loadEntityType(), saveEntity(), deleteEntity() |
| 2803 | ⬜ | Core/EntityRegistry | core | Zod-Validierung bei save() mit getSchemaForType() | hoch | Ja | #2802 | EntityRegistry.md#validierung, Core.md#zod-schemas | src/infrastructure/vault/entity-registry.adapter.ts:save() [ändern], [neu] src/core/schemas/index.ts:getSchemaForType() - nutzt existierende Schemas aus src/core/schemas/ |
| 2804 | ✅ | Core/EntityRegistry | core | Predicate-basierte query() Methode (Lineare Suche für MVP) | hoch | Ja | - | EntityRegistry.md#querying | src/infrastructure/vault/entity-registry.adapter.ts:query() |
| 2805 | ✅ | Core/EntityRegistry | core | Unbounded In-Memory Cache mit Map pro EntityType | hoch | Ja | - | EntityRegistry.md#caching-strategy | src/infrastructure/vault/entity-registry.adapter.ts:EntityCache [neu - private interface], ensureCacheLoaded() [neu] |
| 2806 | ⬜ | Core/EntityRegistry | core | Lazy Loading: Cache-Population bei erstem Zugriff auf Entity-Typ | hoch | Ja | #2805 | EntityRegistry.md#lifecycle | src/infrastructure/vault/entity-registry.adapter.ts:get() [ändern], getAll() [ändern] - beide rufen ensureCacheLoaded() auf |
| 2807 | ⬜ | Core/EntityRegistry | core | File-Watcher Invalidierung bei modify/delete Events | hoch | Ja | #2805 | EntityRegistry.md#caching-strategy, Infrastructure.md#file-watcher-integration | src/infrastructure/vault/entity-registry.adapter.ts:registerFileWatcher() [neu], invalidateFromPath() [neu] - Obsidian vault.on('modify'/'delete') Events |
| 2808 | ⬜ | Core/EntityRegistry | core | Pessimistisches Speichern (sofort bei save(), erst Vault dann Cache) | hoch | Ja | #2802, #2805 | EntityRegistry.md#persistence-timing, Infrastructure.md#state-persistenz | src/infrastructure/vault/entity-registry.adapter.ts:save() [ändern] - 1. Vault write, 2. Cache update, 3. Return Result |
| 2809 | ⛔ | Core/EntityRegistry | core | Error Handling: ValidationError, NotFoundError, IOError Klassen | hoch | Ja | #2803 | EntityRegistry.md#error-handling, Error-Handling.md | [neu] src/core/types/entity-registry-errors.ts:ValidationError, NotFoundError, IOError (extends Error) |
| 2810 | ⬜ | Core/EntityRegistry | core | Entity-Deletion Cascades: Referenz-Prüfung und Soft-Cascade Bereinigung | mittel | Ja | #2802 | EntityRegistry.md#entity-deletion-cascades | src/infrastructure/vault/entity-registry.adapter.ts:delete() [ändern], checkReferences() [neu], confirmDeletionDialog() [neu - UI-Integration], cascadeCleanup() [neu] |
| 2811 | ⬜ | Core/EntityRegistry | core | Constructor Injection: Features erhalten EntityRegistryPort via Constructor | hoch | Ja | #2800, #2802 | EntityRegistry.md#bootstrapping, Features.md#feature-communication | src/main.ts:onload() [ändern - bootstrapFeatures()], Feature-Constructors [ändern - entityRegistry-Parameter hinzufügen] |
| 2815 | ✅ | Core/EntityRegistry | core | CreatureDefinition vs Creature vs NPC Hierarchie dokumentieren und implementieren | hoch | Ja | - | EntityRegistry.md#creature-hierarchie-definition-vs-instanz-vs-npc, Creature.md, NPC-System.md | src/core/schemas/creature.ts:CreatureDefinition (existiert), [neu] src/core/types/creature.ts:Creature (Runtime-Instanz - nicht in Registry), src/core/schemas/npc.ts:NPC (existiert mit CreatureRef) - Hierarchie ist implementiert aber nicht dokumentiert |
| 2817 | ⬜ | Core/EntityRegistry | core | In-Memory-Indizes für häufige Queries (Post-MVP Performance-Optimierung) | niedrig | Nein | #2804 | EntityRegistry.md#prioritaet | [neu] src/infrastructure/vault/entity-registry.adapter.ts:buildIndices(), IndexConfig, queryWithIndex() |
| 2818 | ⛔ | Core/EntityRegistry | core | Schema-Migration System für automatische Updates (Post-MVP) | niedrig | Nein | #2803 | EntityRegistry.md#keine-backwards-migration | [neu] src/infrastructure/vault/schema-migration.ts:MigrationRunner, Migration interface, migrationRegistry |
| 2942 | ✅ | Core/EntityRegistry | core | EntityRegistry Bootstrap: preloadEntityTypes() in main.ts vor Feature-Init | hoch | Ja | - | EntityRegistry.md#bootstrapping | - |
| 2943 | ⬜ | Core/EntityRegistry | core | save() auf Vault-Write warten (pessimistic save-first) | hoch | Ja | #2802 | EntityRegistry.md#persistence-timing | - |
| 2944 | ⛔ | Core/EntityRegistry | core | save() I/O-Fehler an Caller propagieren | hoch | Ja | #2943 | EntityRegistry.md#error-handling | - |
