# buildPossibleActions

> **Verantwortlichkeit:** Generiert alle gueltigen Action/Target/Cell Kombinationen
> **Code:** `src/services/combatantAI/core/actionEnumeration.ts`
> **Konsumiert von:** [planNextAction](planNextAction.md), [selectors](algorithm-approaches.md)
> **Abhaengigkeit:** [scoreAction](scoreAction.md) (`calculatePairScore`), [buildThreatMap](buildThreatMap.md)

Stateless Candidate-Generator. Erzeugt alle moeglichen Aktionen fuer einen Combatant basierend auf Komponenten-Analyse, Budget, ThreatMap und OpportunityMap.

---

## Architektur-Uebersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  buildPossibleActions(combatant, state, budget, threatMap)      │
│                                                                 │
│  Komponenten-basierte Evaluation:                               │
│  Fuer jede Action:                                              │
│    1. Budget-Check: hasTimingBudget(action, budget)             │
│    2. Komponenten bestimmen:                                    │
│       - needsTargetCell? (hasToTargetMovementCost)              │
│       - needsEnemyTarget? (action.damage != null)               │
│    3. Kandidaten generieren basierend auf Komponenten           │
│                                                                 │
│  Unified Score = actionScore + positionThreat + opportunity     │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Output: ScoredAction[]                                         │
│                                                                 │
│  { type: 'action', action, target?, fromPosition, score }       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Komponenten-basierte Evaluation

Jede Action wird anhand ihrer individuellen Komponenten evaluiert - keine kuenstlichen Kategorien (Movement/Standard/Bonus).

### Komponenten-Fragen

| Frage | Check | Bedeutung |
|-------|-------|-----------|
| Braucht Budget? | `hasTimingBudget(action, budget)` | Action/Bonus/Free verfuegbar? |
| Braucht targetCell? | `hasToTargetMovementCost(action)` | Movement zu Cell |
| Braucht enemy target? | `action.damage != null` | Angriff auf Gegner |
| Braucht ally target? | `action.healing != null` | Heilung auf Verbuendeten (HACK: noch nicht implementiert) |

### Action-Typen nach Komponenten

| Action | needsTargetCell | needsEnemyTarget | Kandidaten |
|--------|-----------------|------------------|------------|
| std-move | ✅ | ❌ | 1 pro erreichbare Cell |
| Dash | ✅ | ❌ | 1 pro erreichbare Cell (extended range) |
| Misty Step | ✅ | ❌ | 1 pro erreichbare Cell (30ft teleport) |
| Thunder Step | ✅ | ✅ | 1 pro Cell × Enemy in Range |
| Longsword | ❌ | ✅ | 1 pro Cell × Enemy in Range |
| Dodge | ❌ | ❌ | 1 (Self) |

---

## buildPossibleActions()

Hauptfunktion. Generiert alle Action/Target/Cell Kombinationen.

```typescript
function buildPossibleActions(
  combatant: CombatantWithLayers,
  state: CombatantSimulationStateWithLayers,
  budget: TurnBudget,
  threatMap: Map<string, ThreatMapEntry>
): ScoredAction[]
```

**Parameter:**
- `combatant` - Der aktive Combatant (mit Layer-Daten)
- `state` - Combat State (read-only)
- `budget` - Verbleibendes Turn-Budget
- `threatMap` - Von `buildThreatMap()` vorberechnet

**Return:**
```typescript
type ScoredAction = {
  type: 'action';
  action: Action;
  target?: Combatant;
  fromPosition: GridPosition;
  targetCell?: GridPosition;
  score: number;
}
```

---

## Generierungs-Logik

### Algorithmus

