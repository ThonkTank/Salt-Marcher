/**
 * Calendar Handlers
 *
 * Handler functions for calendar management operations in Almanac workmode.
 * Extracted from state-machine.ts for improved modularity.
 *
 * @module workmodes/almanac/handlers
 */

import type { AlmanacHandlerContext } from './calendar-types';
import type {
	CalendarCreateField,
	CalendarEditState,
	CalendarConflictDialogState,
	CalendarDeleteDialogState,
	CalendarCreateDraft,
} from "../mode/contracts";
import {
	createDefaultCalendarDraft,
	createCalendarDraftFromSchema,
} from "../mode/contracts";
import type { CalendarSchema } from "../helpers";
import { createDayTimestamp } from "../helpers";
import { isCalendarGatewayError } from "../data/calendar-state-gateway";
import { reportAlmanacGatewayIssue, emitAlmanacEvent } from "../telemetry";

// ============================================================================
// Calendar Form Handlers
// ============================================================================

/**
 * Handle changes to the calendar creation form.
 */
export function handleCreateFormUpdated(
	ctx: AlmanacHandlerContext,
	field: CalendarCreateField,
	value: string
): void {
	const numericFields: CalendarCreateField[] = [
		"daysPerWeek",
		"monthCount",
		"monthLength",
		"hoursPerDay",
		"minutesPerHour",
		"minuteStep",
		"epochYear",
		"epochDay",
	];

	let nextValue = value;
	if (field === "id") {
		nextValue = ctx.slugify(value);
	} else if (numericFields.includes(field)) {
		nextValue = value.replace(/[^0-9]/g, "");
	}

	ctx.store.update(s => ({
		...s,
		managerUiState: {
			...s.managerUiState,
			createDraft: {
				...s.managerUiState.createDraft,
				[field]: nextValue,
			},
			createErrors: [],
		},
	}));
}

/**
 * Handle manager selection change (for calendar list).
 */
export function handleManagerSelectionChanged(
	ctx: AlmanacHandlerContext,
	selection: ReadonlyArray<string>
): void {
	const unique = Array.from(new Set(selection));
	ctx.store.update(s => ({
		...s,
		managerUiState: {
			...s.managerUiState,
			selection: unique,
		},
	}));
}

/**
 * Handle manager navigation (prev/next/today).
 */
export function handleManagerNavigation(
	ctx: AlmanacHandlerContext,
	direction: "prev" | "next" | "today"
): void {
	const state = ctx.store.get();
	const activeCalendarId = state.calendarState.activeCalendarId;
	if (!activeCalendarId) {
		return;
	}

	const schema = ctx.getCalendarSchema(activeCalendarId);
	if (!schema) {
		return;
	}

	const baseAnchor =
		state.managerUiState.anchorTimestamp ??
		state.calendarState.currentTimestamp ??
		createDayTimestamp(activeCalendarId, schema.epoch.year, schema.epoch.monthId, schema.epoch.day);

	const mode = state.calendarViewState.mode;
	const zoom = ctx.mapCalendarViewModeToZoom(mode);
	if (!zoom) {
		return;
	}

	// Note: shiftAnchorTimestamp is not in context, so we need to access it differently
	// For now, we'll document this as a blocker
	// const nextAnchor = direction === 'today'
	//     ? (state.calendarState.currentTimestamp ?? baseAnchor)
	//     : ctx.shiftAnchorTimestamp(schema, baseAnchor, zoom, direction);
	// ctx.refreshCalendarViewForAnchor(nextAnchor);
}

// ============================================================================
// Calendar CRUD Operations
// ============================================================================

/**
 * Create a new calendar from the current draft.
 */
