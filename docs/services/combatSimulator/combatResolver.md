# combatResolver

> **Verantwortlichkeit:** Combat State-Management und Action-Resolution
> **Konsumiert von:** [difficulty](../encounter/difficulty.md) (Simulation), Combat-Tracker (zukuenftig)
>
> **Verwendet:**
> - [combatantAI](combatantAI.md) - Entscheidungslogik
> - [pmf](../../utils/pmf.md) - Wahrscheinlichkeitsverteilungen
>
> **Verwandte Dokumente:**
> - [difficulty.md](../encounter/difficulty.md) - Simulations-Loop und Difficulty-Klassifizierung

Generisches Helper-Repository fuer Combat State-Management und Action-Resolution.

**KEINE autonome Simulation hier - nur State + Resolution!**

Die autonome Simulations-Logik (Runden-Loop, Victory-Conditions, Outcome-Analyse) liegt in [difficulty.ts](../encounter/difficulty.md).

---

## Exports

### Constants

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| `DEFAULT_ENCOUNTER_DISTANCE` | 60 | Standard-Distanz in Fuss |

### State Creation

| Funktion | Beschreibung |
|----------|--------------|
| `createPartyProfiles(party)` | Erstellt Combat-Profile fuer Party-Mitglieder |
| `createEnemyProfiles(groups)` | Erstellt Combat-Profile fuer Encounter-Gruppen (mit Action-Resolution) |
| `createCombatState(...)` | Erstellt vollstaendigen Combat-State |

#### Creature Action-Loading

`createEnemyProfiles()` loest Actions aus mehreren Quellen auf:

```typescript
// 1. Inline-Actions (direkt im Creature)
let actions = [...(creature.actions ?? [])];

// 2. Action-Referenzen (via Vault)
if (creature.actionIds?.length) {
  for (const actionId of creature.actionIds) {
    const action = vault.getEntity<Action>('action', actionId);
    actions.push(action);
  }
}

// 3. Fallback
if (actions.length === 0) {
  actions = [getDefaultCreatureAction(creature.cr)];
}
```

**Prioritaet:**

1. Beide Quellen werden kombiniert (nicht exklusiv)
2. Fallback nur wenn keine Actions gefunden

