# planNextAction

> **Verantwortlichkeit:** Entry Point und Orchestration der Action-Selection
> **Code:** `src/services/combatantAI/selectNextAction.ts`
> **Konsumiert von:** [difficulty](../encounter/difficulty.md), [combatTracking](../combatTracking.md)

Entry Point fuer die Combat-AI. Delegiert an den konfigurierten ActionSelector (Default: Greedy).

---

## Code-Struktur

| Datei | Verantwortlichkeit |
|-------|-------------------|
| `selectNextAction.ts` | Thin wrapper → delegiert an Selector |
| `selectors/greedySelector.ts` | Default: Greedy Selection |
| `selectors/randomSelector.ts` | Baseline: Random Selection |
| `selectors/factoredSelector.ts` | Beam Search: Position × Action Dekomposition |
| `selectors/iterativeSelector.ts` | Anytime: Iterative Deepening mit Move Ordering |
| `selectors/registry.ts` | Selector-Wechsel zur Laufzeit |
| `helpers/pruningHelpers.ts` | Pruning-Heuristiken (computeGlobalBestByType) |
| `helpers/actionAvailability.ts` | Resource- und Requirement-Checks |

---

## Selector-Integration

```typescript
// selectNextAction.ts - delegiert an Registry
import { getDefaultSelector } from './selectors/registry';

export function selectNextAction(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget
): TurnAction {
  return getDefaultSelector().selectNextAction(combatant, state, budget);
}
```

**Selector wechseln:**
```typescript
import { getSelector } from '@/services/combatantAI';

// Random statt Greedy verwenden
const action = getSelector('random').selectNextAction(combatant, state, budget);
```

> **Dokumentation:** [algorithm-approaches.md](algorithm-approaches.md) (ActionSelector Interface)

---

## GreedySelector (Default)

Implementiert in `selectors/greedySelector.ts`. Waehlt immer die beste sofort verfuegbare Aktion.

**Pipeline:**
1. Budget-Check → Pass wenn erschoepft
2. `buildThreatMap()` - Position-Bewertung
3. `buildPossibleActions()` - Kandidaten generieren
4. Beste Aktion waehlen (hoechster Score)

**Stats-Tracking:**
```typescript
const selector = getDefaultSelector();
selector.selectNextAction(...);
const stats = selector.getStats();
// { nodesEvaluated: 150, elapsedMs: 12 }
```

---

## Pruning-Helpers

> **Code:** `src/services/combatantAI/helpers/pruningHelpers.ts`

Optionale Optimierungen fuer fortgeschrittene Algorithmen (Iterative Deepening, Beam Search).

### computeGlobalBestByType()

Berechnet globale Best-Scores pro ActionSlot fuer Pruning-Schaetzung.

```typescript
function computeGlobalBestByType(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  escapeDangerMap: Map<string, number>
): GlobalBestByType

interface GlobalBestByType {
  action: number;       // Bester Standard-Action Score
  bonusAction: number;  // Bester Bonus-Action Score
  movement: number;     // Maximaler Movement-Gewinn (Danger-Reduktion)
}
```

### estimateMaxFollowUpGain()

Schaetzt maximalen Gewinn der mit verbleibendem Budget noch moeglich ist.

```typescript
function estimateMaxFollowUpGain(
  budget: TurnBudget,
  globalBest: GlobalBestByType
): number
```

### Pruning-Nutzung

```typescript
// Aggressive Candidate-Elimination
if (candidateScore + maxGain < bestScore * PRUNING_THRESHOLD) {
  // Eliminieren - kann nicht mehr gewinnen
}
```

### Konstanten (Tunable)

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| `PRUNING_THRESHOLD` | 0.3 | Kandidaten unter 30% des Besten eliminieren |
| `BEAM_WIDTH` | 50 | Maximale Kandidaten pro Iteration |

---

## Best Selection

Die eigentliche Auswahl ist jetzt in `selectors/greedySelector.ts` integriert:

```typescript
// Greedy: Waehle hoechsten Score
const best = candidates.reduce((a, b) => a.score > b.score ? a : b);

// Wenn Score <= 0 → Pass
if (best.score <= 0) return { type: 'pass' };

return { type: 'action', action: best.action, target: best.target, fromPosition: best.fromPosition };
```

---

## Architektur-Uebersicht

### Action-by-Action Pattern

```
// Aufruf-Loop in difficulty.simulateTurn() oder CombatWorkflow
while (true) {
  action = selectNextAction(combatant, state, budget)  // AI: Read-only
  result = executeAction(combatant, action, state, budget)  // Tracking: Mutation
  if (action.type === 'pass') break
}
```

