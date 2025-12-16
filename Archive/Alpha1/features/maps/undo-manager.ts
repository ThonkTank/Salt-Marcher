/**
 * Undo/Redo Manager for Cartographer
 *
 * Provides undo/redo functionality for map editing operations using stack-based history.
 * Captures before/after snapshots of tile data for precise state restoration.
 *
 * Features:
 * - Stack-based undo/redo (50 entry limit)
 * - Batch tile restoration using TileStore
 * - Error handling with rollback
 * - Operation metadata for UI display
 *
 * @example
 * ```typescript
 * const undoManager = new UndoManager(app, file, tileStore);
 *
 * // Push operation to undo stack
 * undoManager.push({
 *   timestamp: Date.now(),
 *   operation: "paint",
 *   tool: "terrain-brush",
 *   tiles: [
 *     { coord: { q: 0, r: 0 }, before: null, after: { terrain: "plains" } }
 *   ],
 *   summary: "Painted 1 hex with plains terrain"
 * });
 *
 * // Undo operation
 * await undoManager.undo();
 *
 * // Redo operation
 * await undoManager.redo();
 * ```
 */

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("undo-manager");
import type { TileCoord, TileData } from "./data";
import type { TileCache } from "./data/tile-cache";
import { coordToKey, type CoordKey } from "@geometry";

/**
 * Undo stack entry
 *
 * Stores operation metadata and tile snapshots for undo/redo.
 */
export interface UndoStackEntry {
	/** Timestamp when operation was performed */
	timestamp: number;

	/** Operation type: "paint", "erase", "gradient", etc. */
	operation: string;

	/** Tool that performed the operation: "terrain-brush", "area-brush", etc. */
	tool: string;

	/** Tile snapshots (before/after states) */
	tiles: Array<{
		coord: TileCoord;
		before: TileData | null;
		after: TileData | null;
	}>;

	/** Human-readable summary for UI display */
	summary: string;
}

/**
 * Undo/Redo Manager
 *
 * Manages undo/redo stacks for map editing operations.
 */
export class UndoManager {
	/** Undo stack (most recent entry at end) */
	private undoStack: UndoStackEntry[] = [];

	/** Redo stack (most recent entry at end) */
	private redoStack: UndoStackEntry[] = [];

	/** Maximum stack size (older entries are discarded) */
	private readonly maxStackSize: number = 50;

	/**
	 * Create undo manager
	 *
	 * @param app - Obsidian app instance
	 * @param file - Map file being edited
	 * @param tileCache - Tile cache for state restoration
	 */
	constructor(
		private readonly app: App,
		private readonly file: TFile,
		private readonly tileCache: TileCache
	) {
		logger.info("[UndoManager] Created", { file: file.path, maxStackSize: this.maxStackSize });
	}

	/**
	 * Push new entry to undo stack
	 *
	 * Clears redo stack (branching timeline model).
	 *
	 * @param entry - Undo stack entry with operation metadata and tile snapshots
	 */
	push(entry: UndoStackEntry): void {
		// Add to undo stack
		this.undoStack.push(entry);

		// Enforce stack limit (discard oldest entries)
		if (this.undoStack.length > this.maxStackSize) {
			this.undoStack.shift();
			logger.debug("[UndoManager] Stack limit reached, discarded oldest entry");
		}

		// Clear redo stack (new action creates new timeline branch)
		this.redoStack = [];

		logger.debug("[UndoManager] Pushed entry", {
			operation: entry.operation,
			tool: entry.tool,
			tileCount: entry.tiles.length,
			summary: entry.summary,
			undoStackSize: this.undoStack.length,
		});
	}

	/**
	 * Undo last operation
	 *
	 * Restores tiles to "before" state and moves entry to redo stack.
	 *
	 * @throws Error if undo stack is empty
	 * @throws Error if tile restoration fails
	 */
	undo(): void {
		if (this.undoStack.length === 0) {
			throw new Error("Nothing to undo");
		}

		// Pop entry from undo stack
		const entry = this.undoStack.pop()!;

		logger.info("[UndoManager] Undoing operation", {
			operation: entry.operation,
			tool: entry.tool,
			tileCount: entry.tiles.length,
			summary: entry.summary,
		});

		try {
			// Restore tiles to "before" state
			this.restoreTiles(entry.tiles.map((t) => ({ coord: t.coord, data: t.before })));

			// Move entry to redo stack
			this.redoStack.push(entry);

			logger.info("[UndoManager] Undo completed", {
				undoStackSize: this.undoStack.length,
				redoStackSize: this.redoStack.length,
			});
		} catch (error) {
			// Rollback: restore entry to undo stack
			this.undoStack.push(entry);

			logger.error("[UndoManager] Undo failed, rolled back", { error });
			throw error;
		}
	}

