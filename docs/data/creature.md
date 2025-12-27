# Schema: CreatureDefinition

> **Produziert von:** [Library](../application/Library.md) (CRUD), Presets (bundled)
> **Konsumiert von:** [Encounter](../features/encounter/Encounter.md), [Combat](../features/Combat-System.md), [Loot](../features/Loot-Feature.md)

Template fuer Monster und NPCs - wiederverwendbare Spielwerte und Encounter-Praeferenzen.

---

## Drei-Stufen-Hierarchie

Das Creature-System unterscheidet drei Abstraktionsebenen:

| Begriff | Bedeutung | Persistenz | Beispiel |
|---------|-----------|------------|----------|
| `CreatureDefinition` | Template/Statblock | EntityRegistry | "Goblin", CR 1/4, 7 HP |
| `Creature` | Instanz in Encounter/Combat | Runtime (nicht persistiert) | "Goblin #1", aktuell 5 HP |
| `NPC` | Benannte persistente Instanz | EntityRegistry | "Griknak", Persoenlichkeit |

- **CreatureDefinition**: Dieses Dokument
- **Creature (Runtime)**: Siehe [Combat-System.md](../features/Combat-System.md)
- **NPC**: Siehe [npc.md](npc.md)

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `id` | `EntityId<'creature'>` | Eindeutige ID | Required |
| `name` | `string` | Anzeigename | Required, non-empty |
| `cr` | `number` | Challenge Rating | Required, >= 0 |
| `maxHp` | `number` | Maximale Trefferpunkte | Required, > 0 |
| `ac` | `number` | Ruestungsklasse | Required, > 0 |
| `size` | `Size` | Kreaturgroesse | Required |
| `tags` | `string[]` | Kategorisierung | Required, min 1 |
| `disposition` | `Disposition` | Grundhaltung | Required |
| `terrainAffinities` | `EntityId<'terrain'>[]` | Heimat-Terrains | Required, min 1 |
| `activeTime` | `TimeSegment[]` | Aktive Tageszeiten | Required, min 1 |
| `designRole` | `DesignRole` | MCDM-Kampfrolle | Required (auto-abgeleitet) |
| `groupSize` | `number \| CountRange` | Natuerliche Gruppengroesse | Optional, default: 1 |
| `activities` | `EntityId<'activity'>[]` | Moegliche Aktivitaeten | Optional |
| `preferences` | `CreaturePreferences` | Gewichtungs-Modifikatoren | Optional |
| `lootTags` | `string[]` | Loot-Kategorien | Required |
| `defaultLoot` | `DefaultLootEntry[]` | Garantiertes Loot | Optional |
| `carriesLoot` | `boolean` | Traegt Carried Loot? | Optional, default: true (humanoid) |
| `stashLocationHint` | `string` | Hinweis auf Hoard | Optional |
| `detectionProfile` | `CreatureDetectionProfile` | Entdeckbarkeit | **Required** |
| `abilities` | `AbilityScores` | D&D 5e Attribute | Required |
| `skills` | `SkillProficiencies` | Fertigkeiten | Optional |
| `savingThrows` | `SavingThrowProficiencies` | Rettungswuerfe | Optional |
| `resistances` | `DamageType[]` | Schadensresistenzen | Optional |
| `immunities` | `DamageType[]` | Schadensimmunitaeten | Optional |
| `conditionImmunities` | `Condition[]` | Zustandsimmunitaeten | Optional |
| `senses` | `Senses` | Sinne | Optional |
| `languages` | `string[]` | Sprachen | Optional |
| `speed` | `SpeedBlock` | Bewegungsraten | Required |
| `actions` | `Action[]` | Aktionen | Optional |
| `reactions` | `Action[]` | Reaktionen | Optional |
| `legendaryActions` | `LegendaryAction[]` | Legendaere Aktionen | Optional |
| `description` | `string` | Beschreibungstext | Optional |
| `source` | `string` | Quellenverweis | Optional |

---

## Sub-Schemas

### Size

```typescript
type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
```

### Disposition

```typescript
type Disposition = 'hostile' | 'neutral' | 'friendly';
```

### TimeSegment

```typescript
type TimeSegment = 'dawn' | 'day' | 'dusk' | 'night';
```

