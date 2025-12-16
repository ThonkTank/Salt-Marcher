// src/workmodes/cartographer/editor/tools/base/brush-executor.ts
// Unified brush execution system - eliminates duplication across brush tools

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-base-brush");
import type { AxialCoord } from "@geometry";
import { coordsInRadius, coordToKey, type CoordKey } from "@geometry";
import { getMapSession } from "@features/maps/session";
import type { TileData } from "@domain";
import {
	createAbortChecker,
	isAbortError,
} from "./brush-execution";
import { PerformanceTimer } from "@services/performance";

// ============================================================================
// Types
// ============================================================================

/**
 * Context for brush execution.
 * Contains all information needed to execute a brush operation.
 */
export interface BrushExecutorContext {
	/** Obsidian app instance for vault access */
	app: App;
	/** Map file being edited */
	mapFile: TFile;
	/** Center coordinate of brush stroke */
	center: AxialCoord;
	/** Radius of brush effect (0 = only center) */
	brushRadius: number;
	/** Tool name for logging and error reporting */
	toolName: string;
	/** Abort signal from editor lifecycle (null if not available) */
	abortSignal: AbortSignal | null;
	/** Optional status message callback */
	setStatus?: (message: string) => void;
}

/**
 * Result of building payload for a single tile.
 * Returns either a save operation, delete operation, or null to skip.
 */
export interface BrushPayloadResult {
	/** Save this tile with new data (previousData for rollback) */
	save?: { coord: AxialCoord; data: TileData; previousData: TileData | null };
	/** Delete this tile (previousData for rollback) */
	delete?: { coord: AxialCoord; previousData: TileData | null };
}

/**
 * Callbacks for brush-specific behavior.
 * These are provided by each brush tool to customize the execution.
 */
export interface BrushExecutorCallbacks {
	/**
	 * Build payload for a single tile.
	 * Called for each coordinate in brush radius.
	 *
	 * @param coord - Coordinate being processed
	 * @param existingData - Current tile data (null if no tile exists)
	 * @param throwIfAborted - Call this before expensive operations to check abort signal
	 * @returns Payload to apply (save/delete) or null to skip this tile
	 */
	buildPayload: (
		coord: AxialCoord,
		existingData: TileData | null,
		throwIfAborted: () => void
	) => BrushPayloadResult | null;

	/**
	 * Called after successful save batch for visual updates.
	 * Use this to update rendering, overlays, etc.
	 *
	 * @param saved - Array of saved tiles with their previous data
	 */
	onSaved?: (saved: Array<{ coord: AxialCoord; data: TileData; previousData: TileData | null }>) => void;

	/**
	 * Called after successful delete batch for visual updates.
	 * Use this to clear rendering, overlays, etc.
	 *
	 * @param deleted - Array of deleted tiles with their previous data
	 */
	onDeleted?: (deleted: Array<{ coord: AxialCoord; previousData: TileData | null }>) => void;

	/**
	 * Custom visual restore for save rollback.
	 * Called during error recovery to restore visual state.
	 *
	 * @param coord - Coordinate being rolled back
	 * @param previousData - Previous tile data to restore
	 */
	restoreSaveVisual?: (coord: AxialCoord, previousData: TileData | null) => void;

	/**
	 * Custom visual restore for delete rollback.
	 * Called during error recovery to restore visual state.
	 *
	 * @param coord - Coordinate being rolled back
	 * @param previousData - Previous tile data to restore
	 */
	restoreDeleteVisual?: (coord: AxialCoord, previousData: TileData | null) => void;
}

/**
 * Result of brush execution.
 * Reports how many tiles were affected.
 */
