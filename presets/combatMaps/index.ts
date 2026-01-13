// Ziel: Combat Terrain Map Presets für Tournament Tests
// Siehe: docs/services/combatTracking.md
//
// Jede Map ist für ein spezifisches Szenario in test-selectors.ts designed.
// Return-Typ ist CombatMapConfig mit bounds und spawnZones für korrekte Positionierung.

import type { CombatCellProperties, CombatMapConfig } from '../../src/types/combatTerrain';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Erstellt einen Key aus x,y Koordinaten (z=0). */
function key(x: number, y: number): string {
  return `${x},${y},0`;
}

/** Erstellt eine Wall-Cell (blockt Movement + LoS). */
function wall(): CombatCellProperties {
  return {
    blocksMovement: true,
    blocksLoS: true,
    movementCostMultiplier: 1,
    cover: 'full',
    effects: [{ type: 'impassable' }, { type: 'blocks-los' }],
  };
}

/** Erstellt eine Pillar-Cell (blockt Movement + LoS, bietet Full Cover). */
function pillar(): CombatCellProperties {
  return {
    blocksMovement: true,
    blocksLoS: true,
    movementCostMultiplier: 1,
    cover: 'full',
    effects: [{ type: 'impassable' }, { type: 'blocks-los' }],
  };
}

/** Erstellt eine Half-Cover Cell (niedriger Stein, Busch). */
function halfCover(): CombatCellProperties {
  return {
    blocksMovement: false,
    blocksLoS: false,
    movementCostMultiplier: 1,
    cover: 'half',
    effects: [],
  };
}

/** Erstellt eine Three-Quarters-Cover Cell (hohe Barrikade). */
function threeQuartersCover(): CombatCellProperties {
  return {
    blocksMovement: false,
    blocksLoS: false,
    movementCostMultiplier: 1,
    cover: 'three-quarters',
    effects: [],
  };
}

/** Erstellt Difficult Terrain (doppelte Movement-Kosten). */
function difficultTerrain(): CombatCellProperties {
  return {
    blocksMovement: false,
    blocksLoS: false,
    movementCostMultiplier: 2,
    cover: 'none',
    effects: [{ type: 'difficult' }],
  };
}

/** Erstellt Damage Terrain (Schaden beim Betreten). */
function damageTerrain(damage: string, damageType: string): CombatCellProperties {
  return {
    blocksMovement: false,
    blocksLoS: false,
    movementCostMultiplier: 1,
    cover: 'none',
    effects: [{ type: 'damage-on-enter', params: { damage, damageType } }],
  };
}

// ============================================================================
// STANDARD BOUNDS (12x6 Grid)
// ============================================================================

const STANDARD_BOUNDS = { minX: 0, maxX: 11, minY: 0, maxY: 5 };
const KITING_BOUNDS = { minX: 0, maxX: 11, minY: 0, maxY: 7 };  // Größer für Kiting

// ============================================================================
// SCENARIO MAPS
// ============================================================================

/**
 * 1v1 Melee: Offenes Feld, keine Hindernisse.
 * Testet pure Melee-Entscheidungen ohne taktische Komplexität.
 */
export function create1v1MeleeMap(): CombatMapConfig {
  return {
    terrainMap: new Map(),  // Leer = offenes Feld
    bounds: STANDARD_BOUNDS,
    spawnZones: {
      party: { minX: 0, maxX: 2, minY: 2, maxY: 3 },
      enemies: { minX: 9, maxX: 11, minY: 2, maxY: 3 },
    },
  };
}

/**
 * 2v4 Mixed: Einige Säulen für Cover und taktische Positionierung.
 * Layout (12x6):
 * ```
 * . . . . . . . . . . . .
 * . . . P . . . . P . . .
 * . . . . . . . . . . . .
 * . . . . . . . . . . . .
 * . . . P . . . . P . . .
 * . . . . . . . . . . . .
 * ```
 * P = Pillar
 */
export function create2v4MixedMap(): CombatMapConfig {
  const terrainMap = new Map<string, CombatCellProperties>();

  // Säulen als Cover-Punkte
  terrainMap.set(key(3, 1), pillar());
  terrainMap.set(key(8, 1), pillar());
  terrainMap.set(key(3, 4), pillar());
  terrainMap.set(key(8, 4), pillar());

  return {
    terrainMap,
    bounds: STANDARD_BOUNDS,
    spawnZones: {
      party: { minX: 0, maxX: 1, minY: 2, maxY: 3 },
      enemies: { minX: 10, maxX: 11, minY: 0, maxY: 5 },
    },
  };
}

/**
 * 1vN Horde: Zentrale Wand, die den Kampf teilt.
 * Testet wie die AI mit einem starken Einzelkämpfer gegen viele umgeht.
 * Layout (12x6):
 * ```
 * . . . . . . . . . . . .
 * . . . . . W W . . . . .
 * . . . . . W W . . . . .
 * . . . . . W W . . . . .
 * . . . . . W W . . . . .
 * . . . . . . . . . . . .
 * ```
 * W = Wall
 */
