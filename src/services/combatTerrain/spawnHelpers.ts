// Ziel: Spawn-Positionierung für Combat mit Terrain-Awareness
// Siehe: docs/services/combatTracking.md
//
// Findet gültige Spawn-Positionen innerhalb von Zonen,
// filtert Cells die blocksMovement: true haben.

import type { GridPosition } from '@/types/combat';
import type { CombatCellProperties, MapBounds } from '@/types/combatTerrain';
import { DEFAULT_CELL_PROPERTIES } from '@/types/combatTerrain';
import { positionToKey } from '@/utils/squareSpace/grid';

// ============================================================================
// CELL VALIDATION
// ============================================================================

/**
 * Prüft ob eine Cell begehbar ist (nicht blocksMovement).
 * Cells die nicht in der terrainMap sind, verwenden DEFAULT_CELL_PROPERTIES.
 */
export function isCellWalkable(
  position: GridPosition,
  terrainMap: Map<string, CombatCellProperties>
): boolean {
  const key = positionToKey(position);
  const cell = terrainMap.get(key) ?? DEFAULT_CELL_PROPERTIES;
  return !cell.blocksMovement;
}

/**
 * Prüft ob eine Position innerhalb der angegebenen Bounds liegt.
 */
export function isWithinBounds(
  position: GridPosition,
  bounds: MapBounds
): boolean {
  return (
    position.x >= bounds.minX &&
    position.x <= bounds.maxX &&
    position.y >= bounds.minY &&
    position.y <= bounds.maxY
  );
}

// ============================================================================
// SPAWN POSITION FINDING
// ============================================================================

/**
 * Sammelt alle Cells innerhalb einer Zone.
 * Gibt GridPositions zurück (z = 0).
 */
function getAllCellsInZone(zone: MapBounds): GridPosition[] {
  const cells: GridPosition[] = [];
  for (let x = zone.minX; x <= zone.maxX; x++) {
    for (let y = zone.minY; y <= zone.maxY; y++) {
      cells.push({ x, y, z: 0 });
    }
  }
  return cells;
}

/**
 * Findet gültige Spawn-Positionen innerhalb einer Zone.
 * Filtert Cells die blocksMovement: true haben.
 * Verteilt Positionen möglichst gleichmäßig über die Zone.
 *
 * @param zone Rechteckige Zone für Spawning
 * @param terrainMap Terrain-Properties (sparse Map)
 * @param count Anzahl benötigter Spawn-Positionen
 * @returns Array von GridPositions (kann weniger als count sein wenn Zone zu klein)
 */
export function findValidSpawnCells(
  zone: MapBounds,
  terrainMap: Map<string, CombatCellProperties>,
  count: number
): GridPosition[] {
  // Alle Cells in der Zone sammeln
  const allCells = getAllCellsInZone(zone);

  // Nur begehbare Cells behalten
  const walkableCells = allCells.filter(cell =>
    isCellWalkable(cell, terrainMap)
  );

  if (walkableCells.length === 0) {
    // Fallback: Mittelpunkt der Zone (auch wenn blockiert)
    const centerX = Math.floor((zone.minX + zone.maxX) / 2);
    const centerY = Math.floor((zone.minY + zone.maxY) / 2);
    return [{ x: centerX, y: centerY, z: 0 }];
  }

  if (walkableCells.length <= count) {
    // Weniger walkable Cells als benötigt - alle zurückgeben
    return walkableCells;
  }

  // Gleichmäßige Verteilung: Jede N-te Cell wählen
  const step = walkableCells.length / count;
  const result: GridPosition[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * step);
    result.push(walkableCells[index]);
  }

  return result;
}

/**
 * Berechnet Spawn-Positionen für zwei Gruppen basierend auf Map-Konfiguration.
 * Wenn keine spawnZones definiert sind, wird ein Standard-Layout verwendet.
 *
 * @param bounds Map-Grenzen
 * @param spawnZones Optionale explizite Spawn-Zonen
 * @param terrainMap Terrain-Properties
 * @param partyCount Anzahl Party-Mitglieder
 * @param enemyCount Anzahl Enemies
 * @returns Tuple [partyPositions, enemyPositions]
 */
export function calculateSpawnPositions(
  bounds: MapBounds,
  spawnZones: { party: MapBounds; enemies: MapBounds } | undefined,
  terrainMap: Map<string, CombatCellProperties>,
  partyCount: number,
  enemyCount: number
): [GridPosition[], GridPosition[]] {
  if (spawnZones) {
    // Explizite Spawn-Zonen verwenden
    const partySpawns = findValidSpawnCells(
      spawnZones.party,
      terrainMap,
      partyCount
    );
    const enemySpawns = findValidSpawnCells(
      spawnZones.enemies,
      terrainMap,
      enemyCount
    );
    return [partySpawns, enemySpawns];
  }

  // Fallback: Standard-Layout (Party links, Enemies rechts)
  const centerY = Math.floor((bounds.minY + bounds.maxY) / 2);
  const height = Math.max(1, Math.ceil(Math.max(partyCount, enemyCount) / 2));

  const partyZone: MapBounds = {
    minX: bounds.minX,
    maxX: bounds.minX + 2,
    minY: Math.max(bounds.minY, centerY - height),
    maxY: Math.min(bounds.maxY, centerY + height),
  };

  const enemyZone: MapBounds = {
    minX: bounds.maxX - 2,
    maxX: bounds.maxX,
    minY: Math.max(bounds.minY, centerY - height),
    maxY: Math.min(bounds.maxY, centerY + height),
  };

  const partySpawns = findValidSpawnCells(partyZone, terrainMap, partyCount);
  const enemySpawns = findValidSpawnCells(enemyZone, terrainMap, enemyCount);

  return [partySpawns, enemySpawns];
}
