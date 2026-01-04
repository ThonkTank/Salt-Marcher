# Grid Utilities

> **Verantwortlichkeit:** Square-cell Grid-Operationen fuer Combat und Dungeon-Maps
> **Konsumiert von:** [combatResolver](../services/combatSimulator/combatResolver.md), [combatantAI](../services/combatSimulator/combatantAI.md), Dungeon-System (zukuenftig)
>
> **Verwandte Dokumente:**
> - [hex.ts](../utils/hex.md) - Hex-Grid fuer Overworld
> - [Dungeon-System](../features/Dungeon-System.md) - Zukuenftige Dungeon-Integration

---

## Koordinatensystem

Grid verwendet **Cell-Indizes** (0, 1, 2...) statt Feet:

```typescript
interface GridPosition {
  x: number;  // Spalten-Index (Ost-West)
  y: number;  // Zeilen-Index (Nord-Sued)
  z: number;  // Elevations-Layer (0 = Bodenlevel)
}
```

**Konvertierung zu Feet:** `feet = cellIndex * 5`

---

## Diagonalregel

Die Distanzberechnung unterstuetzt verschiedene Diagonalregeln:

| Regel | Diagonale | Status |
|-------|-----------|--------|
| `phb-variant` | 1.5 Cells | Implementiert (5-10-5-10) |
| `simple` | 1 Cell | Stub (Chebyshev) |
| `euclidean` | ~1.41 Cells | Stub |

```typescript
type DiagonalRule = 'simple' | 'phb-variant' | 'euclidean';
```

**Default:** `phb-variant` (D&D 5e PHB Variante)

---

## Z-Achse (3D-Zellen)

Z ist ein Cell-Index wie x/y - jede Zelle ist ein **5ft-Wuerfel**:

| z | Hoehe (feet) | Beispiel |
|---|--------------|----------|
| 0 | 0-5ft | Bodenlevel |
| 1 | 5-10ft | Balkon, Erhoehung |
| 2 | 10-15ft | Zweite Etage |
| -1 | -5-0ft | Grube, Keller |

---

## Types

### GridConfig

```typescript
interface GridConfig {
  cellSizeFeet: 5;           // D&D 5e Standard
  width: number;             // Anzahl Zellen
  height: number;            // Anzahl Zellen
  layers: number;            // Elevations-Layer
  diagonalRule: DiagonalRule;
}
```

### SpeedBlock

```typescript
interface SpeedBlock {
  walk: number;   // In Feet (D&D Standard)
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
}
```

---

## Funktionen

### Grid-Erstellung

| Funktion | Beschreibung |
|----------|--------------|
| `createGrid(config)` | Erstellt GridConfig mit Defaults |

### Konvertierung

| Funktion | Beschreibung |
|----------|--------------|
| `cellToFeet(cell, cellSize)` | Cell-Index zu Feet |
| `feetToCell(feet, cellSize)` | Feet zu Cell-Index (abrunden) |
| `positionToFeet(pos, cellSize)` | GridPosition zu Vector3 in Feet |
| `feetToPosition(vec, cellSize)` | Vector3 in Feet zu GridPosition |

### Distanz

| Funktion | Beschreibung |
|----------|--------------|
| `getDistance(a, b, rule)` | 3D-Distanz in Cells |
| `getDistanceFeet(a, b, config)` | Distanz in Feet |

### Bounds & Nachbarn

| Funktion | Beschreibung |
|----------|--------------|
| `isWithinBounds(pos, config)` | Prueft ob Position gueltig |
| `clampToGrid(pos, config)` | Begrenzt Position auf Bounds |
| `getNeighbors(pos)` | 8 horizontale Nachbarn |
| `getNeighbors3D(pos)` | 26 3D-Nachbarn |
| `filterInBounds(positions, config)` | Filtert ungueltige Positionen |

### Formation & Positionierung

| Funktion | Beschreibung |
|----------|--------------|
| `spreadFormation(count, center, spacing)` | Verteilt Positionen in Reihen |
| `positionOpposingSides(a, b, dist, spacing)` | Positioniert zwei Gruppen gegenueber |

### Utilities

| Funktion | Beschreibung |
|----------|--------------|
| `positionToKey(pos)` | GridPosition zu String ("x,y,z") |
| `keyToPosition(key)` | String zu GridPosition |
| `positionsEqual(a, b)` | Gleichheitspruefung |
| `getDirection(a, b)` | Normalisierte Richtung (-1, 0, 1) |
| `stepToward(from, to)` | Einen Schritt Richtung Ziel |

---

## Beispiele

### Grid erstellen

```typescript
import { createGrid, getDistance, spreadFormation } from '@/utils/grid';

const grid = createGrid({
  width: 40,
  height: 40,
  layers: 10,
  diagonalRule: 'phb-variant',
});
```

### Distanz berechnen

```typescript
const a = { x: 0, y: 0, z: 0 };
const b = { x: 3, y: 4, z: 0 };

const distCells = getDistance(a, b, 'phb-variant');  // 5 Cells
const distFeet = distCells * 5;  // 25 Feet
```

### Formation verteilen

```typescript
const center = { x: 10, y: 10, z: 0 };
const positions = spreadFormation(4, center, 2);
// [{ x: 10, y: 10, z: 0 }, { x: 12, y: 10, z: 0 }, ...]
```

---

## Line of Sight (Stubs)

Siehe `gridLineOfSight.ts` fuer LoS-bezogene Funktionen (noch nicht implementiert):

| Funktion | Status |
|----------|--------|
| `rayCast(from, to, isBlocked)` | Stub |
| `getVisibleCells(origin, range, isOpaque)` | Stub |
| `calculateCover(attacker, target, isBlocking)` | Stub |
| `hasLineOfSight(from, to, maxRange)` | Vereinfacht (nur Distanz) |
| `getLineCells(from, to)` | Implementiert (Bresenham) |
