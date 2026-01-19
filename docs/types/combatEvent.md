> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# Schema: CombatEvent

> **Verantwortlichkeit:** Einheitliche Expression Language fuer alle Combat-relevanten Entities
> **Konsumiert von:** [Combat](../features/Combat.md), [combatTracking](../services/combatTracking/combatTracking.md), [combatantAI](../services/combatantAI/combatantAI.md)
> **Schema:** [combatEvent.ts](../../src/types/entities/combatEvent.ts)
> **Einsteiger-Guide:** [combatEvent-guide.md](combatEvent-guide.md) (praktische Anleitung mit Templates)

---

## Uebersicht

CombatEvent ist das einheitliche Schema fuer **alle** Combat-relevanten Faehigkeiten:

- **Aktionen:** Angriffe, Zauber, Spezialfaehigkeiten
- **Reaktionen:** Opportunity Attacks, Shield, Counterspell
- **Traits:** Pack Tactics, Magic Resistance
- **Auras:** Paladin Aura of Protection, Spirit Guardians
- **Conditions:** Grappled, Prone, Frightened (als CombatEvents!)
- **Zones:** Cloudkill, Wall of Fire

Jedes CombatEvent besteht aus **7 Komponenten**:

| Komponente | Frage | Beispiel |
|------------|-------|----------|
| **Precondition** | Was muss wahr sein? | "Nur wenn Ziel prone ist" |
| **Trigger** | Wie wird es ausgeloest? | "Als Reaktion wenn angegriffen" |
| **Check** | Wie wird Erfolg bestimmt? | "Attack Roll vs AC" |
| **Cost** | Was kostet es? | "1 Action + Spell Slot 3" |
| **Effect** | Was passiert? | "2d6 fire damage" |
| **Targeting** | Wer/Was/Wo? | "1 Kreatur in 30ft Radius" |
| **Duration** | Wie lange / wann endet es? | "1 Minute, Concentration" |

---

## Vollstaendiges Schema

```typescript
type CombatEvent = {
  id: string
  name: string
  description?: string

  // === CORE COMPONENTS ===
  precondition: Precondition
  trigger: Trigger
  cost: Cost
  targeting: Targeting
  check: Check
  effect: Effect
  duration: Duration

  // === METADATA ===
  tags?: string[]
  source?: string
}
```

---

## 1. Precondition

> **Frage:** Was muss wahr sein, damit dieses CombatEvent ueberhaupt verfuegbar/aktiv ist?

### Anwendungsfaelle

| Typ | Beispiel | Precondition |
|-----|----------|--------------|
| Weapon Requirement | Sneak Attack | "Wielding finesse or ranged weapon" |
| Resource Check | Spell | "Has spell slot available" |
| State Requirement | Opportunity Attack | "Has reaction available" |
| Position Requirement | Flanking Bonus | "Ally on opposite side of target" |
| Condition Requirement | Sentinel feat | "Target attacked ally, not self" |

### Schema

```typescript
type Precondition =
  // === EXISTENCE / QUANTIFICATION ===
  | { type: 'always' }
  | { type: 'never' }
  | { type: 'exists', entity: QuantifiedEntity, where?: Precondition }

  // === LOGICAL COMPOSITION ===
  | { type: 'and', conditions: Precondition[] }
  | { type: 'or', conditions: Precondition[] }
  | { type: 'not', condition: Precondition }

  // === CONDITION PREDICATES ===
  | { type: 'has-condition', entity: EntityRef, condition: ConditionId, negate?: boolean }
  | { type: 'has-no-condition', target: EntityRef, condition: ConditionId }
  | { type: 'is-incapacitated', entity?: EntityRef }

  // === RESOURCE PREDICATES ===
  | { type: 'has-resource', resource: ResourceType, amount: number }

  // === EQUIPMENT PREDICATES ===
  | { type: 'is-wielding', weaponProperty: WeaponProperty[] }
  | { type: 'has-free-hand' }
  | { type: 'has-free-hands', count: number }  // 1 oder 2 (fuer Two-Handed Weapons)

  // === HP PREDICATES ===
  | { type: 'hp-threshold', entity: EntityRef, comparison: '<' | '<=' | '>' | '>=', threshold: number | 'half' }

  // === ALLIANCE PREDICATES ===
  | { type: 'is-ally', entity: EntityRef, relativeTo?: EntityRef }
  | { type: 'is-enemy', entity: EntityRef, relativeTo?: EntityRef }

  // === SPATIAL PREDICATES ===
  | { type: 'within-range', subject: EntityRef, object: EntityRef, range: Distance }
  | { type: 'beyond-range', subject: EntityRef, object: EntityRef, range: Distance }
  | { type: 'adjacent-to', subject: EntityRef, object: EntityRef }
  | { type: 'opposite-side', subject: EntityRef, object: EntityRef, anchor: EntityRef }
  | { type: 'in-line-between', entity: EntityRef, from: EntityRef, to: EntityRef }

  // === VISIBILITY PREDICATES ===
  | { type: 'has-line-of-sight', from: EntityRef, to: EntityRef }
  | { type: 'can-see', target: EntityRef }

  // === SIZE PREDICATES ===
  | { type: 'size-category', entity?: EntityRef, max?: SizeCategory, min?: SizeCategory }

  // === CREATURE PREDICATES ===
  | { type: 'is-creature-type', entity: EntityRef, creatureType: CreatureType }

  // === ACTION PREDICATES (fuer Modifier-Conditions) ===
  | { type: 'action-is-id', actionId: string }
  | { type: 'action-has-property', property: string }
  | { type: 'action-is-type', actionType: string }
  | { type: 'action-range-type', rangeType: 'melee' | 'ranged' }
  | { type: 'target-in-long-range' }
  | { type: 'target-beyond-normal-range' }
  | { type: 'has-advantage' }
```

