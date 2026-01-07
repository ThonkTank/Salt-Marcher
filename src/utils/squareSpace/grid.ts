// Ziel: Grid utilities für square-cell Maps (Combat, Dungeon)
// Siehe: docs/utils/grid.md
//
// Koordinatensystem: Cell-Indizes (nicht Feet)
// - x: Spalten-Index (Ost-West)
// - y: Zeilen-Index (Nord-Süd)
// - z: Elevations-Layer (5ft-Würfel)
//
// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Implementiere DiagonalRule 'simple'
// - Chebyshev-Distanz (jede Diagonale = 1 Cell)
//
// [TODO]: Implementiere DiagonalRule 'euclidean'
// - Echte geometrische Distanz (~1.41 pro Diagonale)

// ============================================================================
// TYPES
// ============================================================================

/** Grid-relative Position (Cell-Indizes, nicht Feet). */
export interface GridPosition {
  x: number; // Spalten-Index (0, 1, 2...)
  y: number; // Zeilen-Index (0, 1, 2...)
  z: number; // Elevations-Layer (0 = Bodenlevel)
}

/** Diagonalregel für Distanzberechnung. */
export type DiagonalRule = 'simple' | 'phb-variant' | 'euclidean';

/** Grid-Konfiguration. */
export interface GridConfig {
  cellSizeFeet: 5;
  width: number; // Anzahl Zellen
  height: number; // Anzahl Zellen
  layers: number; // Elevations-Layer (default 1)
  diagonalRule: DiagonalRule;
}

/** Speed-Block für Movement-Berechnung (in Feet, per D&D). */
export interface SpeedBlock {
  walk: number;
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
}

/** 3D-Vektor in Feet (für Konvertierung). */
export interface Vector3Feet {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// GRID CREATION
// ============================================================================

/** Erstellt Grid-Konfiguration mit Defaults. */
export function createGrid(config: {
  width: number;
  height: number;
  layers?: number;
  diagonalRule?: DiagonalRule;
}): GridConfig {
  return {
    cellSizeFeet: 5,
    width: config.width,
    height: config.height,
    layers: config.layers ?? 1,
    diagonalRule: config.diagonalRule ?? 'phb-variant',
  };
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/** Konvertiert Cell-Index zu Feet. */
export function cellToFeet(cell: number, cellSize: number = 5): number {
  return cell * cellSize;
}

/** Konvertiert Feet zu Cell-Index (abrunden). */
export function feetToCell(feet: number, cellSize: number = 5): number {
  return Math.floor(feet / cellSize);
}

/** Konvertiert GridPosition zu Vector3 in Feet. */
export function positionToFeet(
  pos: GridPosition,
  cellSize: number = 5
): Vector3Feet {
  return {
    x: cellToFeet(pos.x, cellSize),
    y: cellToFeet(pos.y, cellSize),
    z: cellToFeet(pos.z, cellSize),
  };
}

/** Konvertiert Vector3 in Feet zu GridPosition. */
export function feetToPosition(
  vec: Vector3Feet,
  cellSize: number = 5
): GridPosition {
  return {
    x: feetToCell(vec.x, cellSize),
    y: feetToCell(vec.y, cellSize),
    z: feetToCell(vec.z, cellSize),
  };
}

// ============================================================================
// DISTANCE FUNCTIONS
// ============================================================================

/**
 * Berechnet 3D-Distanz zwischen zwei Positionen in Cells.
 * Nutzt die konfigurierte DiagonalRule.
 */
export function getDistance(
  a: GridPosition,
  b: GridPosition,
  rule: DiagonalRule = 'phb-variant'
): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const dz = Math.abs(a.z - b.z);

  switch (rule) {
    case 'phb-variant':
      return getDistancePHBVariant(dx, dy, dz);
    case 'simple':
    case 'euclidean':
      throw new Error(`DiagonalRule '${rule}' not implemented`);
  }
}

/**
 * PHB-Variant: 5-10-5-10 Regel für Diagonalen.
 * Durchschnittlich 1.5 Cells pro Diagonale.
 */
function getDistancePHBVariant(dx: number, dy: number, dz: number): number {
  // Sortiere Achsen absteigend: major, mid, minor
  const sorted = [dx, dy, dz].sort((x, y) => y - x);
  const [major, mid, minor] = sorted;

  // Major-Achse: volle Kosten
  // Mid-Achse: +0.5 pro Cell (Diagonale)
  // Minor-Achse: +0.5 pro Cell (zweite Diagonale)
  return major + Math.floor(mid * 0.5) + Math.floor(minor * 0.5);
}

/**
 * Berechnet Distanz in Feet.
 * Convenience-Wrapper für getDistance().
 */
export function getDistanceFeet(
  a: GridPosition,
  b: GridPosition,
  config: GridConfig
): number {
  const distanceCells = getDistance(a, b, config.diagonalRule);
  return cellToFeet(distanceCells, config.cellSizeFeet);
}

// ============================================================================
// BOUNDS & NEIGHBORS
// ============================================================================

/** Prüft ob Position innerhalb der Grid-Bounds liegt. */
export function isWithinBounds(pos: GridPosition, config: GridConfig): boolean {
  return (
    pos.x >= 0 &&
    pos.x < config.width &&
    pos.y >= 0 &&
    pos.y < config.height &&
    pos.z >= 0 &&
    pos.z < config.layers
  );
}

/** Begrenzt Position auf gültige Grid-Bounds. */
export function clampToGrid(pos: GridPosition, config: GridConfig): GridPosition {
  return {
    x: Math.max(0, Math.min(config.width - 1, pos.x)),
    y: Math.max(0, Math.min(config.height - 1, pos.y)),
    z: Math.max(0, Math.min(config.layers - 1, pos.z)),
  };
}

/** Gibt alle 8 horizontalen Nachbarzellen zurück (ohne Bounds-Check). */
export function getNeighbors(pos: GridPosition): GridPosition[] {
  const neighbors: GridPosition[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      neighbors.push({ x: pos.x + dx, y: pos.y + dy, z: pos.z });
    }
  }
  return neighbors;
}

