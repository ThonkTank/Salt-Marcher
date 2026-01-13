# resolveEffects

> **Verantwortlichkeit:** Berechnet die Effekte einer Aktion basierend auf Success-Results
> **Input:** ResolutionContext, SuccessResult[]
> **Output:** ResolutionResult (pure data, KEINE State-Mutation)
> **Pfad:** `src/services/combatTracking/resolution/resolveEffects.ts`

## Uebersicht

`resolveEffects` ist der vierte und letzte Schritt der Resolution-Pipeline im combatTracking Service. Er berechnet alle Effekte und gibt ein `ResolutionResult` zurueck - **ohne den State zu mutieren**. Die State-Mutation erfolgt im `combatWorkflow.applyResult()`.

```
SuccessResult[] + ResolutionContext
        │
        ▼
┌────────────────┐
│ resolveEffects │
└────────────────┘
        │
        ▼
ResolutionResult (pure data)
        │
        ▼
combatWorkflow.applyResult() [WRITE]
```

---

## Output-Struktur

```typescript
// Finales Ergebnis - KEINE State-Mutation, nur Daten
interface ResolutionResult {
  hpChanges: HPChange[];
  conditionsToAdd: ConditionApplication[];
  conditionsToRemove: ConditionRemoval[];
  forcedMovement: ForcedMovementEntry[];
  zoneActivation?: ZoneActivation;
  concentrationBreak?: string;        // Combatant ID
  protocolData: ProtocolData;         // Fuer Protocol-Entry
}

interface HPChange {
  combatantId: string;
  previousHP: number;                 // Erwartungswert
  newHP: number;                      // Erwartungswert
  change: number;                     // Negativ = Damage, Positiv = Healing
  source: string;
  damageType?: DamageType;
}

interface ConditionApplication {
  target: Combatant;
  condition: ConditionState;
  probability: number;                // 0-1, nach Save-Chance
}

interface ConditionRemoval {
  targetId: string;
  conditionName: string;
}

interface ForcedMovementEntry {
  targetId: string;
  type: 'push' | 'pull' | 'slide';
  distance: number;
  direction?: GridPosition;
}

interface ZoneActivation {
  actionId: string;
  ownerId: string;
  radius: number;
  targetFilter: ValidTargets;
  trigger: ZoneTrigger;
  effect: ActionEffect;
}

interface ProtocolData {
  roundNumber: number;
  actorId: string;
  actorName: string;
  actionName: string;
  targetIds: string[];
  targetNames: string[];
  hit: boolean;
  critical: boolean;
  damageDealt: number;
  damageType?: DamageType;
  conditionsApplied: string[];
  trigger: TriggerType;
}
```

---

## Damage Resolution

### Primary Damage

```typescript
damage: {
  dice: '1d8',
  modifier: 3,
  type: 'slashing'
}
```

**Berechnung:**

```typescript
function calculatePrimaryDamage(
  action: Action,
  successResult: SuccessResult,
  modifiers: ModifierSet
): number {
  if (!action.damage || !successResult.hit) return 0;

  const baseDamage = diceExpectedValue(action.damage.dice)
    + action.damage.modifier
    + modifiers.damageBonus;

  const multiplier = successResult.damageMultiplier;

  return baseDamage * multiplier;
}
```

### Extra Damage

Zusaetzlicher Schaden (Sneak Attack, Divine Smite, etc.):

```typescript
extraDamage: [
  { dice: '2d6', type: 'radiant' },    // Divine Smite
  { dice: '3d6', type: 'piercing' }    // Sneak Attack
]
```

```typescript
function resolveExtraDamage(
  action: Action,
  successResult: SuccessResult
): DamageEntry[] {
  if (!action.extraDamage || !successResult.hit) return [];

  return action.extraDamage.map(extra => ({
    amount: diceExpectedValue(extra.dice) * successResult.damageMultiplier,
    type: extra.type,
    source: 'extra'
  }));
}
```

### Critical Hit Damage

Bei Critical Hit werden Wuerfel verdoppelt:

```typescript
function calculateCritDamage(dice: string, modifier: number): number {
  // "1d8" → "2d8" (Wuerfel verdoppelt, Modifier bleibt)
  return diceExpectedValue(doubleDice(dice)) + modifier;
}
```

### Damage Types

