> ⚠️ **ON HOLD** - Diese Dokumentation ist aktuell nicht aktiv.
> Die Combat-Implementierung wurde vorübergehend pausiert.

# getRelevantCells

> **Verantwortlichkeit:** Berechnet erreichbare Zellen mit Movement-Kosten
> **Code:** `src/services/gridSpace/gridSpace.ts`
> **Konsumiert von:** [planNextAction](planNextAction.md), [buildThreatMap](buildThreatMap.md), [buildPossibleActions](buildPossibleActions.md)

Dijkstra-basierte Erreichbarkeitsberechnung fuer Combat-AI. Beruecksichtigt Terrain-Kosten und Kreatur-Blockaden.

---

## Unterschied zu gridSpace.getRelevantCells()

| Aspekt | gridSpace | combatantAI |
|--------|-----------|-------------|
| Algorithmus | Bounding-Box (2x Movement) | Dijkstra |
| Terrain-Kosten | Nein | Ja |
| Kreatur-Blockaden | Nein | Ja |
| Return | `GridPosition[]` | `ReachableCell[]` |

Die gridSpace-Version ist fuer einfache Aufgaben (z.B. Spell-Targeting). Die combatantAI-Version ist fuer taktische Bewegungs-Entscheidungen.

---

## getRelevantCells()

```typescript
function getRelevantCells(
  combatant: CombatantWithLayers,
  state: CombatSimulationStateWithLayers,
  movementBudget: number
): ReachableCell[]
```

**Parameter:**
- `combatant` - Der sich bewegende Combatant
- `state` - Combat-State mit Grid und Combatant-Positionen
- `movementBudget` - Verbleibendes Movement in Cells

**Return:**
```typescript
interface ReachableCell {
  cell: GridPosition;
  cost: number;         // Tatsaechliche Kosten um diese Zelle zu erreichen
  path?: GridPosition[];  // Optional: Pfad zur Zelle (fuer AoO-Berechnung)
}
```

---

## Algorithmus: Dijkstra

### Pseudocode

```
function getRelevantCells(combatant, state, movementBudget):
  startCell = combatant.position
  visited = Map<cellKey, ReachableCell>
  queue = PriorityQueue (min-heap by cost)

  queue.add({ cell: startCell, cost: 0 })

  while queue.notEmpty():
    current = queue.poll()

    if visited.has(cellKey(current.cell)):
      continue

    visited.set(cellKey(current.cell), current)

    for neighbor in getNeighbors(current.cell):
      moveCost = getMovementCost(combatant, state, current.cell, neighbor)

      if moveCost === Infinity:
        continue  // Blockiert

      totalCost = current.cost + moveCost

      if totalCost <= movementBudget:
        queue.add({ cell: neighbor, cost: totalCost })

  return Array.from(visited.values())
```

### Komplexitaet

- **Zeit:** O(V log V + E) mit V = erreichbare Zellen, E = Kanten
- **Praktisch:** Bei 6 Movement (30ft) sind ~100-200 Zellen erreichbar

---

## Movement-Kosten

### getMovementCost()

```typescript
function getMovementCost(
  combatant: CombatantWithLayers,
  state: CombatSimulationStateWithLayers,
  from: GridPosition,
  to: GridPosition
): number  // 1, 2, oder Infinity
```

### Terrain-Kosten

| Terrain | Kosten | Beispiele |
|---------|--------|-----------|
| Normal | 1 | Offenes Gelaende, Strasse |
| Difficult | 2 | Gestrupp, Schutt, seichtes Wasser |
| Impassable | Infinity | Waende, tiefes Wasser, Lava |

**Quelle:** `state.grid.terrain[cellKey]` oder Default = 1 (Normal)

### Kreatur-Blockaden

| Situation | Kosten | D&D RAW |
|-----------|--------|---------|
| Leere Zelle | Terrain-Kosten | - |
| Verbuendete Kreatur | Terrain-Kosten | PHB: "move through nonhostile creature's space" |
| Feindliche Kreatur | Infinity | PHB: "can't move through a hostile creature's space" |
| Eigene Position | 0 | Startpunkt |

**Pruefung:** `isEnemyAt(state, combatant.alliance, to)`

### Groesse-Modifikatoren (Optional, spaeter)

| Situation | Regel |
|-----------|-------|
| Kleine Kreatur durch groessere | Kann durchbewegen (Difficult Terrain) |
| Kreatur 2+ Groessenklassen kleiner | Kann durchbewegen |

**MVP:** Ignorieren - alle Kreaturen blockieren gleich.

---

## Position-Key Format

**Standard:** `"${x},${y},${z}"` (3D, Komma-separiert)

```typescript
function cellKey(pos: GridPosition): string {
  return `${pos.x},${pos.y},${pos.z}`;
}

function parseKey(key: string): GridPosition {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}
```

**Verwendung:** Konsistent in allen Map-Keys (visited, terrain, combatantPositions).

---

## Nachbarn

### getNeighbors()

```typescript
function getNeighbors(cell: GridPosition): GridPosition[]
```

**D&D Grid (Square):** 8 Nachbarn (inklusive Diagonalen)

```
[NW] [N] [NE]
[W]  [X] [E]
[SW] [S] [SE]
```

**Diagonale Bewegung:** Kosten 1 (PHB Variant: "Playing on a Grid")

---

## Pfad-Tracking (Optional)

Fuer AoO-Berechnung (Opportunity Attacks) kann der Pfad gespeichert werden:

```typescript
interface ReachableCell {
  cell: GridPosition;
  cost: number;
  path?: GridPosition[];  // Alle Zellen auf dem Weg
}
```

**Verwendung:** `calculateExpectedReactionCost()` in buildThreatMap braucht den Pfad, um zu pruefen welche Gegner-Reichweiten verlassen werden.

**MVP:** Pfad optional - kann auch bei Bedarf neu berechnet werden.

---

## Grid-Bounds

```typescript
function isInBounds(cell: GridPosition, grid: GridConfig): boolean {
  return cell.x >= 0 && cell.x < grid.width &&
         cell.y >= 0 && cell.y < grid.height;
}
```

Zellen ausserhalb des Grids werden ignoriert.

---

## Exports

```typescript
// Main Export
export function getRelevantCells(
  combatant: CombatantWithLayers,
  state: CombatSimulationStateWithLayers,
  movementBudget: number
): ReachableCell[];

// Helper Exports
export function getMovementCost(
  combatant: CombatantWithLayers,
  state: CombatSimulationStateWithLayers,
  from: GridPosition,
  to: GridPosition
): number;

export function cellKey(pos: GridPosition): string;
export function parseKey(key: string): GridPosition;
export function getNeighbors(cell: GridPosition): GridPosition[];
export function isInBounds(cell: GridPosition, grid: GridConfig): boolean;
```

---

## Siehe auch

- [gridSpace.md](../gridSpace.md) - Einfache Version ohne Pathfinding
- [buildThreatMap.md](buildThreatMap.md) - Nutzt Pfade fuer AoO-Berechnung
- [simulationState.md](simulationState.md) - Budget-Management
