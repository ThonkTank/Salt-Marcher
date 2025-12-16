// src/workmodes/almanac/handlers/time-handlers.ts
// Time-related handler functions for Almanac workmode

/**
 * Time Handler Functions
 *
 * Pure functions for handling time operations in the Almanac workmode:
 * - Time advancement (days, hours, minutes)
 * - Time jumping (set timestamp)
 * - Jump previews
 *
 * All handlers receive TimeHandlerContext and update state via store.update().
 *
 * @module workmodes/almanac/handlers
 */

import type { TimeHandlerContext } from './calendar-types';
import { reportAlmanacGatewayIssue, emitAlmanacEvent } from "../telemetry";
import { AlmanacRepositoryError } from "../data/repositories";
import { isCalendarGatewayError } from "../data/calendar-state-gateway";
import type { CalendarTimestamp, CalendarEvent } from "../helpers";

const MAX_TRIGGERED_EVENTS = 10;
const MAX_TRIGGERED_PHENOMENA = 10;

/**
 * Advance time by a specified amount.
 *
 * Handles:
 * - Updating calendar state via gateway
 * - Fetching upcoming events
 * - Rebuilding phenomena
 * - Notifying cartographer
 * - Emitting telemetry events
 *
 * @param ctx - Time handler context
 * @param amount - Amount to advance
 * @param unit - Unit of time (day/hour/minute)
 * @param source - Source of advancement (global/travel)
 */