```typescript
type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force'
  | 'lightning' | 'necrotic' | 'piercing' | 'poison'
  | 'psychic' | 'radiant' | 'slashing' | 'thunder';
```

---

## Condition Resolution

### Primaere Conditions (bei Hit)

Conditions die bei erfolgreicher Primaer-Resolution angewandt werden:

```typescript
effects: [
  {
    condition: 'prone',
    affectsTarget: 'enemy',
    duration: { type: 'instant' }
  }
]
```

### Sekundaere Saves (Conditions mit eigenem Save)

Manche Aktionen haben einen Attack Roll UND einen sekundaeren Save fuer Conditions:

```typescript
// Wolf Bite: Attack Roll + STR Save fuer Knockdown
effects: [
  {
    condition: 'prone',
    affectsTarget: 'enemy',
    save: {
      ability: 'str',
      dc: 11,
      onSave: 'none'
    },
    duration: { type: 'instant' }
  }
]
```

**Logik:**

```typescript
function resolveConditionWithSave(
  effect: ActionEffect,
  target: Combatant,
  successResult: SuccessResult,
  modifiers: ModifierSet,
  state: Readonly<CombatState>
): ConditionApplication | null {
  // Nur wenn primaere Resolution erfolgreich war
  if (!successResult.hit) return null;

  // Sekundaeren Save berechnen
  if (effect.save) {
    const saveBonus = getSaveBonus(target, effect.save.ability);
    const saveChance = calculateSaveChance(
      effect.save.dc,
      saveBonus + modifiers.saveBonus,
      modifiers.saveAdvantage
    );

    // Bei onSave: 'none' → Condition nur bei Fail
    if (effect.save.onSave === 'none') {
      const failChance = 1 - saveChance;
      return {
        target,
        condition: buildConditionState(effect),
        probability: failChance
      };
    }
  }

  // Keine Save → volle Wahrscheinlichkeit
  return {
    target,
    condition: buildConditionState(effect),
    probability: successResult.hitProbability
  };
}
```

### Duration-Typen

| Typ | Beschreibung | Beendigung |
|-----|--------------|------------|
| `instant` | Sofort (Prone) | Manuell (Aufstehen) |
| `rounds` | X Runden | Automatisch nach X Runden |
| `until-save` | Bis Save gelingt | Save am Turn-Ende |
| `until-escape` | Bis Escape gelingt | Action zum Escapen |
| `concentration` | Bis Konzentration bricht | Damage oder freiwillig |

### Condition-State aufbauen

```typescript
function buildConditionState(
  effect: ActionEffect,
  sourceId: string
): ConditionState {
  return {
    name: effect.condition,
    probability: 1.0,                 // Wird spaeter angepasst
    effect: CONDITION_EFFECTS[effect.condition],
    duration: effect.duration,
    sourceId,                         // Fuer Escape-Checks
    endingSave: effect.endingSave
  };
}
```

---

## Healing Resolution

```typescript
effects: [
  {
    healing: { dice: '2d8', modifier: 3 },
    affectsTarget: 'ally'
  }
]
```

```typescript
function resolveHealing(
  action: Action,
  successResult: SuccessResult,
  target: Combatant,
  state: Readonly<CombatState>
): HPChange | null {
  const healingEffect = action.effects?.find(e => e.healing);
  if (!healingEffect) return null;

  const healAmount = diceExpectedValue(healingEffect.healing.dice)
    + healingEffect.healing.modifier;

  const currentHP = getExpectedValue(getHP(target));
  const maxHP = getMaxHP(target);
  const newHP = Math.min(currentHP + healAmount, maxHP);

  return {
    combatantId: target.id,
    previousHP: currentHP,
    newHP,
    change: newHP - currentHP,
    source: 'healing'
  };
}
```

---

## Movement Effects

### Forced Movement (Push, Pull, Slide)

```typescript
effects: [
  {
    forcedMovement: {
      type: 'push',
      distance: 10
    }
  }
]
```

```typescript
function resolveForcedMovement(
  effect: ActionEffect,
  target: Combatant,
  actor: Combatant,
  successResult: SuccessResult
): ForcedMovementEntry | null {
  if (!effect.forcedMovement || !successResult.hit) return null;

  return {
    targetId: target.id,
    type: effect.forcedMovement.type,
    distance: effect.forcedMovement.distance
  };
}
```