### AbilityScores

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `str` | `number` | Staerke |
| `dex` | `number` | Geschicklichkeit |
| `con` | `number` | Konstitution |
| `int` | `number` | Intelligenz |
| `wis` | `number` | Weisheit |
| `cha` | `number` | Charisma |

### SpeedBlock

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `walk` | `number` | Gehgeschwindigkeit (Feet) |
| `fly` | `number?` | Fluggeschwindigkeit |
| `swim` | `number?` | Schwimmgeschwindigkeit |
| `climb` | `number?` | Klettergeschwindigkeit |
| `burrow` | `number?` | Grabgeschwindigkeit |

### Senses

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `passivePerception` | `number` | Fuer Stealth-Checks |
| `darkvision` | `number?` | Range in Feet |
| `blindsight` | `number?` | Range in Feet |
| `tremorsense` | `number?` | Range in Feet |
| `trueSight` | `number?` | Range in Feet |

### CreatureDetectionProfile

Bestimmt wie leicht die Kreatur von der Party entdeckt werden kann.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `noiseLevel` | `NoiseLevel` | Lautstaerke |
| `scentStrength` | `ScentStrength` | Geruchsstaerke |
| `stealthAbilities` | `StealthAbility[]?` | Spezielle Tarnfaehigkeiten |

**NoiseLevel:**

| Wert | Basis-Range | Bei Wind/Regen | Beispiele |
|------|-------------|----------------|-----------|
| `silent` | 0ft | 0ft | Geister, Schleicher |
| `quiet` | 30ft | 15ft | Katzen, Assassinen |
| `normal` | 60ft | 30ft | Menschen, Woelfe |
| `loud` | 200ft | 100ft | Orks, Baeren |
| `deafening` | 500ft | 250ft | Drachen, Riesen |

**ScentStrength:**

| Wert | Basis-Range | Bei Wind/Regen | Beispiele |
|------|-------------|----------------|-----------|
| `none` | 0ft | 0ft | Konstrukte, Geister |
| `faint` | 30ft | 0ft | Elfen, Barden |
| `moderate` | 60ft | 30ft | Menschen, Goblins |
| `strong` | 150ft | 75ft | Trolle, Gnolls |
| `overwhelming` | 300ft | 150ft | Troglodyten, Aas |

**StealthAbility:**

| Wert | Effekt |
|------|--------|
| `burrowing` | Visuell: 0ft, Audio: normal |
| `invisibility` | Visuell: 0ft, andere normal |
| `ethereal` | Alle: 0ft, nur True Sight |
| `shapechange` | Keine auto-Detection |
| `mimicry` | Audio kann fehlgeleitet werden |
| `ambusher` | Loest Ambush-Check aus |

### CreaturePreferences

Optionale Gewichtungs-Modifikatoren fuer das Encounter-System.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `terrain` | `Record<EntityId<'terrain'>, number>` | Terrain-Gewichtung |
| `timeOfDay` | `Record<TimeSegment, number>` | Tageszeit-Gewichtung |
| `weather` | `Record<WeatherCondition, number>` | Wetter-Gewichtung |
| `altitude` | `{ min: number; max: number }` | Hoehenbereich |

**Gewichtungs-Werte:**

| Wert | Bedeutung |
|------|-----------|
| `2.0` | Bevorzugt - doppelte Wahrscheinlichkeit |
| `1.0` | Normal - Standard-Wahrscheinlichkeit |
| `0.5` | Selten - halbe Wahrscheinlichkeit |
| `0` | Nie - erscheint nicht |

### DefaultLootEntry

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `itemId` | `EntityId<'item'>` | Item-Referenz |
| `chance` | `number` | Wahrscheinlichkeit (0.0-1.0) |
| `quantity` | `number \| [min, max]?` | Menge |

### CountRange

```typescript
interface CountRange {
  min: number;
  avg: number;
  max: number;
}
```

---

## Design-Rollen (MCDM-basiert)

Design-Rollen werden bei der Creature-Erstellung automatisch aus dem Statblock abgeleitet.