**Vorteile:**
- Saubere Trennung: AI (Read-only) vs Tracking (Mutation)
- Protocol-Eintrag pro Aktion (nicht pro Turn)
- Budget-Mutation durch executeAction(), nicht AI

---

### Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  selectNextAction(combatant, state, budget)                     │
│                                                                 │
│  1. Budget-Check → Pass wenn erschoepft                         │
│                                                                 │
│  2. ThreatMap berechnen                                         │
│     buildThreatMap(combatant, state, reachableCells, currentPos)│
│                                                                 │
│  3. Kandidaten generieren                                       │
│     buildPossibleActions(combatant, state, budget, threatMap)   │
│                                                                 │
│  4. Beste Aktion waehlen                                        │
│     findBestMove(candidates, budget)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## selectNextAction()

Hauptfunktion des Moduls. Waehlt die beste naechste Aktion.

```typescript
function selectNextAction(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget
): TurnAction
```

**Parameter:**
- `combatant` - Der aktive Combatant (mit Layer-Daten)
- `state` - Combat State (read-only)
- `budget` - Verbleibendes Turn-Budget (read-only)

**Return:**
```typescript
type TurnAction =
  | { type: 'action'; action: Action; target?: Combatant; fromPosition: GridPosition }
  | { type: 'pass' }
```

**Pass wird zurueckgegeben wenn:**
- Kein Budget mehr verfuegbar (hasAction, hasBonusAction, movementCells alle false/0)
- Keine Kandidaten generiert werden konnten
- Beste Aktion hat Score <= 0

---

## D&D 5e Zuege

D&D 5e Zuege koennen mehrere Aktionen enthalten:

| Komponente | Beschreibung |
|------------|--------------|
| **Movement** | Kann aufgeteilt werden (vor und nach Aktion) |
| **Action** | Angriff, Cast, Dash, Dodge, etc. |
| **Bonus Action** | TWF Off-Hand, Cunning Action, Bonus-Spells |
| **Pass** | Beendet den Zug |

---

## TurnBudget

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

---

## Budget-Simulation

