// src/features/maps/state/elevation-store.ts
// Reactive store for elevation field data with persistence

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("elevation-store");
import { writable } from "@services/state";
import {
	loadElevationJSON,
	saveElevationJSON,
	deleteElevationJSON,
	hasElevationJSON,
	type ElevationJSON,
} from "../data/elevation-repository";
import { ElevationField, type ControlPoint } from "@services/elevation";
import type { WritableStore } from "@services/state";

/**
 * Elevation Store State
 *
 * Combines ElevationField instance with loading status.
 */
export interface ElevationStoreState {
	/** Elevation field instance (null if not loaded) */
	field: ElevationField | null;
	/** Loading status */
	loaded: boolean;
	/** Last save timestamp */
	lastSaved?: string;
}

/**
 * Elevation Store
 *
 * Reactive store for continuous elevation data using control points.
 * Manages persistence, caching, and real-time updates.
 *
 * **Features:**
 * - Lazy loading (on first access)
 * - Automatic persistence (debounced saves)
 * - Reactive subscriptions (updates trigger re-renders)
 * - Git-friendly JSON storage
 *
 * @example
 * ```typescript
 * const elevStore = getElevationStore(app, mapFile);
 *
 * // Subscribe to changes
 * elevStore.subscribe(state => {
 *   if (state.field) {
 *     const elevation = state.field.getElevation(100, 100);
 *     console.log("Elevation at (100,100):", elevation);
 *   }
 * });
 *
 * // Add control point
 * elevStore.addControlPoint({ x: 100, y: 100, elevation: 500, type: "painted" });
 *
 * // Save to disk
 * await elevStore.save();
 * ```
 */
export interface ElevationStore {
	/** Svelte store for reactive subscriptions */
	readonly state: WritableStore<ElevationStoreState>;

	/** Load elevation data from disk */
	load(): Promise<void>;

	/** Save elevation data to disk */
	save(): Promise<void>;

	/** Delete elevation data file */
	delete(): Promise<void>;

	/** Check if elevation data exists */
	exists(): boolean;

	/** Add control point (triggers cache invalidation) */
	addControlPoint(point: Omit<ControlPoint, "id"> & { id?: string }): string;

	/** Update control point elevation */
	updateElevation(id: string, elevation: number): boolean;

	/** Remove control point */
	removeControlPoint(id: string): boolean;

	/** Get all control points */
	getAllControlPoints(): ControlPoint[];

	/** Find nearest control point */
	findNearestControlPoint(x: number, y: number, threshold?: number): ControlPoint | undefined;

	/** Get elevation at pixel coordinates */
	getElevation(x: number, y: number): number | undefined;

	/** Get raw cached grid */
	getCachedGrid(): Float32Array | null;

	/** Get elevation field instance */
	getField(): ElevationField | null;

	/** Clear all control points */
	clear(): void;

	/** Get statistics */
	getStats(): ReturnType<ElevationField["getStats"]>;
}

/**
 * Create empty elevation store state
 */
function createEmptyState(): ElevationStoreState {
	return {
		field: null,
		loaded: false,
	};
}

/**
 * Global elevation store registry
 *
 * Uses WeakMap for automatic garbage collection when App is destroyed.
 * One store per map file (keyed by file path) per App instance.
 */
const elevationStores = new WeakMap<App, Map<string, ElevationStore>>();

/**
 * Get or create elevation store for map file
 *
 * **Singleton Pattern:** Returns the same store instance for the same map file.
 *
 * @param app - Obsidian App instance
 * @param mapFile - Map markdown file
 * @returns Elevation store for this map
 *
 * @example
 * ```typescript
 * const elevStore = getElevationStore(app, mapFile);
 * await elevStore.load();
 * elevStore.addControlPoint({ x: 100, y: 100, elevation: 500, type: "painted" });
 * await elevStore.save();
 * ```
 */
export function getElevationStore(app: App, mapFile: TFile): ElevationStore {
	// Get or create app-specific registry
	let appStores = elevationStores.get(app);
	if (!appStores) {
		appStores = new Map();
		elevationStores.set(app, appStores);
	}

	const key = mapFile.path;

	// Return existing store if already created
	if (appStores.has(key)) {
		return appStores.get(key)!;
	}

	// Create new store
	const store = createElevationStoreInternal(app, mapFile);
	appStores.set(key, store);

	logger.debug(`Created store for ${mapFile.path}`);
	return store;
}

/**
 * Internal elevation store implementation
 */