```typescript
type DesignRole =
  | 'ambusher'     // Stealth + Surprise
  | 'artillery'    // Fernkampf bevorzugt
  | 'brute'        // Hohe HP, hoher Schaden
  | 'controller'   // Debuffs, Crowd Control
  | 'leader'       // Kaempft mit Untergebenen
  | 'minion'       // Schwach, Horde-tauglich
  | 'skirmisher'   // Mobil, Hit-and-Run
  | 'soldier'      // Hohe AC, Tank
  | 'solo'         // Kaempft alleine
  | 'support';     // Buffs, Healing
```

### Ableitungs-Logik

| Rolle | Ableitungs-Hinweise |
|-------|---------------------|
| `solo` | Hat Legendary Actions |
| `minion` | CR < 1, keine Multiattack |
| `leader` | Hat Buff-Auren/Command-Abilities |
| `artillery` | Mehr Ranged als Melee |
| `brute` | HP > CR-Durchschnitt * 1.2 |
| `soldier` | AC > CR-Durchschnitt |
| `skirmisher` | Speed >= 40 oder Disengage |
| `controller` | AoE oder Condition-Abilities |
| `support` | Healing oder Buff-Abilities |
| `ambusher` | Stealth-Proficiency oder Sneak Attack |

---

## Terrain-Affinitaet

Kreaturen und Terrains haben eine bidirektionale Beziehung:

```
creature.terrainAffinities[] <-> terrain.nativeCreatures[]
```

Das System synchronisiert automatisch: Aenderung an einer Seite aktualisiert die andere.

---

## Loot-Kategorien

| Kategorie | Feld | Beschreibung |
|-----------|------|--------------|
| **Carried** | `carriesLoot` | Was die Kreatur bei sich traegt |
| **Harvestable** | `defaultLoot` | Vom Koerper gewinnbar |
| **Stashed** | `stashLocationHint` | An anderem Ort (Hoard) |

**carriesLoot Defaults:**

| Kreatur-Typ | Default |
|-------------|:-------:|
| Humanoid | `true` |
| Beast | `false` |
| Construct | `false` |

---

## Invarianten

- `detectionProfile` ist **Required** - Kreatur kann ohne nicht erstellt werden
- `terrainAffinities` muss mindestens 1 Terrain enthalten
- `activeTime` muss mindestens 1 TimeSegment enthalten
- `designRole` wird bei Erstellung automatisch abgeleitet (nicht manuell setzen)
- `abilities` muss alle 6 Attribute enthalten (str, dex, con, int, wis, cha)
- `speed.walk` ist Required, alle anderen Speed-Typen optional

---

## Beispiel

```typescript
const goblin: CreatureDefinition = {
  id: 'creature:goblin-warrior',
  name: 'Goblin Warrior',

  // Basis-Statistiken
  cr: 0.25,
  maxHp: 7,
  ac: 15,
  size: 'small',

  // Kategorisierung
  tags: ['humanoid', 'goblinoid'],
  disposition: 'hostile',

  // Encounter-System
  terrainAffinities: ['terrain:forest', 'terrain:cave'],
  activeTime: ['dawn', 'dusk', 'night'],
  designRole: 'minion',
  groupSize: { min: 3, avg: 5, max: 8 },
  activities: ['activity:patrolling', 'activity:ambush'],

  // Detection
  detectionProfile: {
    noiseLevel: 'normal',
    scentStrength: 'moderate',
    stealthAbilities: ['ambusher']
  },

  // Loot
  lootTags: ['humanoid', 'poor', 'tribal'],
  defaultLoot: [
    { itemId: 'item:scimitar', chance: 1.0 },
    { itemId: 'item:shortbow', chance: 0.5 }
  ],
  carriesLoot: true,

  // D&D 5e Statblock
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  skills: { stealth: 6 },
  senses: { passivePerception: 9, darkvision: 60 },
  languages: ['Common', 'Goblin'],
  speed: { walk: 30 },

  // Aktionen
  actions: [
    // Siehe action.md fuer Action-Schema
  ],

  source: 'Monster Manual, p. 166'
};
```

---

## Storage

```
Vault/SaltMarcher/data/
├── creature/
│   ├── _bundled/           # Mitgelieferte Kreaturen
│   │   ├── goblin.json
│   │   └── wolf.json
│   └── user/               # User-erstellte Kreaturen
│       └── custom-beast.json
```