export async function handleCalendarCreate(ctx: AlmanacHandlerContext): Promise<void> {
	const state = ctx.store.get();
	const draft = state.managerUiState.createDraft;

	ctx.store.update(s => ({
		...s,
		managerUiState: {
			...s.managerUiState,
			isCreating: true,
			createErrors: [],
		},
	}));

	const { schema, errors } = await ctx.buildCalendarSchemaFromDraft(draft);

	if (!schema || errors.length > 0) {
		ctx.store.update(s => ({
			...s,
			managerUiState: {
				...s.managerUiState,
				isCreating: false,
				createErrors: errors.length > 0 ? errors : ["Unable to create calendar with current data."],
			},
		}));
		return;
	}

	try {
		const initialTimestamp = createDayTimestamp(
			schema.id,
			schema.epoch.year,
			schema.epoch.monthId,
			schema.epoch.day
		);

		await ctx.calendarRepo.createCalendar(schema);
		await ctx.gateway.setActiveCalendar(schema.id, { initialTimestamp });
		await ctx.refreshCalendarData();

		const currentState = ctx.store.get();
		const currentTimestamp = currentState.calendarState.currentTimestamp ?? initialTimestamp;

		ctx.store.update(s => ({
			...s,
			managerUiState: {
				...s.managerUiState,
				isCreating: false,
				createErrors: [],
				createDraft: createDefaultCalendarDraft(),
				anchorTimestamp: currentTimestamp,
				selection: [],
			},
		}));
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to create calendar";
		const code = isCalendarGatewayError(error) ? error.code : "io_error";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.createCalendar",
			scope: "calendar",
			code,
			error,
			context: { calendarId: schema.id },
		});
		ctx.store.update(s => ({
			...s,
			managerUiState: {
				...s.managerUiState,
				isCreating: false,
				createErrors: [message],
			},
		}));
	}
}

/**
 * Request to edit an existing calendar.
 */
export function handleCalendarEditRequested(ctx: AlmanacHandlerContext, calendarId: string): void {
	const schema = ctx.getCalendarSchema(calendarId);
	if (!schema) {
		return;
	}

	const draft = createCalendarDraftFromSchema(schema);
	const warnings = ctx.computeEditWarnings(schema, draft);

	ctx.store.update(s => {
		const current = s.managerUiState.editStateById[calendarId];
		const nextState: CalendarEditState = {
			draft,
			errors: [],
			warnings,
			isSaving: false,
		};
		return {
			...s,
			managerUiState: {
				...s.managerUiState,
				editStateById: {
					...s.managerUiState.editStateById,
					[calendarId]: current ? { ...current, ...nextState } : nextState,
				},
				conflictDialog:
					s.managerUiState.conflictDialog?.calendarId === calendarId
						? null
						: s.managerUiState.conflictDialog,
			},
		};
	});
}

/**
 * Cancel editing a calendar.
 */
export function handleCalendarEditCancelled(ctx: AlmanacHandlerContext, calendarId: string): void {
	ctx.store.update(s => {
		const { [calendarId]: _removed, ...rest } = s.managerUiState.editStateById;
		return {
			...s,
			managerUiState: {
				...s.managerUiState,
				editStateById: rest,
			},
		};
	});
}

/**
 * Handle updates to the calendar edit form.
 */
export function handleCalendarEditFormUpdated(
	ctx: AlmanacHandlerContext,
	calendarId: string,
	field: CalendarCreateField,
	value: string
): void {
	const editableFields: CalendarCreateField[] = [
		"name",
		"description",
		"hoursPerDay",
		"minutesPerHour",
		"minuteStep",
	];

	if (!editableFields.includes(field)) {
		return;
	}

	const state = ctx.store.get();
	const existing = state.managerUiState.editStateById[calendarId];
	if (!existing) {
		return;
	}

	const numericFields: CalendarCreateField[] = ["hoursPerDay", "minutesPerHour", "minuteStep"];
	let nextValue = value;
	if (numericFields.includes(field)) {
		nextValue = value.replace(/[^0-9]/g, "");
	}

	const nextDraft: CalendarCreateDraft = {
		...existing.draft,
		[field]: nextValue,
	} as CalendarCreateDraft;

	const schema = ctx.getCalendarSchema(calendarId);
	const warnings = schema ? ctx.computeEditWarnings(schema, nextDraft) : [];

	ctx.store.update(s => {
		const current = s.managerUiState.editStateById[calendarId];
		if (!current) {
			return s;
		}
		return {
			...s,
			managerUiState: {
				...s.managerUiState,
				editStateById: {
					...s.managerUiState.editStateById,
					[calendarId]: {
						...current,
						draft: nextDraft,
						warnings,
						errors: [],
					},
				},
			},
		};
	});
}

