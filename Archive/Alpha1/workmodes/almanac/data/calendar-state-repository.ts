// src/workmodes/almanac/data/calendar-state-repository.ts
// Repository for persisting and loading calendar state (active calendar, current timestamp, preferences)

import type { CalendarTimestamp } from "../helpers";
import type { AlmanacPreferencesSnapshot, TravelCalendarMode } from "../mode/contracts";

/**
 * Scope state structure (global or per-travel)
 */
export interface ScopeState {
  activeCalendarId: string | null;
  currentTimestamp: CalendarTimestamp | null;
}

/**
 * Travel leaf preferences structure
 */
export interface TravelLeafPreferences {
  readonly visible: boolean;
  readonly mode: TravelCalendarMode;
  readonly lastViewedTimestamp?: CalendarTimestamp | null;
}

/**
 * Complete calendar state structure
 */
export interface CalendarState {
  readonly scopes: ReadonlyMap<string, ScopeState>;
  readonly preferences: AlmanacPreferencesSnapshot;
  readonly travelLeaf: ReadonlyMap<string, TravelLeafPreferences>;
}

/**
 * Storage adapter interface for persisting calendar state
 */
export interface StorageAdapter<TData = unknown> {
  load(): Promise<void>;
  get(): TData | null;
  set(data: TData): void;
  save(): Promise<void>;
}

/**
 * Repository for calendar state persistence
 *
 * Handles loading and saving of:
 * - Active calendar per scope (global and per-travel)
 * - Current timestamp per scope
 * - User preferences
 * - Travel leaf preferences
 */
export class CalendarStateRepository {
  constructor(private readonly storage: StorageAdapter) {}

  /**
   * Load calendar state from persistent storage
   *
   * @returns Complete calendar state
   */
  async loadState(): Promise<CalendarState> {
    await this.storage.load();
    const data = this.storage.get();
    return this.normalizeStorageData(data);
  }

  /**
   * Save calendar state to persistent storage
   *
   * @param state - Complete calendar state to save
   */
  async saveState(state: CalendarState): Promise<void> {
    const data = this.serializeState(state);
    this.storage.set(data);
    await this.storage.save();
  }

  /**
   * Get scope state for a specific travel or global scope
   *
   * @param state - Current calendar state
   * @param travelId - Travel ID or null for global scope
   * @returns Scope state (creates default if missing)
   */
  getScopeState(state: CalendarState, travelId: string | null): ScopeState {
    const key = travelId ?? "__global__";
    const existing = state.scopes.get(key);

    if (existing) {
      return existing;
    }

    // Return default scope state if not found
    return {
      activeCalendarId: null,
      currentTimestamp: null,
    };
  }

  /**
   * Update scope state for a specific travel or global scope
   *
   * @param state - Current calendar state
   * @param travelId - Travel ID or null for global scope
   * @param scopeState - New scope state
   * @returns Updated calendar state
   */
  setScopeState(
    state: CalendarState,
    travelId: string | null,
    scopeState: ScopeState,
  ): CalendarState {
    const key = travelId ?? "__global__";
    const newScopes = new Map(state.scopes);
    newScopes.set(key, scopeState);

    return {
      ...state,
      scopes: newScopes,
    };
  }

  /**
   * Update scope state with partial updates (convenience method)
   *
   * @param state - Current calendar state
   * @param travelId - Travel ID or null for global scope
   * @param updates - Partial scope state updates
   * @returns Updated calendar state
   */
  updateScopeState(
    state: CalendarState,
    travelId: string | null,
    updates: Partial<ScopeState>,
  ): CalendarState {
    const key = travelId ?? "__global__";
    const currentScope = this.getScopeState(state, travelId);
    const updatedScope: ScopeState = {
      ...currentScope,
      ...updates,
    };

    const newScopes = new Map(state.scopes);
    newScopes.set(key, updatedScope);

    return {
      ...state,
      scopes: newScopes,
    };
  }

