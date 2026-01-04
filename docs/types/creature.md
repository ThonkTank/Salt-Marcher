# Schema: CreatureDefinition

> **Produziert von:** [Library](../views/Library.md) (CRUD), Presets (bundled)
> **Konsumiert von:** [Encounter](../services/encounter/Encounter.md), [Combat](../features/Combat-System.md), [Loot](../services/Loot.md)

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
| `hitDice` | `string` | Hit Dice Expression (z.B. "2d6+4") | Required |
| `maxHp` | `number` | Maximale HP aus hitDice (berechnet) | Auto |
| `averageHp` | `number` | Durchschnittliche HP aus hitDice (berechnet, aufgerundet) | Auto |
| `ac` | `number` | Ruestungsklasse | Required, > 0 |
| `size` | `Size` | Kreaturgroesse | Required |
| `tags` | `string[]` | Kategorisierung | Required, min 1 |
| `species` | `string?` | Referenz auf Species-Entity | Optional |
| `appearanceOverride` | `LayerTraitConfig` | Creature-spezifische Ergaenzung | Optional |
| `baseDisposition` | `number` | Basis-Disposition (-100 bis +100) | Required |
| `terrainAffinities` | `EntityId<'terrain'>[]` | Heimat-Terrains | Required, min 1 |
| `activeTime` | `TimeSegment[]` | Aktive Tageszeiten | Required, min 1 |
| `designRole` | `DesignRole` | MCDM-Kampfrolle | Required (auto-abgeleitet) |
| `groupSize` | `number \| CountRange` | Natuerliche Gruppengroesse | Optional, default: 1 |
| `activities` | `EntityId<'activity'>[]` | Moegliche Aktivitaeten | Optional |
| `preferences` | `CreaturePreferences` | Gewichtungs-Modifikatoren | Optional |
| `lootPool` | `string[]` | Item-IDs (ueberschreibt Culture-Kaskade) | Optional |
| `wealthTier` | `WealthTier?` | Beeinflusst Loot-WERT | Optional |
| `defaultLoot` | `DefaultLootEntry[]` | Garantiertes Loot | Optional |
| `carriesLoot` | `boolean` | Traegt Carried Loot? | Optional, default: true (humanoid) |
| `detectionProfile` | `CreatureDetectionProfile` | Entdeckbarkeit | **Required** |
| `abilities` | `AbilityScores` | D&D 5e Attribute | Required |
| `skills` | `SkillProficiencies` | Fertigkeiten | Optional |
| `senses` | `Senses` | Sinne | Optional |
| `languages` | `string[]` | Sprachen | Optional |
| `speed` | `SpeedBlock` | Bewegungsraten | Required |
| `actions` | `Action[]` | Aktionen (inline) | Optional |
| `actionIds` | `string[]` | Referenzen zu Action-Presets | Optional |
| `reactions` | `Action[]` | Reaktionen | Optional |
| `legendaryActions` | `Action[]` | Legendaere Aktionen | Optional |
| `description` | `string` | Beschreibungstext | Optional |
| `source` | `string` | Quellenverweis | Optional |

---

## Sub-Schemas

### Size

```typescript
type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
```

### baseDisposition

Numerische Basis-Disposition auf einer Skala von -100 bis +100.

```typescript
baseDisposition: number  // -100 bis +100
```

**Effektive Disposition:**

Die tatsaechliche Disposition gegenueber der Party wird aus `baseDisposition` plus Reputation berechnet:

```
effectiveDisposition = clamp(baseDisposition + reputation, -100, +100)
```

**Label-Thresholds:**

| Bereich | Label |
|---------|-------|
| < -33 | `hostile` |
| -33 bis +33 | `neutral` |
| > +33 | `friendly` |

**Typische Basis-Werte:**

| Kreatur-Typ | baseDisposition | Bedeutung |
|-------------|:---------------:|-----------|
| Raubtiere, Untote | -75 | Grundsaetzlich feindlich |
| Wilde Tiere | -25 | Territorial, aber nicht aggressiv |
| Neutrale NPCs | 0 | Abwartend |
| Haendler, Dorfbewohner | +25 | Tendenziell freundlich |
| Verbuendete | +75 | Grundsaetzlich freundlich |

