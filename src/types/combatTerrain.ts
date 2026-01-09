// Ziel: Combat Terrain Types für LOS, Cover, Difficult Terrain
// Siehe: docs/services/combatTracking.md

import type { CoverLevel } from '@/utils/squareSpace/gridLineOfSight';

// ============================================================================
// TERRAIN EFFECT TYPES
// ============================================================================

/** Effect-Typ für extensibles Terrain-System. */
export type CombatTerrainEffectType =
  // Movement
  | 'difficult'           // 2× Movement-Kosten
  | 'impassable'          // Blockiert Movement
  | 'size-restricted'     // Nur bestimmte Sizes passieren
  | 'shooting-only'       // Kann durchgehen aber nicht aufhalten
  // Visibility
  | 'blocks-los'          // Blockiert LoS komplett
  | 'obscured-light'      // Lightly Obscured
  | 'obscured-heavy'      // Heavily Obscured
  // Damage
  | 'damage-on-enter'     // Schaden beim Betreten
  | 'damage-on-start'     // Schaden bei Turn Start
  | 'damage-on-end'       // Schaden bei Turn End
  // Conditions
  | 'condition-on-enter'  // Condition beim Betreten
  | 'condition-while-in'  // Condition solange in Cell
  // Interactive
  | 'door-closed'         // Geschlossene Tür
  | 'door-open'           // Offene Tür
  | 'teleporter';         // Teleportation

/** Parameter für Effect-Typen. */
export interface CombatTerrainEffectParams {
  // Für damage-*
  damage?: string;        // Dice expression: "1d6", "2d6"
  damageType?: string;    // "fire", "cold", "piercing"
  // Für condition-*
  condition?: string;     // "prone", "restrained"
  // Für size-restricted
  maxSize?: number;       // Max creature size (1=Tiny, 2=Small, ...)
  // Für teleporter
  targetCell?: string;    // positionToKey des Ziel-Cells
}

/** Einzelner Effect auf einer Cell. */
export interface CombatCellEffect {
  type: CombatTerrainEffectType;
  params?: CombatTerrainEffectParams;
}

// ============================================================================
// CELL PROPERTIES
// ============================================================================

/**
 * Terrain-Properties einer einzelnen Cell.
 * Sparse Map: Nur nicht-default Cells werden gespeichert.
 */
export interface CombatCellProperties {
  blocksMovement: boolean;              // true = Wall/Pillar
  blocksLoS: boolean;                   // true = Blockiert Sicht
  movementCostMultiplier: number;       // 1 = normal, 2 = difficult
  cover: CoverLevel;                    // 'none' | 'half' | 'three-quarters' | 'full'
  effects: CombatCellEffect[];          // Extensibles Effect-System
}

/** Default-Properties für leere Cells (nicht gespeichert). */
export const DEFAULT_CELL_PROPERTIES: Readonly<CombatCellProperties> = {
  blocksMovement: false,
  blocksLoS: false,
  movementCostMultiplier: 1,
  cover: 'none',
  effects: [],
};

// ============================================================================
// MAP CONFIGURATION
// ============================================================================

/** Rechteckige Bounds für Map-Grenzen oder Spawn-Zonen. */
export interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Vollständige Konfiguration für eine Combat-Map.
 * Enthält Terrain-Properties, Map-Grenzen und optionale Spawn-Zonen.
 */
export interface CombatMapConfig {
  /** Sparse terrain properties (nur nicht-default Cells). */
  terrainMap: Map<string, CombatCellProperties>;
  /** Map-Grenzen (inklusive). Combatants können nicht außerhalb spawnen/bewegen. */
  bounds: MapBounds;
  /** Optionale Spawn-Zonen für Party und Enemies. */
  spawnZones?: {
    party: MapBounds;
    enemies: MapBounds;
  };
}