### Grant Movement (in Protocol, nicht in Result)

Movement Grants (Dash, Teleport) werden im Protocol dokumentiert, aber nicht als HP/Condition-Change.

---

## Zone Activation

Bei Aktionen mit `zone`-Effekt wird eine Zone aktiviert:

```typescript
effects: [
  {
    zone: {
      radius: 15,
      targetFilter: 'enemies',
      trigger: 'on-enter'
    },
    damage: { dice: '3d8', type: 'radiant' },
    duration: { type: 'concentration' }
  }
]
```

```typescript
function resolveZoneActivation(
  action: Action,
  actor: Combatant,
  successResult: SuccessResult
): ZoneActivation | null {
  const zoneEffect = action.effects?.find(e => e.zone);
  if (!zoneEffect || !successResult.hit) return null;

  return {
    actionId: action.id,
    ownerId: actor.id,
    radius: zoneEffect.zone.radius,
    targetFilter: zoneEffect.zone.targetFilter,
    trigger: zoneEffect.zone.trigger,
    effect: zoneEffect
  };
}
```

---

## Concentration Break

Wenn eine Aktion Schaden verursacht, kann die Konzentration des Targets brechen:

```typescript
function resolveConcentrationBreak(
  target: Combatant,
  damage: number,
  state: Readonly<CombatState>
): string | undefined {
  if (!target.combatState.concentratingOn) return undefined;

  const dc = Math.max(10, Math.floor(damage / 2));
  const conSave = getSaveBonus(target, 'con');
  const failChance = 1 - calculateSaveChance(dc, conSave, 'none');

  // Probabilistisch: Bei hoher Fail-Chance → Concentration bricht
  if (failChance > 0.5) {
    return target.id;
  }
  return undefined;
}
```

---

## Kompletter Resolution-Flow

```typescript
function resolveEffects(
  context: ResolutionContext,
  successResults: SuccessResult[],
  modifierSets: ModifierSet[]
): ResolutionResult {
  const hpChanges: HPChange[] = [];
  const conditionsToAdd: ConditionApplication[] = [];
  const forcedMovement: ForcedMovementEntry[] = [];
  let concentrationBreak: string | undefined;

  for (let i = 0; i < successResults.length; i++) {
    const result = successResults[i];
    const modifiers = modifierSets[i];
    const target = result.target;

    // 1. Damage berechnen
    const damage = calculatePrimaryDamage(context.action, result, modifiers);
    const extraDamage = resolveExtraDamage(context.action, result);
    const totalDamage = damage + extraDamage.reduce((sum, d) => sum + d.amount, 0);

    if (totalDamage > 0) {
      const currentHP = getExpectedValue(getHP(target));
      hpChanges.push({
        combatantId: target.id,
        previousHP: currentHP,
        newHP: Math.max(0, currentHP - totalDamage),
        change: -totalDamage,
        source: context.action.name,
        damageType: context.action.damage?.type
      });

      // Concentration-Check bei Damage
      const concBreak = resolveConcentrationBreak(target, totalDamage, context.state);
      if (concBreak) concentrationBreak = concBreak;
    }

    // 2. Conditions berechnen (inkl. sekundaere Saves)
    for (const effect of context.action.effects ?? []) {
      if (effect.condition && effect.affectsTarget === 'enemy') {
        const condApp = resolveConditionWithSave(
          effect, target, result, modifiers, context.state
        );
        if (condApp) conditionsToAdd.push(condApp);
      }
    }

    // 3. Forced Movement
    for (const effect of context.action.effects ?? []) {
      const movement = resolveForcedMovement(effect, target, context.actor, result);
      if (movement) forcedMovement.push(movement);
    }
  }

  // 4. Healing (fuer Ally-Targets)
  for (const result of successResults) {
    const healing = resolveHealing(context.action, result, result.target, context.state);
    if (healing) hpChanges.push(healing);
  }

  // 5. Zone Activation
  const zoneActivation = resolveZoneActivation(
    context.action, context.actor, successResults[0]
  );

  // 6. Protocol-Daten aufbauen
  const protocolData = buildProtocolData(context, successResults, hpChanges);

  return {
    hpChanges,
    conditionsToAdd,
    conditionsToRemove: [],           // Wird bei Escape-Actions gefuellt
    forcedMovement,
    zoneActivation,
    concentrationBreak,
    protocolData
  };
}
```

