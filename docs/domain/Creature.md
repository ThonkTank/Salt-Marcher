# Creature

> **Lies auch:** [EntityRegistry](../architecture/EntityRegistry.md)
> **Wird benoetigt von:** Encounter, Combat, NPC-System

Single Source of Truth fuer Creature-Definitionen und die Drei-Stufen-Hierarchie.

**Design-Philosophie:** CreatureDefinition ist ein wiederverwendbares Template. Instanzen entstehen zur Runtime (Combat) oder als persistente NPCs.

---

## Uebersicht

Das Creature-System unterscheidet drei Abstraktionsebenen:

```
CreatureDefinition (Template)
    │
    ├── Creature (Runtime-Instanz)
    │   └── Temporaer waehrend Encounter/Combat
    │
    └── NPC (Persistente Instanz)
        └── Benannte Kreatur mit Geschichte
```

---

## Drei-Stufen-Hierarchie

| Begriff | Bedeutung | Persistenz | Beispiel |
|---------|-----------|------------|----------|
| `CreatureDefinition` | Template/Statblock | **EntityRegistry** | "Goblin", CR 1/4, 7 HP |
| `Creature` | Instanz in Encounter/Combat | **Runtime** (nicht persistiert) | "Goblin #1", aktuell 5 HP |
| `NPC` | Benannte persistente Instanz | **EntityRegistry** | "Griknak", Persoenlichkeit |

---

## Schema

### CreatureDefinition

Template fuer Monster und NPCs - reine Spielwerte und Encounter-Praeferenzen:

```typescript
interface CreatureDefinition {
  id: EntityId<'creature'>;
  name: string;                           // "Goblin"

  // Basis-Statistiken
  cr: number;                             // Challenge Rating
  maxHp: number;
  ac: number;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

  // Kategorisierung
  tags: string[];                         // ["humanoid", "goblinoid"]
  disposition: 'hostile' | 'neutral' | 'friendly';

  // Encounter-System: Wo/Wann erscheint diese Kreatur?
  terrainAffinities: EntityId<'terrain'>[];   // In welchen Terrains heimisch
  activeTime: TimeSegment[];                   // 'dawn' | 'day' | 'dusk' | 'night'

  // Gewichtungs-Praeferenzen (Optional, fuer Feinsteuerung)
  preferences?: CreaturePreferences;

  // Loot-System
  lootTags: string[];                     // ["humanoid", "poor", "tribal"]
  defaultLoot?: DefaultLootEntry[];       // Garantiertes/wahrscheinliches Loot

  // D&D 5e Statblock (komplett)
  abilities: AbilityScores;
  skills?: SkillProficiencies;
  savingThrows?: SavingThrowProficiencies;
  resistances?: DamageType[];
  immunities?: DamageType[];
  conditionImmunities?: Condition[];
  senses?: Senses;
  languages?: string[];
  speed: SpeedBlock;

  // Aktionen
  actions?: Action[];
  reactions?: Action[];
  legendaryActions?: LegendaryAction[];

  // Metadaten
  description?: string;
  source?: string;                        // "Monster Manual, p. 166"
}

type TimeSegment = 'dawn' | 'day' | 'dusk' | 'night';

interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

interface SpeedBlock {
  walk: number;
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
}

// Sinne (fuer Encounter-Trigger und Visibility)
interface Senses {
  passivePerception: number;   // Fuer Stealth-Checks
  darkvision?: number;         // Range in Feet (60, 120, etc.)
  blindsight?: number;         // Range in Feet
  tremorsense?: number;        // Range in Feet
  trueSight?: number;          // Range in Feet
}

// Loot-System (NEU)
interface DefaultLootEntry {
  itemId: EntityId<'item'>;
  chance: number;                  // 0.0-1.0 (1.0 = garantiert)
  quantity?: number | [min: number, max: number];
}
```

### DefaultLoot

Creatures koennen garantiertes oder wahrscheinliches Loot haben.

