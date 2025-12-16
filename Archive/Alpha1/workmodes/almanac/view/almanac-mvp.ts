// src/workmodes/almanac/view/almanac-mvp.ts
// MVP implementation of Almanac view - provides basic calendar time management and upcoming events

import type { App } from "obsidian";
import { Notice } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-mvp');
import { searchEvents } from "../helpers/search-engine";
import { createAlmanacToolbar, type AlmanacToolbarHandle } from "./almanac-toolbar";
import { createAstronomicalPanel, type AstronomicalPanelHandle } from "./astronomical-panel";
import { openEventEditor } from "./event-editor-modal";
import { createEventInboxPanel, type EventInboxPanelHandle } from "./event-inbox-panel";
import { openJumpToDateModal } from "./jump-to-date-modal";
import { KeyboardShortcutsHelpModal } from "./almanac-keyboard-shortcuts-help";
import { createMonthViewCalendar, type MonthViewCalendarHandle } from "./month-view-calendar";
import { createQuickAddBar, type QuickAddBarHandle } from "./quick-add-bar";
import { createSearchBar, type SearchBarHandle } from "./search-bar";
import { createSidebarResizeHandle, type SidebarResizeHandleHandle } from "./sidebar-resize-handle";
import { createTimeControlsPanel, type TimeControlsPanelHandle } from "./time-controls-panel";
import { createTimelineViewCalendar, type TimelineViewCalendarHandle } from "./timeline-view-calendar";
import { createUpcomingEventsList, type UpcomingEventsListHandle } from "./upcoming-events-list";
import { createWeekViewCalendar, type WeekViewCalendarHandle } from "./week-view-calendar";
import type { CalendarStateGateway } from "../data/calendar-state-gateway";
import type { CalendarEvent, CalendarSchema } from "../helpers";

/**
 * Almanac MVP Renderer
 *
 * Provides minimal viable product for Almanac:
 * - Current calendar time display
 * - Time advance controls (day/hour/minute)
 * - Upcoming events list (next 7 days)
 * - Month calendar grid with event indicators
 * - Week calendar grid with hourly slots (Phase 13 Priority 3)
 * - Timeline view with chronological entries (Phase 13 Priority 3)
 * - Astronomical panel with moon phases and celestial events (Phase 13 UI - Task 1C)
 * - Event creation via full editor modal (Ctrl+N or + button)
 * - Global keyboard shortcuts (Almanac UI Phase 1 - Task 3B)
 * - Event inbox with priority filtering (Phase 2 Wave 3B)
 *
 * Phase 13 Implementation:
 * - Vault data integration via CalendarStateGateway
 * - Automatic persistence of time advances
 * - Load calendar schema and events from vault
 * - Multiple calendar view types (list, month, week, timeline)
 * - Astronomical cycles visualization (Phase 13 UI - Task 1C)
 * - Full-featured event editor modal
 * - Full keyboard navigation (Almanac UI Phase 1 - Task 3B)
 * - Event inbox panel (Phase 2 Wave 3B)
 *
 * Keyboard Shortcuts (Almanac UI Phase 1 - Task 3B):
 * - View switching: 1-4 keys
 * - Navigation: Arrow keys, T (today), J (jump to date)
 * - Actions: Ctrl+N (new event), / or Ctrl+F (search), ? (help)
 * - Event actions: E (edit), D (delete), Enter (open)
 * - Escape: Clear/close/deselect
 *
 * Future enhancements (deferred to later phases):
 * - Date picker for jump-to-date
 */
