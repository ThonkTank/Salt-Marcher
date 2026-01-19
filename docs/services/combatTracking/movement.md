> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# Movement

> **Verantwortlichkeit:** Combat-spezifische Movement-Logik
> **Pfad (Single Source of Truth):** `src/services/combatTracking/movement.ts`
> **Pfad (Pathfinding):** `src/services/combatTerrain/terrainMovement.ts`
> **Pfad (Execution):** `src/workflows/combatWorkflow.ts`

---

## Architektur

Movement-Logik ist auf drei Module verteilt:

```
combatTracking/movement.ts       →  Combat-spezifisch (READ-ONLY)
├── Speed & TurnBudget
├── Dash/Teleport/Extra Movement
├── Grapple-Queries
└── Action-Helpers

combatTerrain/terrainMovement.ts →  Wiederverwendbar (Combat + Dungeon)
├── Dijkstra Pathfinding
├── Movement-Kosten (Terrain)
└── Cell-Occupancy

workflows/combatWorkflow.ts      →  Movement Execution (State-Mutation)
├── runAction() → resolveAction() + applyResult()
├── OA-Resolution
└── Zone/Terrain-Effekt Trigger
```

---

## movement.ts API (READ-ONLY)

### Speed & Budget

| Funktion | Beschreibung |
|----------|--------------|
| `getSpeed(c)` | SpeedBlock aus Combatant (walk, fly, swim, climb, burrow) |
| `getEffectiveSpeed(c, state?)` | Effektive Speed unter Berücksichtigung von Modifiers und Zones |
| `createTurnBudget(c, state?)` | Erstellt TurnBudget für einen Combatant |
| `calculateGrantedMovement(grant, budget)` | Berechnet Movement-Bonus von grantMovement Effects |
| `hasAnyBonusAction(c)` | Prüft ob Combatant Bonus Actions hat |

### Grapple Queries

| Funktion | Beschreibung |
|----------|--------------|
| `getGrappledTargets(grappler, state)` | Findet alle von diesem Grappler gegrappelten Combatants |
| `hasAbductTrait(c)` | Prüft ob Combatant das Abduct-Trait hat (keine Speed-Reduktion beim Drag) |

### Action Helpers

| Funktion | Beschreibung |
|----------|--------------|
| `hasGrantMovementEffect(action)` | Prüft ob Action Movement gewährt (Dash, Teleport, etc.) |
| `hasToTargetMovementCost(action)` | Prüft ob Action toTarget Movement-Kosten hat |
| `getMovementRange(action, budget, combatant)` | Berechnet erreichbare Range für Movement-Action |

---

## Movement Budget

### TurnBudget

```typescript
interface TurnBudget {
  movementCells: number;      // Verbleibende Bewegung
  baseMovementCells: number;  // Basis-Speed (ohne Dash)
  hasAction: boolean;
  hasBonusAction: boolean;
  hasReaction: boolean;
}
```

### Speed → Cells Conversion

```typescript
// 5ft = 1 Cell
const movementCells = Math.floor(speed.walk / 5);
```

### Effective Speed

`getEffectiveSpeed()` berücksichtigt:

1. **speedOverride** - Absoluter Wert (0 für grappled, paralyzed, etc.)
2. **speedMultiplier** - Multiplikator (0.5 für grappling)
3. **Zone Speed-Modifier** - Spirit Guardians, etc.

---

## Pathfinding (terrainMovement.ts)

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

## Movement Execution (combatWorkflow.ts)

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

### grantMovement Effects

Actions können Movement gewähren:

```typescript
effects: [{
  grantMovement: {
    type: 'dash' | 'extra' | 'teleport';
    value?: number;  // nur bei 'extra' und 'teleport'
  }
}]
```

| Type | Beschreibung |
|------|--------------|
| `dash` | Verdoppelt baseMovementCells |
| `extra` | Addiert fixen Wert zu movementCells |
| `teleport` | Ersetzt Budget komplett (unabhängig von current budget) |

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