export async function handleTimeAdvance(
	ctx: TimeHandlerContext,
	amount: number,
	unit: "day" | "hour" | "minute",
	source: "global" | "travel" = "global"
): Promise<void> {
	const { store, gateway, eventRepo, phenomenonRepo, cartographerGateway, travelId } = ctx;
	const state = store.get();
	const activeCalendarId = state.calendarState.activeCalendarId;

	if (!activeCalendarId) {
		return;
	}

	store.update(s => ({
		...s,
		calendarState: {
			...s.calendarState,
			lastAdvanceStep: { amount, unit },
		},
		almanacUiState:
			source === "global"
				? {
						...s.almanacUiState,
						isLoading: true,
						error: undefined,
				  }
				: s.almanacUiState,
		travelLeafState:
			source === "travel"
				? {
						...s.travelLeafState,
						isLoading: true,
						error: undefined,
						lastQuickStep: { amount, unit },
				  }
				: s.travelLeafState,
	}));

	try {
		const advanceOptions = travelId
			? {
					travelId,
					hookContext: { scope: "travel" as const, travelId, reason: "advance" as const },
			  }
			: { hookContext: { scope: "global" as const, reason: "advance" as const } };

		const result = await gateway.advanceTimeBy(amount, unit, advanceOptions);
		const schema = ctx.getCalendarSchema(activeCalendarId);
		let upcoming: CalendarEvent[] = [...state.calendarState.upcomingEvents];

		if (schema) {
			upcoming = [...(await eventRepo.getUpcomingEvents(activeCalendarId, schema, result.timestamp, 5))];
		}

		// Rebuild phenomena
		if (ctx.phenomenaDefinitions.length === 0) {
			const freshPhenomena = await phenomenonRepo.listPhenomena();
			ctx.setPhenomenaDefinitions(freshPhenomena.map(item => ctx.toPhenomenon(item)));
		}

		ctx.setPhenomenaSource(
			ctx.buildPhenomenonViewModels(
				ctx.phenomenaDefinitions,
				state.calendarState.calendars,
				activeCalendarId,
				result.timestamp
			)
		);

		const filters = state.eventsUiState.filters;
		const filteredPhenomena = ctx.applyPhenomenaFilters(filters);
		const availableCategories = ctx.getUniqueCategories(ctx.phenomenaSource);
		const filterCount = filters.categories.length + filters.calendarIds.length;
		const calendars = state.calendarState.calendars;
		const currentSelectedId = state.eventsUiState.selectedPhenomenonId ?? null;
		let nextSelectedId: string | null = null;
		let nextDetail = null;

		if (currentSelectedId && filteredPhenomena.some(item => item.id === currentSelectedId)) {
			nextDetail = ctx.buildPhenomenonDetailForId(currentSelectedId, calendars, result.timestamp);
			nextSelectedId = nextDetail ? currentSelectedId : null;
		}

		if (!nextSelectedId && filteredPhenomena.length > 0) {
			const firstId = filteredPhenomena[0].id;
			nextDetail = ctx.buildPhenomenonDetailForId(firstId, calendars, result.timestamp);
			nextSelectedId = nextDetail ? firstId : null;
		}

		const mapMarkers = ctx.buildPhenomenonMapMarkers(filteredPhenomena, calendars);

		store.update(s => {
			const mergedTriggered = [...result.triggeredEvents, ...s.calendarState.triggeredEvents].slice(
				0,
				MAX_TRIGGERED_EVENTS
			);

			const mergedPhenomena = [
				...result.triggeredPhenomena,
				...s.calendarState.triggeredPhenomena,
			].slice(0, MAX_TRIGGERED_PHENOMENA);

			const minuteStep =
				s.calendarState.timeDefinition?.minuteStep ?? s.travelLeafState.minuteStep;

			const zoom = ctx.mapCalendarViewModeToZoom(s.calendarViewState.mode);

			return {
				...s,
				calendarState: {
					...s.calendarState,
					currentTimestamp: result.timestamp,
					upcomingEvents: upcoming,
					triggeredEvents: mergedTriggered,
					upcomingPhenomena: result.upcomingPhenomena,
					triggeredPhenomena: mergedPhenomena,
				},
				almanacUiState:
					source === "global"
						? {
								...s.almanacUiState,
								isLoading: false,
						  }
						: s.almanacUiState,
				travelLeafState: {
					...s.travelLeafState,
					travelId,
					currentTimestamp: result.timestamp,
					minuteStep,
					...(source === "travel"
						? { isLoading: false, error: undefined, lastQuickStep: { amount, unit } }
						: {}),
				},
				eventsUiState: {
					...s.eventsUiState,
					filterCount,
					filters: { ...filters },
					availableCategories,
					mapMarkers,
					phenomena: filteredPhenomena,
					selectedPhenomenonId: nextSelectedId,
					selectedPhenomenonDetail: nextDetail,
					isDetailLoading: false,
				},
				managerUiState: {
					...s.managerUiState,
					anchorTimestamp: result.timestamp,
					agendaItems: zoom
						? ctx.collectAgendaItems(result.timestamp, zoom, upcoming)
						: s.managerUiState.agendaItems,
					jumpPreview: [],
				},
			};
		});

		await cartographerGateway.notifyTravelPanel({
			travelId,
			currentTimestamp: result.timestamp,
			triggeredEvents: result.triggeredEvents,
			triggeredPhenomena: result.triggeredPhenomena,
			skippedEvents: [],
			skippedPhenomena: [],
			lastAdvanceStep: { amount, unit },
			reason: "advance",
		});

		emitAlmanacEvent({
			type: "calendar.time.advance",
			scope: source,
			reason: "advance",
			unit,
			amount,
			triggeredEvents: result.triggeredEvents.length,
			triggeredPhenomena: result.triggeredPhenomena.length,
			skippedEvents: 0,
			travelId: source === "travel" ? travelId : null,
			timestamp: result.timestamp,
		});

		void ctx.persistPreferences({
			lastSelectedPhenomenonId: nextSelectedId ?? undefined,
		});

		if (travelId) {
			void ctx.persistTravelLeafPreferences({ lastViewedTimestamp: result.timestamp });
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Zeitfortschritt fehlgeschlagen";
		const code =
			error instanceof AlmanacRepositoryError
				? error.code
				: isCalendarGatewayError(error)
				? error.code
				: "io_error";

		reportAlmanacGatewayIssue({
			operation: "stateMachine.timeAdvance",
			scope: source === "travel" ? "travel" : "calendar",
			code,
			error,
			context: { amount, unit, travelId },
		});

		if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
			emitAlmanacEvent({
				type: "calendar.event.conflict",
				code: "phenomenon",
				message,
				context: error.details,
			});
		}

		store.update(s => ({
			...s,
			almanacUiState:
				source === "global"
					? {
							...s.almanacUiState,
							isLoading: false,
							error: message,
					  }
					: s.almanacUiState,
			travelLeafState:
				source === "travel"
					? {
							...s.travelLeafState,
							isLoading: false,
							error: message,
					  }
					: s.travelLeafState,
		}));
	}
}

