// src/workmodes/almanac/view/event-inbox-panel.ts
// Event Inbox panel for filtering and managing calendar events (Phase 2 Wave 3B)
//
// Features:
// - Priority filtering (Urgent/High/Normal/Low)
// - Time range filtering (Today/Week/Month/All)
// - Read/unread states (in-memory, persistence TODO)
// - Mark as read on click
// - Event count badge
// - Priority-colored indicators

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-event-inbox');
import { formatTimestamp, getEventAnchorTimestamp } from '../helpers';
import { mapPriorityToLevel, countUnreadEvents, filterInboxEvents } from '../helpers/inbox-filters';
import { createCollapsiblePanelState, createCollapseToggleButton } from './panel-collapse-util';
import type { CalendarStateGateway } from '../data/calendar-state-gateway';
import type { CalendarEvent, CalendarSchema, CalendarTimestamp } from '../helpers';
import type { InboxFilters, InboxPriorityLevel, InboxTimeRange } from '../helpers/inbox-filters';

export interface EventInboxPanelOptions {
	readonly gateway: CalendarStateGateway;
	readonly currentTimestamp: CalendarTimestamp;
	readonly schema: CalendarSchema;
	readonly onEventClick?: (event: CalendarEvent) => void;
}

export interface EventInboxPanelHandle {
	update(timestamp: CalendarTimestamp, schema: CalendarSchema): Promise<void>;
	refresh(): Promise<void>;
	destroy(): void;
	readonly root: HTMLElement;
}

const PRIORITY_LABELS: Record<InboxPriorityLevel, string> = {
	urgent: 'Dringend',
	high: 'Hoch',
	normal: 'Normal',
	low: 'Niedrig',
};

const TIME_RANGE_LABELS: Record<InboxTimeRange, string> = {
	today: 'Heute',
	week: 'Woche',
	month: 'Monat',
	all: 'Alle',
};

/**
 * Create Event Inbox Panel
 *
 * Provides a sidebar panel showing upcoming events with:
 * - Priority filtering (Urgent/High/Normal/Low)
 * - Time range filtering (Today/Week/Month/All)
 * - Read/unread states
 * - Event count badge
 * - Priority-colored indicators
 *
 * Phase 2 Wave 3B Implementation
 */