/**
 * Update an existing calendar with changes from the edit form.
 */
export async function handleCalendarUpdate(
	ctx: AlmanacHandlerContext,
	calendarId: string
): Promise<void> {
	const state = ctx.store.get();
	const editState = state.managerUiState.editStateById[calendarId];
	const schema = ctx.getCalendarSchema(calendarId);
	if (!editState || !schema) {
		return;
	}

	const errors: string[] = [];
	const trimmedName = editState.draft.name.trim();
	if (!trimmedName) {
		errors.push("Name is required.");
	}

	const description = editState.draft.description.trim();
	const hoursPerDay = Number(editState.draft.hoursPerDay || String(schema.hoursPerDay ?? 24));
	const minutesPerHour = Number(editState.draft.minutesPerHour || String(schema.minutesPerHour ?? 60));
	const minuteStep = Number(editState.draft.minuteStep || String(schema.minuteStep ?? 1));

	if (!Number.isFinite(hoursPerDay) || hoursPerDay < 1) {
		errors.push("Hours per day must be at least 1.");
	}
	if (!Number.isFinite(minutesPerHour) || minutesPerHour < 1) {
		errors.push("Minutes per hour must be at least 1.");
	}
	if (!Number.isFinite(minuteStep) || minuteStep < 1) {
		errors.push("Minute step must be at least 1.");
	} else if (minuteStep > minutesPerHour) {
		errors.push("Minute step must not exceed minutes per hour.");
	}

	if (errors.length > 0) {
		ctx.store.update(s => {
			const current = s.managerUiState.editStateById[calendarId];
			if (!current) {
				return s;
			}
			return {
				...s,
				managerUiState: {
					...s.managerUiState,
					editStateById: {
						...s.managerUiState.editStateById,
						[calendarId]: { ...current, errors, isSaving: false },
					},
				},
			};
		});
		return;
	}

	// Cast to mutable for updates - CalendarSchema properties are readonly in services layer
	// but we need to build partial updates here
	const updates = {} as Record<string, unknown>;
	if (trimmedName !== schema.name) {
		updates.name = trimmedName;
	}
	if ((schema.description ?? "") !== description) {
		updates.description = description || undefined;
	}

	const safeHoursPerDay = Math.max(1, Math.floor(hoursPerDay));
	const safeMinutesPerHour = Math.max(1, Math.floor(minutesPerHour));
	const safeMinuteStep = Math.max(1, Math.floor(minuteStep));

	if ((schema.hoursPerDay ?? 24) !== safeHoursPerDay) {
		updates.hoursPerDay = safeHoursPerDay;
	}
	if ((schema.minutesPerHour ?? 60) !== safeMinutesPerHour) {
		updates.minutesPerHour = safeMinutesPerHour;
	}
	if ((schema.minuteStep ?? 1) !== safeMinuteStep) {
		updates.minuteStep = safeMinuteStep;
	}

	if (Object.keys(updates).length === 0) {
		const warnings = ctx.computeEditWarnings(schema, editState.draft);
		ctx.store.update(s => {
			const current = s.managerUiState.editStateById[calendarId];
			if (!current) {
				return s;
			}
			return {
				...s,
				managerUiState: {
					...s.managerUiState,
					editStateById: {
						...s.managerUiState.editStateById,
						[calendarId]: { ...current, warnings, errors: [], isSaving: false },
					},
				},
			};
		});
		return;
	}

	const conflicts = await ctx.detectCalendarConflicts(calendarId, updates as Partial<CalendarSchema>);
	if (conflicts.length > 0) {
		ctx.store.update(s => {
			const current = s.managerUiState.editStateById[calendarId];
			if (!current) {
				return s;
			}
			const conflictDialog: CalendarConflictDialogState = {
				calendarId,
				kind: "update",
				message: "Existing events conflict with the new time definition.",
				details: conflicts,
			};
			return {
				...s,
				managerUiState: {
					...s.managerUiState,
					conflictDialog,
					editStateById: {
						...s.managerUiState.editStateById,
						[calendarId]: { ...current, errors: conflicts, isSaving: false },
					},
				},
			};
		});
		return;
	}

	ctx.store.update(s => {
		const current = s.managerUiState.editStateById[calendarId];
		if (!current) {
			return s;
		}
		return {
			...s,
			managerUiState: {
				...s.managerUiState,
				conflictDialog:
					s.managerUiState.conflictDialog?.calendarId === calendarId
						? null
						: s.managerUiState.conflictDialog,
				editStateById: {
					...s.managerUiState.editStateById,
					[calendarId]: { ...current, errors: [], isSaving: true },
				},
			},
		};
	});

	try {
		await ctx.calendarRepo.updateCalendar(calendarId, updates as Partial<CalendarSchema>);
		await ctx.refreshCalendarData();

		const updatedSchema = ctx.getCalendarSchema(calendarId) ?? schema;
		const nextDraft = createCalendarDraftFromSchema(updatedSchema);
		const warnings = ctx.computeEditWarnings(updatedSchema, nextDraft);

		ctx.store.update(s => {
			const current = s.managerUiState.editStateById[calendarId];
			if (!current) {
				return s;
			}
			return {
				...s,
				managerUiState: {
					...s.managerUiState,
					editStateById: {
						...s.managerUiState.editStateById,
						[calendarId]: {
							draft: nextDraft,
							warnings,
							errors: [],
							isSaving: false,
						},
					},
				},
			};
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to update calendar";
		const code = isCalendarGatewayError(error) ? error.code : "io_error";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.updateCalendar",
			scope: "calendar",
			code,
			error,
			context: { calendarId },
		});
		ctx.store.update(s => {
			const current = s.managerUiState.editStateById[calendarId];
			if (!current) {
				return s;
			}
			return {
				...s,
				managerUiState: {
					...s.managerUiState,
					editStateById: {
						...s.managerUiState.editStateById,
						[calendarId]: { ...current, errors: [message], isSaving: false },
					},
				},
			};
		});
	}
}