/** Gibt alle 26 3D-Nachbarzellen zurück (inkl. vertikal). */
export function getNeighbors3D(pos: GridPosition): GridPosition[] {
  const neighbors: GridPosition[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        neighbors.push({ x: pos.x + dx, y: pos.y + dy, z: pos.z + dz });
      }
    }
  }
  return neighbors;
}

/** Filtert Positionen auf gültige Bounds. */
export function filterInBounds(
  positions: GridPosition[],
  config: GridConfig
): GridPosition[] {
  return positions.filter((pos) => isWithinBounds(pos, config));
}

// ============================================================================
// FORMATION & POSITIONING
// ============================================================================

/**
 * Verteilt Positionen in einer Formation (Reihen à 4).
 * @param count Anzahl der zu verteilenden Einheiten
 * @param center Mittelpunkt der Formation
 * @param spacing Abstand zwischen Einheiten (in Cells)
 */
export function spreadFormation(
  count: number,
  center: GridPosition,
  spacing: number = 2
): GridPosition[] {
  const positions: GridPosition[] = [];

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    positions.push({
      x: center.x + col * spacing,
      y: center.y + (row - Math.floor(count / 8)) * spacing,
      z: center.z,
    });
  }

  return positions;
}

/**
 * Positioniert zwei Gruppen gegenüber auf dem Grid.
 * @param groupA Größe der ersten Gruppe
 * @param groupB Größe der zweiten Gruppe
 * @param distanceCells Abstand zwischen den Gruppen (in Cells)
 * @param spacing Abstand innerhalb einer Formation (in Cells)
 */