### EntityRef

```typescript
type EntityRef = 'self' | 'target' | 'attacker' | 'source' | 'ally' | 'enemy'
```

---

## 2. Trigger

> **Frage:** Wann/Wie wird dieses CombatEvent ausgeloest?

### Kategorien

| Kategorie | Beschreibung | Beispiele |
|-----------|--------------|-----------|
| **Active** | Spieler/AI waehlt aus | Attack, Cast Spell, Dash |
| **Reactive** | Auf Event reagieren | Opportunity Attack, Shield, Counterspell |
| **Passive** | Immer aktiv | Aura of Protection, Pack Tactics |
| **Temporal** | Zeitbasiert | Start/End of Turn, Zone Entry |

### Schema

```typescript
type Trigger =
  // === ACTIVE ===
  | { type: 'active' }

  // === REACTIVE ===
  | { type: 'reaction', event: ReactionEvent }

  // === PASSIVE ===
  | { type: 'passive' }
  | { type: 'aura', radius: Distance }

  // === TEMPORAL ===
  | { type: 'on-turn-start', whose: 'self' | 'any' | 'ally' | 'enemy' }
  | { type: 'on-turn-end', whose: 'self' | 'any' | 'ally' | 'enemy' }
  | { type: 'on-round-start' }
  | { type: 'on-round-end' }
  | { type: 'on-initiative', initiative: number, timing: 'wins-ties' | 'loses-ties' }

  // === ZONE ===
  | { type: 'on-zone-enter', zoneId: string }
  | { type: 'on-zone-exit', zoneId: string }
  | { type: 'on-zone-start-turn', zoneId: string }

type ReactionEvent =
  // === DECLARATION PHASE (vor Wuerfel) ===
  | 'on-attack-declared'     // Shield
  | 'on-spell-declared'      // Counterspell

  // === EXECUTION PHASE (Wuerfel geworfen) ===
  | 'on-attack-rolled'       // Cutting Words
  | 'on-save-rolled'

  // === EFFECT PHASE (Effekt tritt ein) ===
  | 'on-attacked'
  | 'on-hit'
  | 'on-damaged'
  | 'on-ally-attacked'
  | 'on-ally-damaged'

  // === COMPLETION PHASE (Aktion abgeschlossen) ===
  | 'on-enemy-casts-spell'
  | 'on-enemy-leaves-reach'  // Opportunity Attack
  | 'on-enemy-enters-reach'
  | 'on-forced-movement'
  | 'on-condition-applied'
  | 'on-condition-removed'
```

### Event-Phasen (inspiriert von dnd_engine)

Jede Action durchlaeuft 4 Phasen, die unterschiedliche Trigger-Zeitpunkte ermoeglichen:

```
DECLARATION → EXECUTION → EFFECT → COMPLETION
     ↑            ↑          ↑          ↑
   Shield    Counterspell  Absorb    Riposte
```

| Phase | Zeitpunkt | Beispiel-Reaktionen |
|-------|-----------|---------------------|
| **Declaration** | Aktion angekuendigt | Shield (vor Attack Roll) |
| **Execution** | Wuerfel geworfen | Counterspell, Cutting Words |
| **Effect** | Effekt tritt ein | Absorb Elements, Hellish Rebuke |
| **Completion** | Aktion abgeschlossen | Riposte, Sentinel |

**Quelle:** dnd_engine Event-Architektur (`references/dnd_engine/dnd_engine/events/`)

---

## 3. Check

> **Frage:** Wie wird bestimmt ob das CombatEvent erfolgreich ist?

### Kategorien

| Typ | Mechanik | Beispiel |
|-----|----------|----------|
| **Attack** | d20 + mod vs AC | Sword attack |
| **Save** | Target rolls vs DC | Fireball (DEX save) |
| **Contested** | Both roll, higher wins | Grapple |
| **Auto** | Immer erfolgreich | Magic Missile, Healing Word |
| **None** | Kein Check (passive) | Aura effects |

### Schema

```typescript
type Check =
  | { type: 'attack', attackType: AttackType }
  | { type: 'save', save: AbilityType, dc: DC }
  | { type: 'contested',
      self: SkillOrAbility,
      target: SkillOrAbility | { choice: SkillOrAbility[] }
    }
  | { type: 'auto' }
  | { type: 'none' }

type AttackType = 'melee-weapon' | 'ranged-weapon' | 'melee-spell' | 'ranged-spell'

type AbilityType = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

type SkillOrAbility = AbilityType | SkillType

type DC =
  | { type: 'fixed', value: number }
  | { type: 'ability-based', ability: AbilityType, proficient: boolean }
  | { type: 'spell-dc' }
  | { type: 'formula', formula: string }
```

### CheckResult

```typescript
type CheckResult =
  | 'critical-success'  // Nat 20 (nur Attack Rolls)
  | 'success'           // >= DC / AC
  | 'failure'           // < DC / AC
  | 'critical-failure'  // Nat 1 (nur Attack Rolls)
```

### Formula-DC (inspiriert von dnd5e)

DC kann dynamisch aus Attributen berechnet werden mit @-Referenzen:

```typescript
type DC =
  | { type: 'fixed', value: number }
  | { type: 'formula', formula: '8 + @proficiency + @abilities.cha.mod' }
  | { type: 'spell-dc' }  // Kurzform fuer Caster
```

**Quelle:** dnd5e Roll Data References (`references/dnd5e/module/dice/`)

---

## 4. Cost

> **Frage:** Was kostet es, dieses CombatEvent auszuloesen?

### Kategorien

| Kategorie | Beispiele |
|-----------|-----------|
| **Action Economy** | Action, Bonus Action, Reaction, Free |
| **Resources** | Spell Slot, Ki Points, Superiority Dice |
| **Movement** | Movement Speed (for Dash, etc.) |
| **Cooldown** | Recharge (5-6), 1/Short Rest, 1/Long Rest |
| **Material** | Gold cost, Component consumption |
| **Items** | Ammunition, Potions, Scrolls |