/**
 * Preview events that would be skipped by a time jump.
 *
 * @param ctx - Time handler context
 * @param target - Target timestamp
 */
export async function handleTimeJumpPreview(
	ctx: TimeHandlerContext,
	target: CalendarTimestamp
): Promise<void> {
	const { store, gateway, eventRepo, calendarRepo } = ctx;
	const state = store.get();
	const activeCalendarId = state.calendarState.activeCalendarId;

	if (!activeCalendarId) {
		ctx.clearJumpPreview();
		return;
	}

	if (target.calendarId !== activeCalendarId) {
		target = { ...target, calendarId: activeCalendarId };
	}

	const schema =
		ctx.getCalendarSchema(activeCalendarId) ?? (await calendarRepo.getCalendar(activeCalendarId));
	const currentTimestamp = state.calendarState.currentTimestamp;

	if (!schema || !currentTimestamp) {
		ctx.clearJumpPreview();
		return;
	}

	const preview = await eventRepo.getEventsInRange(
		activeCalendarId,
		schema,
		currentTimestamp,
		target
	);

	store.update(s => ({
		...s,
		managerUiState: {
			...s.managerUiState,
			jumpPreview: [...preview],
		},
	}));
}

/**
 * Jump to a specific timestamp.
 *
 * Handles:
 * - Previewing skipped events
 * - Updating calendar state via gateway
 * - Fetching upcoming events
 * - Rebuilding phenomena
 * - Notifying cartographer
 * - Emitting telemetry events
 *
 * @param ctx - Time handler context
 * @param target - Target timestamp
 */
