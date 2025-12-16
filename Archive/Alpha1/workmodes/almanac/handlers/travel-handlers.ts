// src/workmodes/almanac/handlers/travel-handlers.ts
// Travel-related handler functions for Almanac workmode

/**
 * Travel Handler Functions
 *
 * Pure functions for handling travel leaf operations in the Almanac workmode:
 * - Travel leaf mounting/unmounting
 * - Travel mode changes
 *
 * All handlers receive TravelHandlerContext and update state via store.update().
 *
 * @module workmodes/almanac/handlers
 */

import type { TravelHandlerContext } from './calendar-types';
import { reportAlmanacGatewayIssue, emitAlmanacEvent } from "../telemetry";
import { isCalendarGatewayError } from "../data/calendar-state-gateway";
import type { TravelCalendarMode } from "../mode/contracts";

/**
 * Handle travel leaf mounted event.
 *
 * Initializes the travel leaf state and loads preferences from gateway.
 *
 * @param ctx - Travel handler context
 * @param travelId - Travel ID being mounted
 */
export async function handleTravelLeafMounted(
	ctx: TravelHandlerContext,
	travelId: string
): Promise<void> {
	const { store, gateway } = ctx;

	// Update travelId in context (mutate context state)
	// Note: This is OK because context is mutable state holder
	ctx.travelId = travelId;

	store.update(s => ({
		...s,
		travelLeafState: {
			...s.travelLeafState,
			travelId,
			visible: true,
			isLoading: true,
			error: undefined,
		},
	}));

	try {
		const prefs = await gateway.getTravelLeafPreferences(travelId);
		ctx.setTravelLeafPreferences(prefs);

		const state = store.get();

		store.update(s => ({
			...s,
			travelLeafState: {
				...s.travelLeafState,
				travelId,
				visible: true,
				mode: prefs?.mode ?? s.travelLeafState.mode,
				currentTimestamp: s.calendarState.currentTimestamp,
				minuteStep: s.calendarState.timeDefinition?.minuteStep ?? s.travelLeafState.minuteStep,
				isLoading: false,
				error: undefined,
			},
		}));

		await ctx.persistTravelLeafPreferences({
			visible: true,
			mode: state.travelLeafState.mode,
			lastViewedTimestamp: state.calendarState.currentTimestamp ?? null,
		});

		emitAlmanacEvent({
			type: "calendar.travel.lifecycle",
			phase: "mount",
			travelId,
			visible: true,
			mode: state.travelLeafState.mode,
			timestamp: state.calendarState.currentTimestamp,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Travel-Leaf konnte nicht initialisiert werden";
		const code = isCalendarGatewayError(error) ? error.code : "io_error";

		reportAlmanacGatewayIssue({
			operation: "stateMachine.travelLeaf.mount",
			scope: "travel",
			code,
			error,
			context: { travelId },
		});

		store.update(s => ({
			...s,
			travelLeafState: {
				...s.travelLeafState,
				isLoading: false,
				error: message,
			},
		}));
	}
}

/**
 * Handle travel mode changed event.
 *
 * Updates the travel mode in state and persists preferences.
 *
 * @param ctx - Travel handler context
 * @param mode - New travel mode
 */
export async function handleTravelModeChanged(
	ctx: TravelHandlerContext,
	mode: TravelCalendarMode
): Promise<void> {
	const { store } = ctx;
	const state = store.get();

	if (mode === state.travelLeafState.mode) {
		return;
	}

	store.update(s => ({
		...s,
		travelLeafState: {
			...s.travelLeafState,
			mode,
		},
	}));

	emitAlmanacEvent({
		type: "calendar.travel.lifecycle",
		phase: "mode-change",
		travelId: state.travelLeafState.travelId,
		visible: state.travelLeafState.visible,
		mode,
		timestamp: state.travelLeafState.currentTimestamp,
	});

	await ctx.persistTravelLeafPreferences({ mode });
}