-> Reputation: [faction.md#reputations](faction.md#reputations), [npc.md#reputations](npc.md#reputations)

### Species

Referenz auf Species-Entity fuer physische Merkmale.

```typescript
species: 'goblin'  // Referenz auf Species-Entity
```

**Vererbung:**

| Aspekt | Quelle | Ueberschreibbar |
|--------|--------|-----------------|
| appearance | Species.appearance | Ja, via appearanceOverride |
| defaultSize | Species.defaultSize | Ja, via size |
| defaultCulture | Species.defaultCulture | Ja, via Faction.usualCultures |

**Beispiele:**
- `species: "goblin"` → Creature erbt appearance von Species 'goblin'
- `species: "human"` → Creature erbt appearance von Species 'human'
- Nicht gesetzt → Creature erbt keine appearance

→ Species-Entity: [species.md](species.md)
→ Culture-Auswahl: [Culture-Resolution.md](../services/npcs/Culture-Resolution.md)

### appearanceOverride

Creature-spezifische Ergaenzung zu Species.appearance.

```typescript
appearanceOverride: LayerTraitConfig  // { add?: string[], unwanted?: string[] }
```

**Anwendungsfaelle:**
- Einzigartige Narben fuer bestimmte Creature-Variante
- Boss-spezifische Merkmale (z.B. Goblin-Boss mit Krone)
- Mutationen fuer spezielle Kreaturen

**Beispiele:**

| Creature | Species | appearanceOverride |
|----------|---------|-------------------|
| goblin | goblin | - (erbt alles von Species) |
| goblin-boss | goblin | `{ add: ['crown', 'golden_teeth'] }` |
| mutant-wolf | wolf | `{ add: ['extra_head', 'glowing_fur'] }` |

**Unterschied zu Culture.styling:**

| Feld | Quelle | Typ | Beispiele |
|------|--------|-----|-----------|
| `Species.appearance` | Species | Physisch/biologisch | Augenfarbe, Hautfarbe, Koerperbau |
| `appearanceOverride` | Creature | Physisch/spezifisch | Einzigartige Narben, Boss-Merkmale |
| `Culture.styling` | Culture | Kulturell/erlernt | Kleidung, Schmuck, Tattoos |

→ Species-Entity: [species.md](species.md)
→ Schema: [types.md#LayerTraitConfig](../architecture/types.md#layertraitconfig)

### hitDice

Hit Dice Expression - Single Source of Truth fuer HP-Berechnung.

```typescript
hitDice: string  // z.B. "2d6", "2d8+4", "7d10+21"
```

**Berechnete Felder:**
- `maxHp` = `diceMax(hitDice)` - Maximaler HP-Wert
- `averageHp` = `Math.ceil(diceAvg(hitDice))` - Durchschnitt (aufgerundet)

**Verhalten:**
- Bei Encounter-Generierung wird fuer jede Kreatur-Instanz individuell gewuerfelt
- `averageHp` fuer Difficulty-Berechnungen und UI verwenden
- `maxHp` ist das theoretische Maximum (alle Wuerfel auf Maximum)
- Validierung erfolgt via `validateDiceExpression()` bei Kreatur-Erstellung

**Beispiele:**

| Kreatur | hitDice | maxHp | averageHp | HP-Range |
|---------|---------|-------|-----------|----------|
| Goblin | "2d6" | 12 | 7 | 2-12 |
| Wolf | "2d8+2" | 18 | 11 | 4-18 |
| Skeleton | "2d8+4" | 20 | 13 | 6-20 |
| Owlbear | "7d10+21" | 91 | 60 | 28-91 |

### TimeSegment

```typescript
type TimeSegment = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
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
| `weather` | `{ prefers?: string[], avoids?: string[] }` | Wetter-Praeferenzen |
| `altitude` | `{ min: number; max: number }` | Hoehenbereich |

**Gewichtungs-Werte:**

| Feld | Typ | Effekt |
|------|-----|--------|
| `terrain` | `Record<string, number>` | Multiplikator (2.0 = bevorzugt, 0.5 = selten) |
| `timeOfDay` | `Record<TimeSegment, number>` | Multiplikator |
| `weather.prefers` | `string[]` | x2.0 - doppelte Wahrscheinlichkeit |
| `weather.avoids` | `string[]` | x0.5 - halbe Wahrscheinlichkeit |

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
| **Pool** | `lootPool` | Item-IDs fuer zufaellige Auswahl |
| **Wealth** | `wealthTier` | Beeinflusst Loot-WERT |
| **Carried** | `carriesLoot` | Was die Kreatur bei sich traegt |
| **Harvestable** | `defaultLoot` | Vom Koerper gewinnbar |

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
  baseDisposition: -75,  // Grundsaetzlich feindlich

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
  lootPool: ['item:scimitar', 'item:shortbow', 'item:gold-pouch'],
  wealthTier: 'poor',
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

## Action-Integration

Creatures koennen Actions auf zwei Arten definieren:

| Methode | Feld | Beschreibung | Verwendung |
|---------|------|--------------|------------|
| **Inline** | `actions` | Action-Objekte direkt im Creature | Einzigartige Custom-Actions |
| **Referenz** | `actionIds` | IDs zu Action-Presets | Standard-MM-Actions |

**Resolution-Reihenfolge (in combatResolver):**

1. Inline-Actions aus `creature.actions[]`
2. Referenzierte Actions via `creature.actionIds[]` → Vault-Lookup
3. Fallback: CR-skalierte Default-Action

**Beispiel mit Referenzen:**

```typescript
const goblin: CreatureDefinition = {
  id: 'goblin',
  name: 'Goblin',
  cr: 0.25,
  // ... andere Felder
  actionIds: ['goblin-scimitar', 'goblin-shortbow'],  // Referenzen
};
```

→ Action-Schema: [action.md](action.md)
→ Action-Presets: `presets/actions/index.ts`

### Weitere Action-Felder

| Feld | Beschreibung | Beispiel |
|------|--------------|----------|
| `reactions` | Reaktionen auf Trigger | Shield, Parry |
| `legendaryActions` | Legendaere Aktionen (mit `recharge: { type: 'legendary', cost: N }`) | Tail Attack |

Alle Action-Felder sind optional und akzeptieren `Action[]`.

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


## Tasks

|  # | Status | Domain   | Layer    | Beschreibung                                                                           |  Prio  | MVP? | Deps | Spec                                 | Imp.                                |
|--:|:----:|:-------|:-------|:-------------------------------------------------------------------------------------|:----:|:--:|:---|:-----------------------------------|:----------------------------------|
| 29 |   ✅    | creature | entities | HP-Varianz: Trefferpunkte basierend auf Hit Dice wuerfeln statt maxHp direkt verwenden | mittel | Nein | -    | creature.md#Felder                   | -                                   |
| 62 |   ✅    | creature | entities | CreatureDefinition: disposition zu baseDisposition (number) migrieren                  | mittel | Nein | #61  | entities/creature.md#Felder          | types/entities/creature.ts [ändern] |
| 65 |   ⬜    | creature | entities | Creature-Presets: disposition zu baseDisposition konvertieren                          | mittel | Nein | #62  | entities/creature.md#baseDisposition | presets/creatures.ts [neu]          |