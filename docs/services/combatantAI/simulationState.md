# simulationState

> **Verantwortlichkeit:** Hypothetisches State-Management fuer AI Look-Ahead
> **Code:** `src/services/combatantAI/core/stateProjection.ts`
> **Konsumiert von:** [planNextAction](planNextAction.md), [buildPossibleActions](buildPossibleActions.md), [selectors](algorithm-approaches.md)
> **Shared Component** fuer alle Algorithmen - siehe [combatantAI.md](combatantAI.md)

Stateless Utility-Modul fuer immutable State-Operationen. Ermoeglicht Look-Ahead-Berechnungen ohne den echten Combat-State zu mutieren.

---

## Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  TRENNUNG: Simulation vs Tracking                               │
│                                                                 │
│  AI (Read-only)              │  Tracking (Mutation)             │
│  ─────────────────────────── │ ───────────────────────────────  │
│  consumeBudget()             │  executeAction()                 │
│  projectState()              │  applyDamage()                   │
│  cloneState()                │  updateCombatantState()          │
│                              │                                  │
│  → Returned neue Objekte     │  → Mutiert State direkt          │
│  → Fuer Look-Ahead           │  → Fuer echten Combat            │
└─────────────────────────────────────────────────────────────────┘
```

**Kernprinzip:** Die AI darf den echten State/Budget nie mutieren. Alle Look-Ahead-Operationen arbeiten auf Kopien.

---

## Budget Management

### TurnBudget

```typescript
interface TurnBudget {
  movementCells: number;      // Verbleibendes Movement in Cells
  baseMovementCells: number;  // Basis-Movement (fuer Dash-Berechnung)
  hasAction: boolean;         // Action noch verfuegbar?
  hasBonusAction: boolean;    // Bonus Action noch verfuegbar?
  hasReaction: boolean;       // Reaction noch verfuegbar?
  hasDashed: boolean;         // Bereits Dash verwendet?
}
```

### initializeBudget()

Erstellt ein frisches TurnBudget fuer einen Combatant.

```typescript
function initializeBudget(combatant: Combatant | CombatantWithLayers): TurnBudget {
  const baseMovement = feetToCell(combatant.speed?.walk ?? 30);

  return {
    movementCells: baseMovement,
    baseMovementCells: baseMovement,
    hasAction: true,
    hasBonusAction: true,
    hasReaction: true,
    hasDashed: false,
  };
}
```

---

### consumeBudget()

Immutable Budget-Konsumption. Returned neues Budget-Objekt.

```typescript
function consumeBudget(
  budget: TurnBudget,
  action: Action,
  movementCost?: number
): TurnBudget
```

**Verhalten:**

| action.timing.type | Budget-Aenderung |
|--------------------|------------------|
| `'action'` | `hasAction: false` |
| `'bonus'` | `hasBonusAction: false` |
| `'reaction'` | `hasReaction: false` |
| `'passive'` | Keine Aenderung |

**Dash-Behandlung:**

```typescript
if (hasGrantMovementEffect(action)) {
  return {
    ...budget,
    hasAction: false,  // Dash konsumiert Action
    hasDashed: true,
    movementCells: budget.movementCells + budget.baseMovementCells,
  };
}
```

**Movement-Kosten:**

```typescript
if (movementCost !== undefined) {
  return {
    ...newBudget,
    movementCells: Math.max(0, newBudget.movementCells - movementCost),
  };
}
```

**WICHTIG:** Returned IMMER ein neues Objekt. Mutiert nie das Input-Budget.

---

### isBudgetExhausted()

Prueft ob noch sinnvolle Aktionen moeglich sind.

```typescript
function isBudgetExhausted(budget: TurnBudget): boolean {
  return !budget.hasAction
      && !budget.hasBonusAction
      && budget.movementCells === 0;
}
```

**Hinweis:** Reaction wird nicht beruecksichtigt - Reactions sind fuer gegnerische Turns.

---

### canAffordAction()

Prueft ob eine Action mit dem aktuellen Budget ausfuehrbar ist.

```typescript
function canAffordAction(budget: TurnBudget, action: Action): boolean {
  switch (action.timing?.type) {
    case 'action':
      return budget.hasAction;
    case 'bonus':
      return budget.hasBonusAction;
    case 'reaction':
      return budget.hasReaction;
    case 'passive':
      return true;  // Passive Actions kosten nichts
    default:
      return budget.hasAction;  // Default: Action
  }
}
```

---

## State Projection

### projectState()

Projiziert State nach einer hypothetischen Aktion. Fuer Look-Ahead-Algorithmen.

```typescript
function projectState(
  state: CombatantSimulationStateWithLayers,
  action: Action,
  target: CombatantWithLayers,
  result: SimulatedActionResult
): CombatantSimulationStateWithLayers
```

**Was passiert:**

1. **Deep Clone** des States (immutable)
2. **HP-Aenderung** beim Target basierend auf `result.damage` oder `result.healing`
3. **Condition-Anwendung** wenn `result.appliedCondition`
4. **Position-Update** wenn Bewegung involviert
5. **Combatant-Entfernung** wenn HP <= 0

**WICHTIG:** Returned IMMER einen neuen State. Mutiert nie den Input-State.

**Beispiel:**

```typescript
const hypotheticalState = projectState(
  currentState,
  fireball,
  goblin,
  { damage: 28, appliedCondition: null }
);

