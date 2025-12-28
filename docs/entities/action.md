# Schema: Action

> **Produziert von:** [Library](../views/Library.md) (Creature-Editor), Presets (bundled)
> **Konsumiert von:** [Combat](../features/Combat-System.md), [CreatureDefinition](creature.md)

Einheitliches Schema fuer alle Kampf-Aktionen (Creature und Character). Deckt ab:
Weapon-Attacks, Spell-Attacks, AoE, Buffs/Debuffs, Healing, Summoning, Transformation.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| `name` | `string` | Aktionsname | Required |
| `actionType` | `ActionType` | Kategorisierung | Required |
| `timing` | `ActionTiming` | Timing & Economy | Required |
| `range` | `ActionRange` | Reichweite | Required |
| `targeting` | `Targeting` | Zielauswahl | Required |
| `attack` | `AttackRoll?` | Angriffswurf | Einer von attack/save/contested/autoHit |
| `save` | `SaveDC?` | Rettungswurf | Einer von attack/save/contested/autoHit |
| `contested` | `ContestedCheck?` | Vergleichender Wurf | Einer von attack/save/contested/autoHit |
| `autoHit` | `boolean?` | Automatischer Treffer | Einer von attack/save/contested/autoHit |
| `damage` | `ActionDamage?` | Primaerer Schaden | Optional |
| `extraDamage` | `ActionDamage[]?` | Zusaetzlicher Schaden | Optional |
| `healing` | `{ dice: string; modifier: number }?` | Heilung | Optional |
| `effects` | `ActionEffect[]?` | Effekte/Conditions | Optional |
| `forcedMovement` | `ForcedMovement?` | Erzwungene Bewegung | Optional |
| `multiattack` | `Multiattack?` | Multi-Angriff Definition | Required bei actionType: 'multiattack' |
| `summon` | `Summon?` | Beschwoerung | Optional |
| `transform` | `Transform?` | Verwandlung | Optional |
| `counter` | `Counter?` | Aufhebung | Optional |
| `conditionalBonuses` | `ConditionalBonus[]?` | Bedingte Boni | Optional |
| `critical` | `Critical?` | Kritische Treffer | Optional |
| `hpThreshold` | `HpThreshold?` | HP-basierte Effekte | Optional |
| `recharge` | `ActionRecharge?` | Wiederaufladung | Optional |
| `spellSlot` | `SpellSlot?` | Zauberplatz | Optional |
| `components` | `SpellComponents?` | Zauberkomponenten | Optional |
| `concentration` | `boolean?` | Erfordert Konzentration | Optional |
| `description` | `string?` | Beschreibungstext | Optional |
| `properties` | `string[]?` | Waffen-Eigenschaften | Optional |
| `source` | `ActionSource?` | Herkunft | Optional |

---

## Sub-Schemas

### ActionType

```typescript
type ActionType =
  | 'melee-weapon' | 'ranged-weapon' | 'melee-spell' | 'ranged-spell'
  | 'save-effect' | 'aoe' | 'healing' | 'buff' | 'debuff' | 'utility'
  | 'summon' | 'transform' | 'counter' | 'multiattack' | 'lair' | 'legendary';
```

### ActionSource

```typescript
type ActionSource = 'class' | 'race' | 'item' | 'spell' | 'innate' | 'lair';
```

---

### ActionRange

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `type` | `'reach' \| 'ranged' \| 'self' \| 'touch'` | Reichweitentyp |
| `normal` | `number` | Normale Reichweite (Feet) |
| `long` | `number?` | Lange Reichweite (mit Nachteil) |

### Aoe

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `shape` | `'sphere' \| 'cube' \| 'cone' \| 'line' \| 'cylinder'` | Form |
| `size` | `number` | Radius/Laenge/Seite (Feet) |
| `width` | `number?` | Breite (fuer Line) |
| `height` | `number?` | Hoehe (fuer Cylinder) |
| `origin` | `'self' \| 'point' \| 'creature'` | Ursprung |

### Targeting

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `type` | `'single' \| 'multiple' \| 'area'` | Zieltyp |
| `count` | `number?` | Max Anzahl bei 'multiple' |
| `aoe` | `Aoe?` | AoE-Details bei 'area' |
| `friendlyFire` | `boolean?` | Trifft auch Verbuendete? |

---