### Schema

```typescript
type Cost =
  // === ACTION ECONOMY ===
  | { type: 'action-economy', economy: ActionEconomy }
  | { type: 'free' }

  // === RESOURCES ===
  | { type: 'spell-slot', level: number | 'any' }
  | { type: 'resource', resource: ResourceId, amount: number }
  | { type: 'hp', amount: number }
  | { type: 'legendary', points: number }

  // === ITEMS (verbraucht aus Inventory) ===
  | { type: 'consume-item', itemId?: string, itemTag?: string, quantity: number }

  // === MOVEMENT ===
  | { type: 'movement', amount: Distance | 'all' }

  // === COOLDOWNS ===
  | { type: 'recharge', range: [number, number] }
  | { type: 'per-rest', restType: 'short' | 'long', uses: number }
  | { type: 'per-day', uses: number }

  // === MATERIAL ===
  | { type: 'material', gp: number, consumed: boolean }

  // === COMPOSITION ===
  | { type: 'composite', costs: Cost[] }
  | { type: 'choice', options: Cost[] }

type ActionEconomy = 'action' | 'bonus-action' | 'reaction' | 'free' | 'legendary' | 'lair'
```

### consume-item Cost

Verbraucht Items aus dem Combat-Inventory des Combatants:

```typescript
{ type: 'consume-item', itemId?: string, itemTag?: string, quantity: number }
```

**Felder:**
- `itemId` - Exakte Item-ID (z.B. `'crossbow-bolt'`)
- `itemTag` - Item-Tag fuer kategorische Matches (z.B. `'ammunition'`)
- `quantity` - Anzahl zu verbrauchen (default: 1)

**Beispiele:**

```yaml
# Crossbow mit Ammunition (ueber Tag)
cost:
  type: composite
  costs:
    - { type: 'action-economy', economy: 'action' }
    - { type: 'consume-item', itemTag: 'ammunition', quantity: 1 }

# Healing Potion (ueber ID)
cost:
  type: composite
  costs:
    - { type: 'action-economy', economy: 'bonus-action' }
    - { type: 'consume-item', itemId: 'potion-of-healing', quantity: 1 }
```

**Inventory-Integration:**
- Combat-Inventory wird bei Combat-Start aus NPC.possessions / Character.inventory kopiert
- `isCostAffordable()` prueft ob genug Items vorhanden sind
- `consumeActionCost()` decrementiert die Quantity nach Resolution
- Wenn `quantity` auf 0 faellt, wird das Item nicht entfernt (fuer Recovery-Tracking)

### Cooldown-Tracking (inspiriert von GAS/ModiBuff)

Erweiterte Recharge-Mechanik mit explizitem State:

```typescript
type Cost =
  | { type: 'recharge',
      range: [number, number],    // 5-6 = 5 oder 6 auf d6
      rechargeTrigger?: 'start-of-turn' | 'short-rest' | 'long-rest'
    }
  | { type: 'cooldown',
      turns: number,              // Nicht verfuegbar fuer N Runden
      sharedCooldown?: string     // Cooldown-Gruppe
    }
  | { type: 'charges',
      max: number,
      recharge: { amount: number | string, trigger: 'dawn' | 'short-rest' | 'long-rest' }
    }
```

Beispiel - Staff of Power:
```yaml
cost:
  type: charges
  max: 20
  recharge: { amount: '2d8+4', trigger: 'dawn' }
```

### Composite Cost Beispiele

```yaml
# Paladin Smite (Slot + Attack)
cost:
  type: composite
  costs:
    - { type: 'action-economy', economy: 'free' }  # Teil des Angriffs
    - { type: 'spell-slot', level: 1 }

# Sorcerer Quickened Spell
cost:
  type: composite
  costs:
    - { type: 'action-economy', economy: 'bonus-action' }
    - { type: 'resource', resource: 'sorcery-points', amount: 2 }
    - { type: 'spell-slot', level: 'any' }
```

**Quellen:** GAS Duration/Cooldown Types, ModiBuff Interval System

---

## 5. Targeting

> **Frage:** Wen/Was kann dieses CombatEvent treffen und wo?

### Dimensionen

| Dimension | Frage | Beispiele |
|-----------|-------|-----------|
| **Count** | Wie viele? | 1, 2, "all in area" |
| **Filter** | Wer ist gueltig? | Enemies only, Allies only, Any creature |
| **Shape** | Welche Geometrie? | Single, Cone, Sphere, Line, Cube |
| **Range** | Wie weit? | Self, Touch, 30ft, 120ft |
| **Origin** | Von wo aus? | Self, Point in range |

### Schema

```typescript
type Targeting =
  | { type: 'single', range: Range, filter: TargetFilter }
  | { type: 'multi', count: number | 'all', range: Range, filter: TargetFilter, unique: boolean }
  | { type: 'area', shape: AreaShape, origin: AreaOrigin, filter: TargetFilter }
  | { type: 'self' }
  | { type: 'chain', primary: Targeting, secondary: { count: number, range: Distance, filter: TargetFilter } }

type Range =
  | { type: 'self' }
  | { type: 'touch' }
  | { type: 'reach', distance: Distance }
  | { type: 'ranged', normal: Distance, disadvantage?: Distance }

type AreaShape =
  | { shape: 'sphere', radius: Distance }
  | { shape: 'cube', size: Distance }
  | { shape: 'cone', length: Distance }
  | { shape: 'line', length: Distance, width: Distance }
  | { shape: 'cylinder', radius: Distance, height: Distance }

type AreaOrigin =
  | { type: 'self' }
  | { type: 'point', range: Distance }
  | { type: 'target', range: Distance }

type TargetFilter =
  | 'any'
  | 'ally'
  | 'enemy'
  | 'self'
  | 'other'
  | 'willing'
  | 'creature'
  | 'object'
  | { type: 'creature-type', types: CreatureType[] }
  | { type: 'condition', has: ConditionId }
  | { type: 'condition', lacks: ConditionId }
  | { type: 'and', filters: TargetFilter[] }
  | { type: 'or', filters: TargetFilter[] }

type Distance = number  // in feet
```

