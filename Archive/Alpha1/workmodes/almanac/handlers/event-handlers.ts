/**
 * Almanac Event Handlers
 *
 * Pure functions for handling event-related operations in the Almanac workmode.
 * Extracted from state-machine.ts for better separation of concerns.
 *
 * @module workmodes/almanac/handlers
 */

import type { EventHandlerContext } from './calendar-types';
import { reportAlmanacGatewayIssue } from "../telemetry";
import { emitAlmanacEvent } from "../telemetry";
import {
	createEmptySingleEventDraft,
	createEmptyRecurringEventDraft,
} from "../mode/contracts";
import type { EventEditorMode, EventEditorDraft } from "../mode/contracts";
import type { CalendarTimestamp, CalendarEventSingle, CalendarEventRecurring } from "../helpers";
import { isSingleEvent } from "../helpers";
import { formatPhenomenaExport, parsePhenomenaImport } from "../data/phenomena-serialization";
import { AlmanacRepositoryError } from "../data/repositories";
import type { ImportSummary } from "../mode/contracts";
import type { PhenomenonDTO } from "../data/dto";

// ============================================================================
// Event Editor Handlers
// ============================================================================

/**
 * Handle event create request.
 * Opens the event editor modal with an empty draft.
 */
export async function handleEventCreateRequested(
	ctx: EventHandlerContext,
	mode: EventEditorMode,
	calendarId?: string,
	timestamp?: CalendarTimestamp
): Promise<void> {
	const { store } = ctx;
	const state = store.get();

	const fallbackCalendarId =
		calendarId ??
		timestamp?.calendarId ??
		state.calendarState.activeCalendarId ??
		state.calendarState.defaultCalendarId ??
		(state.calendarState.calendars[0]?.id ?? null);

	if (!fallbackCalendarId) {
		const message = "Kein Kalender verfügbar.";
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isEventEditorOpen: true,
				eventEditorMode: mode,
				eventEditorDraft: null,
				eventEditorErrors: [message],
				eventEditorPreview: [],
				isEventSaving: false,
				eventEditorError: message,
			},
		}));
		return;
	}

	const schema = ctx.getCalendarSchema(fallbackCalendarId);
	const currentTimestamp = state.calendarState.currentTimestamp;
	const referenceTimestamp =
		timestamp && timestamp.calendarId === fallbackCalendarId
			? timestamp
			: currentTimestamp && currentTimestamp.calendarId === fallbackCalendarId
			? currentTimestamp
			: undefined;
	const reference = referenceTimestamp
		? { year: referenceTimestamp.year, monthId: referenceTimestamp.monthId, day: referenceTimestamp.day }
		: schema
		? { year: schema.epoch.year, monthId: schema.epoch.monthId, day: schema.epoch.day }
		: undefined;

	const draft =
		mode === "single"
			? createEmptySingleEventDraft(fallbackCalendarId, reference)
			: createEmptyRecurringEventDraft(fallbackCalendarId, reference);

	const { errors, preview } = ctx.validateAndPreviewDraft(draft);

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isEventEditorOpen: true,
			eventEditorMode: mode,
			eventEditorDraft: draft,
			eventEditorErrors: errors,
			eventEditorPreview: preview,
			isEventSaving: false,
			eventEditorError: undefined,
		},
	}));
}

/**
 * Handle event edit request.
 * Loads an existing event and opens the editor with its data.
 */
export async function handleEventEditRequested(
	ctx: EventHandlerContext,
	eventId: string
): Promise<void> {
	const { store } = ctx;

	try {
		const event = await ctx.loadEventById(eventId);
		if (!event) {
			throw new Error(`Event ${eventId} konnte nicht gefunden werden.`);
		}
		const draft = ctx.createDraftFromEvent(event);
		const { errors, preview } = ctx.validateAndPreviewDraft(draft);

		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isEventEditorOpen: true,
				eventEditorMode: draft.kind === "recurring" ? "recurring" : "single",
				eventEditorDraft: draft,
				eventEditorErrors: errors,
				eventEditorPreview: preview,
				isEventSaving: false,
				eventEditorError: undefined,
			},
		}));
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Ereignis konnte nicht geladen werden.";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.event.load",
			scope: "event",
			code: "io_error",
			error,
			context: { eventId },
		});
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isEventEditorOpen: false,
				eventEditorMode: null,
				eventEditorDraft: null,
				eventEditorErrors: [message],
				eventEditorPreview: [],
				isEventSaving: false,
				eventEditorError: message,
			},
		}));
	}
}