export function positionOpposingSides(
  groupA: number,
  groupB: number,
  distanceCells: number,
  spacing: number = 2
): { sideA: GridPosition[]; sideB: GridPosition[] } {
  const centerA: GridPosition = { x: 0, y: 0, z: 0 };
  const centerB: GridPosition = { x: distanceCells, y: 0, z: 0 };

  return {
    sideA: spreadFormation(groupA, centerA, spacing),
    sideB: spreadFormation(groupB, centerB, spacing),
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Konvertiert GridPosition zu String-Key für Set/Map-Operationen. */
export function positionToKey(pos: GridPosition): string {
  return `${pos.x},${pos.y},${pos.z}`;
}

/** Parst String-Key zurück zu GridPosition. */
export function keyToPosition(key: string): GridPosition {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}

/** Prüft ob zwei Positionen gleich sind. */
export function positionsEqual(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/** Berechnet die Richtung von a nach b (normalisiert auf -1, 0, 1). */
export function getDirection(a: GridPosition, b: GridPosition): GridPosition {
  return {
    x: Math.sign(b.x - a.x),
    y: Math.sign(b.y - a.y),
    z: Math.sign(b.z - a.z),
  };
}

/** Bewegt Position einen Schritt in Richtung Ziel. */
export function stepToward(from: GridPosition, to: GridPosition): GridPosition {
  const dir = getDirection(from, to);
  return {
    x: from.x + dir.x,
    y: from.y + dir.y,
    z: from.z + dir.z,
  };
}

// ============================================================================
// MOVEMENT & RANGE UTILITIES
// ============================================================================

/**
 * Cache fuer Offset-Patterns pro Range.
 * Vermeidet wiederholte Array-Generierung bei Escape-Danger-Berechnungen.
 */
const offsetPatternCache = new Map<number, { dx: number; dy: number }[]>();

/**
 * Gibt gecachtes Offset-Pattern fuer eine Range zurueck.
 * PHB-Variant Distance: Chebyshev (max of |dx|, |dy|).
 *
 * @param range Bewegungsreichweite in Cells
 * @returns Array von Offsets relativ zum Zentrum
 */
export function getOffsetPattern(range: number): { dx: number; dy: number }[] {
  if (!offsetPatternCache.has(range)) {
    const offsets: { dx: number; dy: number }[] = [];
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        // PHB-Variant Distance: Chebyshev
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= range) {
          offsets.push({ dx, dy });
        }
      }
    }
    offsetPatternCache.set(range, offsets);
  }
  return offsetPatternCache.get(range)!;
}

/**
 * Gibt alle relevanten Cells innerhalb der Bewegungsreichweite zurueck.
 * Performance-Optimierung: PHB-Variant Distance Filter (~27% weniger Cells).
 */
export function getRelevantCells(
  center: GridPosition,
  movementCells: number
): GridPosition[] {
  const range = movementCells;
  const cells: GridPosition[] = [];

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      const cell = { x: center.x + dx, y: center.y + dy, z: center.z };
      // PHB-Variant Distance: Chebyshev (max of dx, dy) statt Bounding-Box
      if (getDistance(center, cell) <= range) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

/**
 * Berechnet Movement-basiertes Decay fuer Attraction und Danger Scores.
 * Kombiniert diskrete Baender (50% pro Runde) mit leichtem Intra-Band Decay.
 *
 * @param distanceToTarget - Cells bis zum Ziel/Feind
 * @param targetReach - Reichweite zum Ziel (Attack Range fuer Attraction, Range + Movement fuer Danger)
 * @param movement - Movement pro Runde
 * @returns Decay-Multiplikator (1.0 = voller Wert, 0.5 = halber Wert, etc.)
 */
export function calculateMovementDecay(
  distanceToTarget: number,
  targetReach: number,
  movement: number
): number {
  if (distanceToTarget <= targetReach) {
    // Band 0: Jetzt erreichbar - voller Wert
    return 1.0;
  }

  const excessDistance = distanceToTarget - targetReach;

  // Band-Nummer: 1 = naechste Runde, 2 = uebernaechste, etc.
  const bandNumber = Math.ceil(excessDistance / Math.max(1, movement));

  // Haupt-Multiplikator: 50% pro Runde
  const bandMultiplier = Math.pow(0.5, bandNumber);

  // Intra-Band Position: 0.0 (Band-Start) bis 1.0 (Band-Ende)
  const positionInBand = movement > 0
    ? (excessDistance % movement) / movement
    : 0;

  // Leichtes Decay innerhalb des Bands: 100% -> 90% ueber das Band
  // Incentiviert Bewegung in Richtung Band-Grenze
  const intraBandDecay = 1.0 - (positionInBand * 0.1);

  return bandMultiplier * intraBandDecay;
}