// ============================================================================
// Calendar Deletion
// ============================================================================

/**
 * Request to delete a calendar (shows confirmation dialog).
 */
export async function handleCalendarDeleteRequested(
	ctx: AlmanacHandlerContext,
	calendarId: string
): Promise<void> {
	const state = ctx.store.get();
	const schema = ctx.getCalendarSchema(calendarId);
	if (!schema) {
		return;
	}

	// Note: phenomenaDefinitions needs to be passed via context
	// For now, documenting as blocker
	const linkedPhenomena: string[] = [];
	// const linkedPhenomena = ctx.phenomenaDefinitions
	//     .filter(phenomenon => phenomenon.appliesToCalendarIds.includes(calendarId))
	//     .map(phenomenon => phenomenon.name);

	const linkedTravelIds = await ctx.collectTravelDefaultIds(calendarId);
	const requiresFallback = state.calendarState.defaultCalendarId === calendarId;

	ctx.store.update(s => ({
		...s,
		managerUiState: {
			...s.managerUiState,
			deleteDialog: {
				calendarId,
				calendarName: schema.name,
				requiresFallback,
				linkedTravelIds,
				linkedPhenomena,
				isDeleting: false,
				error: undefined,
			},
		},
	}));
}

/**
 * Cancel calendar deletion.
 */