export interface BrushExecutorResult {
	/** Number of tiles saved */
	saved: number;
	/** Number of tiles deleted */
	deleted: number;
	/** Number of tiles skipped (buildPayload returned null) */
	skipped: number;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Execute a brush operation with automatic rollback on error.
 *
 * This function encapsulates the common brush execution pattern:
 * 1. Calculate coordinates in radius
 * 2. Load existing tiles in batch
 * 3. Build payloads for each tile (via callback)
 * 4. Save/delete tiles in batch
 * 5. Update visuals (via callbacks)
 * 6. On error: rollback changes in reverse order
 *
 * Benefits:
 * - Eliminates ~600 LOC of duplication across brush tools
 * - Standardized abort handling and error recovery
 * - Consistent performance (batch operations, timing)
 * - Single place to optimize brush operations
 *
 * @param ctx - Brush execution context
 * @param callbacks - Brush-specific behavior (payload building, visual updates)
 * @returns Result with counts of affected tiles
 *
 * @example
 * ```typescript
 * await executeBrush(
 *   {
 *     app,
 *     mapFile,
 *     center: { q: 0, r: 0 },
 *     brushRadius: 2,
 *     toolName: "terrain-brush",
 *     abortSignal: signal,
 *   },
 *   {
 *     buildPayload: (coord, existingData, throwIfAborted) => {
 *       if (!existingData) return null; // Skip tiles without data
 *       return {
 *         save: {
 *           coord,
 *           data: { ...existingData, terrain: "hills" },
 *           previousData: existingData,
 *         },
 *       };
 *     },
 *     onSaved: (saved) => {
 *       for (const { coord, data } of saved) {
 *         handles.setTerrainIcon(coord, data.terrain);
 *       }
 *     },
 *   }
 * );
 * ```
 */
export async function executeBrush(
	ctx: BrushExecutorContext,
	callbacks: BrushExecutorCallbacks
): Promise<BrushExecutorResult> {
	const { app, mapFile, center, brushRadius, toolName, abortSignal, setStatus } = ctx;
	const { buildPayload, onSaved, onDeleted, restoreSaveVisual, restoreDeleteVisual } = callbacks;

	const timer = new PerformanceTimer(`${toolName}-execute`);

	// Create abort checker
	const throwIfAborted = createAbortChecker(abortSignal, toolName);

	// Track applied changes for rollback
	const appliedSaves: Array<{ coord: AxialCoord; data: TileData; previousData: TileData | null }> = [];
	const appliedDeletes: Array<{ coord: AxialCoord; previousData: TileData | null }> = [];

	// Get tile cache early so it's available for rollback in catch block
	const { tileCache } = getMapSession(app, mapFile);

	try {
		// 1. Calculate target coordinates in radius
		throwIfAborted();

		const targets = new Map<string, AxialCoord>();
		for (const coord of coordsInRadius(center, brushRadius)) {
			targets.set(coordToKey(coord), coord);
		}
		const coords = Array.from(targets.values());

		logger.info(`[${toolName}] Processing ${coords.length} tiles in radius ${brushRadius}`);

		// 2. Load all tiles (TileCache provides synchronous access)
		throwIfAborted();

		await tileCache.load(); // Ensure loaded
		const allTiles = tileCache.getAll();
		// Build map of only requested coords
		const tileDataMap = new Map<string, TileData>();
		for (const coord of coords) {
			const key = coordToKey(coord);
			const data = allTiles.get(key);
			if (data) {
				tileDataMap.set(key, data);
			}
		}
		logger.info(`[${toolName}] Loaded ${tileDataMap.size}/${coords.length} existing tiles`);

		throwIfAborted();

		// 3. Build payloads for all tiles
		const tilesToSave: Array<{ coord: AxialCoord; data: TileData; previousData: TileData | null }> = [];
		const tilesToDelete: Array<{ coord: AxialCoord; previousData: TileData | null }> = [];
		let skippedCount = 0;

		for (const coord of coords) {
			throwIfAborted();

			const key = coordToKey(coord);
			const existingData = tileDataMap.get(key) ?? null;

			// Ask brush tool to build payload
			const payload = buildPayload(coord, existingData, throwIfAborted);

			if (!payload) {
				skippedCount++;
				continue;
			}

			// Collect payloads
			if (payload.save) {
				tilesToSave.push(payload.save);
			}
			if (payload.delete) {
				tilesToDelete.push(payload.delete);
			}
		}

		logger.info(`[${toolName}] Built payloads: ${tilesToSave.length} saves, ${tilesToDelete.length} deletes, ${skippedCount} skipped`);

		throwIfAborted();

		// 4. Save tiles in batch using TileCache
		if (tilesToSave.length > 0) {
			logger.info(`[${toolName}] Saving ${tilesToSave.length} tiles in batch`);
			const entries = tilesToSave.map(t => ({
				key: coordToKey(t.coord),
				data: t.data
			}));
			tileCache.setBatch(entries);
			logger.info(`[${toolName}] Saved ${tilesToSave.length} tiles successfully`);

			// Track for rollback
			appliedSaves.push(...tilesToSave);

			// Update visuals
			if (onSaved) {
				onSaved(tilesToSave);
			}
		}

		throwIfAborted();

		// 5. Delete tiles in batch using TileCache
		if (tilesToDelete.length > 0) {
			logger.info(`[${toolName}] Deleting ${tilesToDelete.length} tiles in batch`);
			const keysToDelete = tilesToDelete.map(t => coordToKey(t.coord));
			tileCache.deleteBatch(keysToDelete);
			logger.info(`[${toolName}] Deleted ${tilesToDelete.length} tiles successfully`);

			// Track for rollback
			appliedDeletes.push(...tilesToDelete);

			// Update visuals
			if (onDeleted) {
				onDeleted(tilesToDelete);
			}
		}

		throwIfAborted();

		timer.end();

		return {
			saved: tilesToSave.length,
			deleted: tilesToDelete.length,
			skipped: skippedCount,
		};
	} catch (error) {
		timer.abort();

		const aborted = isAbortError(error);
		if (!aborted) {
			logger.error(`[${toolName}] Brush execution failed`, error);
		}

		// Rollback in reverse order (deletes first, then saves)
		logger.info(`[${toolName}] Rolling back ${appliedDeletes.length} deletes and ${appliedSaves.length} saves`);

		// Restore deleted tiles (in reverse order)
		for (let i = appliedDeletes.length - 1; i >= 0; i--) {
			const { coord, previousData } = appliedDeletes[i];
			try {
				if (restoreDeleteVisual) {
					restoreDeleteVisual(coord, previousData);
				}
			} catch (restoreErr) {
				logger.error(`[${toolName}] Failed to restore delete visual for ${coordToKey(coord)}`, restoreErr);
			}

			try {
				if (previousData) {
					tileCache.set(coordToKey(coord), previousData);
				}
			} catch (rollbackErr) {
				logger.error(`[${toolName}] Failed to rollback delete for ${coordToKey(coord)}`, rollbackErr);
			}
		}

		// Restore saved tiles (in reverse order)
		for (let i = appliedSaves.length - 1; i >= 0; i--) {
			const { coord, previousData } = appliedSaves[i];
			try {
				if (restoreSaveVisual) {
					restoreSaveVisual(coord, previousData);
				}
			} catch (restoreErr) {
				logger.error(`[${toolName}] Failed to restore save visual for ${coordToKey(coord)}`, restoreErr);
			}

			try {
				if (previousData) {
					tileCache.set(coordToKey(coord), previousData);
				} else {
					// No previous data - delete the tile we created
					tileCache.delete(coordToKey(coord));
				}
			} catch (rollbackErr) {
				logger.error(`[${toolName}] Failed to rollback save for ${coordToKey(coord)}`, rollbackErr);
			}
		}

		// If not aborted, propagate error
		if (!aborted) {
			// Update status if available
			if (setStatus) {
				try {
					setStatus(`${toolName} failed: ${error instanceof Error ? error.message : String(error)}`);
				} catch (statusErr) {
					logger.error(`[${toolName}] Failed to publish error status`, statusErr);
				}
			}

			throw error;
		}

		// Aborted - return zero results
		return {
			saved: 0,
			deleted: 0,
			skipped: 0,
		};
	}
}