// currentState ist UNVERAENDERT
// hypotheticalState hat Goblin mit reduzierter HP
```

---

### SimulatedActionResult

```typescript
interface SimulatedActionResult {
  damage?: number;            // Erwarteter Schaden (oder 0)
  healing?: number;           // Erwartete Heilung (oder 0)
  appliedCondition?: {
    type: ConditionType;
    duration: number;         // Erwartete Runden
    saveEndOfTurn?: boolean;  // Save-Retry moeglich?
  } | null;
  targetPosition?: GridPosition;  // Neue Position nach Push/Pull
}
```

---

### cloneState()

Deep Clone eines Combat-States. Fuer Branch-Exploration in Look-Ahead.

```typescript
function cloneState(
  state: CombatantSimulationStateWithLayers
): CombatantSimulationStateWithLayers
```

**Klont:**
- `combatants` Array (deep)
- `combatant.combatState` (deep)
- `combatant._layeredActions` (shallow - Actions sind immutable)
- `grid` Map (deep)
- `alliances` (shallow - aendert sich nicht mid-combat)

**Performance-Hinweis:** Verwendet strukturiertes Klonen, nicht JSON.parse(JSON.stringify()).

---

## State-Typen

### CombatState vs CombatSimulationState

| Typ | Zweck | Eigenschaften |
|-----|-------|---------------|
| **CombatState** | Echtes Combat-Tracking | Mutierbar, mit persistenten IDs, Protocol-Logging |
| **CombatSimulationState** | AI-Simulation | Immutable, ohne persistente IDs, fuer Look-Ahead |

**CombatState** (Tracking):
```typescript
interface CombatState {
  combatId: string;           // Persistente ID
  combatants: Combatant[];
  turnOrder: string[];        // Participant-IDs
  currentTurnIndex: number;
  roundNumber: number;
  protocol: CombatLogEntry[]; // Wird gemutiert
  grid: GridState;
}
```

**CombatSimulationState** (AI):
```typescript
interface CombatSimulationState {
  combatants: Combatant[];
  turnOrder: string[];
  currentTurnIndex: number;
  roundNumber: number;
  grid: GridState;
  // KEIN combatId, KEIN protocol
}
```

### WithLayers Varianten

Beide State-Typen haben `WithLayers` Varianten fuer Layer-Daten:

```typescript
interface CombatStateWithLayers extends CombatState {
  combatants: CombatantWithLayers[];
}

interface CombatantSimulationStateWithLayers extends CombatSimulationState {
  combatants: CombatantWithLayers[];
}
```

---

## Exports

### Budget Management

| Funktion | Beschreibung |
|----------|--------------|
| `initializeBudget(combatant)` | Erstellt frisches TurnBudget |
| `consumeBudget(budget, action, movementCost?)` | Immutable Budget-Konsumption |
| `isBudgetExhausted(budget)` | Prueft ob Turn beendet |
| `canAffordAction(budget, action)` | Prueft ob Action moeglich |

### State Projection

| Funktion | Beschreibung |
|----------|--------------|
| `projectState(state, action, target, result)` | State nach hypothetischer Aktion |
| `cloneState(state)` | Deep Clone fuer Look-Ahead |

### Typen

| Typ | Beschreibung |
|-----|--------------|
| `TurnBudget` | Budget fuer einen Turn |
| `SimulatedActionResult` | Ergebnis einer simulierten Aktion |
| `CombatSimulationState` | AI-State (immutable) |
| `CombatSimulationStateWithLayers` | AI-State mit Layer-Daten |
