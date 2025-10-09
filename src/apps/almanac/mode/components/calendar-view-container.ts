// src/apps/almanac/mode/components/calendar-view-container.ts
// Upper section: Persistent calendar view with month/week/day/upcoming modes

import {
    CALENDAR_VIEW_MODE_METADATA,
    CALENDAR_VIEW_MODE_ORDER,
    type CalendarViewMode,
    type CalendarViewState,
} from "../contracts";
import { createTabNavigation } from "../../../../ui/workmode";

export interface CalendarViewContainerConfig {
    readonly state: CalendarViewState;
    readonly onModeChange: (mode: CalendarViewMode) => void;
    readonly onNavigate: (direction: "prev" | "next" | "today") => void;
    readonly onEventSelect: (eventId: string) => void;
}

export function createCalendarViewContainer(
    parent: HTMLElement,
    config: CalendarViewContainerConfig,
): {
    readonly element: HTMLElement;
    update(state: CalendarViewState): void;
    destroy(): void;
} {
    const container = parent.createDiv({ cls: "almanac-calendar-view" });

    // Header with tab navigation
    const header = container.createDiv({ cls: "almanac-calendar-view__header" });

    const tabNav = createTabNavigation<CalendarViewMode>(header, {
        tabs: CALENDAR_VIEW_MODE_ORDER.map(mode => ({
            id: mode,
            label: CALENDAR_VIEW_MODE_METADATA[mode].label,
            icon: CALENDAR_VIEW_MODE_METADATA[mode].icon,
        })),
        activeTab: config.state.mode ?? "month",
        className: "almanac-calendar-view__tabs",
        onSelect: config.onModeChange,
    });

    // Navigation controls
    const navControls = header.createDiv({ cls: "almanac-calendar-view__nav" });
    (
        [
            { label: "◀", action: "prev" as const, aria: "Previous" },
            { label: "Today", action: "today" as const },
            { label: "▶", action: "next" as const, aria: "Next" },
        ] satisfies Array<{ label: string; action: "prev" | "next" | "today"; aria?: string }>
    ).forEach(({ label, action, aria }) => {
        const button = navControls.createEl("button", { text: label });
        if (aria) {
            button.setAttribute("aria-label", aria);
        }
        button.onclick = () => config.onNavigate(action);
    });

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

        const mode = state.mode ?? "month";

        if (mode === "upcoming") {
            const list = content.createDiv({ cls: "almanac-upcoming-list" });

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
            return;
        }

        const grid = content.createDiv({
            cls: `almanac-calendar-grid almanac-calendar-grid--${mode}`,
        });
        const label = mode.charAt(0).toUpperCase() + mode.slice(1);
        grid.createDiv({ text: `${label} view - ${state.events.length} events` });
    };

    // Initial render
    renderContent(config.state);

    return {
        element: container,
        update(state: CalendarViewState) {
            tabNav.setActiveTab(state.mode ?? "month");
            renderContent(state);
        },

        destroy() {
            tabNav.destroy();
            container.remove();
        },
    };
}