### ActionDamage

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `dice` | `string` | Wuerfelformel ("1d8", "8d6") |
| `modifier` | `number` | Modifikator (+STR/DEX) |
| `type` | `DamageType` | Schadenstyp |
| `versatileDice` | `string?` | Zwei-Hand-Option |
| `scalingDice` | `string?` | Cantrip-Scaling pro Tier |

### DamageType

```typescript
type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force'
  | 'lightning' | 'necrotic' | 'piercing' | 'poison'
  | 'psychic' | 'radiant' | 'slashing' | 'thunder';
```

---

### AttackRoll

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `bonus` | `number` | Angriffsbonus |
| `advantage` | `'always' \| 'conditional' \| 'none'?` | Vorteil |

### SaveDC

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `ability` | `AbilityType` | Rettungswurf-Attribut |
| `dc` | `number` | Schwierigkeitsgrad |
| `onSave` | `'none' \| 'half' \| 'special'` | Effekt bei Erfolg |

```typescript
type AbilityType = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
```

---

### ActionEffect

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `condition` | `ConditionType?` | Zustand |
| `statModifiers` | `StatModifier[]?` | Stat-Aenderungen |
| `rollModifiers` | `RollModifier[]?` | Wurf-Modifikatoren |
| `damageModifiers` | `DamageModifier[]?` | Schadensresistenzen |
| `movementModifiers` | `MovementModifier[]?` | Bewegungsaenderungen |
| `tempHp` | `{ dice: string; modifier: number }?` | Temporaere HP |
| `duration` | `Duration?` | Dauer |
| `endingSave` | `SaveDC?` | Wiederholter Rettungswurf |
| `affectsTarget` | `'self' \| 'ally' \| 'enemy' \| 'any'` | Betroffene |
| `terrain` | `TerrainEffect?` | Gelaendeeffekt |
| `description` | `string?` | Beschreibung |

### ConditionType

```typescript
type ConditionType =
  | 'blinded' | 'charmed' | 'deafened' | 'frightened'
  | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed'
  | 'petrified' | 'poisoned' | 'prone' | 'restrained'
  | 'stunned' | 'unconscious' | 'exhaustion';
```

### Duration

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `type` | `DurationType` | Dauertyp |
| `value` | `number?` | Wert (Runden, Minuten, etc.) |

```typescript
type DurationType =
  | 'instant' | 'rounds' | 'minutes' | 'hours'
  | 'until-save' | 'concentration' | 'until-long-rest';
```

### StatModifier

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `stat` | `ModifiableStat` | Betroffener Wert |
| `value` | `number` | Modifikatorwert |
| `dice` | `string?` | Wuerfelbonus ("1d4") |
| `type` | `'bonus' \| 'set' \| 'multiply'` | Modifikatortyp |

```typescript
type ModifiableStat =
  | 'ac' | 'speed' | 'attack' | 'damage' | 'saves'
  | 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
  | 'str-save' | 'dex-save' | 'con-save' | 'int-save' | 'wis-save' | 'cha-save'
  | 'initiative' | 'spell-dc';
```

### RollModifier

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `on` | `RollTarget` | Betroffene Wuerfe |
| `type` | `'advantage' \| 'disadvantage' \| 'auto-success' \| 'auto-fail'` | Modifikator |
| `against` | `string?` | Gegen was |

```typescript
type RollTarget =
  | 'attacks' | 'saves' | 'ability-checks' | 'concentration' | 'death-saves'
  | 'str-checks' | 'dex-checks' | 'stealth' | 'perception' | 'initiative';
```

### DamageModifier

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `type` | `'resistance' \| 'immunity' \| 'vulnerability'` | Modifikatortyp |
| `damageTypes` | `DamageType[]` | Betroffene Schadenstypen |

### MovementModifier

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `type` | `'speed' \| 'fly' \| 'swim' \| 'climb' \| 'burrow' \| 'teleport'` | Bewegungstyp |
| `value` | `number` | Geschwindigkeit (Feet) |
| `mode` | `'grant' \| 'bonus'` | Verleiht oder addiert |

### TerrainEffect

```typescript
type TerrainEffect = 'difficult' | 'magical-darkness' | 'silence' | 'fog';
```

---

### ActionTiming

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `type` | `ActionTimingType` | Aktionstyp |
| `trigger` | `string?` | Ausloeser-Beschreibung |
| `triggerCondition` | `TriggerCondition?` | Strukturierter Ausloeser |

```typescript
type ActionTimingType = 'action' | 'bonus' | 'reaction' | 'legendary' | 'lair' | 'mythic' | 'free';
```