### Chain Targeting (inspiriert von Avrae)

Fuer Kettenblitz-artige Effekte mit sekundaeren Zielen:

```yaml
id: chain-lightning
targeting:
  type: chain
  primary:
    type: single
    range: { type: 'ranged', normal: 150 }
    filter: enemy
  secondary:
    count: 3
    range: 30  # Von jedem vorherigen Ziel
    filter:
      type: and
      filters:
        - enemy
        - { type: 'not-already-targeted' }
```

**Quellen:** PF2e Selector System, Avrae Target Resolution Pipeline

---

## 6. Effect

> **Frage:** Was passiert wenn das CombatEvent ausgefuehrt wird?

### Kategorien

| Kategorie | Beispiele |
|-----------|-----------|
| **HP** | Damage, Healing, Temp HP |
| **Condition** | Apply, Remove, Modify |
| **Movement** | Push, Pull, Teleport |
| **Resources** | Consume, Restore |
| **Modifier** | Grant advantage, Impose disadvantage |
| **Special** | Summon, Transform, Create Zone |

### Schema

```typescript
type Effect =
  // === HP EFFECTS ===
  | { type: 'damage', damage: DamageRoll, damageType: DamageType }
  | { type: 'healing', healing: DiceExpression }
  | { type: 'temp-hp', amount: DiceExpression }
  | { type: 'max-hp-change', amount: number, permanent: boolean }

  // === CONDITION EFFECTS ===
  | { type: 'apply-condition', condition: ConditionId, to?: EntityRef, source?: EntityRef, linkedTo?: EntityRef, duration?: Duration }
  | { type: 'remove-condition', condition: ConditionId }
  | { type: 'remove-condition-type', conditionType: ConditionType }

  // === MOVEMENT EFFECTS ===
  | { type: 'push', distance: Distance, direction: 'away' | 'toward' | Direction }
  | { type: 'pull', distance: Distance }
  | { type: 'teleport', distance: Distance, destination: 'choice' | 'swap' | 'random' }
  | { type: 'move-to', destination: Position }
  | { type: 'prone' }
  | { type: 'set-speed', value: number }
  | { type: 'block-speed-bonus' }
  | { type: 'movement-restriction', restriction: MovementRestriction, to?: EntityRef }

  // === MODIFIER EFFECTS ===
  | { type: 'grant-advantage', on: ModifierTarget, to?: EntityRef, condition?: Precondition, duration?: Duration }
  | { type: 'impose-disadvantage', on: ModifierTarget, to?: EntityRef, condition?: Precondition, duration?: Duration }
  | { type: 'grant-bonus', on: ModifierTarget, bonus: number | DiceExpression }
  | { type: 'impose-penalty', on: ModifierTarget, penalty: number | DiceExpression }
  | { type: 'grant-resistance', damageType: DamageType, duration?: Duration }
  | { type: 'grant-immunity', damageType: DamageType | ConditionId, duration?: Duration }
  | { type: 'grant-vulnerability', damageType: DamageType, duration?: Duration }

  // === RESOURCE EFFECTS ===
  | { type: 'consume-resource', resource: ResourceId, amount: number }
  | { type: 'restore-resource', resource: ResourceId, amount: number | 'all' }

  // === SPECIAL EFFECTS ===
  | { type: 'create-zone', zone: ZoneDefinition }
  | { type: 'summon', creature: CreatureRef, count: number | DiceExpression }
  | { type: 'transform', into: CreatureRef, duration?: Duration }
  | { type: 'counter', targetType: 'spell' | 'attack' | 'ability' }
  | { type: 'break-concentration' }
  | { type: 'end-concentration' }
  | { type: 'grant-ability', ability: string }
  | { type: 'occupy-hand', hands: number }
  | { type: 'tag', tag: string, value?: any }
  | { type: 'execute-events', events: CombatEventId[], mode: 'all' | 'choice' }
  | { type: 'modify-action-economy', attacksPerAction: number }

  // === COMPOSITION ===
  | { type: 'all', effects: Effect[] }
  | { type: 'choice', effects: Effect[] }
  | { type: 'conditional', condition: Precondition, then: Effect, else?: Effect }
  | { type: 'on-check-result',
      'critical-success'?: Effect,
      'success'?: Effect,
      'failure'?: Effect,
      'critical-failure'?: Effect
    }
  | { type: 'on-event', event: ReactionEvent, effect: Effect }
  | { type: 'scaled', base: Effect, perLevel?: Effect }
  | { type: 'repeated', effect: Effect, times: number | DiceExpression }
  | { type: 'none' }

type DamageRoll = DiceExpression | { base: DiceExpression, bonus?: number }
type DiceExpression = string  // e.g., "2d6", "1d8+3", "4d6kh3"

type ModifierTarget =
  | 'attack-rolls'
  | 'saving-throws'
  | 'ability-checks'
  | 'damage-rolls'
  | 'ac'
  | 'speed'
  | { type: 'specific-save', ability: AbilityType }
  | { type: 'specific-skill', skill: SkillType }

type MovementRestriction = 'cannot-move-closer' | 'cannot-move-away' | 'cannot-move'
```

### Stacking Policies (inspiriert von GAS)

Wie verhalten sich mehrere Instanzen desselben Effects?

