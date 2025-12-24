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
  defaultLoot?: DefaultLootEntry[];       // Garantiertes/wahrscheinliches Loot (Harvestable)
  carriesLoot?: boolean;                  // Traegt Carried Loot? Default: true (humanoid), false (beast)
  stashLocationHint?: string;             // Hinweis auf Hoard-Location, z.B. "Drachenhoehle"

  // Detection-Profil (REQUIRED fuer Encounter-System)
  detectionProfile: CreatureDetectionProfile;

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

// Detection-Profil (REQUIRED - Kreatur kann ohne nicht erstellt werden)
interface CreatureDetectionProfile {
  // Wie leicht ist die Kreatur zu entdecken?
  noiseLevel: 'silent' | 'quiet' | 'normal' | 'loud' | 'deafening';
  scentStrength: 'none' | 'faint' | 'moderate' | 'strong' | 'overwhelming';

  // Kann die Kreatur Wahrnehmung umgehen?
  stealthAbilities?: StealthAbility[];
}

type StealthAbility =
  | 'burrowing'      // Kann unter der Erde reisen
  | 'invisibility'   // Kann unsichtbar werden
  | 'ethereal'       // Auf anderer Ebene
  | 'shapechange'    // Kann harmlose Form annehmen
  | 'mimicry'        // Kann Gerausche imitieren
  | 'ambusher';      // Hat Ambush-Verhalten

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

### Loot-Kategorien

Creatures haben drei verschiedene Loot-Quellen:

| Kategorie | Feld | Beschreibung |
|-----------|------|--------------|
| **Carried** | `carriesLoot` | Was die Kreatur bei sich traegt (Muenzen, Waffen) |
| **Harvestable** | `defaultLoot` | Vom Koerper gewinnbar (Schuppen, Pelz) |
| **Stashed** | `stashLocationHint` | An einem anderen Ort (Hoard, Lager) |

**carriesLoot:**

| Kreatur-Typ | Default | Beispiel |
|-------------|:-------:|----------|
| Humanoid | `true` | Goblin, Bandit, Haendler |
| Beast | `false` | Wolf, Baer, Drache |
| Construct | `false` | Golem, Animated Armor |

**stashLocationHint:**

Freitext-Verweis auf einen Ort, an dem die Kreatur einen Hoard hat:

```typescript
const adultRedDragon: CreatureDefinition = {
  name: "Adult Red Dragon",
  lootTags: ["dragon", "hoard"],
  carriesLoot: false,              // Traegt nichts bei sich
  defaultLoot: [                   // Harvestable
    { itemId: "dragon-scale", chance: 1.0, quantity: [10, 20] },
    { itemId: "dragon-blood", chance: 1.0 },
    { itemId: "dragon-heart", chance: 0.5 },
  ],
  stashLocationHint: "Hoehle im Feuerberg"  // Verweis auf Hoard
};
```