### TriggerCondition

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `event` | `TriggerEvent` | Ausloesendes Ereignis |
| `filter` | `string?` | Zusaetzliche Bedingung |

```typescript
type TriggerEvent =
  | 'attacked' | 'damaged' | 'spell-cast' | 'movement'
  | 'start-turn' | 'end-turn' | 'ally-attacked' | 'ally-damaged'
  | 'enters-reach' | 'leaves-reach';
```

---

### ActionRecharge

```typescript
type ActionRecharge =
  | { type: 'at-will' }
  | { type: 'recharge'; range: [number, number] }
  | { type: 'per-day'; uses: number }
  | { type: 'per-rest'; uses: number; rest: 'short' | 'long' }
  | { type: 'legendary'; cost: number }
  | { type: 'lair' }
  | { type: 'mythic' };
```

### SpellSlot

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `level` | `number` | Zaubergrad (1-9) |
| `upcastDice` | `string?` | Zusaetzliche Wuerfel pro Stufe |
| `upcastEffect` | `string?` | Zusaetzlicher Effekt |

### SpellComponents

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `verbal` | `boolean` | Verbale Komponente |
| `somatic` | `boolean` | Gestische Komponente |
| `material` | `string?` | Materielle Komponente |
| `materialCost` | `number?` | Kosten in Gold |
| `consumed` | `boolean?` | Wird verbraucht? |

---

### Multiattack

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `attacks` | `{ actionRef: string; count: number }[]` | Angriffs-Sequenz |
| `description` | `string?` | Beschreibung |

### ForcedMovement

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `type` | `'push' \| 'pull' \| 'teleport' \| 'swap' \| 'prone'` | Bewegungstyp |
| `distance` | `number` | Distanz (Feet) |
| `direction` | `'away' \| 'toward' \| 'chosen' \| 'vertical'?` | Richtung |
| `save` | `SaveDC?` | Rettungswurf dagegen |

### ContestedCheck

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `attackerSkill` | `SkillType` | Angreifer-Fertigkeit |
| `defenderChoice` | `SkillType[]` | Verteidiger-Optionen |
| `onSuccess` | `ActionEffect` | Effekt bei Erfolg |
| `sizeLimit` | `number?` | Max Groessenunterschied |

### ConditionalBonus

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `condition` | `BonusCondition` | Voraussetzung |
| `parameter` | `number?` | Parameter fuer Bedingung |
| `bonus` | `ConditionalBonusEffect` | Gewaehlter Bonus |

```typescript
type BonusCondition =
  | 'moved-distance' | 'ally-adjacent' | 'target-prone' | 'target-restrained'
  | 'below-half-hp' | 'first-attack' | 'hidden' | 'higher-ground' | 'darkness';

interface ConditionalBonusEffect {
  type: 'damage' | 'attack' | 'advantage' | 'crit-range';
  value?: number | string;
}
```

### Summon

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `creatureType` | `string` | Kreaturentyp |
| `crLimit` | `number?` | Max CR |
| `count` | `{ dice: string } \| number?` | Anzahl |
| `duration` | `Duration` | Dauer |
| `control` | `'friendly' \| 'hostile' \| 'uncontrolled'` | Kontrolle |
| `statBlock` | `string?` | Statblock-Referenz |

### Transform

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `into` | `'beast' \| 'creature' \| 'object' \| 'specific'` | Zielform |
| `crLimit` | `number?` | Max CR |
| `specificForm` | `string?` | Spezifische Form |
| `duration` | `Duration` | Dauer |
| `retainMind` | `boolean` | Behaelt Geist? |
| `retainHp` | `boolean` | Behaelt HP? |

### Counter

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `counters` | `CounterTarget` | Was wird aufgehoben |
| `autoSuccess` | `boolean?` | Automatischer Erfolg |
| `check` | `CounterCheck?` | Erforderlicher Check |

```typescript
type CounterTarget = 'spell' | 'condition' | 'curse' | 'disease' | 'charm' | 'frightened' | 'any-magic';

interface CounterCheck {
  ability: AbilityType;
  dc: number | 'spell-level';
}
```

### Critical

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `range` | `[number, number]` | Krit-Bereich (z.B. [19, 20]) |
| `autoCrit` | `string?` | Bedingung fuer Auto-Krit |
| `bonusDice` | `string?` | Extra Wuerfel bei Krit |