```typescript
for (const action of allActions) {
  // 1. Budget-Check
  if (!hasTimingBudget(action, budget)) continue;

  // 2. Komponenten bestimmen
  const needsTargetCell = hasToTargetMovementCost(action);
  const needsEnemyTarget = action.damage != null;

  // 3. Kandidaten generieren basierend auf Komponenten
  if (needsTargetCell) {
    // Movement-Komponente (Move, Dash, Misty Step, Thunder Step)
    generateMovementCandidates(action, needsEnemyTarget);
  } else if (needsEnemyTarget) {
    // Reine Attack-Action (Longsword, Fireball)
    generateAttackCandidates(action);
  } else {
    // Self-buff, Dodge, Help
    generateSelfCandidate(action);
  }
}
```

### 1. Movement-Actions (needsTargetCell = true)

Actions mit `budgetCosts: [{ resource: 'movement', cost: { type: 'toTarget' } }]`.

```typescript
const range = getMovementRange(action, budget.movementCells, combatant);
const reachable = getReachableCells(currentCell, range);

for (const cell of reachable) {
  if (getDistance(currentCell, cell) === 0) continue;

  if (needsEnemyTarget) {
    // Movement + Damage (Thunder Step)
    for (const enemy of getEnemiesInRangeFrom(cell, action, enemies)) {
      candidates.push({ action, target: enemy, targetCell: cell, ... });
    }
  } else {
    // Reines Movement (Move, Dash, Misty Step)
    candidates.push({ action, targetCell: cell, ... });
  }
}
```

**Range-Berechnung (getMovementRange):**

| `grantMovement.type` | Range | Beispiel |
|----------------------|-------|----------|
| (keins) | `budget.movementCells` | std-move |
| `dash` | `budget.movementCells + speed` | Dash |
| `extra` | `budget.movementCells + value` | Expeditious Retreat |
| `teleport` | `value` (ersetzt Budget) | Misty Step |

### 2. Attack-Actions (needsEnemyTarget = true, needsTargetCell = false)

Standard-Angriffe wie Longsword, Fireball, etc.

```typescript
const cellsForAction = getCellsForAction(currentCell, budget);

for (const cell of cellsForAction) {
  const enemiesInRange = getEnemiesInRangeFrom(cell, action, enemies);

  for (const enemy of enemiesInRange) {
    const result = calculatePairScore(virtualCombatant, action, enemy, distance, state);
    if (result && result.score > 0) {
      candidates.push({ action, target: enemy, fromPosition: cell, ... });
    }
  }
}
```

**getCellsForAction:** Aktuelle Cell + alle Cells erreichbar mit Movement-Budget.

### 3. Self-Actions (needsTargetCell = false, needsEnemyTarget = false)

Dodge, Help, Self-Buffs, etc.

```typescript
const score = positionThreat * THREAT_WEIGHT + remainingOpportunity * OPPORTUNITY_WEIGHT;

if (score > 0) {
  candidates.push({ action, fromPosition: currentCell, score });
}
```

---

## Score-Berechnung

### Unified Score

```typescript
score = actionScore + positionThreat * THREAT_WEIGHT + remainingOpportunity * OPPORTUNITY_WEIGHT
```

- **actionScore:** Von `calculatePairScore()` (DPR-basiert)
- **positionThreat:** Net-Threat an der Cell (negativ = gefaehrlich)
- **remainingOpportunity:** Was kann nach dieser Action noch getan werden?

### Konstanten

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| `THREAT_WEIGHT` | 0.5 | Gewichtung von Position-Threat |
| `OPPORTUNITY_WEIGHT` | 0.5 | Gewichtung von Remaining-Opportunity |

---

## Helper-Funktionen

### hasTimingBudget()

Prueft ob Action das entsprechende Timing-Budget hat.

```typescript
function hasTimingBudget(action: Action, budget: TurnBudget): boolean {
  switch (action.timing.type) {
    case 'action': return budget.hasAction;
    case 'bonus': return budget.hasBonusAction;
    case 'free': return true;
    default: return false;
  }
}
```

### hasToTargetMovementCost()

Prueft ob Action eine Movement-zu-Cell Komponente hat.

```typescript
function hasToTargetMovementCost(action: Action): boolean {
  return action.budgetCosts?.some(
    c => c.resource === 'movement' && c.cost.type === 'toTarget'
  ) ?? false;
}
```