→ Details: [Loot-Feature.md](../features/Loot-Feature.md#loot-kategorien)

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

## Design-Rollen (MCDM-basiert)

Design-Rollen sind abgeleitete Tags, die bei der Creature-Erstellung aus dem Statblock automatisch bestimmt werden. Sie ermoeglichen **automatisiertes Encounter-Balancing**.

### Rollen-Uebersicht

| Rolle | Beschreibung | Ableitungs-Hinweise |
|-------|--------------|---------------------|
| **Ambusher** | Stealth + Surprise | Stealth prof, Sneak Attack |
| **Artillery** | Fernkampf bevorzugt | Ranged > Melee, Range-Spells |
| **Brute** | Hohe HP, hoher Schaden | HP ueber CR-Durchschnitt |
| **Controller** | Debuffs, Crowd Control | AoE, Conditions, Forced Movement |
| **Leader** | Kaempft mit Untergebenen | Buff-Auras, Command-Abilities |
| **Minion** | Schwach, Horde-tauglich | CR < 1, keine Multiattack |
| **Skirmisher** | Mobil, Hit-and-Run | Hohe Speed, Disengage |
| **Soldier** | Hohe AC, Tank | AC ueber Durchschnitt |
| **Solo** | Kaempft alleine | Legendary Actions |
| **Support** | Buffs, Healing | Healing, Buff-Abilities |

### Ableitung aus Statblock

Die Rolle wird bei Creature-Erstellung automatisch abgeleitet und als Tag gespeichert:

```typescript
// Grobe Ableitungs-Logik (Details bei Implementierung)
function deriveDesignRole(creature: CreatureDefinition): DesignRole {
  // Solo: Hat Legendary Actions
  if (creature.legendaryActions?.length > 0) return 'solo';

  // Minion: Schwach, keine Multiattack
  if (creature.cr < 1 && !hasMultiattack(creature)) return 'minion';

  // Leader: Hat Buff-Auren oder Command-Abilities
  if (hasBuffAbilities(creature)) return 'leader';

  // Artillery: Mehr Ranged als Melee
  if (prefersFernkampf(creature)) return 'artillery';

  // Brute: HP ueber CR-Durchschnitt
  if (creature.maxHp > getAverageHpForCr(creature.cr) * 1.2) return 'brute';

  // Soldier: AC ueber Durchschnitt
  if (creature.ac > getAverageAcForCr(creature.cr)) return 'soldier';

  // Skirmisher: Hohe Speed oder Disengage
  if (creature.speed.walk >= 40 || hasDisengage(creature)) return 'skirmisher';

  // Controller: AoE oder Condition-Abilities
  if (hasControlAbilities(creature)) return 'controller';

  // Support: Healing oder Buff-Abilities
  if (hasSupportAbilities(creature)) return 'support';

  // Ambusher: Stealth-Proficiency oder Sneak Attack
  if (hasStealthProficiency(creature) || hasSneakAttack(creature)) return 'ambusher';

  // Fallback
  return 'soldier';
}
```

### Speicherung

Die abgeleitete Rolle wird im `tags`-Array gespeichert:

```typescript
const goblin: CreatureDefinition = {
  name: "Goblin",
  tags: ["humanoid", "goblinoid", "minion"],  // ← Design-Rolle als Tag
  // ...
};

const youngDragon: CreatureDefinition = {
  name: "Young Red Dragon",
  tags: ["dragon", "solo"],  // ← Design-Rolle als Tag
  // ...
};
```

### Verwendung in Encounter-Templates

Encounter-Templates koennen Design-Rollen direkt als Slot-Anforderung nutzen:

```typescript
// Template fuer balancierten Kampf
{
  id: "balanced-combat",
  roles: {
    frontline: { count: { min: 1, max: 2 }, budgetPercent: 40, designRole: 'soldier' },
    damage: { count: { min: 1, max: 2 }, budgetPercent: 40, designRole: 'artillery' },
    support: { count: { min: 0, max: 1 }, budgetPercent: 20, designRole: 'support' }
  }
}
```

→ **Encounter-Templates:** [Encounter-System.md](../features/Encounter-System.md#encounter-templates)

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

## Detection-Profil

Das `detectionProfile` ist ein **REQUIRED** Feld auf jeder CreatureDefinition. Es bestimmt wie leicht die Kreatur von der Party entdeckt werden kann.

### Noise Level

Laute Kreaturen koennen aus groesserer Entfernung gehoert werden:

| Noise Level | Basis-Range | Bei Wind/Regen | Beispiele |
|-------------|-------------|----------------|-----------|
| `silent` | 0ft | 0ft | Geister, Schleicher |
| `quiet` | 30ft | 15ft | Katzen, Assassinen |
| `normal` | 60ft | 30ft | Menschen, Woelfe |
| `loud` | 200ft | 100ft | Orks, Baeren, Ruestungen |
| `deafening` | 500ft | 250ft | Drachen, Riesen, Armeen |

### Scent Strength

Stark riechende Kreaturen koennen von Party-Mitgliedern mit gutem Geruchssinn oder unter speziellen Bedingungen entdeckt werden:

| Scent Strength | Basis-Range | Bei starkem Wind/Regen | Beispiele |
|----------------|-------------|------------------------|-----------|
| `none` | 0ft | 0ft | Konstrukte, Geister |
| `faint` | 30ft | 0ft | Elfen, Barden |
| `moderate` | 60ft | 30ft | Menschen, Goblins |
| `strong` | 150ft | 75ft | Trolle, Gnolls, Vieh |
| `overwhelming` | 300ft | 150ft | Troglodyten, Otyughs, Aas |

**Hinweis:** Keine Windrichtung - Wind-Staerke reduziert generell (wie bei Audio).

### Stealth Abilities

Spezielle Faehigkeiten die Entdeckung erschweren:

| Ability | Effekt |
|---------|--------|
| `burrowing` | Visuell: 0ft, Audio: normal, Tremorsense kann entdecken |
| `invisibility` | Visuell: 0ft, andere Sinne normal |
| `ethereal` | Alle: 0ft, nur True Sight kann entdecken |
| `shapechange` | Keine auto-Detection, muss manuell erkannt werden |
| `mimicry` | Audio-Detection kann fehlgeleitet werden |
| `ambusher` | Loest Ambush-Check aus (Stealth vs Passive Perception) |

### Stealth-Ability Prioritaet

Bei mehreren StealthAbilities gilt die staerkste. Die Prioritaet ist:

```typescript
const STEALTH_PRIORITY: StealthAbility[] = [
  'ethereal',      // 1. Hoechste - auf anderer Ebene
  'invisibility',  // 2. Unsichtbar
  'burrowing',     // 3. Unter der Erde
  'shapechange',   // 4. Kann Form aendern
  'mimicry',       // 5. Kann Gerausche imitieren
  'ambusher',      // 6. Niedrigste - nur Ambush-Check
];

function getPrimaryStealthAbility(
  abilities: StealthAbility[]
): StealthAbility | undefined {
  for (const ability of STEALTH_PRIORITY) {
    if (abilities.includes(ability)) return ability;
  }
  return undefined;
}
```

**Beispiel:** Eine Kreatur mit `['burrowing', 'invisibility']` wird als `invisibility` behandelt (staerker).

### Beispiele

```typescript
// Wolf - normal laut, starker Geruch, ambusher
const wolf: CreatureDefinition = {
  // ... Basis-Stats ...
  detectionProfile: {
    noiseLevel: 'normal',
    scentStrength: 'strong',
    stealthAbilities: ['ambusher']
  }
};

// Geist - silent, kein Geruch, ethereal
const ghost: CreatureDefinition = {
  // ... Basis-Stats ...
  detectionProfile: {
    noiseLevel: 'silent',
    scentStrength: 'none',
    stealthAbilities: ['ethereal']
  }
};

// Ork-Armee - sehr laut, stark riechend
const orcWarband: CreatureDefinition = {
  // ... Basis-Stats ...
  detectionProfile: {
    noiseLevel: 'deafening',
    scentStrength: 'strong'
  }
};
```

→ **Multi-Sense Detection:** [Encounter-System.md](../features/Encounter-System.md#multi-sense-detection)

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
| **detectionProfile (REQUIRED)** | ✓ | | Multi-Sense Detection |
| Vollstaendiger Statblock | | mittel | Alle D&D 5e Felder |
| Legendary Actions | | niedrig | Fuer Boss-Monster |
| **Sinne fuer Encounter-Trigger** | | mittel | Creature-Sichtweite |

---

*Siehe auch: [NPC-System.md](NPC-System.md) | [Encounter-System.md](../features/Encounter-System.md) | [Terrain.md](Terrain.md) | [EntityRegistry.md](../architecture/EntityRegistry.md)*

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 1200 | ⛔ | Creature | core | CreatureDefinition Schema: Vollständiges Interface implementieren | hoch | Ja | #2703, #2949, #2950, #1205, #1206, #1207, #1208, #1209 | Creature.md#schema, EntityRegistry.md#creature-hierarchie-definition-vs-instanz-vs-npc | src/core/schemas/creature.ts:creatureDefinitionSchema |
| 1201 | ✅ | Creature | core | Basis-Statistiken: CR, HP, AC, Size | hoch | Ja | #1200 | Creature.md#creaturedefinition | src/core/schemas/creature.ts:creatureDefinitionSchema (Zeile 112-121) |
| 1202 | ✅ | Creature | core | terrainAffinities: Array von Terrain-IDs | hoch | Ja | #1200, #1700 | Creature.md#creaturedefinition, Terrain.md#schema | src/core/schemas/creature.ts:creatureDefinitionSchema (Zeile 134) |
| 1203 | ✅ | Creature | core | activeTime: TimeSegment-Array (dawn, day, dusk, night) | hoch | Ja | #1200 | Creature.md#creaturedefinition, Encounter-System.md#tile-eligibility | src/core/schemas/creature.ts:creatureDefinitionSchema (Zeile 137) |
| 1204 | ✅ | Creature | core | lootTags: String-Array für Loot-System | hoch | Ja | #1200 | Creature.md#creaturedefinition, Loot-Feature.md#loot-tags | src/core/schemas/creature.ts:creatureDefinitionSchema (Zeile 145) |
| 1205 | ✅ | Creature | core | DefaultLootEntry Interface: itemId, chance, quantity | hoch | Ja | - | Creature.md#defaultloot, Item.md#schema | [neu] src/core/schemas/creature.ts:defaultLootEntrySchema |
| 1206 | ✅ | Creature | core | defaultLoot Array: Garantiertes/wahrscheinliches Loot | hoch | Ja | - | Creature.md#defaultloot, Loot-Feature.md#creature-default-loot | [neu] src/core/schemas/creature.ts:creatureDefinitionSchema |
| 1207 | ✅ | Creature | core | CreaturePreferences Interface: Gewichtungs-Modifikatoren | hoch | Ja | #1200 | Creature.md#creaturepreferences, Encounter-System.md#tile-eligibility | src/core/schemas/creature.ts:creaturePreferencesSchema (Zeile 73-92) |
| 1208 | ✅ | Creature | core | AbilityScores Interface: STR, DEX, CON, INT, WIS, CHA | hoch | Ja | #1200 | Creature.md#creaturedefinition, Combat-System.md#schemas | src/core/schemas/creature.ts:abilityScoresSchema (Zeile 45-52) |
| 1209 | ✅ | Creature | core | SpeedBlock Interface: walk, fly, swim, climb, burrow | hoch | Ja | #1200 | Creature.md#creaturedefinition | src/core/schemas/creature.ts:speedBlockSchema (Zeile 59-65) |
| 1210 | ⛔ | Creature | core | Senses Interface: passivePerception, darkvision, blindsight, etc. | mittel | Nein | #1200 | Creature.md#creaturedefinition, Creature.md#sinne-post-mvp | [neu] src/core/schemas/creature.ts:sensesSchema |
| 1211 | ✅ | Creature | core | Creature Runtime Interface: instanceId, currentHp, tempHp, conditions | hoch | Ja | #1200 | Creature.md#creature-runtime, Combat-System.md#schemas | src/core/schemas/creature.ts:creatureInstanceSchema (Zeile 183-211) |
| 1212 | ⛔ | Creature | features | Auto-Sync: creature.terrainAffinities ← terrain.nativeCreatures bidirektional | hoch | Ja | #1202, #1700 | Creature.md#auto-sync-verhalten, Terrain.md#auto-sync-mechanismus | [neu] src/features/creature/auto-sync.ts:syncCreatureToTerrain() |
| 1214 | ✅ | Creature | features | Encounter Integration: filterEligibleCreatures() | hoch | Ja | #200, #1202, #1203 | Creature.md#encounter-feature, Encounter-System.md#tile-eligibility | src/features/encounter/encounter-utils.ts:filterEligibleCreatures() (Zeile 45-61) |
| 1215 | ✅ | Creature | features | Combat Integration: createCombatCreature() Factory | hoch | Ja | #300, #1211 | Creature.md#combat-feature, Combat-System.md#schemas | src/features/combat/combat-utils.ts:createCombatCreature() (Zeile 90-99), createParticipantFromCreature() (Zeile 108-125) |
| 1216 | ⛔ | Creature | features | Loot Integration: defaultLoot Processing bei Encounter | hoch | Ja | #215, #705, #1206 | Creature.md#defaultloot, Loot-Feature.md#creature-default-loot, Encounter-System.md#schemas | src/features/loot/loot-utils.ts:mergeLootTags() (Zeile 130-145 nutzt nur lootTags), [neu] src/features/loot/loot-utils.ts:processDefaultLoot() |
| 1217 | ⛔ | Creature | infrastructure | Storage: creature/ und npc/ Verzeichnisse | hoch | Ja | #1200, #1300, #2802 | Creature.md#storage, EntityRegistry.md#storage, NPC-System.md#npc-schema | [neu] src/infrastructure/vault-entity-registry.adapter.ts (creature/npc-Verzeichnis-Setup) |
| 1218 | ⛔ | Creature | infrastructure | Bundled Creatures: Mitgelieferte Basis-Kreaturen (_bundled/) | mittel | Ja | #1217 | Creature.md#storage | presets/creatures/base-creatures.json (8 creatures vorhanden, aber Vault-Integration fehlt) |
| 1219 | ⛔ | Creature | core | Vollständiger D&D 5e Statblock: Skills, Saves, Resistances, etc. | mittel | Nein | #1200 | Creature.md#creaturedefinition | src/core/schemas/creature.ts:creatureDefinitionSchema (actions vorhanden Zeile 159, aber Skills/Saves/Resistances fehlen) [neu] skillProficienciesSchema, savingThrowProficienciesSchema, resistancesSchema |
| 1220 | ⛔ | Creature | core | Actions Interface: Attack, Spellcasting, Special Abilities | mittel | Nein | #1200 | Creature.md#creaturedefinition | src/core/schemas/creature.ts:creatureDefinitionSchema (actions als string[] Zeile 159), [neu] actionSchema mit strukturiertem Interface |
| 1221 | ⛔ | Creature | core | Legendary Actions Interface: Legendary Actions für Boss-Monster | niedrig | Nein | #1200, #1220 | Creature.md#creaturedefinition, Combat-System.md#post-mvp-erweiterungen | [neu] src/core/schemas/creature.ts:legendaryActionSchema, creatureDefinitionSchema erweitern |
| 1222 | ⛔ | Creature | features | Sinne-System: Encounter-Trigger basierend auf Sichtweite | mittel | Nein | #1210, #1214 | Creature.md#sinne-post-mvp, Encounter-System.md#tile-eligibility | [neu] src/features/encounter/visibility.ts:checkCreatureVisibility() |
| 1223 | ⛔ | Creature | features | Passive Perception für Stealth-Checks | mittel | Nein | #1210, #1222 | Creature.md#sinn-typen | [neu] src/features/encounter/visibility.ts:calculatePassivePerceptionDC() |
| 2949 | ⛔ | Creature | core | CreatureDetectionProfile Schema (noiseLevel, scentStrength, stealthAbilities) - REQUIRED auf CreatureDefinition | hoch | Ja | #1200 | Creature.md#detection-profil | schemas/creature.ts:creatureDetectionProfileSchema |
| 2950 | ✅ | Creature | core | StealthAbility Type (burrowing, invisibility, ethereal, shapechange, mimicry, ambusher) | hoch | Ja | - | Creature.md#stealthability | schemas/creature.ts:stealthAbilitySchema |
| 2961 | ⛔ | Creature | features | Design-Rollen Ableitung: deriveDesignRole() aus Statblock | mittel | Ja | #1200 | Creature.md#design-rollen-mcdm-basiert | [neu] src/features/creature/design-role.ts:deriveDesignRole() |
| 3003 | ⛔ | Creature | core | carriesLoot: boolean Feld (default humanoid=true, beast=false) | niedrig | Nein | #1200 | Creature.md#loot-kategorien | - |
| 3004 | ⛔ | Creature | core | stashLocationHint: string Feld (Verweis auf Hoard-Location) | niedrig | Nein | #1200 | Creature.md#loot-kategorien | - |
| 3129 | ⬜ | Creature | - | Stealth-Ability-Priorität: getPrimaryStealthAbility() Implementation | mittel | nein | #2950, #2949 | Creature.md#stealth-ability-prioritaet | - |