export function createEventInboxPanel(
	container: HTMLElement,
	options: EventInboxPanelOptions
): EventInboxPanelHandle {
	const { gateway, onEventClick } = options;
	let currentTimestamp = options.currentTimestamp;
	let schema = options.schema;

	const root = container.createDiv({ cls: 'sm-event-inbox-panel' });

	// Phase 2: Use collapsible panel utility
	const collapseState = createCollapsiblePanelState({
		panelId: 'inbox',
		defaultCollapsed: false,
	});

	// Phase 2: Load filters from localStorage
	const FILTERS_STORAGE_KEY = 'sm-almanac-inbox-filters';
	let currentFilters: InboxFilters = loadFiltersFromStorage();

	let events: CalendarEvent[] = [];
	let readEventIds: Set<string> = new Set();

	logger.info('Creating event inbox panel', {
		calendarId: schema.id,
		filters: currentFilters
	});

	async function loadEvents(): Promise<void> {
		try {
			// Load snapshot to get upcoming events
			const snapshot = await gateway.loadSnapshot();
			events = [...(snapshot.upcomingEvents as CalendarEvent[])];

			logger.info('Loaded events', { count: events.length });
		} catch (error) {
			logger.error('Failed to load events', { error });
			events = [];
		}
	}

	async function renderPanel(): Promise<void> {
		root.empty();

		await loadEvents();

		// Apply filters
		const filteredEvents = filterInboxEvents(
			events,
			currentFilters,
			readEventIds,
			currentTimestamp,
			schema
		);

		const unreadCount = countUnreadEvents(filteredEvents, readEventIds);

		// Header with collapse toggle and unread count
		const header = root.createDiv({ cls: 'sm-event-inbox-panel__header' });

		// Phase 2: Use collapse toggle utility
		const collapseBtn = createCollapseToggleButton(collapseState, () => void renderPanel());
		collapseBtn.classList.add('sm-event-inbox-panel__collapse-btn');
		header.appendChild(collapseBtn);

		const titleContainer = header.createDiv({ cls: 'sm-event-inbox-panel__title-container' });
		titleContainer.createEl('h3', {
			text: 'Ereignis-Postfach',
			cls: 'sm-event-inbox-panel__title',
		});

		if (unreadCount > 0) {
			titleContainer.createEl('span', {
				text: unreadCount.toString(),
				cls: 'sm-event-inbox-panel__badge',
			});
		}

		// Stop here if collapsed
		if (collapseState.isCollapsed) {
			return;
		}

		// Filter controls
		const filterBar = root.createDiv({ cls: 'sm-event-inbox-panel__filters' });
		renderFilters(filterBar);

		// Event list
		const eventList = root.createDiv({ cls: 'sm-event-inbox-panel__list' });
		if (filteredEvents.length === 0) {
			eventList.createDiv({
				text: 'Keine Ereignisse gefunden',
				cls: 'sm-event-inbox-panel__empty',
			});
		} else {
			renderEventList(eventList, filteredEvents);
		}
	}

	function renderFilters(container: HTMLElement): void {
		// Priority filter buttons
		const priorityGroup = container.createDiv({ cls: 'sm-event-inbox-panel__filter-group' });
		priorityGroup.createSpan({ text: 'Priorität:', cls: 'sm-event-inbox-panel__filter-label' });

		const priorityLevels: InboxPriorityLevel[] = ['urgent', 'high', 'normal', 'low'];
		for (const level of priorityLevels) {
			const btn = priorityGroup.createEl('button', {
				cls: 'sm-event-inbox-panel__filter-btn',
				text: PRIORITY_LABELS[level],
			});

			if (currentFilters.priorities.includes(level)) {
				btn.addClass('is-active');
			}

			btn.addEventListener('click', async () => {
				// Toggle priority in filter
				const priorities = currentFilters.priorities.includes(level)
					? currentFilters.priorities.filter(p => p !== level)
					: [...currentFilters.priorities, level];

				currentFilters = { ...currentFilters, priorities };
				saveFiltersToStorage(currentFilters); // Phase 2: Persist to localStorage
				logger.info('Priority filter toggled', { level, active: priorities.includes(level) });
				await renderPanel();
			});
		}

		// Time range buttons
		const timeGroup = container.createDiv({ cls: 'sm-event-inbox-panel__filter-group' });
		timeGroup.createSpan({ text: 'Zeitraum:', cls: 'sm-event-inbox-panel__filter-label' });

		const timeRanges: InboxTimeRange[] = ['today', 'week', 'month', 'all'];
		for (const range of timeRanges) {
			const btn = timeGroup.createEl('button', {
				cls: 'sm-event-inbox-panel__filter-btn',
				text: TIME_RANGE_LABELS[range],
			});

			if (currentFilters.timeRange === range) {
				btn.addClass('is-active');
			}

			btn.addEventListener('click', async () => {
				currentFilters = { ...currentFilters, timeRange: range };
				saveFiltersToStorage(currentFilters); // Phase 2: Persist to localStorage
				logger.info('Time range filter changed', { range });
				await renderPanel();
			});
		}

		// Show read toggle
		const toggleGroup = container.createDiv({ cls: 'sm-event-inbox-panel__filter-group' });
		const showReadBtn = toggleGroup.createEl('button', {
			cls: 'sm-event-inbox-panel__filter-btn',
			text: currentFilters.showRead ? '👁️ Gelesene ausblenden' : '👁️ Gelesene anzeigen',
		});

		if (currentFilters.showRead) {
			showReadBtn.addClass('is-active');
		}

		showReadBtn.addEventListener('click', async () => {
			currentFilters = { ...currentFilters, showRead: !currentFilters.showRead };
			saveFiltersToStorage(currentFilters); // Phase 2: Persist to localStorage
			logger.info('Show read filter toggled', { showRead: currentFilters.showRead });
			// TODO: Persist filters to gateway when API is available
			await renderPanel();
		});
	}

	function renderEventList(container: HTMLElement, filteredEvents: CalendarEvent[]): void {
		for (const event of filteredEvents) {
			const priorityLevel = mapPriorityToLevel(event.priority);
			const isRead = readEventIds.has(event.id);

			const item = container.createDiv({
				cls: 'sm-event-inbox-panel__item',
				attr: { 'data-event-id': event.id }
			});

			if (!isRead) {
				item.addClass('is-unread');
			}

			// Set priority level as data attribute for CSS styling
			item.setAttribute('data-priority', priorityLevel);

			// Priority indicator
			const indicator = item.createDiv({
				cls: 'sm-event-inbox-panel__priority-icon',
			});
			indicator.setAttribute('data-priority', priorityLevel);

			// Event content
			const content = item.createDiv({ cls: 'sm-event-inbox-panel__item-content' });

			// Event title
			content.createDiv({
				text: event.title,
				cls: 'sm-event-inbox-panel__item-title',
			});

			// Event date/time
			const eventTimestamp = getEventAnchorTimestamp(event) ?? event.date;
			content.createDiv({
				text: formatTimestamp(schema, eventTimestamp),
				cls: 'sm-event-inbox-panel__item-time',
			});

			// Event category (if present)
			if (event.category) {
				content.createDiv({
					text: event.category,
					cls: 'sm-event-inbox-panel__item-category',
				});
			}

			// Click to open editor and mark as read
			item.addEventListener('click', async () => {
				if (!isRead) {
					readEventIds.add(event.id);
					logger.info('Marked event as read', { eventId: event.id });
					// TODO: Persist read state to gateway when API is available
					await renderPanel();
				}
				if (onEventClick) {
					onEventClick(event);
				}
			});

			// Right-click to toggle read state
			item.addEventListener('contextmenu', async (e) => {
				e.preventDefault();
				if (isRead) {
					readEventIds.delete(event.id);
					logger.info('Marked event as unread', { eventId: event.id });
				} else {
					readEventIds.add(event.id);
					logger.info('Marked event as read', { eventId: event.id });
				}
				// TODO: Persist read state to gateway when API is available
				await renderPanel();
			});
		}
	}

	// Phase 2: Helper functions for filter persistence
	function loadFiltersFromStorage(): InboxFilters {
		try {
			const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
			if (!stored) {
				// Return defaults
				return {
					priorities: ['urgent', 'high', 'normal', 'low'],
					categories: [],
					timeRange: 'week',
					showRead: false,
				};
			}

			const parsed = JSON.parse(stored);
			return {
				priorities: Array.isArray(parsed.priorities) ? parsed.priorities : ['urgent', 'high', 'normal', 'low'],
				categories: Array.isArray(parsed.categories) ? parsed.categories : [],
				timeRange: parsed.timeRange || 'week',
				showRead: parsed.showRead === true,
			};
		} catch (error) {
			logger.error('Failed to load filters from storage', { error });
			// Return defaults on error
			return {
				priorities: ['urgent', 'high', 'normal', 'low'],
				categories: [],
				timeRange: 'week',
				showRead: false,
			};
		}
	}

	function saveFiltersToStorage(filters: InboxFilters): void {
		try {
			localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
			logger.info('Saved filters to storage', { filters });
		} catch (error) {
			logger.error('Failed to save filters to storage', { error });
		}
	}

	// Initial render
	void renderPanel();

	return {
		async update(timestamp: CalendarTimestamp, calendarSchema: CalendarSchema): Promise<void> {
			currentTimestamp = timestamp;
			schema = calendarSchema;
			logger.info('Updating panel', { timestamp, calendarId: schema.id });
			await renderPanel();
		},
		async refresh(): Promise<void> {
			logger.info('Refreshing panel');
			await renderPanel();
		},
		destroy(): void {
			logger.info('Destroying panel');
			collapseState.destroy();
			root.remove();
		},
		get root(): HTMLElement {
			return root;
		}
	};
}
