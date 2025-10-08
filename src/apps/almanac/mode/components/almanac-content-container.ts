// src/apps/almanac/mode/components/almanac-content-container.ts
// Lower section: Tabbed content for Dashboard/Events/Manager

import type { App } from "obsidian";
import type { AlmanacContentMode, AlmanacState } from "../contracts";
import { createTabNavigation, type TabConfig, type TabNavigationHandle } from "../../../../ui/workmode";

export interface AlmanacContentContainerConfig {
    readonly mode: AlmanacContentMode;
    readonly onModeChange: (mode: AlmanacContentMode) => void;
}

export interface AlmanacContentContainerHandle {
    readonly element: HTMLElement;
    readonly dashboardElement: HTMLElement;
    readonly eventsElement: HTMLElement;
    readonly managerElement: HTMLElement;
    setMode(mode: AlmanacContentMode): void;
    update(state: AlmanacState): void;
    destroy(): void;
}

export function createAlmanacContentContainer(
    app: App,
    parent: HTMLElement,
    config: AlmanacContentContainerConfig
): AlmanacContentContainerHandle {
    const container = parent.createDiv({ cls: "almanac-content-tabs" });

    // Header with tab navigation
    const header = container.createDiv({ cls: "almanac-content-tabs__header" });

    const tabs: TabConfig<AlmanacContentMode>[] = [
        { id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
        { id: "events", label: "Events", icon: "calendar-search" },
        { id: "manager", label: "Manager", icon: "settings" },
    ];

    const tabNav = createTabNavigation<AlmanacContentMode>(header, {
        tabs,
        activeTab: config.mode,
        className: "almanac-content-tabs__nav",
        onSelect: config.onModeChange,
    });

    // Content body
    const body = container.createDiv({ cls: "almanac-content-tabs__body" });

    // Create containers for each mode (hidden by default)
    const dashboardContainer = body.createDiv({ cls: "almanac-dashboard-content" });
    const eventsContainer = body.createDiv({ cls: "almanac-events-content" });
    const managerContainer = body.createDiv({ cls: "almanac-manager-content" });

    // Track current mode
    let currentMode = config.mode;

    const updateVisibility = () => {
        dashboardContainer.style.display = currentMode === "dashboard" ? "" : "none";
        eventsContainer.style.display = currentMode === "events" ? "" : "none";
        managerContainer.style.display = currentMode === "manager" ? "" : "none";
    };

    updateVisibility();

    return {
        element: container,
        dashboardElement: dashboardContainer,
        eventsElement: eventsContainer,
        managerElement: managerContainer,

        setMode(mode: AlmanacContentMode) {
            currentMode = mode;
            tabNav.setActiveTab(mode);
            updateVisibility();
        },

        update(state: AlmanacState) {
            // Child components will be mounted in these containers
            // and will handle their own updates
        },

        destroy() {
            tabNav.destroy();
            container.remove();
        },
    };
}