```typescript
type StackingPolicy =
  | 'none'           // Ignoriere Duplikate (z.B. Rage)
  | 'refresh'        // Setze Duration zurueck
  | 'add-stacks'     // Erhoehe Stack-Counter
  | 'highest-wins'   // Nur staerkster Effekt aktiv
  | 'aggregate'      // Alle Werte addieren

type Effect = {
  // ... bestehende Felder
  stacking?: {
    policy: StackingPolicy
    maxStacks?: number
    stackEffect?: Effect  // Pro Stack zusaetzlich
  }
}
```

Beispiel - Barbarian Rage (stackt nicht):
```yaml
effect:
  type: grant-bonus
  on: damage-rolls
  bonus: 2
  stacking:
    policy: 'none'
```

### EffectOn Flags (inspiriert von ModiBuff)

Wann wird ein Effect ausgewertet?

```typescript
type EffectTiming =
  | 'on-apply'       // Einmalig bei Anwendung
  | 'on-interval'    // Wiederholt (z.B. DoT)
  | 'on-stack'       // Bei jedem neuen Stack
  | 'on-remove'      // Bei Entfernung

type Effect = {
  // ... bestehende Felder
  timing?: EffectTiming
  interval?: Duration  // Fuer 'on-interval'
}
```

Beispiel - Poison (DoT):
```yaml
effect:
  type: damage
  damage: '1d4'
  damageType: poison
  timing: 'on-interval'
  interval: { type: 'rounds', count: 1, until: 'start' }
```

### Rider Effects (inspiriert von dnd5e)

Zusaetzliche Effekte die an Haupteffekte angehaengt werden:

```yaml
# Flametongue Sword
effect:
  type: all
  effects:
    - type: damage
      damage: '1d8'
      damageType: slashing
    - type: damage
      damage: '2d6'
      damageType: fire
      rider: true  # Markiert als Rider-Effekt
```

**Quellen:** GAS Stacking Policies, ModiBuff EffectOn Flags, dnd5e Active Effects

---

## 7. Duration

> **Frage:** Wie lange haelt der Effekt an und wie endet er?

### Kategorien

| Typ | Ende durch | Beispiel |
|-----|------------|----------|
| **Instant** | Sofort vorbei | Damage |
| **Timed** | Zeit laeuft ab | 1 minute, 1 hour |
| **Rounds** | X Runden | Until end of next turn |
| **Concentration** | Caster verliert | Hold Person |
| **Conditional** | Bedingung erfuellt | Until save succeeds |
| **Permanent** | Nie (bis dispel) | Curse |

### Schema

```typescript
type Duration =
  | { type: 'instant' }
  | { type: 'rounds', count: number, until: 'start' | 'end' }
  | { type: 'minutes', count: number }
  | { type: 'hours', count: number }
  | { type: 'concentration', maxDuration?: Duration, repeatSave?: RepeatSave }
  | { type: 'until-save', save: AbilityType, dc: DC, frequency: 'end-of-turn' | 'start-of-turn' | 'on-damage' }
  | { type: 'until-condition', condition: DurationCondition }
  | { type: 'until-dispelled' }
  | { type: 'permanent' }
  | { type: 'linked', linkedTo: EntityRef | ConditionRef, on?: EntityRef }
  | { type: 'from-source' }
  | { type: 'special', description: string }

type RepeatSave = {
  frequency: 'start-of-turn' | 'end-of-turn' | 'on-damage'
  whose: 'self' | 'target'
  save?: AbilityType
  dc?: DC
  onSuccess: 'end-effect' | 'reduce-effect' | 'custom'
}

// Duration-spezifische Conditions (erweitert Precondition)
type DurationCondition =
  | Precondition
  | { type: 'source-incapacitated' }
  | { type: 'source-dead' }
  | { type: 'forced-apart', distance: Distance | 'reach' }
  | { type: 'escape-action-success' }
  | { type: 'contested-check-success', self: SkillChoice, vs: string, trigger: 'on-action-spent' }
  | { type: 'action-taken', action: string, movementCost?: 'half' | 'all' }
```

### Duration-Typen-Klassifikation (inspiriert von GAS)

Drei Hauptkategorien fuer Duration-Handling:

| Typ | Beschreibung | Cleanup |
|-----|--------------|---------|
| **Instant** | Sofort angewandt, kein Tracking | Kein State |
| **Duration** | Zeitbasiert, automatisches Ende | Timer-basiert |
| **Infinite** | Bis manuell entfernt | Explizit |

```typescript
type DurationType = 'instant' | 'duration' | 'infinite'

// Mapping zu bestehendem Schema
// instant: { type: 'instant' }
// duration: { type: 'rounds' | 'minutes' | 'hours' | 'concentration' }
// infinite: { type: 'permanent' | 'until-dispelled' }
```

### Linked Duration Patterns

Fuer verbundene Conditions (Grappled ↔ Grappling):

```yaml
# Auf dem Grappler
duration:
  type: linked
  linkedTo: 'condition-grappled'
  on: 'target'
  propagation: 'bidirectional'  # Beide enden zusammen

# Alternatives Pattern: Lineage-Tracking (inspiriert von dnd_engine)
duration:
  type: linked
  lineage:
    parent: 'grapple-action'    # Urspruengliche Aktion
    children: ['grappled', 'grappling']
```

**Quellen:** GAS Duration Types, dnd_engine Lineage System

---

## Conditions als CombatEvents

**Paradigmenwechsel:** Conditions sind keine separate Schema-Ebene, sondern selbst CombatEvents mit passivem Trigger und Duration-basierter Interaktion.

### Beispiel: Grappled

