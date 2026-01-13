# gatherModifiers

> **Verantwortlichkeit:** Sammelt alle Modifier die eine Aktion beeinflussen
> **Input:** Attacker, Target, Action, CombatState
> **Output:** ModifierSet
> **Pfad:** `src/services/combatTracking/resolution/gatherModifiers.ts`
> **Schema:** [conditionExpression.ts](../../../src/types/entities/conditionExpression.ts) (SchemaModifier)

---

## Uebersicht

`gatherModifiers` sammelt Modifier aus 4 einheitlichen Quellen und evaluiert sie mit derselben Logik. Alle Modifier verwenden das `SchemaModifier` Format - keine separate Behandlung nach Typ.

```
┌─────────────────────────────────────────────────────────────┐
│ gatherModifiers(attacker, target, action, state)            │
│                                                             │
│   1. attacker.combatState.modifiers[]  → ActiveModifier[]   │
│   2. target.combatState.modifiers[]    → ActiveModifier[]   │
│   3. action.modifierRefs[] + schemaModifiers[]              │
│   4. state.areaEffects[]               → AreaEffect[]       │
│                                                             │
│   Alle: evaluateCondition(mod.condition, ctx) → applyEffect │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
    ModifierSet
```

---

## Output-Struktur

```typescript
interface ModifierSet {
  // Attack Modifiers
  attackAdvantage: AdvantageState;    // 'advantage' | 'disadvantage' | 'none'
  attackBonus: number;                // Flat bonus (Bless, etc.)

  // Defense Modifiers
  targetACBonus: number;              // Shield, Cover, etc.

  // Save Modifiers
  saveAdvantage: AdvantageState;      // Magic Resistance, etc.
  saveBonus: number;                  // Bless on save, etc.

  // Damage Modifiers
  damageBonus: number;                // Extra damage modifiers

  // Tracking
  sources: string[];                  // IDs der aktiven Modifier
}

type AdvantageState = 'advantage' | 'disadvantage' | 'none';
```

---

## Modifier-Quellen

### 1. Attacker-Modifier (`attacker.combatState.modifiers[]`)

Modifier die auf dem Angreifer liegen:

| Typ | Beispiele |
|-----|-----------|
| Conditions (Self) | Blinded → Disadvantage, Prone → Disadvantage (Ranged) |
| Buffs | Bless → +1d4 Attack |
| Traits | Pack Tactics, Reckless Attack |

### 2. Target-Modifier (`target.combatState.modifiers[]`)

Modifier die auf dem Ziel liegen:

| Typ | Beispiele |
|-----|-----------|
| Conditions | Restrained → Advantage gegen Target |
| Buffs | Shield → +5 AC |
| Traits | Magic Resistance → Save Advantage |

### 3. Action-Modifier (`action.modifierRefs[]`, `action.schemaModifiers[]`)

Modifier die von der Aktion abhängen:

| Quelle | Beispiele |
|--------|-----------|
| `modifierRefs` | `['long-range', 'ranged-in-melee']` - Preset-IDs |
| `schemaModifiers` | Inline-Modifier fuer action-spezifische Effekte |

```typescript
// Beispiel: Ranged Attack
const longbow: Action = {
  name: 'Longbow',
  modifierRefs: ['long-range', 'ranged-in-melee'],
};
```

### 4. Area Effects (`state.areaEffects[]`)

Position-basierte Modifier:

| Typ | Beispiele |
|-----|-----------|
| Cover | Hindernis zwischen Attacker und Target → +2/+5 AC |
| Auras | Aura of Protection → Save Bonus fuer Allies im Radius |
| Zones | Spirit Guardians → Damage wenn Target in Zone |

---

## Schema-Referenz

### SchemaModifier

Einheitliches Format fuer alle Modifier-Definitionen:

```typescript
interface SchemaModifier {
  id: string;
  name: string;
  description?: string;
  condition: ConditionExpression;  // Wann ist Modifier aktiv?
  effect: SchemaModifierEffect;    // Was bewirkt er?
  priority?: number;               // Evaluierungs-Reihenfolge
}
```

**Definiert in:** `src/types/entities/conditionExpression.ts`

### ActiveModifier

Runtime-Wrapper mit Metadaten:

```typescript
interface ActiveModifier {
  modifier: SchemaModifier;
  source: ModifierSource;
  duration?: ModifierDuration;
  probability: number;  // 1.0 = sicher aktiv
}

interface ModifierSource {
  type: 'condition' | 'buff' | 'trait' | 'item' | 'spell' | 'aura';
  sourceId?: string;
  concentrationOf?: string;
}

interface ModifierDuration {
  type: 'rounds' | 'until-save' | 'until-escape' | 'permanent';
  value?: number;
  saveAt?: 'start' | 'end';
  saveDC?: number;
  saveAbility?: AbilityName;
}
```

