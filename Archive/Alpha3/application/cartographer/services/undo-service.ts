/**
 * Undo Service
 *
 * Simplified snapshot-based undo/redo for tile modifications.
 * Captures original tile states at stroke start, final states at stroke end.
 */

import type { HexTileData } from '@core/schemas/map';
import type { CoordKey } from '@core/schemas/hex-geometry';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/**
 * Single undo entry representing a brush stroke
 */
interface UndoEntry {
  description: string;
  tiles: Map<CoordKey, { before: HexTileData; after: HexTileData }>;
}

/**
 * Undo service configuration
 */
export interface UndoServiceConfig {
  maxEntries?: number;
}

// ═══════════════════════════════════════════════════════════════
// Undo Service
// ═══════════════════════════════════════════════════════════════

export class UndoService {
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private currentDescription = '';
  private originalTiles: Map<CoordKey, HexTileData> = new Map();
  private readonly maxEntries: number;

  constructor(config?: UndoServiceConfig) {
    this.maxEntries = config?.maxEntries ?? 50;
  }

  // ─────────────────────────────────────────────────────────────
  // Stroke Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Begin a new brush stroke
   */
  beginStroke(description: string): void {
    this.currentDescription = description;
    this.originalTiles.clear();
  }

  /**
   * Track a tile that will be modified
   * Call this BEFORE applying changes to the tile
   */
  trackTile(key: CoordKey, tile: HexTileData): void {
    if (!this.originalTiles.has(key)) {
      // Deep copy of original state
      this.originalTiles.set(key, structuredClone(tile));
    }
  }

  /**
   * End the current stroke and commit to undo stack
   * @param currentTiles - The current tile states after all modifications
   */
  endStroke(currentTiles: Record<CoordKey, HexTileData>): void {
    if (this.originalTiles.size === 0) {
      this.currentDescription = '';
      return;
    }

    const entry: UndoEntry = {
      description: this.currentDescription,
      tiles: new Map(),
    };

    // For each tracked tile: before = original, after = current
    for (const [key, before] of this.originalTiles) {
      const after = currentTiles[key];
      if (after) {
        entry.tiles.set(key, {
          before,
          after: structuredClone(after),
        });
      }
    }

    // Only add if there are actual changes
    if (entry.tiles.size > 0) {
      this.undoStack.push(entry);

      // Trim stack if over limit
      while (this.undoStack.length > this.maxEntries) {
        this.undoStack.shift();
      }

      // Clear redo stack on new action
      this.redoStack = [];
    }

    this.currentDescription = '';
    this.originalTiles.clear();
  }

  // ─────────────────────────────────────────────────────────────
  // Undo/Redo Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Undo the last operation
   * @returns Map of tile states to restore, or null if nothing to undo
   */
  undo(): Map<CoordKey, HexTileData> | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    this.redoStack.push(entry);

    const result = new Map<CoordKey, HexTileData>();
    for (const [key, { before }] of entry.tiles) {
      result.set(key, before);
    }
    return result;
  }

  /**
   * Redo the last undone operation
   * @returns Map of tile states to apply, or null if nothing to redo
   */
  redo(): Map<CoordKey, HexTileData> | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    this.undoStack.push(entry);

    const result = new Map<CoordKey, HexTileData>();
    for (const [key, { after }] of entry.tiles) {
      result.set(key, after);
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // State Queries
  // ─────────────────────────────────────────────────────────────

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────

  /**
   * Clear all undo/redo history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.originalTiles.clear();
    this.currentDescription = '';
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new undo service instance
 */
export function createUndoService(config?: UndoServiceConfig): UndoService {
  return new UndoService(config);
}
