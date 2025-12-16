/**
 * Brush Service
 *
 * Orchestrates brush application, combining geometry, math, and undo tracking.
 * Handles all brush-related operations for the Cartographer.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import type { HexTileData, HexMapData } from '@core/schemas/map';
import type { ClimateData } from '@core/schemas/climate';
import type { CoordKey } from '@core/schemas/hex-geometry';
import { coordToKey } from '@core/schemas/hex-geometry';

import {
  type FalloffType,
  type BrushMode,
  applyBrushValue,
  applyBrushIntValue,
  calculateAverage,
} from '../utils/brush-math';
import {
  type BrushCoord,
  getBrushCoordsFiltered,
  getExistingNeighbors,
  createStrokeTracker,
} from '../utils/brush-geometry';
import { UndoService } from './undo-service';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/**
 * Tool type for brush operations
 */
export type ToolType =
  | 'terrain'
  | 'elevation'
  | 'temperature'
  | 'precipitation'
  | 'clouds'
  | 'wind'
  | 'resize';

/**
 * Brush configuration
 */
export interface BrushConfig {
  radius: number;
  strength: number;
  falloff: FalloffType;
  mode: BrushMode;
  value: number;
  terrain: string;
}

/**
 * Result of a brush application
 */
export interface BrushResult {
  /** Tiles that were modified */
  modifiedKeys: CoordKey[];

  /** Updated tile data */
  updatedTiles: Map<CoordKey, Partial<HexTileData>>;
}

// ═══════════════════════════════════════════════════════════════
// Brush Service
// ═══════════════════════════════════════════════════════════════

export class BrushService {
  private readonly undoService: UndoService;
  private strokeTracker = createStrokeTracker();
  private currentTool: ToolType = 'terrain';
  private brushConfig: BrushConfig = {
    radius: 1,
    strength: 100,
    falloff: 'smooth',
    mode: 'set',
    value: 0,
    terrain: 'grassland',
  };

  constructor(undoService: UndoService) {
    this.undoService = undoService;
  }

  // ─────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────

  /**
   * Set the active tool
   */
  setTool(tool: ToolType): void {
    this.currentTool = tool;
  }

  /**
   * Get the active tool
   */
  getTool(): ToolType {
    return this.currentTool;
  }

  /**
   * Update brush configuration
   */
  setBrushConfig(config: Partial<BrushConfig>): void {
    Object.assign(this.brushConfig, config);
  }

  /**
   * Get current brush configuration
   */
  getBrushConfig(): Readonly<BrushConfig> {
    return this.brushConfig;
  }

  // ─────────────────────────────────────────────────────────────
  // Stroke Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Begin a brush stroke
   */
  beginStroke(): void {
    this.strokeTracker.reset();
    this.undoService.beginStroke(this.getToolDescription());
  }

  /**
   * End the current brush stroke
   * @param tiles - Current tile states for undo snapshot
   */
  endStroke(tiles: Record<CoordKey, HexTileData>): void {
    this.undoService.endStroke(tiles);
  }

  /**
   * Get tool description for undo
   */
  private getToolDescription(): string {
    const toolNames: Record<ToolType, string> = {
      terrain: 'Paint Terrain',
      elevation: 'Edit Elevation',
      temperature: 'Edit Temperature',
      precipitation: 'Edit Precipitation',
      clouds: 'Edit Cloud Cover',
      wind: 'Edit Wind',
      resize: 'Resize Map',
    };
    return toolNames[this.currentTool];
  }

  // ─────────────────────────────────────────────────────────────
  // Brush Application
  // ─────────────────────────────────────────────────────────────