```yaml
id: condition-grappled
name: Grappled
description: "Speed becomes 0, can't benefit from bonuses to speed"

trigger: { type: 'passive' }
precondition: { type: 'always' }
cost: { type: 'free' }
targeting: { type: 'self' }
check: { type: 'none' }

effect:
  type: all
  effects:
    - { type: 'set-speed', value: 0 }
    - { type: 'block-speed-bonus' }

duration:
  type: until-condition
  condition:
    type: or
    conditions:
      - { type: 'source-incapacitated' }
      - { type: 'source-dead' }
      - { type: 'forced-apart', distance: 'reach' }
      - type: 'contested-check-success'
        self: { choice: ['athletics', 'acrobatics'] }
        vs: 'source.athletics'
        trigger: 'on-action-spent'
```

### Beispiel: Prone

```yaml
id: condition-prone
name: Prone
trigger: { type: 'passive' }
targeting: { type: 'self' }
check: { type: 'none' }

effect:
  type: all
  effects:
    - type: 'impose-disadvantage'
      on: 'attack-rolls'
    - type: 'grant-advantage'
      to: 'attackers'
      condition: { type: 'within-range', range: 5 }
    - type: 'impose-disadvantage'
      to: 'attackers'
      condition: { type: 'beyond-range', range: 5 }

duration:
  type: until-condition
  condition:
    type: 'action-taken'
    action: 'stand-up'
    movementCost: 'half'
```

### Beispiel: Frightened

```yaml
id: condition-frightened
name: Frightened
trigger: { type: 'passive' }
targeting: { type: 'self' }
check: { type: 'none' }

effect:
  type: all
  effects:
    - type: 'impose-disadvantage'
      on: 'attack-rolls'
      condition: { type: 'can-see', target: 'source' }
    - type: 'impose-disadvantage'
      on: 'ability-checks'
      condition: { type: 'can-see', target: 'source' }
    - type: 'movement-restriction'
      restriction: 'cannot-move-closer'
      to: 'source'

duration:
  type: 'from-source'
```

### Beispiel: Restrained

```yaml
id: condition-restrained
name: Restrained
trigger: { type: 'passive' }
targeting: { type: 'self' }
check: { type: 'none' }

effect:
  type: all
  effects:
    - { type: 'set-speed', value: 0 }
    - { type: 'impose-disadvantage', on: 'attack-rolls' }
    - { type: 'grant-advantage', to: 'attackers' }
    - { type: 'impose-disadvantage', on: { type: 'specific-save', ability: 'dex' } }

duration:
  type: 'from-source'
```

### Linked Conditions

Manche Conditions sind miteinander verbunden (z.B. Grappled und Grappling):

```yaml
# Grappling (auf dem Grappler)
id: condition-grappling
name: Grappling
trigger: { type: 'passive' }
targeting: { type: 'self' }
check: { type: 'none' }

effect:
  type: all
  effects:
    - type: 'grant-ability'
      ability: 'drag-grappled'
    - type: 'occupy-hand'
      hands: 1

duration:
  type: 'linked'
  linkedTo: 'condition-grappled'
  on: 'target'
```

Die Beziehung wird durch `duration.linkedTo` definiert - wenn eine endet, endet auch die andere automatisch.

---

## 8. Zones

> **Frage:** Wie funktionieren persistente Flaecheneffekte?

Zones sind persistente Bereiche mit eigenen Triggern und Effekten (Cloudkill, Spirit Guardians, Wall of Fire).

### ZoneDefinition

```typescript
type ZoneDefinition = {
  id: string
  shape?: AreaShape
  origin?: AreaOrigin

  // Movement behavior (default: static)
  movement?: ZoneMovement

  // Flexible Trigger-Effect-Pairs (empfohlen)
  effects?: Array<{
    triggers: ZoneTriggerEvent | ZoneTriggerEvent[]  // Single oder Array
    effect: Effect
  }>

  // Filter fuer Zone-Effekte
  filter?: 'enemies' | 'allies' | 'all' | 'any'

  // Speed modification (z.B. 0.5 = difficult terrain)
  speedModifier?: number
}

type ZoneTriggerEvent = 'on-enter' | 'on-leave' | 'on-start-turn' | 'on-end-turn'

type ZoneMovement =
  | { type: 'static' }                                  // Default: Zone bewegt sich nicht
  | { type: 'attached', to: EntityRef }                 // Spirit Guardians: folgt Caster
  | { type: 'movable', cost: Cost, distance: number }   // Moonbeam: Bonus Action zum Bewegen
  | { type: 'drift', direction: 'wind' | Direction, distance: number }  // Cloudkill: driftet
```

### Trigger-Effect-Pairs

Das `effects`-Array erlaubt flexible Kombinationen:

```yaml
# Gleicher Effect fuer mehrere Trigger (Array)
effects:
  - triggers: ['on-enter', 'on-start-turn']
    effect: { type: 'damage', damage: '3d8', damageType: 'radiant' }

# Unterschiedliche Effects pro Trigger
effects:
  - triggers: 'on-enter'
    effect: { type: 'damage', damage: '2d6', damageType: 'fire' }
  - triggers: 'on-leave'
    effect: { type: 'damage', damage: '1d6', damageType: 'fire' }
```

### Zone-Beispiele

**Cloudkill (mit Drift):**
```yaml
effect:
  type: create-zone
  zone:
    id: cloudkill-zone
    shape: { shape: 'sphere', radius: 20 }
    movement: { type: 'drift', direction: 'wind', distance: 10 }  # 10ft pro Runde
    effects:
      - triggers: ['on-enter', 'on-start-turn']
        effect:
          type: on-check-result
          failure: { type: 'damage', damage: '5d8', damageType: 'poison' }
          success: { type: 'damage', damage: '2d8', damageType: 'poison' }
check: { type: 'save', save: 'con', dc: { type: 'spell-dc' } }

duration:
  type: concentration
  maxDuration: { type: 'minutes', count: 10 }
```