/**
 * Handle event editor draft update.
 * Merges partial updates into the current draft and revalidates.
 */
export function handleEventEditorUpdated(
	ctx: EventHandlerContext,
	update: Partial<EventEditorDraft>
): void {
	const { store } = ctx;
	const state = store.get();
	const current = state.eventsUiState.eventEditorDraft;

	if (!current) {
		return;
	}

	const nextDraft = { ...current, ...update } as EventEditorDraft;
	const { errors, preview } = ctx.validateAndPreviewDraft(nextDraft);

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			eventEditorDraft: nextDraft,
			eventEditorMode: nextDraft.kind === "recurring" ? "recurring" : "single",
			eventEditorErrors: errors,
			eventEditorPreview: preview,
			eventEditorError: undefined,
		},
	}));
}

/**
 * Handle event editor cancel.
 * Closes the editor without saving changes.
 */
export function handleEventEditorCancelled(ctx: EventHandlerContext): void {
	const { store } = ctx;

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isEventEditorOpen: false,
			eventEditorMode: null,
			eventEditorDraft: null,
			eventEditorErrors: [],
			eventEditorPreview: [],
			isEventSaving: false,
			eventEditorError: undefined,
		},
	}));
}

/**
 * Handle event editor save.
 * Validates the current draft and persists it via the repository.
 */
export async function handleEventEditorSave(ctx: EventHandlerContext): Promise<void> {
	const { store, eventRepo } = ctx;
	const state = store.get();
	const draft = state.eventsUiState.eventEditorDraft;

	if (!draft) {
		return;
	}

	const validation = ctx.validateEventDraft(draft);
	if (validation.errors.length > 0 || !validation.event) {
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				eventEditorErrors: validation.errors,
				eventEditorPreview: [],
				isEventSaving: false,
				eventEditorError: validation.errors[0] ?? undefined,
			},
		}));
		return;
	}

	const isNew = !draft.id;
	const targetId = isNew ? ctx.generateEventId() : draft.id;
	const event = validation.event;
	const payload = isSingleEvent(event)
		? ({ ...event, id: targetId } as CalendarEventSingle)
		: ({ ...event, id: targetId } as CalendarEventRecurring);

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isEventSaving: true,
			eventEditorErrors: validation.errors,
			eventEditorPreview: validation.schema
				? ctx.computeEventPreview(event, validation.schema)
				: [],
			eventEditorError: undefined,
		},
	}));

	try {
		if (isNew) {
			await eventRepo.createEvent(payload);
		} else {
			await eventRepo.updateEvent(targetId, payload);
		}

		await ctx.refreshCalendarData();

		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isEventEditorOpen: false,
				eventEditorMode: null,
				eventEditorDraft: null,
				eventEditorErrors: [],
				eventEditorPreview: [],
				isEventSaving: false,
				eventEditorError: undefined,
			},
		}));
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Ereignis konnte nicht gespeichert werden.";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.event.save",
			scope: "event",
			code: "io_error",
			error,
			context: { eventId: targetId, mode: isNew ? "create" : "update" },
		});
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isEventSaving: false,
				eventEditorError: message,
			},
		}));
	}
}

// ============================================================================
// Event Deletion Handler
// ============================================================================

/**
 * Handle event delete request.
 * Removes the event from the repository and refreshes calendar data.
 */
export async function handleEventDelete(
	ctx: EventHandlerContext,
	eventId: string
): Promise<void> {
	const { store, eventRepo } = ctx;

	try {
		await eventRepo.deleteEvent(eventId);
		await ctx.refreshCalendarData();

		store.update((s) => {
			const isEditingDeleted = s.eventsUiState.eventEditorDraft?.id === eventId;
			return {
				...s,
				eventsUiState: {
					...s.eventsUiState,
					bulkSelection: s.eventsUiState.bulkSelection.filter((id) => id !== eventId),
					...(isEditingDeleted
						? {
								isEventEditorOpen: false,
								eventEditorMode: null,
								eventEditorDraft: null,
								eventEditorErrors: [],
								eventEditorPreview: [],
								isEventSaving: false,
								eventEditorError: undefined,
						  }
						: {}),
				},
			};
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Ereignis konnte nicht gelöscht werden.";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.event.delete",
			scope: "event",
			code: "io_error",
			error,
			context: { eventId },
		});
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				eventEditorError: message,
			},
		}));
	}
}