> **Implementierung:** [simulationState.ts](simulationState.md)
> **Shared Component** fuer alle Algorithmen - siehe [combatantAI.md](combatantAI.md#shared-components-fuer-prototyping)

### Trennung: Simulation vs Execution

| Kontext | Funktion | Verhalten |
|---------|----------|-----------|
| AI (Look-Ahead) | `consumeBudget()` | Immutable, returned neues Budget |
| Tracking (Real) | `executeAction()` | Mutiert State + Budget |

Die AI arbeitet **read-only** und darf den echten State/Budget nicht mutieren.

Detaillierte Dokumentation in [simulationState.md](simulationState.md).

---

## Helper-Funktionen

### hasGrantMovementEffect()

Prueft ob eine Action Movement gewaehrt (Dash-aehnlich).

```typescript
function hasGrantMovementEffect(action: Action): boolean
```

**Effect-basierte Erkennung:** Prueft `action.effects` auf `grantMovement`.

### getAvailableActionsWithLayers()

Version fuer CombatantWithLayers die `_layeredActions` nutzt.

```typescript
function getAvailableActionsWithLayers(
  combatant: CombatantWithLayers,
  context?: { priorActions?: Action[] }
): Action[]
```

**Was passiert:**
1. Kombiniert `combatant._layeredActions` mit Standard-Actions (Dash, Disengage, Dodge)
2. Filtert via `isActionUsable()` (Resources, Requirements, Conditions)

---

## Action Availability

Implementiert in `actionAvailability.ts`. Prueft ob eine Action zur Verfuegung steht.

### Availability-Pruefungen

```typescript
function isActionUsable(
  action: Action,
  combatant: Combatant,
  context?: { priorActions?: Action[] }
): boolean
```

**Prueft folgende Bedingungen:**

| Check | Beschreibung | Beispiel |
|-------|--------------|----------|
| **Resources** | Spell Slots, Recharge, Uses | Fireball braucht Level-3 Slot |
| **Requirements** | Prior-Action Bedingungen | TWF braucht Attack Action first |
| **Conditions** | Incapacitating Conditions | Stunned kann nicht agieren |
| **Timing** | Action vs Bonus Action | Healing Word ist Bonus Action |

### Resource-Typen

| Resource | Tracking | Beispiel |
|----------|----------|----------|
| **Spell Slots** | `resources.spellSlots[level]` | Spell Slot Level 1-9 |
| **Recharge** | `resources.recharge[actionId]` | Breath Weapon (Recharge 5-6) |
| **Uses per Day** | `resources.usesRemaining[actionId]` | Legendary Actions |
| **Ammunition** | `resources.ammunition[type]` | Arrows, Bolts |

### Requirements-System

Alle Action-Typen (nicht nur Bonus Actions) haben ein generisches `requirements` Feld:

```typescript
interface ActionRequirement {
  type: 'prior-action' | 'condition' | 'resource' | 'position';
  // ... type-specific fields
}
```

**Beispiele:**
```typescript
// Two-Weapon Fighting: Requires Attack Action
{ type: 'prior-action', actionType: 'weapon', timing: 'action' }

// Flurry of Blows: Requires Unarmed Strike
{ type: 'prior-action', actionId: 'unarmed-strike' }

// Sneak Attack: Requires Advantage OR Ally adjacent
{ type: 'condition', any: ['advantage', 'ally-adjacent-to-target'] }
```

### Re-Exports

| Funktion | Beschreibung |
|----------|--------------|
| `isActionAvailable(action, resources)` | Resource-Check (Slots, Recharge, Uses) |
| `isActionUsable(action, combatant, context?)` | Kombiniert alle Checks |
| `matchesRequirement(prior, requirement)` | Prior-Action Requirements |
| `hasIncapacitatingCondition(combatant)` | Stunned/Paralyzed/etc. |
| `getAvailableActionsForCombatant(combatant, context?)` | Gefilterte Actions |

---

## Resource Management

Implementiert in `actionAvailability.ts`. Verwaltet Combat-Resources.

### Initialisierung

```typescript
function initializeResources(
  actions: Action[],
  spellSlots: Record<number, number>,
  resourceBudget?: Partial<ResourceBudget>
): ResourceBudget
```

**Wird aufgerufen bei:** Combat-Start (in `initialiseCombat.ts`)

### Resource-Konsum

```typescript
function consumeActionResource(
  action: Action,
  resources: ResourceBudget
): void  // Mutates resources
```

**Wird aufgerufen bei:** Nach erfolgreicher Action-Ausfuehrung (in `executeAction.ts`)

### Recharge-Timer

```typescript
function tickRechargeTimers(resources: ResourceBudget): void  // Mutates resources
```

**Wird aufgerufen bei:** Turn-Ende (decrementiert Recharge-Timer um 1)

### Re-Exports

| Funktion | Beschreibung |
|----------|--------------|
| `initializeResources(actions, spellSlots, resourceBudget)` | Combat-Resources initialisieren |
| `consumeActionResource(action, resources)` | Ressourcen nach Action konsumieren |
| `tickRechargeTimers(resources)` | Timer aktualisieren |

---

## Effect-basierte Action-Erkennung

Das Combat-System prueft `action.effects` fuer spezifisches Verhalten:

| Effect-Feld | Erkennung | Verhalten |
|-------------|-----------|-----------|
| `grantMovement` | `hasGrantMovementEffect(action)` | Extra Movement via Dash |
| `movementBehavior.noOpportunityAttacks` | - | Disengage-Verhalten |
| `incomingModifiers.attacks: 'disadvantage'` | - | Dodge-Verhalten |

**Standard-Actions** (Dash, Disengage, Dodge) verwenden `actionType: 'utility'` und werden durch ihre Effects definiert.

---

## Exports

### Main Export

| Funktion | Beschreibung |
|----------|--------------|
| `selectNextAction(combatant, state, budget)` | Waehlt naechste Aktion (Read-only) |

### Action Helpers

| Funktion | Beschreibung |
|----------|--------------|
| `hasGrantMovementEffect(action)` | Prueft Movement-Grant |
| `getAvailableActionsWithLayers(combatant, context?)` | Actions mit Layer-Daten |

### Re-Exports (aus actionAvailability.ts)

| Funktion | Beschreibung |
|----------|--------------|
| `isActionAvailable` | Resource-Verfuegbarkeit |
| `isActionUsable` | Kombinierte Checks |
| `matchesRequirement` | Prior-Action Matching |
| `hasIncapacitatingCondition` | Condition-Check |
| `getAvailableActionsForCombatant` | Gefilterte Actions |
| `initializeResources` | Resources initialisieren |
| `consumeActionResource` | Resources konsumieren |
| `tickRechargeTimers` | Timer aktualisieren |