**Spirit Guardians (Attached):**
```yaml
effect:
  type: create-zone
  zone:
    id: spirit-guardians-zone
    shape: { shape: 'sphere', radius: 15 }
    movement: { type: 'attached', to: 'self' }  # Bewegt sich mit Caster
    speedModifier: 0.5  # Difficult Terrain fuer Enemies
    filter: 'enemies'
    effects:
      - triggers: ['on-enter', 'on-start-turn']
        effect:
          type: on-check-result
          failure: { type: 'damage', damage: '3d8', damageType: 'radiant' }
          success: { type: 'damage', damage: '1d8', damageType: 'radiant' }
check: { type: 'save', save: 'wis', dc: { type: 'spell-dc' } }

duration:
  type: concentration
  maxDuration: { type: 'minutes', count: 10 }
```

**Moonbeam (Movable):**
```yaml
effect:
  type: create-zone
  zone:
    id: moonbeam-zone
    shape: { shape: 'cylinder', radius: 5, height: 40 }
    origin: { type: 'point', range: 120 }
    movement:
      type: 'movable'
      cost: { type: 'action-economy', economy: 'bonus-action' }
      distance: 60  # Max 60ft pro Move
    effects:
      - triggers: ['on-enter', 'on-start-turn']
        effect:
          type: on-check-result
          failure: { type: 'damage', damage: '2d10', damageType: 'radiant' }
          success: { type: 'damage', damage: '1d10', damageType: 'radiant' }
check: { type: 'save', save: 'con', dc: { type: 'spell-dc' } }

duration:
  type: concentration
  maxDuration: { type: 'minutes', count: 1 }
```

**Quellen:** Cataclysm EOC Pattern, dnd5e Active Effects

---

## Beispiele

### Longsword Attack

```yaml
id: longsword-attack
name: Longsword Attack
precondition: { type: 'is-wielding', weaponProperty: ['versatile'] }
trigger: { type: 'active' }
cost: { type: 'action-economy', economy: 'action' }
targeting:
  type: single
  range: { type: 'reach', distance: 5 }
  filter: enemy
check: { type: 'attack', attackType: 'melee-weapon' }
effect: { type: 'damage', damage: '1d8', damageType: 'slashing' }
duration: { type: 'instant' }
```

### Fireball

```yaml
id: fireball
name: Fireball
precondition: { type: 'has-resource', resource: 'spell-slot', amount: 3 }
trigger: { type: 'active' }
cost:
  type: composite
  costs:
    - { type: 'action-economy', economy: 'action' }
    - { type: 'spell-slot', level: 3 }
targeting:
  type: area
  shape: { shape: 'sphere', radius: 20 }
  origin: { type: 'point', range: 150 }
  filter: any
check: { type: 'save', save: 'dex', dc: { type: 'spell-dc' } }
effect:
  type: on-check-result
  failure: { type: 'damage', damage: '8d6', damageType: 'fire' }
  success: { type: 'damage', damage: '4d6', damageType: 'fire' }
duration: { type: 'instant' }
```

### Opportunity Attack

```yaml
id: opportunity-attack
name: Opportunity Attack
precondition:
  type: and
  conditions:
    - { type: 'has-resource', resource: 'reaction', amount: 1 }
    - { type: 'is-wielding', weaponProperty: ['melee'] }
trigger: { type: 'reaction', event: 'on-enemy-leaves-reach' }
cost: { type: 'action-economy', economy: 'reaction' }
targeting:
  type: single
  range: { type: 'reach', distance: 5 }
  filter: enemy
check: { type: 'attack', attackType: 'melee-weapon' }
effect: { type: 'damage', damage: '1d8', damageType: 'slashing' }
duration: { type: 'instant' }
```

### Paladin Aura of Protection

```yaml
id: aura-of-protection
name: Aura of Protection
precondition: { type: 'always' }
trigger: { type: 'aura', radius: 10 }
cost: { type: 'free' }
targeting:
  type: area
  shape: { shape: 'sphere', radius: 10 }
  origin: { type: 'self' }
  filter: ally
check: { type: 'none' }
effect:
  type: grant-bonus
  on: saving-throws
  bonus: 3  # CHA modifier
duration: { type: 'permanent' }
```

### Grapple

```yaml
id: grapple
name: Grapple
precondition:
  type: and
  conditions:
    - { type: 'has-free-hand' }
    - { type: 'has-no-condition', target: 'self', condition: 'incapacitated' }
trigger: { type: 'active' }
cost: { type: 'action-economy', economy: 'action' }
targeting:
  type: single
  range: { type: 'reach', distance: 5 }
  filter:
    type: and
    filters:
      - enemy
      - { type: 'size-category', max: 'one-larger' }
check:
  type: contested
  self: 'athletics'
  target: { choice: ['athletics', 'acrobatics'] }
effect:
  type: on-check-result
  success:
    type: all
    effects:
      - type: 'apply-condition'
        condition: 'grappled'
        to: 'target'
        source: 'self'
      - type: 'apply-condition'
        condition: 'grappling'
        to: 'self'
        linkedTo: 'target'
  failure: { type: 'none' }
duration: { type: 'instant' }
```

### Hold Person

```yaml
id: hold-person
name: Hold Person
precondition: { type: 'has-resource', resource: 'spell-slot', amount: 2 }
trigger: { type: 'active' }
cost:
  type: composite
  costs:
    - { type: 'action-economy', economy: 'action' }
    - { type: 'spell-slot', level: 2 }
targeting:
  type: single
  range: { type: 'ranged', normal: 60 }
  filter: { type: 'creature-type', types: ['humanoid'] }
check:
  type: save
  save: 'wis'
  dc: { type: 'spell-dc' }
effect:
  type: on-check-result
  failure:
    type: 'apply-condition'
    condition: 'paralyzed'
    to: 'target'
    source: 'self'
  success:
    type: 'none'
duration:
  type: 'concentration'
  maxDuration: { type: 'minutes', count: 1 }
  repeatSave:
    frequency: 'end-of-turn'
    whose: 'target'
    onSuccess: 'end-effect'
tags: ['spell', 'enchantment', 'level-2']
```