### getMovementRange()

Berechnet erreichbare Range fuer eine Movement-Action.

```typescript
function getMovementRange(
  action: Action,
  baseBudget: number,
  combatant: CombatantWithLayers
): number
```

### getCellsForAction()

Erreichbare Cells fuer Non-Movement Actions.

```typescript
function getCellsForAction(
  currentCell: GridPosition,
  budget: TurnBudget
): GridPosition[]
```

### getEnemiesInRangeFrom()

Enemies in Action-Range von einer Cell.

```typescript
function getEnemiesInRangeFrom(
  cell: GridPosition,
  action: Action,
  enemies: Combatant[],
  allActions: Action[]
): Combatant[]
```

---

## Target-Filterung

### getEnemies()

Alle lebenden Feinde.

```typescript
function getEnemies(
  combatant: Combatant,
  state: CombatantSimulationState
): Combatant[]
```

### getAllies()

Alle lebenden Verbuendeten (ohne sich selbst).

```typescript
function getAllies(
  combatant: Combatant,
  state: CombatantSimulationState
): Combatant[]
```

### getCandidates()

Filtert moegliche Ziele basierend auf `action.targeting.validTargets`.

```typescript
function getCandidates(
  attacker: Combatant,
  state: CombatantSimulationState,
  action: Action
): Combatant[]
```

---

## Threat-Weight (Personality-basiert)

> **HACK:** Personality-Integration wird nach der Algorithmus-Auswahl implementiert.
> Aktuell wird ein fester Default-Wert verwendet (`THREAT_WEIGHT = 0.5`).

### Geplante Implementierung

```typescript
function getThreatWeight(combatant: Combatant): number {
  const personality = combatant.personality ?? 'neutral';
  return PERSONALITY_THREAT_WEIGHTS[personality] ?? 0.5;
}
```

| Personality | Threat-Weight | Verhalten |
|-------------|---------------|-----------|
| `reckless` | 0.1 | Ignoriert Gefahr, maximale Aggression |
| `brave` | 0.3 | Niedriger Selbsterhalt, bevorzugt Offensive |
| `neutral` | 0.5 | Balanciert zwischen Sicherheit und Aggression |
| `cautious` | 0.7 | Bevorzugt sichere Positionen |
| `cowardly` | 1.0 | Maximaler Selbsterhalt, flieht bei Gefahr |

---

## Exports

### Candidate Generation

| Funktion | Beschreibung |
|----------|--------------|
| `buildPossibleActions(combatant, state, budget, threatMap)` | Generiert alle Kandidaten |

### Helper Functions

| Funktion | Beschreibung |
|----------|--------------|
| `hasTimingBudget(action, budget)` | Prueft Timing-Budget |
| `hasToTargetMovementCost(action)` | Prueft Movement-Komponente |
| `getMovementRange(action, baseBudget, combatant)` | Berechnet Movement-Range |
| `subtractActionCost(budget, action)` | Berechnet verbleibendes Budget |
| `getThreatWeight(combatant)` | Personality-basierter Threat-Weight (HACK: fixed 0.5) |

### Target Helpers

| Funktion | Beschreibung |
|----------|--------------|
| `getEnemies(combatant, state)` | Alle lebenden Feinde |
| `getAllies(combatant, state)` | Alle lebenden Allies (ohne self) |
| `getCandidates(attacker, state, action)` | Targets basierend auf action.targeting |

### Konstanten

| Konstante | Wert | Beschreibung |
|-----------|------|--------------|
| `THREAT_WEIGHT` | 0.5 | Gewichtung von Threat-Delta |
| `OPPORTUNITY_WEIGHT` | 0.5 | Gewichtung von Opportunity-Delta |

### Types

```typescript
type ScoredAction = {
  type: 'action';
  action: Action;
  target?: Combatant;
  fromPosition: GridPosition;
  targetCell?: GridPosition;
  score: number;
}
```