---

## Beispiel: Longsword Attack

```typescript
// Input
action = {
  damage: { dice: '1d8', modifier: 3, type: 'slashing' },
  effects: []
}
successResult = { hit: true, critical: false, damageMultiplier: 1.0 }

// resolveEffects
→ ResolutionResult {
    hpChanges: [{
      combatantId: 'goblin-1',
      previousHP: 12,
      newHP: 4.5,
      change: -7.5,
      source: 'Longsword',
      damageType: 'slashing'
    }],
    conditionsToAdd: [],
    conditionsToRemove: [],
    forcedMovement: [],
    protocolData: { ... }
  }
```

---

## Beispiel: Wolf Bite mit Knockdown

```typescript
// Input
action = {
  damage: { dice: '2d4', modifier: 2, type: 'piercing' },
  effects: [{
    condition: 'prone',
    affectsTarget: 'enemy',
    save: { ability: 'str', dc: 11, onSave: 'none' }
  }]
}
successResult = { hit: true, damageMultiplier: 1.0 }
target = Bandit (STR save: +1)

// resolveEffects
1. Damage: 2d4+2 = 7 piercing
2. Sekundaerer Save: DC 11, Bonus +1 → Save-Chance 0.55, Fail-Chance 0.45

→ ResolutionResult {
    hpChanges: [{ change: -7, ... }],
    conditionsToAdd: [{
      target: Bandit,
      condition: { name: 'prone', ... },
      probability: 0.45
    }],
    ...
  }
```

---

## Beispiel: Hold Person

```typescript
// Input
action = {
  save: { ability: 'wis', dc: 14, onSave: 'none' },
  effects: [{
    condition: 'paralyzed',
    affectsTarget: 'enemy',
    duration: { type: 'until-save', saveAt: 'end', saveDC: 14, saveAbility: 'wis' }
  }],
  concentration: true
}
successResult = { hit: true, saveSucceeded: false, damageMultiplier: 1.0 }

// resolveEffects
→ ResolutionResult {
    hpChanges: [],
    conditionsToAdd: [{
      target: Bandit,
      condition: {
        name: 'paralyzed',
        duration: { type: 'until-save', ... },
        sourceId: 'wizard-1'
      },
      probability: 0.75    // Primaerer Save bereits in determineSuccess beruecksichtigt
    }],
    ...
  }
```

---

## State-Mutation (im Workflow)

Die State-Mutation erfolgt im `combatWorkflow`, nicht hier:

```typescript
// combatWorkflow.ts
function applyResult(result: ResolutionResult, state: CombatState): void {
  // HP-Aenderungen anwenden
  for (const hpChange of result.hpChanges) {
    const combatant = findCombatant(state, hpChange.combatantId);
    setHP(combatant, createPMF(hpChange.newHP));
  }

  // Conditions hinzufuegen
  for (const condApp of result.conditionsToAdd) {
    addCondition(condApp.target, {
      ...condApp.condition,
      probability: condApp.probability
    });
  }

  // Conditions entfernen
  for (const condRem of result.conditionsToRemove) {
    removeCondition(findCombatant(state, condRem.targetId), condRem.conditionName);
  }

  // Forced Movement
  for (const movement of result.forcedMovement) {
    applyForcedMovement(state, movement);
  }

  // Zone aktivieren
  if (result.zoneActivation) {
    state.activeZones.push(createActiveZone(result.zoneActivation));
  }

  // Concentration brechen
  if (result.concentrationBreak) {
    breakConcentration(findCombatant(state, result.concentrationBreak), state);
  }

  // Dead markieren
  markDeadCombatants(state);

  // Protocol schreiben
  writeProtocolEntry(state, result.protocolData);
}
```

Siehe [CombatWorkflow.md](../../orchestration/CombatWorkflow.md) fuer Details.

---

## Verwandte Dokumente

- [actionResolution.md](actionResolution.md) - Pipeline-Uebersicht
- [determineSuccess.md](determineSuccess.md) - Vorheriger Pipeline-Schritt
- [gatherModifiers.md](gatherModifiers.md) - Modifier-Input
- [CombatWorkflow.md](../../orchestration/CombatWorkflow.md) - State-Mutation
- [triggers.md](triggers.md) - Trigger-System