// ============================================================================
// Bulk Actions Handler
// ============================================================================

/**
 * Handle bulk action on events.
 * Supports delete and export operations on multiple events.
 */
export async function handleEventBulkAction(
	ctx: EventHandlerContext,
	action: "delete" | "export",
	ids?: ReadonlyArray<string>
): Promise<void> {
	const { store, phenomenonRepo } = ctx;
	const state = store.get();
	const selection = ids && ids.length ? Array.from(ids) : [...state.eventsUiState.bulkSelection];
	const unique = Array.from(new Set(selection));

	if (unique.length === 0) {
		return;
	}

	if (action === "export") {
		const entries = ctx.phenomenaDefinitions.filter((item) => unique.includes(item.id));
		const payload = formatPhenomenaExport(entries as PhenomenonDTO[]);
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				lastExportPayload: payload,
				error: undefined,
			},
		}));
		return;
	}

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isLoading: true,
			error: undefined,
		},
	}));

	try {
		for (const id of unique) {
			await phenomenonRepo.deletePhenomenon(id);
		}
		ctx.phenomenaDefinitions = ctx.phenomenaDefinitions.filter(
			(item) => !unique.includes(item.id)
		);
		ctx.rebuildPhenomenaListing(null, {
			bulkSelection: [],
			exportPayload: state.eventsUiState.lastExportPayload ?? undefined,
			importSummary: state.eventsUiState.importSummary ?? null,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Bulk-Aktion fehlgeschlagen";
		const code = error instanceof AlmanacRepositoryError ? error.code : "io_error";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.phenomenon.bulk",
			scope: "phenomenon",
			code,
			error,
			context: { ids: unique },
		});
		if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
			emitAlmanacEvent({
				type: "calendar.event.conflict",
				code: "phenomenon",
				message,
				context: error.details,
			});
		}
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				error: message,
			},
		}));
	} finally {
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isLoading: false,
			},
		}));
	}
}

// ============================================================================
// Import/Export Handlers
// ============================================================================

/**
 * Handle export payload cleared.
 * Clears the last export payload from state.
 */
export function handleEventExportCleared(ctx: EventHandlerContext): void {
	const { store } = ctx;

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			lastExportPayload: undefined,
		},
	}));
}

/**
 * Handle import request.
 * Opens the import dialog.
 */
export function handleEventImportRequested(ctx: EventHandlerContext): void {
	const { store } = ctx;

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isImportDialogOpen: true,
			importError: undefined,
		},
	}));
}

/**
 * Handle import cancelled.
 * Closes the import dialog.
 */
export function handleEventImportCancelled(ctx: EventHandlerContext): void {
	const { store } = ctx;

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isImportDialogOpen: false,
			importError: undefined,
		},
	}));
}

/**
 * Handle import submitted.
 * Parses and imports phenomena from the provided payload.
 */
export async function handleEventImportSubmitted(
	ctx: EventHandlerContext,
	payload: string
): Promise<void> {
	const { store, phenomenonRepo } = ctx;
	const state = store.get();

	store.update((s) => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isLoading: true,
			importError: undefined,
		},
	}));

	try {
		const parsed = parsePhenomenaImport(payload);
		let imported = 0;
		for (const entry of parsed) {
			const stored = await phenomenonRepo.upsertPhenomenon(entry);
			const normalised = ctx.toPhenomenon(stored);
			ctx.phenomenaDefinitions = [
				...ctx.phenomenaDefinitions.filter((item) => item.id !== normalised.id),
				normalised,
			];
			imported += 1;
		}

		const summary: ImportSummary = { imported, failed: 0 };
		ctx.rebuildPhenomenaListing(null, {
			bulkSelection: state.eventsUiState.bulkSelection,
			exportPayload: state.eventsUiState.lastExportPayload ?? undefined,
			importSummary: summary,
		});

		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isImportDialogOpen: false,
			},
		}));
	} catch (error) {
		const message = error instanceof Error ? error.message : "Import fehlgeschlagen";
		const code = error instanceof AlmanacRepositoryError ? error.code : "io_error";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.phenomenon.import",
			scope: "phenomenon",
			code,
			error,
			context: { imported: payload.slice(0, 32) },
		});
		if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
			emitAlmanacEvent({
				type: "calendar.event.conflict",
				code: "phenomenon",
				message,
				context: error.details,
			});
		}
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				importError: message,
			},
		}));
	} finally {
		store.update((s) => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isLoading: false,
			},
		}));
	}
}