export async function handleTimeJump(
	ctx: TimeHandlerContext,
	target: CalendarTimestamp
): Promise<void> {
	const { store, gateway, eventRepo, phenomenonRepo, cartographerGateway, travelId, calendarRepo } =
		ctx;
	const state = store.get();
	const activeCalendarId = state.calendarState.activeCalendarId;

	if (!activeCalendarId) {
		return;
	}

	if (target.calendarId !== activeCalendarId) {
		target = { ...target, calendarId: activeCalendarId };
	}

	store.update(s => ({
		...s,
		almanacUiState: {
			...s.almanacUiState,
			isLoading: true,
			error: undefined,
		},
	}));

	try {
		let schema =
			ctx.getCalendarSchema(activeCalendarId) ?? (await calendarRepo.getCalendar(activeCalendarId));
		const currentTimestamp = state.calendarState.currentTimestamp;
		let preview: CalendarEvent[] = [];

		if (schema && currentTimestamp) {
			preview = [...(await eventRepo.getEventsInRange(
				activeCalendarId,
				schema,
				currentTimestamp,
				target
			))];
		}

		await gateway.setCurrentTimestamp(target);

		const snapshotAfterJump = await gateway.loadSnapshot();
		const upcoming = snapshotAfterJump.upcomingEvents;
		const upcomingPhenomena = snapshotAfterJump.upcomingPhenomena;

		// Rebuild phenomena
		if (ctx.phenomenaDefinitions.length === 0) {
			const freshPhenomena = await phenomenonRepo.listPhenomena();
			ctx.setPhenomenaDefinitions(freshPhenomena.map(item => ctx.toPhenomenon(item)));
		}

		ctx.setPhenomenaSource(
			ctx.buildPhenomenonViewModels(
				ctx.phenomenaDefinitions,
				state.calendarState.calendars,
				activeCalendarId,
				target
			)
		);

		const filters = state.eventsUiState.filters;
		const filteredPhenomena = ctx.applyPhenomenaFilters(filters);
		const availableCategories = ctx.getUniqueCategories(ctx.phenomenaSource);
		const filterCount = filters.categories.length + filters.calendarIds.length;
		const calendars = state.calendarState.calendars;
		const currentSelectedId = state.eventsUiState.selectedPhenomenonId ?? null;
		let nextSelectedId: string | null = null;
		let nextDetail = null;

		if (currentSelectedId && filteredPhenomena.some(item => item.id === currentSelectedId)) {
			nextDetail = ctx.buildPhenomenonDetailForId(currentSelectedId, calendars, target);
			nextSelectedId = nextDetail ? currentSelectedId : null;
		}

		if (!nextSelectedId && filteredPhenomena.length > 0) {
			const firstId = filteredPhenomena[0].id;
			nextDetail = ctx.buildPhenomenonDetailForId(firstId, calendars, target);
			nextSelectedId = nextDetail ? firstId : null;
		}

		const mapMarkers = ctx.buildPhenomenonMapMarkers(filteredPhenomena, calendars);

		store.update(s => {
			const zoom = ctx.mapCalendarViewModeToZoom(s.calendarViewState.mode);

			return {
				...s,
				calendarState: {
					...s.calendarState,
					currentTimestamp: target,
					upcomingEvents: upcoming,
					triggeredEvents: preview,
					upcomingPhenomena,
				},
				almanacUiState: {
					...s.almanacUiState,
					isLoading: false,
				},
				eventsUiState: {
					...s.eventsUiState,
					filterCount,
					filters: { ...filters },
					availableCategories,
					mapMarkers,
					phenomena: filteredPhenomena,
					selectedPhenomenonId: nextSelectedId,
					selectedPhenomenonDetail: nextDetail,
					isDetailLoading: false,
				},
				managerUiState: {
					...s.managerUiState,
					anchorTimestamp: target,
					agendaItems: zoom
						? ctx.collectAgendaItems(target, zoom, [...upcoming])
						: s.managerUiState.agendaItems,
					jumpPreview: [],
				},
			};
		});

		await cartographerGateway.notifyTravelPanel({
			travelId,
			currentTimestamp: target,
			triggeredEvents: [],
			triggeredPhenomena: [],
			skippedEvents: preview,
			skippedPhenomena: [],
			reason: "jump",
		});

		emitAlmanacEvent({
			type: "calendar.time.advance",
			scope: travelId ? "travel" : "global",
			reason: "jump",
			unit: "day",
			amount: 0,
			triggeredEvents: 0,
			triggeredPhenomena: 0,
			skippedEvents: preview.length,
			travelId,
			timestamp: target,
		});

		void ctx.persistPreferences({
			lastSelectedPhenomenonId: nextSelectedId ?? undefined,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Zeit konnte nicht gesetzt werden";
		const code =
			error instanceof AlmanacRepositoryError
				? error.code
				: isCalendarGatewayError(error)
				? error.code
				: "io_error";

		reportAlmanacGatewayIssue({
			operation: "stateMachine.timeJump",
			scope: travelId ? "travel" : "calendar",
			code,
			error,
			context: { travelId },
		});

		if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
			emitAlmanacEvent({
				type: "calendar.event.conflict",
				code: "phenomenon",
				message,
				context: error.details,
			});
		}

		store.update(s => ({
			...s,
			almanacUiState: {
				...s.almanacUiState,
				isLoading: false,
				error: message,
			},
		}));
	}
}
