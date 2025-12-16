/**
 * Phenomenon Handlers
 *
 * Pure functions for managing phenomena (recurring events).
 * Extracted from state-machine.ts as part of Phase 2 refactoring.
 *
 * @module workmodes/almanac/handlers
 */

import type { PhenomenonHandlerContext } from './calendar-types';
import { reportAlmanacGatewayIssue, emitAlmanacEvent } from "../telemetry";
import { AlmanacRepositoryError } from "../data/repositories";
import type { EventsFilterState, EventsViewMode, PhenomenonEditorDraft } from "../mode/contracts";

// ============================================================================
// View Mode Handler
// ============================================================================

/**
 * Handles changes to the events view mode (timeline/table/map).
 *
 * Persists the preference and ensures phenomenon selection is valid.
 */
export async function handleEventsViewMode(
	ctx: PhenomenonHandlerContext,
	viewMode: "timeline" | "table" | "map",
): Promise<void> {
	const state = ctx.store.get();

	if (viewMode === state.eventsUiState.viewMode) {
		return;
	}

	ctx.store.update(s => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			viewMode,
			error: undefined,
		},
	}));

	await ctx.persistPreferences({ eventsViewMode: viewMode });

	// Ensure phenomenon selection is valid after view mode change
	const updatedState = ctx.store.get();
	if (updatedState.almanacUiState.mode === "events") {
		ensurePhenomenonSelection(ctx);
	}
}

// ============================================================================
// Filter Handler
// ============================================================================

/**
 * Handles changes to the events filter state (categories/calendars).
 *
 * Normalizes filters, applies them to phenomena, and updates selection/markers.
 */
export function handleEventsFilterChange(
	ctx: PhenomenonHandlerContext,
	filters: EventsFilterState,
): void {
	const state = ctx.store.get();

	// Normalize filters (remove duplicates/empty values)
	const normalised: EventsFilterState = {
		categories: Array.from(new Set(filters.categories.filter(Boolean))),
		calendarIds: Array.from(new Set(filters.calendarIds.filter(Boolean))),
	};

	const filteredPhenomena = ctx.applyPhenomenaFilters(normalised);
	const filterCount = normalised.categories.length + normalised.calendarIds.length;
	const selectedCandidate = state.eventsUiState.selectedPhenomenonId ?? null;
	const calendars = state.calendarState.calendars;
	const referenceTimestamp = state.calendarState.currentTimestamp;

	let nextSelectedId: string | null = null;
	let nextDetail = null;

	// Try to keep current selection if it's still visible
	if (selectedCandidate && filteredPhenomena.some(item => item.id === selectedCandidate)) {
		nextDetail = ctx.buildPhenomenonDetailForId(selectedCandidate, calendars, referenceTimestamp);
		nextSelectedId = nextDetail ? selectedCandidate : null;
	}

	// Fallback: select first phenomenon
	if (!nextSelectedId && filteredPhenomena.length > 0) {
		const firstId = filteredPhenomena[0].id;
		nextDetail = ctx.buildPhenomenonDetailForId(firstId, calendars, referenceTimestamp);
		nextSelectedId = nextDetail ? firstId : null;
	}

	const mapMarkers = ctx.buildPhenomenonMapMarkers(filteredPhenomena, calendars);

	ctx.store.update(s => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			filters: normalised,
			filterCount,
			mapMarkers,
			phenomena: filteredPhenomena,
			selectedPhenomenonId: nextSelectedId,
			selectedPhenomenonDetail: nextDetail,
			isDetailLoading: false,
		},
	}));

	void ctx.persistPreferences({
		eventsFilters: normalised,
		lastSelectedPhenomenonId: nextSelectedId ?? undefined,
	});
}

// ============================================================================
// Selection Handlers
// ============================================================================

/**
 * Handles phenomenon selection by ID.
 *
 * Loads the full phenomenon from repository, rebuilds detail view,
 * and updates the phenomena definitions cache.
 */