export function create1vNHordeMap(): CombatMapConfig {
  const terrainMap = new Map<string, CombatCellProperties>();

  // Zentrale Wand
  for (let y = 1; y <= 4; y++) {
    terrainMap.set(key(5, y), wall());
    terrainMap.set(key(6, y), wall());
  }

  return {
    terrainMap,
    bounds: STANDARD_BOUNDS,
    spawnZones: {
      party: { minX: 0, maxX: 2, minY: 2, maxY: 3 },
      enemies: { minX: 9, maxX: 11, minY: 2, maxY: 3 },
    },
  };
}

/**
 * Aura-Cluster: Difficult Terrain im Zentrum, zwingt zu engem Kampf.
 * Testet Aura-Positionierung (Captain-Buff Radius).
 * Layout (12x6):
 * ```
 * . . . . . . . . . . . .
 * . . . . D D D D . . . .
 * . . . . D D D D . . . .
 * . . . . D D D D . . . .
 * . . . . D D D D . . . .
 * . . . . . . . . . . . .
 * ```
 * D = Difficult Terrain
 */
export function createAuraClusterMap(): CombatMapConfig {
  const terrainMap = new Map<string, CombatCellProperties>();

  // Zentrales Difficult Terrain
  for (let x = 4; x <= 7; x++) {
    for (let y = 1; y <= 4; y++) {
      terrainMap.set(key(x, y), difficultTerrain());
    }
  }

  return {
    terrainMap,
    bounds: STANDARD_BOUNDS,
    spawnZones: {
      party: { minX: 0, maxX: 2, minY: 2, maxY: 3 },
      enemies: { minX: 9, maxX: 11, minY: 2, maxY: 3 },
    },
  };
}

/**
 * Bloodied: Offenes Feld mit leichtem Cover.
 * Testet Berserker-Rage bei <50% HP.
 * Layout (12x6):
 * ```
 * . . . . . . . . . . . .
 * . . H . . . . . . H . .
 * . . . . . . . . . . . .
 * . . . . . . . . . . . .
 * . . H . . . . . . H . .
 * . . . . . . . . . . . .
 * ```
 * H = Half Cover
 */
export function createBloodiedMap(): CombatMapConfig {
  const terrainMap = new Map<string, CombatCellProperties>();

  // Leichtes Cover an den Ecken
  terrainMap.set(key(2, 1), halfCover());
  terrainMap.set(key(9, 1), halfCover());
  terrainMap.set(key(2, 4), halfCover());
  terrainMap.set(key(9, 4), halfCover());

  return {
    terrainMap,
    bounds: STANDARD_BOUNDS,
    spawnZones: {
      party: { minX: 0, maxX: 1, minY: 2, maxY: 3 },
      enemies: { minX: 10, maxX: 11, minY: 2, maxY: 3 },
    },
  };
}

/**
 * Kiting: Pillars zum Kiten um langsame Gegner.
 * Scouts vs Ogre - Distanz halten.
 * Layout (12x8):
 * ```
 * . . . . . . . . . . . .
 * . . P . . . . . . P . .
 * . . . . . . . . . . . .
 * . . . . P . . P . . . .
 * . . . . P . . P . . . .
 * . . . . . . . . . . . .
 * . . P . . . . . . P . .
 * . . . . . . . . . . . .
 * ```
 * P = Pillar
 */
export function createKitingMap(): CombatMapConfig {
  const terrainMap = new Map<string, CombatCellProperties>();

  // Äußere Pillars
  terrainMap.set(key(2, 1), pillar());
  terrainMap.set(key(9, 1), pillar());
  terrainMap.set(key(2, 6), pillar());
  terrainMap.set(key(9, 6), pillar());

  // Zentrale Pillars (Kiting-Hindernisse)
  terrainMap.set(key(4, 3), pillar());
  terrainMap.set(key(7, 3), pillar());
  terrainMap.set(key(4, 4), pillar());
  terrainMap.set(key(7, 4), pillar());

  return {
    terrainMap,
    bounds: KITING_BOUNDS,
    spawnZones: {
      party: { minX: 0, maxX: 1, minY: 3, maxY: 4 },
      enemies: { minX: 10, maxX: 11, minY: 3, maxY: 4 },
    },
  };
}

/**
 * Kill Healer: Rückwand schützt den Healer.
 * Testet Ziel-Priorisierung (Healer hinter Schutz).
 * Layout (12x6):
 * ```
 * . . . . . . . . . . . .
 * . . . . . . . . . T T W
 * . . . . . . . . . . . W
 * . . . . . . . . . . . W
 * . . . . . . . . . T T W
 * . . . . . . . . . . . .
 * ```
 * W = Wall, T = Three-Quarters Cover
 */