  /**
   * Update preferences
   *
   * @param state - Current calendar state
   * @param preferences - New preferences
   * @returns Updated calendar state
   */
  setPreferences(
    state: CalendarState,
    preferences: AlmanacPreferencesSnapshot,
  ): CalendarState {
    return {
      ...state,
      preferences,
    };
  }

  /**
   * Get travel leaf preferences for a specific travel
   *
   * @param state - Current calendar state
   * @param travelId - Travel ID
   * @returns Travel leaf preferences or null if not set
   */
  getTravelLeafPreferences(
    state: CalendarState,
    travelId: string,
  ): TravelLeafPreferences | null {
    return state.travelLeaf.get(travelId) ?? null;
  }

  /**
   * Update travel leaf preferences
   *
   * @param state - Current calendar state
   * @param travelId - Travel ID
   * @param prefs - New preferences
   * @returns Updated calendar state
   */
  setTravelLeafPreferences(
    state: CalendarState,
    travelId: string,
    prefs: TravelLeafPreferences,
  ): CalendarState {
    const newTravelLeaf = new Map(state.travelLeaf);
    newTravelLeaf.set(travelId, prefs);

    return {
      ...state,
      travelLeaf: newTravelLeaf,
    };
  }

  /**
   * Create initial empty state
   */
  createInitialState(): CalendarState {
    return {
      scopes: new Map([
        ["__global__", { activeCalendarId: null, currentTimestamp: null }],
      ]),
      preferences: {},
      travelLeaf: new Map(),
    };
  }

  // Private helper methods

  private normalizeStorageData(data: unknown): CalendarState {
    if (!data || typeof data !== "object") {
      return this.createInitialState();
    }

    const raw = data as {
      scopes?: Record<string, { activeCalendarId?: string | null; currentTimestamp?: CalendarTimestamp | null }>;
      preferences?: AlmanacPreferencesSnapshot;
      travelLeaf?: Record<string, TravelLeafPreferences>;
    };

    const scopes = new Map<string, ScopeState>();
    if (raw.scopes) {
      for (const [key, value] of Object.entries(raw.scopes)) {
        if (value) {
          scopes.set(key, {
            activeCalendarId: value.activeCalendarId ?? null,
            currentTimestamp: value.currentTimestamp
              ? { ...value.currentTimestamp }
              : null,
          });
        }
      }
    }

    // Ensure global scope exists
    if (!scopes.has("__global__")) {
      scopes.set("__global__", { activeCalendarId: null, currentTimestamp: null });
    }

    const travelLeaf = new Map<string, TravelLeafPreferences>();
    if (raw.travelLeaf) {
      for (const [key, value] of Object.entries(raw.travelLeaf)) {
        travelLeaf.set(key, { ...value });
      }
    }

    return {
      scopes,
      preferences: raw.preferences ? this.clonePreferences(raw.preferences) : {},
      travelLeaf,
    };
  }

  private serializeState(state: CalendarState): unknown {
    const scopes: Record<string, { activeCalendarId: string | null; currentTimestamp: CalendarTimestamp | null }> = {};
    for (const [key, value] of state.scopes.entries()) {
      scopes[key] = {
        activeCalendarId: value.activeCalendarId,
        currentTimestamp: value.currentTimestamp ? { ...value.currentTimestamp } : null,
      };
    }

    const travelLeaf: Record<string, TravelLeafPreferences> = {};
    for (const [key, value] of state.travelLeaf.entries()) {
      travelLeaf[key] = { ...value };
    }

    return {
      scopes,
      preferences: this.clonePreferences(state.preferences),
      travelLeaf,
    };
  }

  private clonePreferences(preferences: AlmanacPreferencesSnapshot): AlmanacPreferencesSnapshot {
    return {
      ...preferences,
      eventsFilters: preferences.eventsFilters
        ? {
            categories: [...(preferences.eventsFilters.categories ?? [])],
            calendarIds: [...(preferences.eventsFilters.calendarIds ?? [])],
          }
        : undefined,
    };
  }
}