```typescript
// Wolf: Pelz garantiert, Zaehne 30%
const wolf: CreatureDefinition = {
  // ... Basis-Stats ...
  lootTags: ['beast'],
  defaultLoot: [
    { itemId: 'wolf-pelt', chance: 1.0 },
    { itemId: 'wolf-fang', chance: 0.3, quantity: [1, 2] }
  ]
};

// Ritter: Volle Ausruestung
const knight: CreatureDefinition = {
  // ... Basis-Stats ...
  lootTags: ['humanoid', 'wealthy'],
  defaultLoot: [
    { itemId: 'longsword', chance: 1.0 },
    { itemId: 'plate-armor', chance: 1.0 },
    { itemId: 'gold-piece', chance: 1.0, quantity: [10, 50] }
  ]
};
```

**Verarbeitung bei Encounter:**

1. Fuer jede Creature: defaultLoot wuerfeln (`Math.random() < entry.chance`)
2. Soft-Cap pruefen: Bei hohen Budget-Schulden teure Items weglassen
3. Items der Creature zuweisen (kann im Kampf genutzt werden)
4. Budget belasten

→ Details: [Loot-Feature.md](../features/Loot-Feature.md#creature-default-loot)

### CreaturePreferences

Optionale Gewichtungs-Modifikatoren fuer das Encounter-System:

```typescript
interface CreaturePreferences {
  // Terrain-Gewichtung: 1.0 = normal, 2.0 = bevorzugt, 0.5 = selten
  terrain?: Record<EntityId<'terrain'>, number>;

  // Tageszeit-Gewichtung
  timeOfDay?: Record<TimeSegment, number>;

  // Wetter-Gewichtung
  weather?: Record<WeatherCondition, number>;

  // Hoehenbereich (fuer Berg-Kreaturen)
  altitude?: { min: number; max: number };
}
```

**Gewichtungs-System:**
| Wert | Bedeutung |
|------|-----------|
| `2.0` | Bevorzugt - doppelte Wahrscheinlichkeit |
| `1.0` | Normal - Standard-Wahrscheinlichkeit |
| `0.5` | Selten - halbe Wahrscheinlichkeit |
| `0` | Nie - erscheint nicht unter dieser Bedingung |

### Creature (Runtime)

Temporaere Instanz waehrend Encounter/Combat - **NICHT** im EntityRegistry:

```typescript
// Existiert NUR im Feature-State (Combat, Encounter)
interface Creature {
  instanceId: string;                     // Eindeutige Runtime-ID
  definitionId: EntityId<'creature'>;     // Referenz auf Template

  // Aktueller Zustand
  currentHp: number;
  tempHp: number;
  conditions: Condition[];

  // Combat-State
  initiative?: number;
  hasActed: boolean;
  concentrationSpell?: string;

  // Position (falls auf Grid)
  position?: GridCoordinate;
}
```

### NPC

Benannte, persistente Kreatur mit Persoenlichkeit - siehe [NPC-System.md](NPC-System.md):

```typescript
interface NPC {
  id: EntityId<'npc'>;
  creature: CreatureRef;                  // Referenz auf Statblock
  name: string;                           // "Griknak der Hinkende"
  personality: PersonalityTraits;
  factionId: EntityId<'faction'>;         // Required: Jeder NPC gehoert zu Faction
  status: 'alive' | 'dead';
  currentPOI?: EntityId<'poi'>;           // Aktueller Aufenthaltsort

  // Tracking
  firstEncounter: GameDateTime;
  lastEncounter: GameDateTime;
  encounterCount: number;
}

interface CreatureRef {
  type: string;                           // Kreatur-Typ (z.B. "goblin")
  id: EntityId<'creature'>;               // Verweis auf Template
}
```

---

## Terrain-Affinitaet und Auto-Sync

### Bidirektionale Beziehung

Kreaturen und Terrains haben eine bidirektionale Beziehung:

```
creature.terrainAffinities[] ←→ terrain.nativeCreatures[]
```

| Feld | Zweck |
|------|-------|
| `creature.terrainAffinities` | Fuer GM: "Wo lebt diese Kreatur?" |
| `terrain.nativeCreatures` | Fuer System: Schnelles Encounter-Matching |

### Auto-Sync Verhalten

Das System synchronisiert automatisch:

```typescript
// Wenn GM creature.terrainAffinities aendert:
// → System aktualisiert automatisch terrain.nativeCreatures

// Wenn GM terrain.nativeCreatures aendert:
// → System aktualisiert automatisch creature.terrainAffinities
```

**Vorteil:** GM muss nur eine Stelle editieren. System haelt beide Seiten konsistent.

---

## Verwendung in anderen Features

### Encounter-Feature

Creature-Selection basiert auf:

1. **Filter (Hard Requirements):**
   - `creature.terrainAffinities` enthaelt aktuelles Terrain
   - `creature.activeTime` enthaelt aktuelles Zeit-Segment

2. **Gewichtung (Soft Preferences):**
   - `creature.preferences.weather` modifiziert Wahrscheinlichkeit
   - `creature.preferences.terrain` fuer Feinsteuerung
   - Fraktions-Praesenz multipliziert Gewichtung

→ Details: [Encounter-System.md](../features/Encounter-System.md)

### Combat-Feature

Combat erstellt `Creature` Runtime-Instanzen aus `CreatureDefinition`:

```typescript
function createCombatCreature(definition: CreatureDefinition): Creature {
  return {
    instanceId: generateId(),
    definitionId: definition.id,
    currentHp: definition.maxHp,
    tempHp: 0,
    conditions: [],
    hasActed: false
  };
}
```

→ Details: [Combat-System.md](../features/Combat-System.md)

### Loot-Feature

`creature.lootTags` bestimmen moegliche Beute:

```typescript
// Goblin mit tags: ["humanoid", "poor", "tribal"]
// → Generiert: einfache Waffen, wenig Gold, Stammesschmuck
```

→ Details: [Loot-Feature.md](../features/Loot-Feature.md)

---

## Sinne (Post-MVP)

Sinnes-Faehigkeiten fuer Kreaturen (NPCs, Monster).

### Verwendung

| Verwendung | Beschreibung |
|------------|--------------|
| **Encounter-Trigger** | Creature-Sichtweite bestimmt wann Party entdeckt wird |
| **Passive Perception** | Fuer Stealth-Checks der Party |
| **NPC-Patrouillen** | Erkennung der Party bei Annaeherung |

### Creature-Sicht vs Party-Sicht

| Aspekt | Party | Creature |
|--------|-------|----------|
| **Overlay** | Grau (nicht sichtbar) | Nicht visualisiert |
| **Verwendung** | GM-Tool | Encounter-Trigger |
| **Berechnung** | Auf Klick/Bewegung | Bei Party-Annaeherung |

### Sinn-Typen

| Sinn | Effekt |
|------|--------|
| **Passive Perception** | Basis-DC fuer Stealth-Checks |
| **Darkvision** | Erkennt Party auch bei Nacht |
| **Blindsight** | Ignoriert Sicht-Modifier |
| **Tremorsense** | Erkennt Bewegung unabhaengig von Sicht |
| **True Sight** | Sieht durch Unsichtbarkeit |

→ **Visibility-System:** [Map-Feature.md](../features/Map-Feature.md#visibility-system)

---

## Storage

```
Vault/SaltMarcher/data/
├── creature/                    # CreatureDefinitions (Templates)
│   ├── _bundled/               # Mitgelieferte Kreaturen
│   │   ├── goblin.json
│   │   └── wolf.json
│   └── user/                   # User-erstellte Kreaturen
│       └── custom-beast.json
└── npc/                        # Persistente NPCs
    └── griknak.json
```

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| CreatureDefinition Schema | ✓ | | Kern-Entity |
| Basis-Statistiken (CR, HP, AC) | ✓ | | D&D 5e Statblock |
| terrainAffinities | ✓ | | Encounter-Filter |
| activeTime | ✓ | | Tageszeit-Filter |
| preferences (Gewichtung) | ✓ | | Feinsteuerung |
| lootTags | ✓ | | Loot-Integration |
| Auto-Sync mit Terrain | ✓ | | Bidirektionale Konsistenz |
| Vollstaendiger Statblock | | mittel | Alle D&D 5e Felder |
| Legendary Actions | | niedrig | Fuer Boss-Monster |
| **Sinne fuer Encounter-Trigger** | | mittel | Creature-Sichtweite |

---

*Siehe auch: [NPC-System.md](NPC-System.md) | [Encounter-System.md](../features/Encounter-System.md) | [Terrain.md](Terrain.md) | [EntityRegistry.md](../architecture/EntityRegistry.md)*
