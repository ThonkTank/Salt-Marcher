// src/apps/almanac/mode/components/almanac-content-container.ts
// Lower section: Tabbed content for Dashboard/Events/Manager

import { ALMANAC_MODE_METADATA, ALMANAC_MODE_ORDER, type AlmanacMode } from "../contracts";
import { createTabNavigation } from "../../../../ui/workmode";

export interface AlmanacContentContainerConfig {
    readonly mode: AlmanacMode;
    readonly onModeChange: (mode: AlmanacMode) => void;
}

export function createAlmanacContentContainer(
    parent: HTMLElement,
    config: AlmanacContentContainerConfig,
): {
    readonly element: HTMLElement;
    getSection(mode: AlmanacMode): HTMLElement;
    setMode(mode: AlmanacMode): void;
    destroy(): void;
} {
    const container = parent.createDiv({ cls: "almanac-content-tabs" });

    // Header with tab navigation
    const header = container.createDiv({ cls: "almanac-content-tabs__header" });

    const tabNav = createTabNavigation<AlmanacMode>(header, {
        tabs: ALMANAC_MODE_ORDER.map(mode => ({
            id: mode,
            label: ALMANAC_MODE_METADATA[mode].label,
            icon: ALMANAC_MODE_METADATA[mode].icon,
        })),
        activeTab: config.mode,
        className: "almanac-content-tabs__nav",
        onSelect: config.onModeChange,
    });

    // Content body
    const body = container.createDiv({ cls: "almanac-content-tabs__body" });

    const sections = new Map<AlmanacMode, HTMLElement>();
    ALMANAC_MODE_ORDER.forEach(mode => {
        const section = body.createDiv({ cls: `almanac-${mode}-content` });
        sections.set(mode, section);
    });

    const setMode = (mode: AlmanacMode) => {
        tabNav.setActiveTab(mode);
        sections.forEach((element, key) => {
            element.toggleAttribute("hidden", key !== mode);
        });
    };

    setMode(config.mode);

    return {
        element: container,
        getSection(mode: AlmanacMode) {
            const section = sections.get(mode);
            if (!section) {
                throw new Error(`Unknown Almanac content section: ${mode}`);
            }
            return section;
        },
        setMode,

        destroy() {
            tabNav.destroy();
            container.remove();
        },
    };
}