export async function handlePhenomenonSelected(
	ctx: PhenomenonHandlerContext,
	phenomenonId: string,
): Promise<void> {
	const state = ctx.store.get();

	ctx.store.update(s => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			selectedPhenomenonId: phenomenonId,
			isDetailLoading: true,
			error: undefined,
		},
	}));

	try {
		const phenomenonDto = await ctx.phenomenonRepo.getPhenomenon(phenomenonId);
		if (!phenomenonDto) {
			throw new Error(`Phenomenon ${phenomenonId} not found`);
		}

		const normalised = ctx.toPhenomenon(phenomenonDto);

		// Update phenomena definitions cache
		ctx.setPhenomenaDefinitions([
			...ctx.phenomenaDefinitions.filter(item => item.id !== normalised.id),
			normalised,
		]);

		// Build detail view
		const detail = ctx.buildPhenomenonDetailForId(
			phenomenonId,
			state.calendarState.calendars,
			state.calendarState.currentTimestamp,
		);

		ctx.store.update(s => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				selectedPhenomenonId: phenomenonId,
				selectedPhenomenonDetail: detail,
				isDetailLoading: false,
			},
		}));

		await ctx.persistPreferences({ lastSelectedPhenomenonId: phenomenonId });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Phenomenon could not be loaded";

		ctx.store.update(s => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				selectedPhenomenonId: null,
				selectedPhenomenonDetail: null,
				isDetailLoading: false,
				error: message,
			},
		}));

		await ctx.persistPreferences({ lastSelectedPhenomenonId: undefined });
	}
}

/**
 * Handles closing the phenomenon detail view.
 *
 * Clears selection and persists the preference.
 */
export function handlePhenomenonDetailClosed(ctx: PhenomenonHandlerContext): void {
	ctx.store.update(s => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			selectedPhenomenonId: null,
			selectedPhenomenonDetail: null,
			isDetailLoading: false,
		},
	}));

	void ctx.persistPreferences({ lastSelectedPhenomenonId: undefined });
}

/**
 * Handles bulk selection of phenomena.
 *
 * Validates IDs against current phenomena and updates bulk selection state.
 */
export function handleEventsBulkSelection(
	ctx: PhenomenonHandlerContext,
	selection: ReadonlyArray<string>,
): void {
	const validIds = new Set(ctx.phenomenaDefinitions.map(item => item.id));
	const unique = Array.from(new Set(selection)).filter(id => validIds.has(id));

	ctx.store.update(s => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			bulkSelection: unique,
		},
	}));
}

// ============================================================================
// Editor Handlers
// ============================================================================

/**
 * Handles phenomenon edit requests (create or edit).
 *
 * Opens the editor with a draft, loading phenomenon from repository if needed.
 */
export async function handlePhenomenonEditRequest(
	ctx: PhenomenonHandlerContext,
	phenomenonId: string | null,
): Promise<void> {
	const base = phenomenonId
		? ctx.phenomenaDefinitions.find(item => item.id === phenomenonId) ?? null
		: null;

	const draft = base
		? ctx.createEditorDraftFromPhenomenon(base)
		: ctx.createDefaultEditorDraft(phenomenonId);

	ctx.store.update(s => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isEditorOpen: true,
			editorDraft: draft,
			isSaving: false,
			editorError: undefined,
		},
	}));

	// Load full phenomenon from repository if not in cache
	if (phenomenonId && !base) {
		try {
			const loaded = await ctx.phenomenonRepo.getPhenomenon(phenomenonId);
			if (!loaded) {
				throw new Error(`Phenomenon ${phenomenonId} not found`);
			}

			const normalised = ctx.toPhenomenon(loaded);

			// Update cache
			ctx.setPhenomenaDefinitions([
				...ctx.phenomenaDefinitions.filter(item => item.id !== normalised.id),
				normalised,
			]);

			// Update draft with loaded data
			ctx.store.update(s => ({
				...s,
				eventsUiState: {
					...s.eventsUiState,
					editorDraft: ctx.createEditorDraftFromPhenomenon(normalised),
				},
			}));
		} catch (error) {
			const message = error instanceof Error ? error.message : "Editor konnte nicht geöffnet werden";

			ctx.store.update(s => ({
				...s,
				eventsUiState: {
					...s.eventsUiState,
					editorError: message,
				},
			}));
		}
	}
}

