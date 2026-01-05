// Ziel: Grid-State und Positioning für Combat und andere Workmodes
// Siehe: docs/services/gridSpace.md
//
// Service für:
// - Grid-Initialisierung mit konfigurierbarer Größe
// - Combatant-Positioning (Initial + Formation)
// - Cell-Enumeration für AI und Movement
//
// Wird von combatTracking, combatSimulator und Workflows genutzt.

import {
  type GridPosition,
  type GridConfig,
  createGrid,
  feetToCell,
  spreadFormation as gridSpreadFormation,
} from '@/utils';
import { getDistance } from '../combatSimulator/combatHelpers';

// Re-export für Consumer
export type { GridPosition, GridConfig } from '@/utils';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[gridSpace]', ...args);
  }
};

// ============================================================================
// CONSTANTS
// ============================================================================

/** Margin um das Kampffeld in Cells. */
export const GRID_MARGIN_CELLS = 20;

/** Default Encounter-Distanz in Feet. */
export const DEFAULT_ENCOUNTER_DISTANCE_FEET = 60;

/** Default Encounter-Distanz in Cells. */
export const DEFAULT_ENCOUNTER_DISTANCE_CELLS = feetToCell(DEFAULT_ENCOUNTER_DISTANCE_FEET);

// ============================================================================
// GRID INITIALIZATION
// ============================================================================

/**
 * Initialisiert Grid für Kampfsimulation.
 * Erstellt quadratisches Grid mit konfigurierbarer Größe basierend auf Encounter-Distanz.
 *
 * @param config.encounterDistanceCells Distanz zwischen Party und Gegnern in Cells
 * @param config.marginCells Optionaler Margin um das Kampffeld (default: GRID_MARGIN_CELLS)
 * @returns GridConfig für Combat-Tracking
 */
export function initializeGrid(config: {
  encounterDistanceCells?: number;
  marginCells?: number;
}): GridConfig {
  const encounterDistanceCells = config.encounterDistanceCells ?? DEFAULT_ENCOUNTER_DISTANCE_CELLS;
  const marginCells = config.marginCells ?? GRID_MARGIN_CELLS;

  const gridSize = encounterDistanceCells + marginCells * 2;

  debug('initializeGrid:', { encounterDistanceCells, marginCells, gridSize });

  return createGrid({
    width: gridSize,
    height: gridSize,
    layers: 10,  // 0-9 = 0-45ft Höhe
    diagonalRule: 'phb-variant',
  });
}

// ============================================================================
// POSITIONING
// ============================================================================

/** Minimal interface für Combatants mit Position. */
export interface PositionedCombatant {
  position: GridPosition;
  groupId: string;
}

/**
 * Verteilt Combatants in Formation (2 Cells = 10ft Abstand).
 * Mutiert die profile.position direkt.
 *
 * @param profiles Array von Profilen deren Position gesetzt wird
 * @param center Mittelpunkt der Formation
 */
export function spreadFormation(
  profiles: PositionedCombatant[],
  center: GridPosition
): void {
  const spacingCells = 2;  // 10ft = 2 Cells
  const positions = gridSpreadFormation(profiles.length, center, spacingCells);
  profiles.forEach((profile, i) => {
    profile.position = positions[i];
  });
}

/**
 * Setzt Initial-Positionen für alle Combatants basierend auf Allianzen.
 * Party + Verbündete auf einer Seite, Feinde auf der anderen.
 *
 * @param profiles Alle Combatant-Profile (werden mutiert)
 * @param alliances Alliance-Map (groupId → verbündete groupIds)
 * @param config.encounterDistanceCells Distanz zwischen den Gruppen
 */
export function calculateInitialPositions(
  profiles: PositionedCombatant[],
  alliances: Record<string, string[]>,
  config?: { encounterDistanceCells?: number }
): void {
  const encounterDistanceCells = config?.encounterDistanceCells ?? DEFAULT_ENCOUNTER_DISTANCE_CELLS;

  // Helper: Prüft ob groupA mit groupB verbündet ist
  const isAllied = (groupA: string, groupB: string): boolean => {
    if (groupA === groupB) return true;
    return alliances[groupA]?.includes(groupB) ?? false;
  };

  // Party + Verbündete auf einer Seite
  const partyAllies = profiles.filter(p => isAllied('party', p.groupId));
  // Feinde auf der anderen Seite (nicht mit party verbündet)
  const enemies = profiles.filter(p => !isAllied('party', p.groupId));

  // Party startet am Rand mit Margin
  const partyCenter: GridPosition = { x: GRID_MARGIN_CELLS, y: GRID_MARGIN_CELLS, z: 0 };
  // Feinde auf der gegenüberliegenden Seite
  const enemyCenter: GridPosition = {
    x: GRID_MARGIN_CELLS + encounterDistanceCells,
    y: GRID_MARGIN_CELLS,
    z: 0,
  };

  spreadFormation(partyAllies, partyCenter);
  spreadFormation(enemies, enemyCenter);

  debug('calculateInitialPositions:', {
    partyAllyCount: partyAllies.length,
    enemyCount: enemies.length,
    encounterDistanceCells,
    partyCenter,
    enemyCenter,
  });
}

// ============================================================================
// CELL ENUMERATION
// ============================================================================

/**
 * Gibt alle relevanten Cells innerhalb 2× Bewegungsreichweite zurück.
 * Performance-Optimierung: Limitiert auf potenziell erreichbare Cells.
 *
 * @param center Ausgangposition
 * @param movementCells Bewegungsreichweite in Cells
 * @returns Array aller Cells im Bereich
 */
export function getRelevantCells(
  center: GridPosition,
  movementCells: number
): GridPosition[] {
  const range = movementCells * 2;
  const cells: GridPosition[] = [];

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      // TODO: 3D Movement für fliegende Kreaturen
      cells.push({ x: center.x + dx, y: center.y + dy, z: center.z });
    }
  }

  debug('getRelevantCells:', { center, movementCells, range, cellCount: cells.length });
  return cells;
}

/**
 * Gibt alle Cells innerhalb einer gegebenen Reichweite zurück.
 * Nutzt PHB-Variant Distanz für korrektes Grid-Matching.
 *
 * @param center Mittelpunkt
 * @param rangeCells Reichweite in Cells
 * @returns Array aller Cells in Reichweite
 */
export function getCellsInRange(
  center: GridPosition,
  rangeCells: number
): GridPosition[] {
  const cells: GridPosition[] = [];

  for (let dx = -rangeCells; dx <= rangeCells; dx++) {
    for (let dy = -rangeCells; dy <= rangeCells; dy++) {
      const cell = { x: center.x + dx, y: center.y + dy, z: center.z };
      // Nur Cells die tatsächlich in Reichweite sind (PHB-Variant Distanz)
      if (getDistance(center, cell) <= rangeCells) {
        cells.push(cell);
      }
    }
  }

  return cells;
}