function createElevationStoreInternal(app: App, mapFile: TFile): ElevationStore {
	const state = writable<ElevationStoreState>(createEmptyState(), {
		name: `elevation-store-${mapFile.basename}`,
	});

	let loadPromise: Promise<void> | null = null;

	const elevationStore: ElevationStore = {
		state,

		async load() {
			// Prevent concurrent loads
			if (loadPromise) {
				return loadPromise;
			}

			loadPromise = (async () => {
				try {
					logger.info(`Loading elevation data for ${mapFile.path}`);

					const json = await loadElevationJSON(app, mapFile);

					if (json) {
						// Create field with loaded data
						const field = new ElevationField(json.config);
						field.fromJSON(json.controlPoints);

						state.update((s) => ({
							...s,
							field,
							loaded: true,
							lastSaved: json.lastModified,
						}));

						logger.info(
							`Loaded ${json.controlPoints.length} control points for ${mapFile.path}`,
						);
					} else {
						// No elevation data yet - create empty field
						const field = new ElevationField();

						state.update((s) => ({
							...s,
							field,
							loaded: true,
						}));

						logger.info(`No elevation data found, created empty field for ${mapFile.path}`);
					}
				} catch (error) {
					logger.error(`Failed to load elevation data for ${mapFile.path}:`, error);
					throw error;
				} finally {
					loadPromise = null;
				}
			})();

			return loadPromise;
		},

		async save() {
			const currentState = state.get();

			if (!currentState.field) {
				logger.warn("Cannot save - field not loaded");
				return;
			}

			try {
				const json: ElevationJSON = {
					version: 1,
					mapPath: mapFile.path,
					config: {
						resolution: 200,
						interpolation: "rbf",
						sigma: 50,
					},
					controlPoints: currentState.field.toJSON(),
				};

				await saveElevationJSON(app, mapFile, json);

				state.update((s) => ({
					...s,
					lastSaved: json.lastModified,
				}));

				logger.info(`Saved elevation data for ${mapFile.path}`);
			} catch (error) {
				logger.error(`Failed to save elevation data for ${mapFile.path}:`, error);
				throw error;
			}
		},

		async delete() {
			try {
				await deleteElevationJSON(app, mapFile);

				// Reset to empty field
				const field = new ElevationField();
				state.update((s) => ({
					...s,
					field,
					lastSaved: undefined,
				}));

				logger.info(`Deleted elevation data for ${mapFile.path}`);
			} catch (error) {
				logger.error(`Failed to delete elevation data for ${mapFile.path}:`, error);
				throw error;
			}
		},

		exists() {
			return hasElevationJSON(app, mapFile);
		},

		addControlPoint(point) {
			const currentState = state.get();
			if (!currentState.field) {
				logger.warn("Cannot add control point - field not loaded");
				return "";
			}

			const id = currentState.field.addControlPoint(point);

			// Trigger reactive update
			state.update((s) => ({ ...s }));

			return id;
		},

		updateElevation(id, elevation) {
			const currentState = state.get();
			if (!currentState.field) {
				return false;
			}

			const success = currentState.field.updateElevation(id, elevation);

			if (success) {
				// Trigger reactive update
				state.update((s) => ({ ...s }));
			}

			return success;
		},

		removeControlPoint(id) {
			const currentState = state.get();
			if (!currentState.field) {
				return false;
			}

			const success = currentState.field.removeControlPoint(id);

			if (success) {
				// Trigger reactive update
				state.update((s) => ({ ...s }));
			}

			return success;
		},

		getAllControlPoints() {
			const currentState = state.get();
			if (!currentState.field) {
				return [];
			}

			return currentState.field.getAllControlPoints();
		},

		findNearestControlPoint(x, y, threshold) {
			const currentState = state.get();
			if (!currentState.field) {
				return undefined;
			}

			return currentState.field.findNearestControlPoint(x, y, threshold);
		},

		getElevation(x, y) {
			const currentState = state.get();
			if (!currentState.field) {
				return undefined;
			}

			return currentState.field.getElevation(x, y);
		},

		getCachedGrid() {
			const currentState = state.get();
			if (!currentState.field) {
				return null;
			}

			return currentState.field.getCachedGrid();
		},

		getField() {
			const currentState = state.get();
			return currentState.field;
		},

		clear() {
			const currentState = state.get();
			if (!currentState.field) {
				return;
			}

			currentState.field.clear();

			// Trigger reactive update
			state.update((s) => ({ ...s }));
		},

		getStats() {
			const currentState = state.get();
			if (!currentState.field) {
				return {
					controlPoints: 0,
					cacheSize: 0,
					cacheValid: false,
				};
			}

			return currentState.field.getStats();
		},
	};

	return elevationStore;
}

/**
 * Clear elevation store from registry
 *
 * Used when map is closed or deleted.
 *
 * @param app - Obsidian App instance
 * @param mapFile - Map markdown file
 */
export function clearElevationStore(app: App, mapFile: TFile): void {
	const appStores = elevationStores.get(app);
	if (!appStores) {
		return;
	}

	const key = mapFile.path;
	if (appStores.has(key)) {
		appStores.delete(key);
		logger.debug(`Cleared store for ${mapFile.path}`);
	}
}

/**
 * Clear all elevation stores for an app instance
 *
 * Used for cleanup on plugin unload.
 *
 * @param app - Obsidian App instance
 */
export function clearAllElevationStores(app: App): void {
	const appStores = elevationStores.get(app);
	if (appStores) {
		appStores.clear();
		logger.info("Cleared all elevation stores");
	}
}