export function createKillHealerMap(): CombatMapConfig {
  const terrainMap = new Map<string, CombatCellProperties>();

  // Rückwand (rechte Seite)
  for (let y = 1; y <= 4; y++) {
    terrainMap.set(key(11, y), wall());
  }

  // Barrikaden vor der Wand
  terrainMap.set(key(9, 1), threeQuartersCover());
  terrainMap.set(key(10, 1), threeQuartersCover());
  terrainMap.set(key(9, 4), threeQuartersCover());
  terrainMap.set(key(10, 4), threeQuartersCover());

  return {
    terrainMap,
    bounds: STANDARD_BOUNDS,
    spawnZones: {
      party: { minX: 0, maxX: 2, minY: 2, maxY: 3 },
      enemies: { minX: 8, maxX: 10, minY: 2, maxY: 3 },  // Vor der Wand
    },
  };
}

/**
 * Grapple: Enger Korridor, begrenzt Ausweichmöglichkeiten.
 * Bugbears mit 10ft Reach - enge Kämpfe.
 * Layout (12x6):
 * ```
 * W W W W W . . W W W W W
 * W W W W W . . W W W W W
 * . . . . . . . . . . . .
 * . . . . . . . . . . . .
 * W W W W W . . W W W W W
 * W W W W W . . W W W W W
 * ```
 * W = Wall (Korridor ist 2 Cells breit in der Mitte)
 */
export function createGrappleMap(): CombatMapConfig {
  const terrainMap = new Map<string, CombatCellProperties>();

  // Obere Wand-Blöcke
  for (let x = 0; x <= 4; x++) {
    terrainMap.set(key(x, 0), wall());
    terrainMap.set(key(x, 1), wall());
  }
  for (let x = 7; x <= 11; x++) {
    terrainMap.set(key(x, 0), wall());
    terrainMap.set(key(x, 1), wall());
  }

  // Untere Wand-Blöcke
  for (let x = 0; x <= 4; x++) {
    terrainMap.set(key(x, 4), wall());
    terrainMap.set(key(x, 5), wall());
  }
  for (let x = 7; x <= 11; x++) {
    terrainMap.set(key(x, 4), wall());
    terrainMap.set(key(x, 5), wall());
  }

  return {
    terrainMap,
    bounds: STANDARD_BOUNDS,
    spawnZones: {
      // Party spawnt links im offenen Bereich (row 2-3)
      party: { minX: 0, maxX: 1, minY: 2, maxY: 3 },
      // Enemies spawnt rechts im offenen Bereich
      enemies: { minX: 10, maxX: 11, minY: 2, maxY: 3 },
    },
  };
}

/**
 * Rampage: Offenes Feld mit Damage-Terrain (Spikes/Dornen).
 * Gnolls mit Rampage - testet ob AI Niedrig-HP Ziele meidet.
 * Layout (12x6):
 * ```
 * . . . . . . . . . . . .
 * . . . S S . . S S . . .
 * . . . S S . . S S . . .
 * . . . S S . . S S . . .
 * . . . S S . . S S . . .
 * . . . . . . . . . . . .
 * ```
 * S = Spike Terrain (1d4 piercing on enter)
 */
export function createRampageMap(): CombatMapConfig {
  const terrainMap = new Map<string, CombatCellProperties>();

  // Linke Spike-Zone
  for (let x = 3; x <= 4; x++) {
    for (let y = 1; y <= 4; y++) {
      terrainMap.set(key(x, y), damageTerrain('1d4', 'piercing'));
    }
  }

  // Rechte Spike-Zone
  for (let x = 7; x <= 8; x++) {
    for (let y = 1; y <= 4; y++) {
      terrainMap.set(key(x, y), damageTerrain('1d4', 'piercing'));
    }
  }

  return {
    terrainMap,
    bounds: STANDARD_BOUNDS,
    spawnZones: {
      party: { minX: 0, maxX: 1, minY: 2, maxY: 3 },
      enemies: { minX: 10, maxX: 11, minY: 2, maxY: 3 },
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Map-Name → Factory-Funktion */
export const COMBAT_MAP_FACTORIES: Record<string, () => CombatMapConfig> = {
  '1v1 Melee': create1v1MeleeMap,
  '2v4 Mixed': create2v4MixedMap,
  '1vN Horde': create1vNHordeMap,
  'Aura-Cluster': createAuraClusterMap,
  'Bloodied': createBloodiedMap,
  'Kiting': createKitingMap,
  'Kill Healer': createKillHealerMap,
  'Grapple': createGrappleMap,
  'Rampage': createRampageMap,
};

/** Erstellt eine CombatMapConfig für ein Szenario. */
export function getMapConfigForScenario(scenarioName: string): CombatMapConfig {
  const factory = COMBAT_MAP_FACTORIES[scenarioName];
  if (!factory) {
    // Unbekanntes Szenario: leere Map mit Standard-Bounds
    return {
      terrainMap: new Map(),
      bounds: STANDARD_BOUNDS,
      spawnZones: {
        party: { minX: 0, maxX: 2, minY: 2, maxY: 3 },
        enemies: { minX: 9, maxX: 11, minY: 2, maxY: 3 },
      },
    };
  }
  return factory();
}

export default COMBAT_MAP_FACTORIES;