/**
 * Handles canceling phenomenon editor.
 *
 * Closes the editor and clears draft/errors.
 */
export function handlePhenomenonEditCancelled(ctx: PhenomenonHandlerContext): void {
	ctx.store.update(s => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isEditorOpen: false,
			editorDraft: null,
			isSaving: false,
			editorError: undefined,
		},
	}));
}

/**
 * Handles saving phenomenon draft.
 *
 * Validates draft, saves to repository, updates cache, and rebuilds phenomena listing.
 */
export async function handlePhenomenonSave(
	ctx: PhenomenonHandlerContext,
	draft: PhenomenonEditorDraft,
): Promise<void> {
	const state = ctx.store.get();

	// Validate name
	const trimmedName = draft.name.trim();
	if (!trimmedName) {
		ctx.store.update(s => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				editorError: "Name darf nicht leer sein.",
			},
		}));
		return;
	}

	ctx.store.update(s => ({
		...s,
		eventsUiState: {
			...s.eventsUiState,
			isSaving: true,
			editorError: undefined,
		},
	}));

	try {
		const existing = ctx.phenomenaDefinitions.find(item => item.id === draft.id) ?? null;
		const dto = ctx.buildPhenomenonFromDraft(draft, existing);
		const stored = await ctx.phenomenonRepo.upsertPhenomenon(dto);
		const normalised = ctx.toPhenomenon(stored);

		// Update phenomena definitions cache
		ctx.setPhenomenaDefinitions([
			...ctx.phenomenaDefinitions.filter(item => item.id !== normalised.id),
			normalised,
		]);

		// Rebuild phenomena listing with updated definition
		ctx.rebuildPhenomenaListing(normalised.id, {
			bulkSelection: state.eventsUiState.bulkSelection,
			exportPayload: state.eventsUiState.lastExportPayload ?? undefined,
			importSummary: state.eventsUiState.importSummary ?? null,
		});

		// Close editor
		ctx.store.update(s => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isEditorOpen: false,
				editorDraft: null,
				isSaving: false,
				editorError: undefined,
			},
		}));
	} catch (error) {
		const message = error instanceof Error ? error.message : "Speichern fehlgeschlagen";
		const code = error instanceof AlmanacRepositoryError ? error.code : "io_error";

		reportAlmanacGatewayIssue({
			operation: "stateMachine.phenomenon.save",
			scope: "phenomenon",
			code,
			error,
			context: { phenomenonId: draft.id },
		});

		if (error instanceof AlmanacRepositoryError && error.code === "phenomenon_conflict") {
			emitAlmanacEvent({
				type: "calendar.event.conflict",
				code: "phenomenon",
				message,
				context: error.details,
			});
		}

		ctx.store.update(s => ({
			...s,
			eventsUiState: {
				...s.eventsUiState,
				isSaving: false,
				editorError: message,
			},
		}));
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensures a valid phenomenon is selected when in events mode.
 *
 * Internal helper used by view mode change handler.
 */
function ensurePhenomenonSelection(ctx: PhenomenonHandlerContext): void {
	const state = ctx.store.get();
	const phenomena = state.eventsUiState.phenomena;

	// Already have valid selection
	if (state.eventsUiState.selectedPhenomenonId) {
		return;
	}

	// Select first phenomenon if available
	if (phenomena.length > 0) {
		const firstId = phenomena[0].id;
		const detail = ctx.buildPhenomenonDetailForId(
			firstId,
			state.calendarState.calendars,
			state.calendarState.currentTimestamp,
		);

		if (detail) {
			ctx.store.update(s => ({
				...s,
				eventsUiState: {
					...s.eventsUiState,
					selectedPhenomenonId: firstId,
					selectedPhenomenonDetail: detail,
				},
			}));

			void ctx.persistPreferences({ lastSelectedPhenomenonId: firstId });
		}
	}
}