### AreaEffect

Position-basierte Effekte:

```typescript
interface AreaEffect {
  id: string;
  ownerId: string;          // 'terrain' oder Combatant-ID
  sourceActionId: string;
  area: AreaDefinition;
  modifier: SchemaModifier;
  triggeredThisTurn: Set<string>;
}

interface AreaDefinition {
  type: 'sphere' | 'cylinder' | 'cone' | 'line' | 'cube';
  radius?: number;
  length?: number;
  width?: number;
  origin: 'self' | 'point';
  position?: GridPosition;
}
```

---

## Evaluation-Flow

```typescript
function gatherModifiers(
  attacker: Combatant,
  target: Combatant,
  action: Action,
  state: CombatState
): ModifierSet {
  const ctx = buildEvaluationContext(attacker, target, action, state);

  // 1. Sammle alle SchemaModifier aus den 4 Quellen
  const allModifiers: SchemaModifier[] = [
    ...attacker.combatState.modifiers.map(am => am.modifier),
    ...target.combatState.modifiers.map(am => am.modifier),
    ...resolveModifierRefs(action.modifierRefs ?? []),
    ...(action.schemaModifiers ?? []),
    ...getAreaModifiers(attacker, target, state)
  ];

  // 2. Evaluiere und akkumuliere (sortiert nach Priority)
  const result = createEmptyModifierSet();

  for (const mod of allModifiers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
    if (evaluateCondition(mod.condition, ctx)) {
      applyEffect(result, mod.effect);
      result.sources.push(mod.id);
    }
  }

  // 3. Advantage-Resolution
  result.attackAdvantage = resolveAdvantageState(
    result.attackAdvSources,
    result.attackDisadvSources
  );

  return result;
}
```

### resolveModifierRefs

Loest Preset-IDs zu SchemaModifier auf:

```typescript
function resolveModifierRefs(refs: string[]): SchemaModifier[] {
  return refs
    .map(id => modifierPresetsMap.get(id))
    .filter((m): m is SchemaModifier => m !== undefined);
}
```

### getAreaModifiers

Sammelt relevante AreaEffects:

```typescript
function getAreaModifiers(
  attacker: Combatant,
  target: Combatant,
  state: CombatState
): SchemaModifier[] {
  const result: SchemaModifier[] = [];

  for (const area of state.areaEffects) {
    // Cover: Hindernis zwischen Attacker und Target
    if (area.ownerId === 'terrain') {
      if (isObstacleBetween(attacker, target, area, state)) {
        result.push(area.modifier);
      }
      continue;
    }

    // Auras/Zones: Prüfe ob Combatant im Radius
    const owner = state.combatants.find(c => c.id === area.ownerId);
    if (!owner || isIncapacitated(owner)) continue;

    if (isInArea(attacker.combatState.position, area, owner) ||
        isInArea(target.combatState.position, area, owner)) {
      result.push(area.modifier);
    }
  }

  return result;
}
```

---

## Modifier-Lifecycle

### Combat-Initialisierung

Bei `initialiseCombat()` werden Modifier gesetzt:

```typescript
// Creature Traits auf Combatants laden
for (const combatant of state.combatants) {
  for (const trait of getPassiveTraits(combatant)) {
    combatant.combatState.modifiers.push({
      modifier: trait,
      source: { type: 'trait' },
      probability: 1.0
    });
  }
}

// Cover-Hindernisse als AreaEffects
for (const obstacle of state.obstacles ?? []) {
  state.areaEffects.push({
    id: `cover-${obstacle.id}`,
    ownerId: 'terrain',
    sourceActionId: 'terrain-cover',
    area: { type: 'point', position: obstacle.position },
    modifier: modifierPresetsMap.get('half-cover')!,
    triggeredThisTurn: new Set()
  });
}
```

### Condition-Anwendung

```typescript
function applyCondition(
  target: Combatant,
  conditionId: string,
  options: { sourceId?: string; duration?: ModifierDuration }
): void {
  const modifier = modifierPresetsMap.get(`condition-${conditionId}-self`);
  if (modifier) {
    target.combatState.modifiers.push({
      modifier,
      source: { type: 'condition', sourceId: options.sourceId },
      duration: options.duration,
      probability: 1.0
    });
  }
}
```

### Buff-Anwendung

```typescript
function applyBuff(
  target: Combatant,
  buffId: string,
  options: { casterId?: string; duration?: ModifierDuration }
): void {
  const modifier = modifierPresetsMap.get(buffId);
  if (modifier) {
    target.combatState.modifiers.push({
      modifier,
      source: { type: 'spell', concentrationOf: options.casterId },
      duration: options.duration,
      probability: 1.0
    });
  }
}
```