### HpThreshold

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `threshold` | `number` | HP-Schwellwert |
| `comparison` | `'below' \| 'above' \| 'equal-or-below'` | Vergleich |
| `effect` | `ActionEffect` | Effekt wenn erfuellt |
| `failEffect` | `ActionEffect?` | Effekt wenn nicht erfuellt |

---

## Invarianten

- **Resolution**: Genau einer von `attack`, `save`, `contested`, oder `autoHit` muss gesetzt sein
- Bei `actionType: 'aoe'` muss `targeting.aoe` gesetzt sein
- Bei `actionType: 'multiattack'` muss `multiattack` gesetzt sein
- Bei `timing.type: 'reaction'` sollte `trigger` oder `triggerCondition` gesetzt sein
- Bei `concentration: true` muss `effects[].duration.type` = 'concentration' sein
- `spellSlot.level` muss zwischen 1-9 liegen
- `damage.dice` muss gueltiges Wuerfelformat sein ("XdY")

---

## Beispiele

### Melee Attack (Wolf Bite)

```typescript
const wolfBite: Action = {
  name: 'Bite',
  actionType: 'melee-weapon',
  timing: { type: 'action' },
  range: { type: 'reach', normal: 5 },
  targeting: { type: 'single' },
  attack: { bonus: 4 },
  damage: { dice: '2d4', modifier: 2, type: 'piercing' },
  effects: [{
    condition: 'prone',
    duration: { type: 'instant' },
    affectsTarget: 'enemy'
  }],
  conditionalBonuses: [{
    condition: 'ally-adjacent',
    bonus: { type: 'advantage' }
  }]
};
```

### AoE (Dragon Fire Breath)

```typescript
const fireBreath: Action = {
  name: 'Fire Breath',
  actionType: 'aoe',
  timing: { type: 'action' },
  range: { type: 'self', normal: 0 },
  targeting: {
    type: 'area',
    aoe: { shape: 'cone', size: 30, origin: 'self' },
    friendlyFire: true
  },
  save: { ability: 'dex', dc: 13, onSave: 'half' },
  damage: { dice: '6d6', modifier: 0, type: 'fire' },
  recharge: { type: 'recharge', range: [5, 6] }
};
```

### Buff (Bless)

```typescript
const bless: Action = {
  name: 'Bless',
  actionType: 'buff',
  timing: { type: 'action' },
  range: { type: 'ranged', normal: 30 },
  targeting: { type: 'multiple', count: 3 },
  autoHit: true,
  effects: [{
    statModifiers: [
      { stat: 'attack', dice: '1d4', value: 0, type: 'bonus' },
      { stat: 'saves', dice: '1d4', value: 0, type: 'bonus' }
    ],
    duration: { type: 'concentration', value: 1 },
    affectsTarget: 'ally'
  }],
  concentration: true,
  spellSlot: { level: 1 },
  components: { verbal: true, somatic: true, material: 'holy water' }
};
```

### Reaction (Shield)

```typescript
const shield: Action = {
  name: 'Shield',
  actionType: 'buff',
  timing: {
    type: 'reaction',
    trigger: 'when hit by attack or targeted by magic missile',
    triggerCondition: { event: 'attacked' }
  },
  range: { type: 'self', normal: 0 },
  targeting: { type: 'single' },
  autoHit: true,
  effects: [{
    statModifiers: [{ stat: 'ac', value: 5, type: 'bonus' }],
    duration: { type: 'rounds', value: 1 },
    affectsTarget: 'self'
  }],
  spellSlot: { level: 1 },
  components: { verbal: true, somatic: true }
};
```

### Legendary Action (Tail Attack)

```typescript
const tailAttack: Action = {
  name: 'Tail Attack',
  actionType: 'legendary',
  timing: { type: 'legendary' },
  range: { type: 'reach', normal: 15 },
  targeting: { type: 'single' },
  attack: { bonus: 14 },
  damage: { dice: '2d8', modifier: 8, type: 'bludgeoning' },
  recharge: { type: 'legendary', cost: 1 }
};
```

### Multiattack

```typescript
const dragonMultiattack: Action = {
  name: 'Multiattack',
  actionType: 'multiattack',
  timing: { type: 'action' },
  range: { type: 'self', normal: 0 },
  targeting: { type: 'single' },
  autoHit: true,
  multiattack: {
    attacks: [
      { actionRef: 'Bite', count: 1 },
      { actionRef: 'Claw', count: 2 }
    ],
    description: 'The dragon makes three attacks: one with its bite and two with its claws.'
  }
};
```