export function handleCalendarDeleteCancelled(ctx: AlmanacHandlerContext): void {
	ctx.store.update(s => ({
		...s,
		managerUiState: {
			...s.managerUiState,
			deleteDialog: null,
		},
	}));
}

/**
 * Confirm and execute calendar deletion.
 */
export async function handleCalendarDeleteConfirmed(
	ctx: AlmanacHandlerContext,
	calendarId: string
): Promise<void> {
	const state = ctx.store.get();
	const dialog = state.managerUiState.deleteDialog;
	if (!dialog || dialog.calendarId !== calendarId) {
		return;
	}

	if (dialog.linkedPhenomena.length > 0) {
		const message = "Calendar is linked to phenomena and cannot be deleted.";
		ctx.store.update(s => ({
			...s,
			managerUiState: {
				...s.managerUiState,
				conflictDialog: {
					calendarId,
					kind: "delete",
					message,
					details: dialog.linkedPhenomena,
				},
				deleteDialog: { ...dialog, error: message },
			},
		}));
		return;
	}

	const currentState = ctx.store.get();
	const fallbackCandidate =
		currentState.calendarState.calendars.find(schema => schema.id !== calendarId)?.id ?? null;
	if (dialog.requiresFallback && !fallbackCandidate) {
		const message = "Cannot delete the last remaining calendar.";
		ctx.store.update(s => ({
			...s,
			managerUiState: {
				...s.managerUiState,
				conflictDialog: {
					calendarId,
					kind: "delete",
					message,
					details: [],
				},
				deleteDialog: { ...dialog, error: message },
			},
		}));
		return;
	}

	ctx.store.update(s => ({
		...s,
		managerUiState: {
			...s.managerUiState,
			deleteDialog: { ...dialog, isDeleting: true, error: undefined },
		},
	}));

	try {
		const defaultsRepo = ctx.getCalendarDefaultsRepository();
		if (defaultsRepo) {
			for (const travelId of dialog.linkedTravelIds) {
				await defaultsRepo.clearTravelDefault(travelId);
			}
		}

		await ctx.calendarRepo.deleteCalendar(calendarId);

		if (dialog.requiresFallback && fallbackCandidate) {
			await ctx.gateway.setDefaultCalendar(fallbackCandidate, { scope: "global" });
		}

		const stateBeforeFallback = ctx.store.get();
		if (stateBeforeFallback.calendarState.activeCalendarId === calendarId && fallbackCandidate) {
			await ctx.gateway.setActiveCalendar(fallbackCandidate);
		}

		await ctx.refreshCalendarData();

		ctx.store.update(s => {
			const { [calendarId]: _removed, ...rest } = s.managerUiState.editStateById;
			return {
				...s,
				managerUiState: {
					...s.managerUiState,
					deleteDialog: null,
					conflictDialog: null,
					selection: s.managerUiState.selection.filter(id => id !== calendarId),
					editStateById: rest,
				},
			};
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to delete calendar";
		const code = isCalendarGatewayError(error) ? error.code : "io_error";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.deleteCalendar",
			scope: "calendar",
			code,
			error,
			context: { calendarId },
		});
		ctx.store.update(s => {
			const currentDialog: CalendarDeleteDialogState | null = s.managerUiState.deleteDialog;
			if (!currentDialog || currentDialog.calendarId !== calendarId) {
				return s;
			}
			return {
				...s,
				managerUiState: {
					...s.managerUiState,
					deleteDialog: { ...currentDialog, isDeleting: false, error: message },
				},
			};
		});
	}
}

/**
 * Dismiss conflict dialog.
 */
export function handleConflictDismissed(ctx: AlmanacHandlerContext): void {
	ctx.store.update(s => ({
		...s,
		managerUiState: {
			...s.managerUiState,
			conflictDialog: null,
		},
	}));
}