export async function renderAlmanacMVP(app: App, container: HTMLElement, gateway: CalendarStateGateway): Promise<(() => void) | void> {
    logger.info("Rendering Almanac MVP with vault integration, astronomical panel, event editor, keyboard shortcuts, and event inbox");

    const root = container.createDiv({ cls: "sm-almanac-mvp" });

    // Load calendar state from vault via gateway
    const snapshot = await gateway.loadSnapshot();

    if (!snapshot.activeCalendar || !snapshot.currentTimestamp) {
        // No calendar configured - show setup notice
        const setupNotice = root.createDiv({ cls: "sm-almanac-mvp__setup-notice" });
        setupNotice.createEl("h3", { text: "Calendar Setup Required" });
        setupNotice.createEl("p", {
            text: "No calendar is configured. Please create a calendar in the Library or import a calendar preset first.",
        });
        logger.warn("No active calendar or current timestamp available");
        return;
    }

    let activeCalendar = snapshot.activeCalendar as CalendarSchema;
    let currentTimestamp = snapshot.currentTimestamp;

    // TODO: Load all available calendars from vault
    // For now, just show the active calendar
    let availableCalendars: CalendarSchema[] = [activeCalendar];

    let eventsList: UpcomingEventsListHandle | null = null;
    let monthView: MonthViewCalendarHandle | null = null;
    let weekView: WeekViewCalendarHandle | null = null;
    let timelineView: TimelineViewCalendarHandle | null = null;
    let astronomicalPanel: AstronomicalPanelHandle | null = null;
    let eventInboxPanel: EventInboxPanelHandle | null = null;
    let sidebarResizeHandle: SidebarResizeHandleHandle | null = null;
    let quickAddBar: QuickAddBarHandle | null = null;
    let timeControlsPanel: TimeControlsPanelHandle | null = null; // Phase 3
    let toolbar: AlmanacToolbarHandle | null = null; // Phase 3
    let currentView: "list" | "month" | "week" | "timeline" = "list";
    let selectedEventId: string | null = null;

    // Almanac UI Phase 1 - Task 3B: Navigation state tracking
    let displayYear = currentTimestamp.year;
    let displayMonthId = currentTimestamp.monthId;

    async function updateAllViews(): Promise<void> {
        toolbar?.update(currentTimestamp, currentView); // Phase 3: Update toolbar
        eventsList?.update(snapshot.upcomingEvents as CalendarEvent[], snapshot.upcomingPhenomena, activeCalendar, currentTimestamp);
        monthView?.update(snapshot.upcomingEvents as CalendarEvent[], snapshot.upcomingPhenomena, activeCalendar, currentTimestamp);
        weekView?.update(snapshot.upcomingEvents as CalendarEvent[], snapshot.upcomingPhenomena, activeCalendar, currentTimestamp);
        timelineView?.update(snapshot.upcomingEvents as CalendarEvent[], snapshot.upcomingPhenomena, activeCalendar, currentTimestamp);

        // Phase 13 UI - Task 1C: Update astronomical panel on time advancement
        await astronomicalPanel?.update(currentTimestamp, activeCalendar);

        // Phase 2 Wave 3B: Update event inbox panel
        await eventInboxPanel?.update(currentTimestamp, activeCalendar);
    }

    // Generic time advance handler factory - DRY principle (LOW #32)
    // Creates specialized handlers for different time units with unified error handling
    function createAdvanceHandler(unit: "day" | "hour" | "minute") {
        return async (amount: number): Promise<void> => {
            logger.info(`Advancing time by ${unit}s`, { amount, unit });
            try {
                const result = await gateway.advanceTimeBy(amount, unit);
                currentTimestamp = result.timestamp;
                await updateAllViews();
            } catch (error) {
                logger.error(`Failed to advance time by ${unit}s`, { error, amount, unit });
                new Notice("Failed to advance time. Check console for details.");
            }
        };
    }

    // Create specialized handlers using the factory
    const handleAdvanceDay = createAdvanceHandler("day");
    const handleAdvanceHour = createAdvanceHandler("hour");
    const handleAdvanceMinute = createAdvanceHandler("minute");

    // Create main layout with sidebar
    const mainLayout = root.createDiv({ cls: "sm-almanac-mvp__layout" });
    const sidebarContainer = mainLayout.createDiv({ cls: "sm-almanac-mvp__sidebar" });
    const contentContainer = mainLayout.createDiv({ cls: "sm-almanac-mvp__content" });

    // Helper function to open event editor modal with proper context
    const openEventEditorModal = () => {
        openEventEditor(app, {
            schema: activeCalendar,
            currentTime: currentTimestamp,
            onSave: async (savedEvent) => {
                logger.info("Event saved from editor", { eventId: savedEvent.id });
                try {
                    await gateway.saveEvent(savedEvent);
                    new Notice(`Event "${savedEvent.title}" saved successfully`);
                    await updateAllViews();
                } catch (error) {
                    logger.error("Failed to save event", { error, eventId: savedEvent.id });
                    new Notice(`Failed to save event: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        });
    };

    // Almanac UI Phase 1 - Task 3B: Global keyboard shortcuts handler
    const handleKeyDown = (e: KeyboardEvent) => {
        // Don't intercept if typing in input field (except Escape)
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            if (e.key === 'Escape') {
                target.blur();
                deselectEvent();
                return;
            }
            return;
        }

        // Don't intercept if modal is open (except Escape for modal close)
        const modalOpen = document.querySelector('.modal');
        if (modalOpen && e.key !== 'Escape') {
            return;
        }

        // View switching (1-4 keys)
        if (e.key === '1' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            switchView("list");
            return;
        }
        if (e.key === '2' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            switchView("month");
            return;
        }
        if (e.key === '3' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            switchView("week");
            return;
        }
        if (e.key === '4' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            switchView("timeline");
            return;
        }

        // Navigation - Arrow keys
        if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            navigatePrevious();
            return;
        }
        if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            navigateNext();
            return;
        }

        // Navigation - Jump to today (T or Ctrl+T)
        if ((e.key === 't' || e.key === 'T')) {
            // Allow both T alone and Ctrl+T
            if (!e.shiftKey) {
                e.preventDefault();
                jumpToToday();
                return;
            }
        }

        // Navigation - Jump to date (J or Ctrl+J) - coming soon
        if ((e.key === 'j' || e.key === 'J') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            jumpToDate();
            return;
        }

        // Calendar selector - Open dropdown (C)
        if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Click the calendar selector button to open dropdown
            const calendarButton = root.querySelector<HTMLButtonElement>('.sm-calendar-selector__button');
            calendarButton?.click();
            return;
        }

        // Actions - New event (N or Ctrl+N)
        if ((e.key === 'n' || e.key === 'N') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            openEventEditorModal();
            return;
        }

        // Actions - Focus search (/ or Ctrl+F) - handled by search-bar component
        // Just prevent default here to avoid conflicts
        if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            // Search bar component handles focusing
            return;
        }

        // Actions - Show keyboard shortcuts help (?)
        if (e.key === '?') {
            e.preventDefault();
            showKeyboardShortcutsHelp();
            return;
        }

        // Event actions (require selected event)
        if (selectedEventId) {
            if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                editSelectedEvent();
                return;
            }
            if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                void deleteSelectedEvent();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                openSelectedEvent();
                return;
            }
        }

        // Escape - Clear everything
        if (e.key === 'Escape') {
            e.preventDefault();
            deselectEvent();
            // Note: Search bar component handles clearing itself
            return;
        }
    };

    // Almanac UI Phase 1 - Task 3B: Navigation helpers
    function navigatePrevious(): void {
        logger.info("Navigating to previous period", { view: currentView });

        if (currentView === 'month') {
            // Navigate to previous month (view-only, doesn't change actual time)
            const monthIndex = activeCalendar.months.findIndex(m => m.id === displayMonthId);
            if (monthIndex > 0) {
                displayMonthId = activeCalendar.months[monthIndex - 1].id;
            } else {
                // Wrap to last month of previous year
                displayYear -= 1;
                displayMonthId = activeCalendar.months[activeCalendar.months.length - 1].id;
            }

            updateAllViews();
            new Notice(`Navigated to previous month`);
        } else if (currentView === 'week') {
            // Navigate to previous week (7 days back)
            handleAdvanceDay(-7);
        } else {
            new Notice('Navigation not available in this view');
        }
    }

    function navigateNext(): void {
        logger.info("Navigating to next period", { view: currentView });

        if (currentView === 'month') {
            // Navigate to next month (view-only, doesn't change actual time)
            const monthIndex = activeCalendar.months.findIndex(m => m.id === displayMonthId);
            if (monthIndex < activeCalendar.months.length - 1) {
                displayMonthId = activeCalendar.months[monthIndex + 1].id;
            } else {
                // Wrap to first month of next year
                displayYear += 1;
                displayMonthId = activeCalendar.months[0].id;
            }

            updateAllViews();
            new Notice(`Navigated to next month`);
        } else if (currentView === 'week') {
            // Navigate to next week (7 days forward)
            handleAdvanceDay(7);
        } else {
            new Notice('Navigation not available in this view');
        }
    }

    async function jumpToToday(): Promise<void> {
        logger.info("Jumping to today");

        try {
            // Get current timestamp from gateway
            const snapshot = await gateway.loadSnapshot();
            if (snapshot.currentTimestamp) {
                currentTimestamp = snapshot.currentTimestamp;
                displayYear = currentTimestamp.year;
                displayMonthId = currentTimestamp.monthId;
                await updateAllViews();
                new Notice('Jumped to today');
            }
        } catch (error) {
            logger.error("Failed to jump to today", { error });
            new Notice("Failed to jump to today. Check console for details.");
        }
    }

    function jumpToDate(): void {
        logger.info("Opening jump to date modal");

        // Phase 3: Open jump-to-date modal
        openJumpToDateModal({
            app,
            schema: activeCalendar,
            currentTimestamp,
            onJump: async (newTimestamp) => {
                logger.info("Jumped to new date", { newTimestamp });
                currentTimestamp = newTimestamp;
                displayYear = newTimestamp.year;
                displayMonthId = newTimestamp.monthId;

                try {
                    // Persist new timestamp
                    await gateway.setCurrentTimestamp(newTimestamp);
                    await updateAllViews();
                    new Notice(`Jumped to ${newTimestamp.day} ${activeCalendar.months.find(m => m.id === newTimestamp.monthId)?.name} ${newTimestamp.year}`);
                } catch (error) {
                    logger.error("Failed to jump to date", { error });
                    new Notice("Failed to jump to date. Check console for details.");
                }
            }
        });
    }

    // Almanac UI Phase 1 - Task 3B: Event selection helpers
    function editSelectedEvent(): void {
        if (!selectedEventId) return;

        logger.info("Editing selected event", { eventId: selectedEventId });

        // Find event in snapshot
        const event = (snapshot.upcomingEvents as CalendarEvent[]).find(e => e.id === selectedEventId);
        if (!event) {
            new Notice('Event not found');
            return;
        }

        openEventEditor(app, {
            schema: activeCalendar,
            currentTime: currentTimestamp,
            event,
            onSave: async (updatedEvent) => {
                logger.info("Event updated", { eventId: updatedEvent.id });
                try {
                    await gateway.saveEvent(updatedEvent);
                    new Notice(`Event "${updatedEvent.title}" updated successfully`);
                    await updateAllViews();
                } catch (error) {
                    logger.error("Failed to update event", { error, eventId: updatedEvent.id });
                    new Notice(`Failed to update event: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        });
    }

    async function deleteSelectedEvent(): Promise<void> {
        if (!selectedEventId) return;

        const event = (snapshot.upcomingEvents as CalendarEvent[]).find(e => e.id === selectedEventId);
        if (!event) {
            new Notice('Event not found');
            return;
        }

        logger.info("Deleting selected event", { eventId: selectedEventId });

        // Confirmation dialog
        const confirmed = confirm(`Delete event "${event.title}"?`);
        if (!confirmed) return;

        try {
            await gateway.deleteEvent(selectedEventId);
            new Notice(`Event "${event.title}" deleted successfully`);
            deselectEvent();
            await updateAllViews();
        } catch (error) {
            logger.error("Failed to delete event", { error, eventId: selectedEventId });
            new Notice(`Failed to delete event: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    function openSelectedEvent(): void {
        if (!selectedEventId) return;

        logger.info("Opening selected event", { eventId: selectedEventId });

        const event = (snapshot.upcomingEvents as CalendarEvent[]).find(e => e.id === selectedEventId);
        if (!event) {
            new Notice('Event not found');
            return;
        }

        openEventEditor(app, {
            schema: activeCalendar,
            currentTime: currentTimestamp,
            event,
            onSave: async (updatedEvent) => {
                logger.info("Event updated", { eventId: updatedEvent.id });
                try {
                    await gateway.saveEvent(updatedEvent);
                    new Notice(`Event "${updatedEvent.title}" updated successfully`);
                    await updateAllViews();
                } catch (error) {
                    logger.error("Failed to update event", { error, eventId: updatedEvent.id });
                    new Notice(`Failed to update event: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        });
    }

    function deselectEvent(): void {
        if (!selectedEventId) return;

        logger.info("Deselecting event", { eventId: selectedEventId });
        selectedEventId = null;

        // Remove visual selection highlight
        root.querySelectorAll('.is-selected').forEach(el => {
            el.classList.remove('is-selected');
        });
    }

    function showKeyboardShortcutsHelp(): void {
        logger.info("Showing keyboard shortcuts help");
        const modal = new KeyboardShortcutsHelpModal(app);
        modal.open();
    }

    // Attach keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    // Phase 2: Render quick-add bar in sidebar
    const quickAddContainer = sidebarContainer.createDiv({ cls: "sm-almanac-mvp__quick-add-container" });
    quickAddBar = createQuickAddBar(quickAddContainer, {
        app,
        schema: activeCalendar,
        currentTimestamp,
        onEventCreated: async (event) => {
            logger.info("Event created from quick-add", { eventId: event.id });
            try {
                await gateway.saveEvent(event);
                new Notice(`Event "${event.title}" created successfully`);
                await updateAllViews();
            } catch (error) {
                logger.error("Failed to save event from quick-add", { error, eventId: event.id });
                new Notice(`Failed to create event: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    });

    // Almanac UI Phase 1: Render search bar in sidebar
    const searchBarContainer = sidebarContainer.createDiv({ cls: "sm-almanac-mvp__search-container" });
    let searchBarHandle: SearchBarHandle | null = null;
    let searchResults: CalendarEvent[] = [];
    let currentSearchIndex = 0;

    searchBarHandle = createSearchBar(searchBarContainer, {
        onSearch: (query) => {
            logger.info("Search query changed", { query });
            if (!query) {
                searchResults = [];
                currentSearchIndex = 0;
                searchBarHandle?.updateCounter(0, 0);
                return;
            }

            // Perform search
            const allEvents = snapshot.upcomingEvents as CalendarEvent[];
            const matches = searchEvents(allEvents, { text: query }, activeCalendar);
            searchResults = matches.map(m => m.event);
            currentSearchIndex = searchResults.length > 0 ? 0 : -1;

            logger.info("Search results", { query, resultCount: searchResults.length });
            searchBarHandle?.updateCounter(currentSearchIndex >= 0 ? currentSearchIndex : 0, searchResults.length);

            if (searchResults.length > 0) {
                // Select first result
                selectedEventId = searchResults[0].id;
                updateAllViews();
            }
        },
        onNext: () => {
            if (searchResults.length === 0) return;
            currentSearchIndex = Math.min(currentSearchIndex + 1, searchResults.length - 1);
            selectedEventId = searchResults[currentSearchIndex].id;
            searchBarHandle?.updateCounter(currentSearchIndex, searchResults.length);
            updateAllViews();
        },
        onPrevious: () => {
            if (searchResults.length === 0) return;
            currentSearchIndex = Math.max(currentSearchIndex - 1, 0);
            selectedEventId = searchResults[currentSearchIndex].id;
            searchBarHandle?.updateCounter(currentSearchIndex, searchResults.length);
            updateAllViews();
        },
        onClear: () => {
            searchResults = [];
            currentSearchIndex = 0;
            selectedEventId = null;
            updateAllViews();
        },
    }, {
        placeholder: "Search events...",
        showCounter: true,
    });

    // Phase 13 UI - Task 1C: Render astronomical panel in sidebar
    const astronomicalPanelContainer = sidebarContainer.createDiv({ cls: "sm-almanac-mvp__astronomical-container" });
    astronomicalPanel = createAstronomicalPanel(astronomicalPanelContainer, {
        currentTimestamp,
        schema: activeCalendar,
        gateway,
        onEventClick: (event) => {
            logger.info("Astronomical event clicked", { phenomenonId: event.phenomenonId, name: event.name });
            // Future: Open phenomenon details or navigate to date
            new Notice(`Astronomical event: ${event.name}`);
        },
    });

    // Phase 2 Wave 3B: Render event inbox panel in sidebar
    const inboxPanelContainer = sidebarContainer.createDiv({ cls: "sm-almanac-mvp__inbox-container" });
    eventInboxPanel = createEventInboxPanel(inboxPanelContainer, {
        gateway,
        currentTimestamp,
        schema: activeCalendar,
        onEventClick: (event) => {
            logger.info("Inbox event clicked", { eventId: event.id });
            selectedEventId = event.id;

            // Add visual highlight
            root.querySelectorAll('.is-selected').forEach(el => {
                el.classList.remove('is-selected');
            });
            const eventEl = root.querySelector(`[data-event-id="${event.id}"]`);
            eventEl?.classList.add('is-selected');

            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
                event,
                onSave: async (updatedEvent) => {
                    logger.info("Event updated from inbox", { eventId: updatedEvent.id });
                    new Notice(`Event "${updatedEvent.title}" updated successfully`);
                    await updateAllViews();
                }
            });
        }
    });

    // Phase 3: Add time controls panel to sidebar (between inbox and resize handle)
    const timeControlsPanelContainer = sidebarContainer.createDiv({ cls: "sm-almanac-mvp__time-controls-container" });
    timeControlsPanel = createTimeControlsPanel(timeControlsPanelContainer, {
        onAdvanceDay: handleAdvanceDay,
        onAdvanceHour: handleAdvanceHour,
        onAdvanceMinute: handleAdvanceMinute,
    });

    // Phase 2: Add sidebar resize handle
    sidebarResizeHandle = createSidebarResizeHandle(sidebarContainer, {
        minWidth: 240,
        maxWidth: 400,
        defaultWidth: 300,
        onResize: (width) => {
            logger.info("Sidebar resized", { width });
        }
    });

    // Calendar selector: Handle calendar change
    async function handleCalendarChange(calendarId: string): Promise<void> {
        logger.info("Calendar change requested", { from: activeCalendar.id, to: calendarId });
        try {
            await gateway.setActiveCalendar(calendarId);
            const newSnapshot = await gateway.loadSnapshot();
            activeCalendar = newSnapshot.activeCalendar as CalendarSchema;
            currentTimestamp = newSnapshot.currentTimestamp;
            await updateAllViews();
            toolbar?.update(currentTimestamp, currentView, activeCalendar.id, availableCalendars);
            new Notice(`Switched to calendar: ${activeCalendar.name}`);
        } catch (error) {
            logger.error("Failed to change calendar", { error });
            new Notice(`Failed to switch calendar: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // Phase 3: Create toolbar with navigation, time display, and view switcher
    const toolbarContainer = contentContainer.createDiv({ cls: "sm-almanac-mvp__toolbar-container" });
    toolbar = createAlmanacToolbar(toolbarContainer, {
        app,
        currentTimestamp,
        schema: activeCalendar,
        currentView,
        activeCalendarId: activeCalendar.id,
        availableCalendars,
        onNavigatePrevious: navigatePrevious,
        onNavigateNext: navigateNext,
        onJumpToToday: jumpToToday,
        onJumpToDate: jumpToDate,
        onCreateEvent: openEventEditorModal,
        onSearch: () => {
            // Focus search bar in sidebar
            const searchInput = root.querySelector<HTMLInputElement>('.sm-search-bar__input');
            searchInput?.focus();
        },
        onShowHelp: showKeyboardShortcutsHelp,
        onViewChange: (view) => {
            switchView(view);
        },
        onCalendarChange: handleCalendarChange,
    });

    const viewContainer = contentContainer.createDiv({ cls: "sm-almanac-mvp__view-container" });

    // Phase 3: View switching logic (toolbar handles button states)
    function switchView(view: "list" | "month" | "week" | "timeline"): void {
        currentView = view;
        logger.info("Switching view", { view });

        // Update toolbar view switcher
        toolbar?.update(currentTimestamp, view);

        // Clear container
        viewContainer.replaceChildren();

        if (view === "list") {
            // Render list view
            if (eventsList) {
                viewContainer.appendChild(eventsList.root);
            }
        } else if (view === "month") {
            // Render month view
            if (monthView) {
                viewContainer.appendChild(monthView.root);
            }
        } else if (view === "week") {
            // Render week view
            if (weekView) {
                viewContainer.appendChild(weekView.root);
            }
        } else if (view === "timeline") {
            // Render timeline view
            if (timelineView) {
                viewContainer.appendChild(timelineView.root);
            }
        }
    }

    // Render upcoming events list
    eventsList = createUpcomingEventsList({
        events: snapshot.upcomingEvents as CalendarEvent[],
        phenomena: snapshot.upcomingPhenomena,
        schema: activeCalendar,
        currentTimestamp,
        onEventClick: (event) => {
            logger.info("Event clicked", { eventId: event.id });
            selectedEventId = event.id;

            // Add visual highlight
            root.querySelectorAll('.is-selected').forEach(el => {
                el.classList.remove('is-selected');
            });
            const eventEl = root.querySelector(`[data-event-id="${event.id}"]`);
            eventEl?.classList.add('is-selected');

            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
                event,
                onSave: (updatedEvent) => {
                    logger.info("Event updated", { eventId: updatedEvent.id });
                    new Notice("Event updated successfully");
                    // Future: Refresh event list with updated data
                },
            });
        },
    });

    // Render month view
    monthView = createMonthViewCalendar({
        events: snapshot.upcomingEvents as CalendarEvent[],
        phenomena: snapshot.upcomingPhenomena,
        schema: activeCalendar,
        currentTimestamp,
        onDayClick: (timestamp) => {
            logger.info("Day clicked", { timestamp });
            // Future: Jump to day in timeline view or show day events
        },
        onEventClick: (event) => {
            logger.info("Event clicked in month view", { eventId: event.id });
            selectedEventId = event.id;

            // Add visual highlight
            root.querySelectorAll('.is-selected').forEach(el => {
                el.classList.remove('is-selected');
            });
            const eventEl = root.querySelector(`[data-event-id="${event.id}"]`);
            eventEl?.classList.add('is-selected');

            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
                event,
                onSave: (updatedEvent) => {
                    logger.info("Event updated", { eventId: updatedEvent.id });
                    new Notice("Event updated successfully");
                    // Future: Refresh views with updated data
                },
            });
        },
    });

    // Render week view
    weekView = createWeekViewCalendar({
        events: snapshot.upcomingEvents as CalendarEvent[],
        phenomena: snapshot.upcomingPhenomena,
        schema: activeCalendar,
        currentTimestamp,
        onDayClick: (timestamp) => {
            logger.info("Day clicked in week view", { timestamp });
            // Future: Jump to day in timeline view or show day events
        },
        onEventClick: (event) => {
            logger.info("Event clicked in week view", { eventId: event.id });
            selectedEventId = event.id;

            // Add visual highlight
            root.querySelectorAll('.is-selected').forEach(el => {
                el.classList.remove('is-selected');
            });
            const eventEl = root.querySelector(`[data-event-id="${event.id}"]`);
            eventEl?.classList.add('is-selected');

            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
                event,
                onSave: (updatedEvent) => {
                    logger.info("Event updated", { eventId: updatedEvent.id });
                    new Notice("Event updated successfully");
                    // Future: Refresh views with updated data
                },
            });
        },
    });

    // Render timeline view
    timelineView = createTimelineViewCalendar({
        events: snapshot.upcomingEvents as CalendarEvent[],
        phenomena: snapshot.upcomingPhenomena,
        schema: activeCalendar,
        currentTimestamp,
        daysAhead: 30,
        onEventClick: (event) => {
            logger.info("Event clicked in timeline view", { eventId: event.id });
            selectedEventId = event.id;

            // Add visual highlight
            root.querySelectorAll('.is-selected').forEach(el => {
                el.classList.remove('is-selected');
            });
            const eventEl = root.querySelector(`[data-event-id="${event.id}"]`);
            eventEl?.classList.add('is-selected');

            openEventEditor(app, {
                schema: activeCalendar,
                currentTime: currentTimestamp,
                event,
                onSave: (updatedEvent) => {
                    logger.info("Event updated", { eventId: updatedEvent.id });
                    new Notice("Event updated successfully");
                    // Future: Refresh views with updated data
                },
            });
        },
    });

    // Initialize with list view
    switchView("list");

    // Future integration notice (updated - astronomical panel, event editor, keyboard shortcuts, and inbox now implemented!)
    const futureNotice = contentContainer.createDiv({ cls: "sm-almanac-mvp__future-notice" });
    futureNotice.createEl("h4", { text: "Coming Soon" });
    const featureList = futureNotice.createEl("ul");
    featureList.createEl("li", { text: "Date picker for jump-to-date (J key)" });
    featureList.createEl("li", { text: "Event persistence to vault" });
    featureList.createEl("li", { text: "Inbox state persistence" });

    logger.info("Almanac MVP rendered successfully with vault integration, astronomical panel, event editor, keyboard shortcuts, and event inbox");

    // Cleanup function (important for memory management)
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
        quickAddBar?.destroy();
        searchBarHandle?.destroy();
        timeControlsPanel?.destroy(); // Phase 3
        toolbar?.destroy(); // Phase 3
        eventInboxPanel?.destroy();
        sidebarResizeHandle?.destroy();
    };
}
