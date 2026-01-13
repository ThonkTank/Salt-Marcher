# Movement

> **Verantwortlichkeit:** Movement-Execution und Budget-Tracking im Combat
> **Pfad:** `src/services/combatTracking/executeAction.ts` (executeMovement)
> **Pfad:** `src/services/combatTerrain/terrainMovement.ts` (Pathfinding)

## Uebersicht

Movement im Combat-System umfasst:
1. **Voluntary Movement** - Combatant bewegt sich waehrend seines Zuges
2. **Forced Movement** - Effekte bewegen Combatants (Grapple-Drag, Teleport)
3. **Action-basiertes Movement** - Bewegung als Teil einer Aktion (toTarget)

---

## Movement Budget

### TurnBudget

```typescript
interface TurnBudget {
  movementCells: number;      // Verbleibende Bewegung
  baseMovementCells: number;  // Basis-Speed (ohne Dash)
  hasAction: boolean;
  hasDashed: boolean;
  hasBonusAction: boolean;
  hasReaction: boolean;
}
```

### Speed → Cells Conversion

```typescript
// 5ft = 1 Cell
const movementCells = Math.floor(speed.walk / 5);
```

### Dash-Aktion

Dash verdoppelt die verfuegbare Bewegung fuer diesen Zug:

```typescript
function applyDash(budget: TurnBudget): void {
  budget.movementCells += budget.baseMovementCells;
  budget.hasDashed = true;
}
```

---

## Pathfinding

### Dijkstra mit Terrain-Kosten

```typescript
function getReachableCellsWithTerrain(
  start: GridPosition,
  movementBudget: number,
  terrain: CombatCellProperties[][],
  combatant: Combatant,
  state: CombatState
): ReachableCell[]
```

### Movement-Kosten

| Terrain | Kosten |
|---------|--------|
| Normal | 1 Cell |
| Difficult | 2 Cells |
| Blocked | ∞ (impassable) |
| Size-restricted | ∞ wenn Combatant zu gross |

### Blocked Cells

- Von feindlichen Combatants besetzt
- Impassable Terrain (Mauer, Abgrund)
- Size-restricted unter Combatant-Groesse

---

## Movement Execution

### executeMovement Flow

```typescript
function executeMovement(
  combatant: Combatant,
  targetPos: GridPosition,
  state: CombatState,
  hasDisengage: boolean
): void {
  const path = calculatePath(combatant, targetPos, state);

  for (const step of path) {
    // 1. OA-Check (wenn nicht Disengage)
    if (!hasDisengage) {
      checkOpportunityAttacks(combatant, step, state);
    }

    // 2. Position setzen (inkl. Grapple-Drag)
    setPosition(combatant, step);

    // 3. Terrain-Effekte (on-leave old, on-enter new)
    applyTerrainEffects(oldPos, 'on-leave', combatant, state);
    applyTerrainEffects(step, 'on-enter', combatant, state);

    // 4. Zone-Effekte
    applyZoneEffects(combatant, 'on-enter', state);
  }
}
```

### OA-Trigger

Opportunity Attacks werden getriggert wenn:
1. Combatant verlaesst Reichweite eines Feindes
2. Feind hat noch Reaction verfuegbar
3. Combatant hat NICHT Disengage-Effekt aktiv

```typescript
function wouldTriggerReaction(
  mover: Combatant,
  from: GridPosition,
  to: GridPosition,
  reactor: Combatant,
  state: CombatState
): boolean {
  const wasInReach = isInReach(reactor, from);
  const stillInReach = isInReach(reactor, to);
  return wasInReach && !stillInReach;
}
```

### Disengage-Effekt

```typescript
effects: [{
  movementBehavior: {
    noOpportunityAttacks: true
  }
}]
```

---

## Action-basiertes Movement

### budgetCosts.movement

Actions koennen Movement-Kosten definieren:

```typescript
budgetCosts: {
  movement?: {
    type: 'toTarget' | 'fixed' | 'all';
    cells?: number;  // nur bei 'fixed'
  }
}
```

| Type | Beschreibung |
|------|--------------|
| `toTarget` | Dijkstra-Distanz zum Ziel |
| `fixed` | Feste Anzahl Cells |
| `all` | Gesamtes verbleibendes Movement |

---

## Forced Movement

### Grapple-Drag

Wenn ein Grappler sich bewegt, bewegen sich gegrapplte Targets mit:

```typescript
function setPosition(combatant: Combatant, pos: GridPosition): void {
  const oldPos = getPosition(combatant);
  combatant.combatState.position = pos;

  // Grapple-Drag: Alle von diesem Combatant gegrappelten mitziehen
  for (const target of getGrappledTargets(combatant, state)) {
    const offset = subtractPositions(pos, oldPos);
    const newTargetPos = addPositions(getPosition(target), offset);
    setPosition(target, newTargetPos);
  }
}
```

### Teleportation

Terrain-Effekte koennen Combatants teleportieren:

```typescript
effect: {
  type: 'teleporter',
  targetCell: { x: 10, y: 5 }
}
```

### Sentinel-Stop

Reactions koennen Movement stoppen:

```typescript
effects: [{
  stopsMovement: true
}]
```

---

## Verwandte Dokumente

- [triggers.md](triggers.md) - Zone-Trigger und OA
- [resolveEffects.md](resolveEffects.md) - Forced Movement im ResolutionResult
- [CombatWorkflow.md](../../orchestration/CombatWorkflow.md) - Position-Updates
- [combatTerrain](../combatTerrain/index.md) - Terrain-Kosten und Effekte