// ============================================================================
// Calendar Selection & Defaults
// ============================================================================

/**
 * Select (activate) a calendar.
 */
export async function handleCalendarSelect(ctx: AlmanacHandlerContext, calendarId: string): Promise<void> {
	const state = ctx.store.get();
	if (calendarId === state.calendarState.activeCalendarId) {
		return;
	}

	const previousActive = state.calendarState.activeCalendarId;

	ctx.store.update(s => ({
		...s,
		calendarState: {
			...s.calendarState,
			activeCalendarId: calendarId,
			isPersisting: true,
		},
		almanacUiState: {
			...s.almanacUiState,
			error: undefined,
		},
	}));

	try {
		const existingTimestamp = state.calendarState.currentTimestamp;
		const timestamp = existingTimestamp?.calendarId === calendarId ? existingTimestamp : undefined;
		await ctx.gateway.setActiveCalendar(calendarId, { initialTimestamp: timestamp ?? undefined });
		await ctx.refreshCalendarData();
		const currentState = ctx.store.get();
		const currentTimestamp = currentState.calendarState.currentTimestamp;
		if (currentTimestamp) {
			const zoom = ctx.mapCalendarViewModeToZoom(currentState.calendarViewState.mode);
			ctx.store.update(s => ({
				...s,
				managerUiState: {
					...s.managerUiState,
					anchorTimestamp: currentTimestamp,
					agendaItems: zoom ? ctx.collectAgendaItems(currentTimestamp, zoom) : s.managerUiState.agendaItems,
					jumpPreview: [],
				},
			}));
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Kalender konnte nicht gesetzt werden";
		const code = isCalendarGatewayError(error) ? error.code : "io_error";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.setActiveCalendar",
			scope: ctx.travelId ? "travel" : "calendar",
			code,
			error,
			context: { calendarId, travelId: ctx.travelId },
		});
		ctx.store.update(s => ({
			...s,
			calendarState: {
				...s.calendarState,
				activeCalendarId: previousActive ?? null,
				isPersisting: false,
			},
			almanacUiState: {
				...s.almanacUiState,
				error: message,
			},
		}));
	}
}

/**
 * Set a calendar as the global default.
 */
export async function handleCalendarDefault(
	ctx: AlmanacHandlerContext,
	calendarId: string
): Promise<void> {
	const state = ctx.store.get();
	const previousDefault = state.calendarState.defaultCalendarId ?? null;

	ctx.store.update(s => ({
		...s,
		calendarState: {
			...s.calendarState,
			isPersisting: true,
		},
		almanacUiState: {
			...s.almanacUiState,
			error: undefined,
		},
	}));

	try {
		await ctx.gateway.setDefaultCalendar(calendarId, { scope: "global" });
		await ctx.refreshCalendarData();
		ctx.store.update(s => ({
			...s,
			calendarState: {
				...s.calendarState,
				defaultCalendarId: calendarId,
				calendars: s.calendarState.calendars.map(schema =>
					schema.id === calendarId
						? { ...schema, isDefaultGlobal: true }
						: { ...schema, isDefaultGlobal: false }
				),
			},
		}));
		emitAlmanacEvent({
			type: "calendar.default.change",
			scope: "global",
			calendarId,
			previousDefaultId: previousDefault,
			travelId: ctx.travelId,
			wasAutoSelected: false,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Standardkalender konnte nicht aktualisiert werden";
		const code = isCalendarGatewayError(error) ? error.code : "io_error";
		reportAlmanacGatewayIssue({
			operation: "stateMachine.setDefault",
			scope: "default",
			code,
			error,
			context: { calendarId, travelId: ctx.travelId },
		});
		ctx.store.update(s => ({
			...s,
			calendarState: {
				...s.calendarState,
				isPersisting: false,
			},
			almanacUiState: {
				...s.almanacUiState,
				error: message,
			},
		}));
	}
}
