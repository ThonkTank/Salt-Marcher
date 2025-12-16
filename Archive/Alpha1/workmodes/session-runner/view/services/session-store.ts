// src/workmodes/session-runner/view/services/session-store.ts
// Centralized state store for Session Runner - replaces 20+ module-level variables.

import type { App, TFile } from "obsidian";
import type { TileData } from "@domain";
import { writable } from "@services/state/writable-store";
import type { WritableStore, Subscriber, Unsubscriber } from "@services/state/store.interface";

/**
 * Simplified weather state for UI display.
 * Full weather data is managed by weatherOverlayStore.
 */
export interface WeatherDisplayState {
    temperature?: string;
    precipitation?: string;
    wind?: string;
    description?: string;
}

/**
 * Core state for Session Runner orchestration.
 * This is the UI/coordination state, NOT travel domain state.
 * Travel domain state lives in the TravelStore (travel-store-registry).
 */
export interface SessionRunnerState {
    // Core context
    readonly app: App | null;
    readonly mapFile: TFile | null;
    readonly currentCoord: { q: number; r: number } | null;

    // Cached tile data (loaded on hex change)
    readonly currentTileData: TileData | null;

    // Cached weather display (from weatherOverlayStore)
    readonly currentWeather: WeatherDisplayState | null;

    // UI state flags
    readonly isInitialized: boolean;
}

/**
 * SessionRunnerStore - Central coordination state for Session Runner.
 *
 * This store consolidates module-level state from experience.ts into
 * a reactive, testable container. It does NOT replace:
 * - TravelStore (travel domain state)
 * - PartyStore (party data)
 * - WeatherOverlayStore (full weather data)
 *
 * It coordinates cached/derived data for UI updates.
 */
export interface SessionRunnerStore {
    subscribe: (fn: Subscriber<SessionRunnerState>) => Unsubscriber;
    get: () => SessionRunnerState;

    // Setters for individual fields
    initialize(app: App): void;
    setMapFile(file: TFile | null): void;
    setCurrentCoord(coord: { q: number; r: number } | null): void;
    updateTileData(data: TileData | null): void;
    updateWeather(weather: WeatherDisplayState | null): void;

    // Bulk update for atomic changes
    update(patch: Partial<SessionRunnerState>): void;

    // Reset for cleanup
    reset(): void;
}

const initialState: SessionRunnerState = {
    app: null,
    mapFile: null,
    currentCoord: null,
    currentTileData: null,
    currentWeather: null,
    isInitialized: false,
};

/**
 * Create a new SessionRunnerStore instance.
 * Each Session Runner experience should have its own store.
 */
export function createSessionRunnerStore(): SessionRunnerStore {
    const store = writable<SessionRunnerState>(initialState, {
        name: "session-runner",
        debug: false,
    });

    return {
        subscribe: store.subscribe,
        get: store.get,

        initialize(app: App) {
            store.update((s) => ({
                ...s,
                app,
                isInitialized: true,
            }));
        },

        setMapFile(file: TFile | null) {
            store.update((s) => ({
                ...s,
                mapFile: file,
                // Clear cached data when map changes
                currentTileData: null,
                currentWeather: null,
                currentCoord: null,
            }));
        },

        setCurrentCoord(coord: { q: number; r: number } | null) {
            store.update((s) => ({ ...s, currentCoord: coord }));
        },

        updateTileData(data: TileData | null) {
            store.update((s) => ({ ...s, currentTileData: data }));
        },

        updateWeather(weather: WeatherDisplayState | null) {
            store.update((s) => ({ ...s, currentWeather: weather }));
        },

        update(patch: Partial<SessionRunnerState>) {
            store.update((s) => ({ ...s, ...patch }));
        },

        reset() {
            store.set(initialState);
        },
    };
}
