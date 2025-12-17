/**
 * Travel Feature store.
 *
 * Manages travel state machine for multi-hex routes.
 */

import type { TravelState, TravelStatus, Route, PauseReason } from './types';
import { createInitialTravelState } from './types';

// ============================================================================
// Travel Store
// ============================================================================

/**
 * Create a travel store for managing state machine.
 */
export function createTravelStore() {
  let state: TravelState = createInitialTravelState();

  return {
    /**
     * Get current state (read-only).
     */
    getState(): Readonly<TravelState> {
      return state;
    },

    /**
     * Get current status.
     */
    getStatus(): TravelStatus {
      return state.status;
    },

    // =========================================================================
    // State Transitions
    // =========================================================================

    /**
     * Transition to planning state with a route.
     */
    setPlanning(route: Route): void {
      state = {
        status: 'planning',
        route,
        currentSegmentIndex: 0,
        segmentProgress: 0,
        pauseReason: null,
        hourProgress: 0,
        totalHoursTraveled: 0,
      };
    },

    /**
     * Transition to traveling state.
     * Requires current status to be 'planning'.
     */
    setTraveling(): boolean {
      if (state.status !== 'planning') {
        return false;
      }
      state = {
        ...state,
        status: 'traveling',
      };
      return true;
    },

    /**
     * Transition to paused state.
     * Requires current status to be 'traveling'.
     */
    setPaused(reason: PauseReason): boolean {
      if (state.status !== 'traveling') {
        return false;
      }
      state = {
        ...state,
        status: 'paused',
        pauseReason: reason,
      };
      return true;
    },

    /**
     * Transition from paused to traveling.
     * Requires current status to be 'paused'.
     */
    setResumed(): boolean {
      if (state.status !== 'paused') {
        return false;
      }
      state = {
        ...state,
        status: 'traveling',
        pauseReason: null,
      };
      return true;
    },

    /**
     * Transition to arrived state.
     * Requires current status to be 'traveling'.
     */
    setArrived(): boolean {
      if (state.status !== 'traveling') {
        return false;
      }
      state = {
        ...state,
        status: 'arrived',
      };
      return true;
    },

    /**
     * Reset to idle state.
     */
    setIdle(): void {
      state = createInitialTravelState();
    },

    // =========================================================================
    // Progress Updates
    // =========================================================================

    /**
     * Advance to the next segment.
     * Returns true if there are more segments, false if route is complete.
     */
    advanceToNextSegment(): boolean {
      if (!state.route) return false;

      const nextIndex = state.currentSegmentIndex + 1;
      if (nextIndex >= state.route.segments.length) {
        // Route complete
        return false;
      }

      state = {
        ...state,
        currentSegmentIndex: nextIndex,
        segmentProgress: 0,
      };
      return true;
    },

    /**
     * Update progress within current segment.
     */
    setSegmentProgress(progress: number): void {
      state = {
        ...state,
        segmentProgress: Math.min(1, Math.max(0, progress)),
      };
    },

    // =========================================================================
    // Hour Tracking (for encounter checks)
    // =========================================================================

    /**
     * Set hour progress (0.0 - 1.0).
     * Used to track when a full hour boundary is crossed for encounter checks.
     */
    setHourProgress(progress: number): void {
      state = {
        ...state,
        hourProgress: progress,
      };
    },

    /**
     * Add hours to total traveled time.
     */
    incrementTotalHours(hours: number): void {
      state = {
        ...state,
        totalHoursTraveled: state.totalHoursTraveled + hours,
      };
    },

    /**
     * Reset hour tracking (when starting a new travel).
     */
    resetTravelProgress(): void {
      state = {
        ...state,
        hourProgress: 0,
        totalHoursTraveled: 0,
      };
    },

    /**
     * Clear the store.
     */
    clear(): void {
      state = createInitialTravelState();
    },
  };
}

export type TravelStore = ReturnType<typeof createTravelStore>;