---

## Modifier-Presets

Alle Modifier werden in `presets/modifiers/index.ts` definiert. Keine Kategorisierung nach Typ.

### Beispiel: Long Range

```typescript
export const longRangeModifier: SchemaModifier = {
  id: 'long-range',
  name: 'Long Range',
  description: 'Disadvantage when target is in long range',
  condition: { type: 'target-in-long-range' },
  effect: { disadvantage: true },
  priority: 10,
};
```

### Beispiel: Prone Target (Close)

```typescript
export const proneTargetCloseModifier: SchemaModifier = {
  id: 'prone-target-close',
  name: 'Prone Target (Close)',
  description: 'Advantage on attacks against prone target when adjacent',
  condition: {
    type: 'and',
    conditions: [
      { type: 'has-condition', entity: 'target', condition: 'prone' },
      { type: 'adjacent-to', subject: 'attacker', object: 'target' },
    ],
  },
  effect: { advantage: true },
  priority: 8,
};
```

### Beispiel: Pack Tactics

```typescript
export const packTacticsModifier: SchemaModifier = {
  id: 'pack-tactics',
  name: 'Pack Tactics',
  condition: {
    type: 'exists',
    entity: { type: 'quantified', quantifier: 'any', filter: 'ally', relativeTo: 'attacker' },
    where: { type: 'adjacent-to', subject: 'self', object: 'target' },
  },
  effect: { advantage: true },
  priority: 7,
};
```

---

## Advantage-Stack Regeln

D&D 5e Regel: Advantage und Disadvantage heben sich gegenseitig auf, unabhaengig von der Anzahl.

```typescript
function resolveAdvantageState(
  advantageSources: number,
  disadvantageSources: number
): AdvantageState {
  if (advantageSources > 0 && disadvantageSources > 0) {
    return 'none';  // Heben sich auf
  }
  if (advantageSources > 0) return 'advantage';
  if (disadvantageSources > 0) return 'disadvantage';
  return 'none';
}
```

**Beispiele:**

| Situation | Adv | Disadv | Ergebnis |
|-----------|-----|--------|----------|
| Pack Tactics | 1 | 0 | Advantage |
| Blinded + Prone Target (Melee) | 1 | 1 | None |
| Pack Tactics + Prone Target + Long Range | 2 | 1 | None |

---

## Beispiel: Wolf Attack

```typescript
// Kontext
attacker = Wolf (Pack Tactics auf combatState.modifiers)
target = Bandit (keine aktiven Modifier)
action = Bite (keine modifierRefs)
state = Ally (anderer Wolf) adjacent zu Bandit

// Gesammelte Modifier
1. attacker.modifiers → [packTacticsModifier]
2. target.modifiers → []
3. action.modifierRefs → []
4. state.areaEffects → []

// Evaluation
packTacticsModifier.condition = exists(ally adjacent to target) → TRUE

// Ergebnis
ModifierSet = {
  attackAdvantage: 'advantage',
  attackBonus: 0,
  targetACBonus: 0,
  saveAdvantage: 'none',
  saveBonus: 0,
  damageBonus: 0,
  sources: ['pack-tactics']
}
```

---

## Beispiel: Longbow mit Cover

```typescript
// Kontext
attacker = Archer
target = Goblin (hinter Half Cover)
action = Longbow { modifierRefs: ['long-range', 'ranged-in-melee'] }
state = Target in Normal Range, Half Cover Obstacle

// Gesammelte Modifier
1. attacker.modifiers → []
2. target.modifiers → []
3. action.modifierRefs → [longRangeModifier, rangedInMeleeModifier]
4. state.areaEffects → [halfCoverEffect]

// Evaluation
longRangeModifier.condition = target-in-long-range → FALSE (in normal range)
rangedInMeleeModifier.condition = exists(enemy adjacent) → FALSE
halfCoverEffect.modifier.condition = in-line-between → TRUE

// Ergebnis
ModifierSet = {
  attackAdvantage: 'none',
  attackBonus: 0,
  targetACBonus: 2,  // Half Cover
  saveAdvantage: 'none',
  saveBonus: 0,
  damageBonus: 0,
  sources: ['half-cover']
}
```

---

## Verwandte Dokumente

- [actionResolution.md](actionResolution.md) - Pipeline-Uebersicht
- [findTargets.md](findTargets.md) - Vorheriger Pipeline-Schritt
- [determineSuccess.md](determineSuccess.md) - Naechster Pipeline-Schritt
- [../../types/action.md](../../types/action.md) - Action-Schema
- [conditionExpression.ts](../../../src/types/entities/conditionExpression.ts) - SchemaModifier Definition
- [presets/modifiers/index.ts](../../../presets/modifiers/index.ts) - Modifier-Presets
