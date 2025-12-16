/**
 * Weather Store
 *
 * Svelte store for reactive weather state management.
 * Stores weather per map + hex coordinate for UI updates.
 */

import { writable, derived, type ReadableStore } from "@services/state";
import type { WeatherState } from "./weather-types";

/**
 * Weather history entry (one snapshot)
 */
export interface WeatherHistoryEntry {
	/** Weather state at this time */
	weather: WeatherState;
	/** Game date (ISO string) */
	date: string;
}

/**
 * Weather forecast entry (predicted future state)
 */
export interface WeatherForecast {
	/** Forecasted weather state */
	weather: WeatherState;
	/** Target game date (ISO string) */
	date: string;
	/** Confidence level (0-1, 1=certain, 0=very uncertain) */
	confidence: number;
}

/**
 * Store state structure
 */
interface WeatherStoreState {
	/** Weather indexed by "mapPath:q:r:s" */
	weatherByHex: Map<string, WeatherState>;
	/** Weather history indexed by "mapPath:q:r:s" (last 7 days) */
	historyByHex: Map<string, WeatherHistoryEntry[]>;
	/** Currently active map path (for filtering) */
	activeMapPath: string | null;
}

/**
 * Create hex key for indexing
 */
function createHexKey(mapPath: string, q: number, r: number, s: number): string {
	return `${mapPath}:${q}:${r}:${s}`;
}

/**
 * Parse hex key back to components
 */
function parseHexKey(key: string): { mapPath: string; q: number; r: number; s: number } | null {
	const parts = key.split(":");
	if (parts.length !== 4) return null;

	const [mapPath, qStr, rStr, sStr] = parts;
	const q = parseInt(qStr, 10);
	const r = parseInt(rStr, 10);
	const s = parseInt(sStr, 10);

	if (isNaN(q) || isNaN(r) || isNaN(s)) return null;

	return { mapPath, q, r, s };
}

/**
 * Create initial store state
 */
function createInitialState(): WeatherStoreState {
	return {
		weatherByHex: new Map(),
		historyByHex: new Map(),
		activeMapPath: null,
	};
}

/**
 * Weather store implementation
 */
class WeatherStore {
	private store = writable<WeatherStoreState>(createInitialState());

	/**
	 * Set weather for a specific hex
	 * Automatically archives previous weather to history
	 */
	setWeather(mapPath: string, weather: WeatherState): void {
		this.store.update((state) => {
			const key = createHexKey(mapPath, weather.hexCoord.q, weather.hexCoord.r, weather.hexCoord.s);

			// Archive current weather to history before updating
			const currentWeather = state.weatherByHex.get(key);
			if (currentWeather) {
				this.addToHistory(state, key, currentWeather);
			}

			state.weatherByHex.set(key, { ...weather });
			return { ...state }; // Return new object to trigger reactivity
		});
	}

	/**
	 * Add weather entry to history (internal helper)
	 * Maintains max 7 days of history per hex
	 */
	private addToHistory(state: WeatherStoreState, key: string, weather: WeatherState): void {
		let history = state.historyByHex.get(key) ?? [];

		// Add new entry
		history.push({
			weather: { ...weather },
			date: weather.lastUpdate,
		});

		// Keep only last 7 entries
		if (history.length > 7) {
			history = history.slice(-7);
		}

		state.historyByHex.set(key, history);
	}

	/**
	 * Get weather for a specific hex (synchronous read from store)
	 */
	getWeather(mapPath: string, q: number, r: number, s: number): WeatherState | null {
		const state = this.store.get();
		const key = createHexKey(mapPath, q, r, s);
		return state.weatherByHex.get(key) ?? null;
	}

	/**
	 * Get weather history for a specific hex (last 7 days)
	 * Returns array sorted oldest to newest
	 */
	getWeatherHistory(mapPath: string, q: number, r: number, s: number): WeatherHistoryEntry[] {
		const state = this.store.get();
		const key = createHexKey(mapPath, q, r, s);
		const result = state.historyByHex.get(key) ?? [];
		return [...result]; // Return copy to prevent external mutation
	}

	/**
	 * Set multiple weather states at once (batch update)
	 */
	setWeatherBatch(mapPath: string, weatherStates: WeatherState[]): void {
		this.store.update((state) => {
			for (const weather of weatherStates) {
				const key = createHexKey(mapPath, weather.hexCoord.q, weather.hexCoord.r, weather.hexCoord.s);
				state.weatherByHex.set(key, { ...weather });
			}
			return { ...state }; // Return new object to trigger reactivity
		});
	}

	/**
	 * Clear all weather for a specific map
	 */
	clearMap(mapPath: string): void {
		this.store.update((state) => {
			const keysToRemove: string[] = [];
			for (const key of state.weatherByHex.keys()) {
				const parsed = parseHexKey(key);
				if (parsed && parsed.mapPath === mapPath) {
					keysToRemove.push(key);
				}
			}
			for (const key of keysToRemove) {
				state.weatherByHex.delete(key);
				state.historyByHex.delete(key); // Also clear history
			}
			return { ...state }; // Return new object to trigger reactivity
		});
	}

	/**
	 * Clear all weather data
	 */
	clearAll(): void {
		this.store.set(createInitialState());
	}

	/**
	 * Set active map path (for filtering)
	 */
	setActiveMap(mapPath: string | null): void {
		this.store.update((state) => {
			state.activeMapPath = mapPath;
			return { ...state }; // Return new object to trigger reactivity
		});
	}

	/**
	 * Get all weather states for the active map
	 */
	getActiveMapWeather(): ReadableStore<WeatherState[]> {
		return derived([this.store], ($state) => {
			if (!$state.activeMapPath) return [];

			const results: WeatherState[] = [];
			for (const [key, weather] of $state.weatherByHex.entries()) {
				const parsed = parseHexKey(key);
				if (parsed && parsed.mapPath === $state.activeMapPath) {
					results.push(weather);
				}
			}
			return results;
		});
	}

	/**
	 * Subscribe to store updates
	 */
	subscribe(callback: (state: WeatherStoreState) => void): () => void {
		return this.store.subscribe(callback);
	}

	/**
	 * Get read-only derived store for a specific hex
	 */
	getHexWeather(mapPath: string, q: number, r: number, s: number): ReadableStore<WeatherState | null> {
		return derived([this.store], ($state) => {
			const key = createHexKey(mapPath, q, r, s);
			return $state.weatherByHex.get(key) ?? null;
		});
	}

	/**
	 * Prune old weather data (remove hexes not updated in N days)
	 * Used to prevent memory bloat on large maps
	 */
	pruneOldWeather(maxAgeDays: number = 30): void {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
		const cutoffTimestamp = cutoffDate.toISOString();

		this.store.update((state) => {
			const keysToRemove: string[] = [];
			for (const [key, weather] of state.weatherByHex.entries()) {
				if (weather.lastUpdate < cutoffTimestamp) {
					keysToRemove.push(key);
				}
			}
			for (const key of keysToRemove) {
				state.weatherByHex.delete(key);
			}
			return { ...state }; // Return new object to trigger reactivity
		});
	}
}

/**
 * Global weather store instance
 */
export const weatherStore = new WeatherStore();

/**
 * Export store for testing
 */
export type { WeatherStore };