→ Action-Presets: `presets/actions/index.ts`
→ CreatureDefinition.actionIds: [creature.md#Action-Integration](../../types/creature.md#action-integration)

| Funktion | Beschreibung |
|----------|--------------|
| `initializeGrid(encounterDistance?)` | Initialisiert 3D-Grid |
| `calculateInitialPositions(profiles, alliances, distance?)` | Verteilt Teilnehmer auf Grid |
| `checkSurprise()` | Prueft Surprise-State (HACK: liefert immer keine Surprise) |

### Action Resolution

| Funktion | Beschreibung |
|----------|--------------|
| `resolveAttack(attacker, target, action)` | Loest einen einzelnen Angriff auf |

### State Updates

| Funktion | Beschreibung |
|----------|--------------|
| `updateCombatantHP(combatant, newHP)` | Aktualisiert HP-PMF und deathProbability |
| `updateCombatantPosition(combatant, newPosition)` | Aktualisiert Position |

---

## Types

### PartyInput

```typescript
interface PartyInput {
  level: number;
  size: number;
  members: Array<{
    id: string;
    level: number;
    hp: number;
    ac: number;
  }>;
}
```

### SimulationState

```typescript
interface SimulationState {
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;
  grid: Grid3D;
  roundNumber: number;
  surprise: SurpriseState;
  resourceBudget: number;
}
```

### AttackResolution

```typescript
interface AttackResolution {
  newTargetHP: ProbabilityDistribution;
  damageDealt: number;  // Expected Value
  newDeathProbability: number;
}
```

---

## Action-Resolution

### resolveAttack()

Loest einen einzelnen Angriff auf und berechnet neue Target-HP:

```typescript
function resolveAttack(
  attacker: CombatProfile,
  target: CombatProfile,
  action: Action
): AttackResolution | null
```

**Wahrscheinlichkeits-Kaskade:**

```
P(0 Schaden) = P(tot) + P(incapacitated) + P(miss)
P(Schaden)   = P(lebendig) x P(aktiv) x P(hit) x DMG-PMF
```

**Nutzung:**

```typescript
const resolution = resolveAttack(attacker, target, action);
if (resolution) {
  updateCombatantHP(target, resolution.newTargetHP);
}
```

---

## State Updates

### updateCombatantHP()

Aktualisiert HP-Distribution und berechnet deathProbability neu:

```typescript
function updateCombatantHP(
  combatant: CombatProfile,
  newHP: ProbabilityDistribution
): void
```

### updateCombatantPosition()

Aktualisiert Position eines Combatants:

```typescript
function updateCombatantPosition(
  combatant: CombatProfile,
  newPosition: Vector3
): void
```

---

## Alliance-System

**Hinweis:** Allianzen werden bei Encounter-Erstellung in [groupActivity.ts](../encounter/groupActivity.md#calculatealliances) berechnet und im `EncounterInstance`-Objekt gespeichert. combatResolver erhaelt `alliances` als Parameter.

Allianzen werden als Map von groupId zu verbuendeten groupIds modelliert:

```typescript
Record<string, string[]>

// Beispiel:
{
  'party': ['party'],
  'group-uuid-1': ['group-uuid-1', 'group-uuid-2'],  // Gleiche Faction
  'group-uuid-2': ['group-uuid-1', 'group-uuid-2'],
  'group-uuid-3': ['group-uuid-3']  // Fraktionslos
}
```

### Allianz-Regeln

| Bedingung | Relation |
|-----------|----------|
| Gleiche `groupId` | Verbuendet |
| Gleiche `factionId` | Verbuendet |
| Verschiedene Factions | Feinde |
| Fraktionslos | Nur mit sich selbst verbuendet |

Allianz-Checks (`isAllied()`, `isHostile()`) werden aus [combatantAI](combatantAI.md) importiert.

---

## PMF-basierte Resolution

Die Resolution-Logik ist vollstaendig PMF-basiert. Dies ermoeglicht:

1. **Wahrscheinlichkeits-Kaskaden:** Alle Faktoren (Tod, Condition, Miss) werden als Wahrscheinlichkeiten verrechnet
2. **Simulation:** Full-PMF fuer Combat-Simulation in difficulty.ts
3. **Combat-Tracker (zukuenftig):** Integer-Wrapper um dieselbe Logik

```typescript
// Simulation: Volle PMF
const hp = createSingleValue(45);  // { 45: 1.0 }
const resolution = resolveAttack(attacker, target, action);

// Combat-Tracker (zukuenftig): Integer-Fassade
function attack(attackerId, targetId, actionId, rolls: { toHit: number; damage: number }) {
  // Wrap zu PMF (single value)
  const attackerHP = createSingleValue(combatant.hp);

  // PMF-Resolution
  const result = resolveAttack(...);

  // Unwrap zu Integer
  return { hit: true, damage: 7, newHP: [...result.newTargetHP.keys()][0] };
}
```

---

## HACK & TODO

### HACK: Vereinfachte Party-Profile

`createPartyProfiles()` nutzt Default-Actions wenn Character keine Actions hat.

### HACK: Keine Surprise-Pruefung

`checkSurprise()` liefert immer keine Surprise. Spec: difficulty.md#5.0.5 erwartet Activity.awareness.

### HACK: Keine Condition-Tracking

`conditionProb` ist immer 0 in `resolveAttack()`. Spec: difficulty.md#5.1.d beschreibt Condition-Wahrscheinlichkeiten.

### TODO: Implementiere resolveHealing()

Fuer Healing-Actions (Intent: healing). Spec: difficulty.md#5.1.b

### TODO: Implementiere resolveCondition()

Fuer Control-Actions (Intent: control). Spec: difficulty.md#5.1.b