	/**
	 * Redo last undone operation
	 *
	 * Restores tiles to "after" state and moves entry to undo stack.
	 *
	 * @throws Error if redo stack is empty
	 * @throws Error if tile restoration fails
	 */
	redo(): void {
		if (this.redoStack.length === 0) {
			throw new Error("Nothing to redo");
		}

		// Pop entry from redo stack
		const entry = this.redoStack.pop()!;

		logger.info("[UndoManager] Redoing operation", {
			operation: entry.operation,
			tool: entry.tool,
			tileCount: entry.tiles.length,
			summary: entry.summary,
		});

		try {
			// Restore tiles to "after" state
			this.restoreTiles(entry.tiles.map((t) => ({ coord: t.coord, data: t.after })));

			// Move entry to undo stack
			this.undoStack.push(entry);

			logger.info("[UndoManager] Redo completed", {
				undoStackSize: this.undoStack.length,
				redoStackSize: this.redoStack.length,
			});
		} catch (error) {
			// Rollback: restore entry to redo stack
			this.redoStack.push(entry);

			logger.error("[UndoManager] Redo failed, rolled back", { error });
			throw error;
		}
	}

	/**
	 * Check if undo operation is available
	 *
	 * @returns true if undo stack is not empty
	 */
	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	/**
	 * Check if redo operation is available
	 *
	 * @returns true if redo stack is not empty
	 */
	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/**
	 * Clear both stacks
	 *
	 * Called when switching maps or exiting editor mode.
	 */
	clear(): void {
		this.undoStack = [];
		this.redoStack = [];

		logger.info("[UndoManager] Stacks cleared");
	}

	/**
	 * Get summary of next undo operation
	 *
	 * @returns summary string or null if undo stack is empty
	 */
	getUndoSummary(): string | null {
		if (this.undoStack.length === 0) {
			return null;
		}

		return this.undoStack[this.undoStack.length - 1].summary;
	}

	/**
	 * Get summary of next redo operation
	 *
	 * @returns summary string or null if redo stack is empty
	 */
	getRedoSummary(): string | null {
		if (this.redoStack.length === 0) {
			return null;
		}

		return this.redoStack[this.redoStack.length - 1].summary;
	}

	/**
	 * Get undo stack size (for debugging/testing)
	 *
	 * @returns number of entries in undo stack
	 */
	getUndoStackSize(): number {
		return this.undoStack.length;
	}

	/**
	 * Get redo stack size (for debugging/testing)
	 *
	 * @returns number of entries in redo stack
	 */
	getRedoStackSize(): number {
		return this.redoStack.length;
	}

	/**
	 * Restore tiles to specified state
	 *
	 * Uses batch operation for performance.
	 *
	 * @param tiles - Tiles to restore with target state
	 */
	private restoreTiles(tiles: Array<{ coord: TileCoord; data: TileData | null }>): void {
		if (tiles.length === 0) {
			logger.debug("[UndoManager] No tiles to restore");
			return;
		}

		logger.debug("[UndoManager] Restoring tiles", { count: tiles.length });

		// Separate tiles to save (with data) from tiles to delete (null data)
		const tilesToSave = tiles.filter((t) => t.data !== null) as Array<{
			coord: TileCoord;
			data: TileData;
		}>;
		const tilesToDelete = tiles.filter((t) => t.data === null).map((t) => t.coord);

		// Save tiles with data using TileCache.setBatch
		if (tilesToSave.length > 0) {
			const entries = tilesToSave.map(t => ({
				key: coordToKey(t.coord),
				data: t.data
			}));
			this.tileCache.setBatch(entries);
			logger.debug("[UndoManager] Restored tiles", { count: tilesToSave.length });
		}

		// Delete tiles with null data using TileCache.deleteBatch
		if (tilesToDelete.length > 0) {
			const keys = tilesToDelete.map(coord => coordToKey(coord));
			this.tileCache.deleteBatch(keys);
			logger.debug("[UndoManager] Deleted tiles", { count: tilesToDelete.length });
		}
	}
}