  /**
   * Apply brush at a coordinate
   *
   * @param center - Center of the brush application
   * @param map - Current map data
   * @returns Brush result with modified tiles
   */
  applyBrush(center: HexCoordinate, map: HexMapData): BrushResult {
    const validKeys = new Set(Object.keys(map.tiles) as CoordKey[]);

    // Get affected coordinates with falloff
    const brushCoords = getBrushCoordsFiltered(
      center,
      this.brushConfig.radius,
      this.brushConfig.falloff,
      validKeys
    );

    // Visited-check only for terrain tool or set mode
    // Sculpt/smooth/noise modes allow multiple passes on same tiles
    const useVisitedCheck =
      this.currentTool === 'terrain' || this.brushConfig.mode === 'set';

    const candidateCoords = useVisitedCheck
      ? brushCoords.filter((bc) => !this.strokeTracker.visited.has(bc.key))
      : brushCoords;

    const modifiedKeys: CoordKey[] = [];
    const updatedTiles = new Map<CoordKey, Partial<HexTileData>>();

    for (const bc of candidateCoords) {
      const tile = map.tiles[bc.key];
      if (!tile) continue;

      const update = this.applyToolToTile(tile, bc, map, validKeys);
      if (update) {
        // Mark as visited only when using visited-check
        if (useVisitedCheck) {
          this.strokeTracker.visited.add(bc.key);
        }

        // Track for undo (before modification)
        this.undoService.trackTile(bc.key, tile);

        modifiedKeys.push(bc.key);
        updatedTiles.set(bc.key, update);
      }
    }

    return { modifiedKeys, updatedTiles };
  }

  /**
   * Apply current tool to a single tile
   */
  private applyToolToTile(
    tile: HexTileData,
    bc: BrushCoord,
    map: HexMapData,
    validKeys: Set<CoordKey>
  ): Partial<HexTileData> | null {
    const { strength, mode, value, terrain } = this.brushConfig;

    switch (this.currentTool) {
      case 'terrain':
        // Terrain uses simple replacement
        if (mode === 'set' && bc.falloff >= 0.5) {
          return { terrain };
        }
        return null;

      case 'elevation':
        return {
          elevation: applyBrushValue(
            tile.elevation,
            mode === 'sculpt' ? value : value, // value is target elevation
            strength,
            bc.falloff,
            mode,
            -1000, // min elevation
            10000 // max elevation
          ),
        };

      case 'temperature':
        return {
          climate: {
            ...tile.climate,
            temperature: this.applyClimateValue(
              tile.climate.temperature,
              value,
              strength,
              bc.falloff,
              mode,
              bc.coord,
              'temperature',
              map,
              validKeys
            ),
          },
        };

      case 'precipitation':
        return {
          climate: {
            ...tile.climate,
            precipitation: this.applyClimateValue(
              tile.climate.precipitation,
              value,
              strength,
              bc.falloff,
              mode,
              bc.coord,
              'precipitation',
              map,
              validKeys
            ),
          },
        };

      case 'clouds':
        return {
          climate: {
            ...tile.climate,
            clouds: this.applyClimateValue(
              tile.climate.clouds,
              value,
              strength,
              bc.falloff,
              mode,
              bc.coord,
              'clouds',
              map,
              validKeys
            ),
          },
        };

      case 'wind':
        return {
          climate: {
            ...tile.climate,
            wind: this.applyClimateValue(
              tile.climate.wind,
              value,
              strength,
              bc.falloff,
              mode,
              bc.coord,
              'wind',
              map,
              validKeys
            ),
          },
        };

      case 'resize':
        // Resize is handled separately
        return null;

      default:
        return null;
    }
  }

  /**
   * Apply brush to a climate property
   */
  private applyClimateValue(
    currentValue: number,
    targetValue: number,
    strength: number,
    falloff: number,
    mode: BrushMode,
    coord: HexCoordinate,
    property: keyof ClimateData,
    map: HexMapData,
    validKeys: Set<CoordKey>
  ): number {
    // For smooth mode, calculate neighbor average
    if (mode === 'smooth') {
      const neighbors = getExistingNeighbors(coord, validKeys);

      if (neighbors.length > 0) {
        const neighborValues = neighbors.map(
          (n) => map.tiles[coordToKey(n)]?.climate[property] ?? currentValue
        );
        targetValue = calculateAverage(neighborValues);
      }
    }

    return applyBrushIntValue(
      currentValue,
      targetValue,
      strength,
      falloff,
      mode,
      1, // min
      12 // max
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Preview
  // ─────────────────────────────────────────────────────────────

  /**
   * Get brush preview coordinates (for overlay rendering)
   *
   * @param center - Center of the brush
   * @param map - Current map data
   * @returns Array of coordinates with falloff values
   */
  getBrushPreview(
    center: HexCoordinate,
    map: HexMapData
  ): BrushCoord[] {
    const validKeys = new Set(Object.keys(map.tiles) as CoordKey[]);

    return getBrushCoordsFiltered(
      center,
      this.brushConfig.radius,
      this.brushConfig.falloff,
      validKeys
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new brush service instance
 */
export function createBrushService(undoService: UndoService): BrushService {
  return new BrushService(undoService);
}
