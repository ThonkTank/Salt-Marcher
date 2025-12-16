/**
 * Persistent storage for Event Inbox state (read events, filters)
 *
 * Manages inbox-specific state that persists to the vault:
 * - Read/unread event tracking
 * - Active filter preferences
 * - Last interaction timestamp
 *
 * Storage location: SaltMarcher/Almanac/inbox-state.json
 * Part of Phase 13 Priority 5 - Event Inbox
 */

import { DEFAULT_INBOX_FILTERS } from '../helpers/inbox-filters';
import { JsonStore, type VaultLike } from './json-store';
import type { InboxFilters, InboxPriorityLevel } from '../helpers/inbox-filters';

/**
 * Inbox state structure for persistence
 */
export interface InboxState {
	/**
	 * Event IDs that have been marked as read
	 */
	readonly readEventIds: ReadonlyArray<string>;

	/**
	 * Active filter settings
	 */
	readonly filters: InboxFilters;

	/**
	 * Timestamp of last inbox interaction (ISO 8601)
	 */
	readonly lastInteraction?: string;
}

/**
 * In-memory inbox state with Set for efficient lookups
 */
export interface InboxStateRuntime {
	/**
	 * Read event IDs as a Set for O(1) lookup
	 */
	readonly readEventIds: ReadonlySet<string>;

	/**
	 * Active filter settings
	 */
	readonly filters: InboxFilters;

	/**
	 * Timestamp of last inbox interaction
	 */
	readonly lastInteraction?: Date;
}

/**
 * Creates initial inbox state (no events read, default filters)
 */
function createInitialInboxState(): InboxState {
	return {
		readEventIds: [],
		filters: DEFAULT_INBOX_FILTERS,
		lastInteraction: undefined,
	};
}

/**
 * Converts stored state to runtime state (array → Set)
 */
export function hydrateInboxState(stored: InboxState): InboxStateRuntime {
	return {
		readEventIds: new Set(stored.readEventIds),
		filters: stored.filters,
		lastInteraction: stored.lastInteraction ? new Date(stored.lastInteraction) : undefined,
	};
}

/**
 * Converts runtime state to storable state (Set → array)
 */
export function dehydrateInboxState(runtime: InboxStateRuntime): InboxState {
	return {
		readEventIds: Array.from(runtime.readEventIds),
		filters: runtime.filters,
		lastInteraction: runtime.lastInteraction?.toISOString(),
	};
}

/**
 * Normalizes potentially incomplete stored state
 */
function normalizeInboxState(partial: Partial<InboxState> | null | undefined): InboxState {
	if (!partial || typeof partial !== 'object') {
		return createInitialInboxState();
	}

	return {
		readEventIds: Array.isArray(partial.readEventIds)
			? partial.readEventIds.filter((id): id is string => typeof id === 'string')
			: [],
		filters: normalizeFilters(partial.filters),
		lastInteraction: typeof partial.lastInteraction === 'string' ? partial.lastInteraction : undefined,
	};
}

/**
 * Normalizes filter object to ensure all required fields
 */
function normalizeFilters(partial: Partial<InboxFilters> | null | undefined): InboxFilters {
	if (!partial || typeof partial !== 'object') {
		return DEFAULT_INBOX_FILTERS;
	}

	return {
		priorities: Array.isArray(partial.priorities)
			? partial.priorities.filter(
					(p): p is InboxPriorityLevel =>
						p === 'low' || p === 'normal' || p === 'high' || p === 'urgent'
			  )
			: [],
		categories: Array.isArray(partial.categories)
			? partial.categories.filter((c): c is string => typeof c === 'string')
			: [],
		timeRange:
			partial.timeRange === 'today' ||
			partial.timeRange === 'week' ||
			partial.timeRange === 'month' ||
			partial.timeRange === 'all'
				? partial.timeRange
				: 'all',
		showRead: typeof partial.showRead === 'boolean' ? partial.showRead : false,
	};
}

/**
 * Creates JsonStore for inbox state persistence
 */
export function createInboxStateStore(vault: VaultLike): JsonStore<InboxState> {
	return new JsonStore<InboxState>(vault, {
		path: 'SaltMarcher/Almanac/inbox-state.json',
		currentVersion: '1.0.0',
		initialData: createInitialInboxState,
	});
}

/**
 * Loads inbox state from vault (hydrated for runtime use)
 */
export async function loadInboxState(store: JsonStore<InboxState>): Promise<InboxStateRuntime> {
	const stored = await store.read();
	const normalized = normalizeInboxState(stored);
	return hydrateInboxState(normalized);
}

/**
 * Saves inbox state to vault (dehydrates runtime state)
 */
export async function saveInboxState(
	store: JsonStore<InboxState>,
	runtime: InboxStateRuntime
): Promise<void> {
	const storable = dehydrateInboxState(runtime);
	await store.update(() => storable);
}

/**
 * Marks an event as read
 */
export async function markEventRead(
	store: JsonStore<InboxState>,
	eventId: string
): Promise<InboxStateRuntime> {
	const current = await loadInboxState(store);
	const updated: InboxStateRuntime = {
		...current,
		readEventIds: new Set([...current.readEventIds, eventId]),
		lastInteraction: new Date(),
	};
	await saveInboxState(store, updated);
	return updated;
}

/**
 * Marks an event as unread
 */
export async function markEventUnread(
	store: JsonStore<InboxState>,
	eventId: string
): Promise<InboxStateRuntime> {
	const current = await loadInboxState(store);
	const updatedIds = new Set(current.readEventIds);
	updatedIds.delete(eventId);
	const updated: InboxStateRuntime = {
		...current,
		readEventIds: updatedIds,
		lastInteraction: new Date(),
	};
	await saveInboxState(store, updated);
	return updated;
}

/**
 * Updates inbox filter preferences
 */
export async function updateInboxFilters(
	store: JsonStore<InboxState>,
	filters: InboxFilters
): Promise<InboxStateRuntime> {
	const current = await loadInboxState(store);
	const updated: InboxStateRuntime = {
		...current,
		filters,
		lastInteraction: new Date(),
	};
	await saveInboxState(store, updated);
	return updated;
}