### Multiattack (Wolf)

```yaml
id: multiattack-wolf
name: Multiattack (Wolf)
precondition: { type: 'always' }
trigger: { type: 'active' }
cost: { type: 'action-economy', economy: 'action' }
effect:
  type: 'execute-events'
  events: ['bite-attack', 'claw-attack']
  mode: 'all'
```

### Lair Action

```yaml
id: lair-action-magma
name: Lair Action (Magma Eruption)
trigger:
  type: 'on-initiative'
  initiative: 20
  timing: 'loses-ties'
cost: { type: 'free' }
targeting:
  type: area
  shape: { shape: 'sphere', radius: 10 }
  origin: { type: 'point', range: 120 }
  filter: any
check: { type: 'save', save: 'dex', dc: { type: 'fixed', value: 15 } }
effect:
  type: on-check-result
  failure: { type: 'damage', damage: '4d6', damageType: 'fire' }
  success: { type: 'damage', damage: '2d6', damageType: 'fire' }
duration: { type: 'instant' }
```

### Legendary Action

```yaml
id: legendary-tail-attack
name: Tail Attack (Legendary)
precondition: { type: 'always' }
trigger: { type: 'active' }
cost:
  type: composite
  costs:
    - { type: 'legendary', points: 1 }
targeting:
  type: single
  range: { type: 'reach', distance: 15 }
  filter: enemy
check: { type: 'attack', attackType: 'melee-weapon' }
effect: { type: 'damage', damage: '2d8+8', damageType: 'bludgeoning' }
duration: { type: 'instant' }
```

---

## Design-Entscheidungen

### Aura Stacking

Aura-Boni **stacken** (addieren sich). Zwei Paladins mit Aura of Protection (CHA +3 und CHA +4) geben Allies +7 auf Saving Throws.

Dies weicht von D&D 5e RAW ab, ist aber einfacher zu implementieren und belohnt Teamzusammenstellung.

### Escape durch Duration-Logik

Escape ist kein separates CombatEvent, sondern wird durch die Duration-Preconditions der Condition gehandhabt. Die Duration-Condition `contested-check-success` definiert wann, wie und was passiert.

### Concentration

Kombinierter Ansatz - Duration-Typ + automatische Condition. Wenn ein CombatEvent mit `duration.type: 'concentration'` angewendet wird, erhaelt der Caster automatisch die `concentrating` Condition, die bei Schaden einen CON Save erfordert.

---

## Evaluator-Pipeline

Die Pipeline durchlaeuft 4 Phasen, die jeweils Reaction Windows oeffnen:

### Phase 1: Declaration

```
┌─────────────────────────────────────────────────┐
│ 1. checkPrecondition(event, context)            │
│    → Boolean: Event verfuegbar?                 │
│                                                 │
│ 2. evaluateTrigger(event, gameEvent)            │
│    → Boolean: Trigger-Bedingung erfuellt?       │
│                                                 │
│ 3. REACTION WINDOW: Declaration Phase           │
│    → Shield, Cutting Words koennen reagieren    │
└─────────────────────────────────────────────────┘
```

### Phase 2: Execution

```
┌─────────────────────────────────────────────────┐
│ 4. deductCost(event, actor)                     │
│    → Resources konsumieren                      │
│                                                 │
│ 5. resolveTargeting(event, context)             │
│    → EntityRef[] der gueltigen Ziele            │
│                                                 │
│ 6. performCheck(event, target)                  │
│    → CheckResult pro Ziel                       │
│                                                 │
│ 7. REACTION WINDOW: Execution Phase             │
│    → Counterspell, Silvery Barbs                │
└─────────────────────────────────────────────────┘
```

### Phase 3: Effect

```
┌─────────────────────────────────────────────────┐
│ 8. resolveEffect(event, target, checkResult)    │
│    → Effect-Instanz mit konkreten Werten        │
│                                                 │
│ 9. applyStacking(effect, existingEffects)       │
│    → Stacking-Policy anwenden                   │
│                                                 │
│ 10. applyEffect(effect, target, state)          │
│     → State-Mutation                            │
│                                                 │
│ 11. REACTION WINDOW: Effect Phase               │
│     → Absorb Elements, Hellish Rebuke           │
└─────────────────────────────────────────────────┘
```

### Phase 4: Completion

```
┌─────────────────────────────────────────────────┐
│ 12. trackDuration(effect, durationState)        │
│     → Duration-Tracking initialisieren          │
│                                                 │
│ 13. emitCompletionEvent(event, result)          │
│     → Fuer Trigger anderer Events               │
│                                                 │
│ 14. REACTION WINDOW: Completion Phase           │
│     → Riposte, Sentinel Stop                    │
│                                                 │
│ 15. return CombatEventResult                    │
└─────────────────────────────────────────────────┘
```

### Context-Objekt

```typescript
type EvaluatorContext = {
  // Akteure
  actor: Combatant
  targets: Combatant[]

  // State
  combatState: CombatState
  durationState: Map<ConditionId, DurationTracker>

  // Event-Kontext
  triggeringEvent?: GameEvent
  parentEvent?: CombatEventId  // Fuer Lineage

  // Modifiers
  activeModifiers: Modifier[]

  // Roll-Cache (fuer Reaction Windows)
  rollResults: Map<string, number>
}
```

**Quellen:** dnd_engine Event-Architektur, PF2e Priority-based Pipeline

---

## Siehe auch

- [combatTracking](../services/combatTracking/combatTracking.md) - Resolution Service
- [combatantAI](../services/combatantAI/combatantAI.md) - AI Decision Making
- [Combat](../features/Combat.md) - Feature Overview
