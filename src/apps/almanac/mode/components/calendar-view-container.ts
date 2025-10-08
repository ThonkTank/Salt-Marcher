// src/apps/almanac/mode/components/calendar-view-container.ts
// Upper section: Persistent calendar view with month/week/day/upcoming modes

import type { App } from "obsidian";
import type { CalendarViewMode, CalendarViewState } from "../contracts";
import { createTabNavigation, type TabConfig, type TabNavigationHandle } from "../../../../ui/workmode";
import type { CalendarTimestamp } from "../../domain/calendar-timestamp";

export interface CalendarViewContainerConfig {
    readonly mode: CalendarViewMode;
    readonly state: CalendarViewState;
    readonly onModeChange: (mode: CalendarViewMode) => void;
    readonly onNavigate: (direction: "prev" | "next" | "today") => void;
    readonly onEventCreate: (timestamp?: CalendarTimestamp) => void;
    readonly onEventSelect: (eventId: string) => void;
}

export interface CalendarViewContainerHandle {
    readonly element: HTMLElement;
    setMode(mode: CalendarViewMode): void;
    update(state: CalendarViewState): void;
    destroy(): void;
}

export function createCalendarViewContainer(
    app: App,
    parent: HTMLElement,
    config: CalendarViewContainerConfig
): CalendarViewContainerHandle {
    const container = parent.createDiv({ cls: "almanac-calendar-view" });

    // Header with tab navigation
    const header = container.createDiv({ cls: "almanac-calendar-view__header" });

    const tabs: TabConfig<CalendarViewMode>[] = [
        { id: "month", label: "Month", icon: "calendar-days" },
        { id: "week", label: "Week", icon: "calendar-range" },
        { id: "day", label: "Day", icon: "calendar-clock" },
        { id: "upcoming", label: "Next", icon: "list-ordered" },
    ];

    const tabNav = createTabNavigation<CalendarViewMode>(header, {
        tabs,
        activeTab: config.mode,
        className: "almanac-calendar-view__tabs",
        onSelect: config.onModeChange,
    });

    // Navigation controls
    const navControls = header.createDiv({ cls: "almanac-calendar-view__nav" });
    const prevBtn = navControls.createEl("button", { text: "◀", attr: { "aria-label": "Previous" } });
    const todayBtn = navControls.createEl("button", { text: "Today" });
    const nextBtn = navControls.createEl("button", { text: "▶", attr: { "aria-label": "Next" } });

    prevBtn.onclick = () => config.onNavigate("prev");
    todayBtn.onclick = () => config.onNavigate("today");
    nextBtn.onclick = () => config.onNavigate("next");

    // Content area
    const content = container.createDiv({ cls: "almanac-calendar-view__content" });

    const renderContent = (state: CalendarViewState) => {
        content.empty();

        if (state.isLoading) {
            content.createDiv({ cls: "sm-mode-loading", text: "Loading..." });
            return;
        }

        if (state.error) {
            content.createDiv({ cls: "sm-mode-error", text: state.error });
            return;
        }

        // Render based on mode
        switch (config.mode) {
            case "month":
                renderMonthView(content, state);
                break;
            case "week":
                renderWeekView(content, state);
                break;
            case "day":
                renderDayView(content, state);
                break;
            case "upcoming":
                renderUpcomingView(content, state);
                break;
        }
    };

    const renderMonthView = (container: HTMLElement, state: CalendarViewState) => {
        const grid = container.createDiv({ cls: "almanac-calendar-grid almanac-calendar-grid--month" });
        // TODO: Implement month grid rendering
        grid.createDiv({ text: `Month view - ${state.events.length} events` });
    };

    const renderWeekView = (container: HTMLElement, state: CalendarViewState) => {
        const grid = container.createDiv({ cls: "almanac-calendar-grid almanac-calendar-grid--week" });
        // TODO: Implement week list rendering
        grid.createDiv({ text: `Week view - ${state.events.length} events` });
    };

    const renderDayView = (container: HTMLElement, state: CalendarViewState) => {
        const timeline = container.createDiv({ cls: "almanac-calendar-timeline" });
        // TODO: Implement day timeline rendering
        timeline.createDiv({ text: `Day view - ${state.events.length} events` });
    };

    const renderUpcomingView = (container: HTMLElement, state: CalendarViewState) => {
        const list = container.createDiv({ cls: "almanac-upcoming-list" });

        if (state.events.length === 0) {
            list.createDiv({ cls: "sm-mode-empty", text: "No upcoming events" });
            return;
        }

        for (const event of state.events) {
            const item = list.createDiv({ cls: "almanac-upcoming-item" });
            item.createDiv({ cls: "almanac-upcoming-item__title", text: event.title });
            item.createDiv({ cls: "almanac-upcoming-item__time", text: "TODO: Format time" });
            item.onclick = () => config.onEventSelect(event.id);
        }
    };

    // Initial render
    renderContent(config.state);

    return {
        element: container,

        setMode(mode: CalendarViewMode) {
            tabNav.setActiveTab(mode);
        },

        update(state: CalendarViewState) {
            renderContent(state);
        },

        destroy() {
            tabNav.destroy();
            container.remove();
        },
    };
}
