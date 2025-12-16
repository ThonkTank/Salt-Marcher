// src/ui/data-manager/workmode-header.ts
// Provides a shared header layout (title, tabs, search + action) for workmode views.

import { applyMapButtonStyle } from "./map-styling";
import { createTabNavigation, type TabConfig, type TabNavigationHandle } from "./tab-navigation";

export interface WorkmodeHeaderTabsConfig<T extends string> {
    readonly items: ReadonlyArray<TabConfig<T>>;
    readonly active: T;
    readonly className?: string;
    readonly onSelect: (tabId: T) => void;
}

export interface WorkmodeHeaderSearchConfig {
    readonly placeholder: string;
    readonly value?: string;
    readonly onChange?: (value: string) => void;
    readonly disabled?: boolean;
}

export interface WorkmodeHeaderActionConfig {
    readonly label: string;
    readonly onClick?: (value: string) => void;
    readonly disabled?: boolean;
}

export interface WorkmodeHeaderConfig<T extends string = string> {
    readonly title: string;
    readonly tabs?: WorkmodeHeaderTabsConfig<T>;
    readonly search?: WorkmodeHeaderSearchConfig;
    readonly action?: WorkmodeHeaderActionConfig;
}

export interface WorkmodeHeaderHandle<T extends string = string> {
    readonly titleEl: HTMLHeadingElement;
    readonly tabNavigation?: TabNavigationHandle<T>;
    readonly searchInput?: HTMLInputElement;
    readonly actionButton?: HTMLButtonElement;
    setActiveTab(tabId: T): void;
    setSearchValue(value: string): void;
    focusSearch(): void;
    destroy(): void;
}

export function createWorkmodeHeader<T extends string = string>(
    parent: HTMLElement,
    config: WorkmodeHeaderConfig<T>,
): WorkmodeHeaderHandle<T> {
    const titleEl = parent.createEl("h2", { text: config.title });

    let tabNavigation: TabNavigationHandle<T> | undefined;
    if (config.tabs && config.tabs.items.length > 0) {
        tabNavigation = createTabNavigation(parent, {
            tabs: config.tabs.items,
            activeTab: config.tabs.active,
            className: config.tabs.className ?? "sm-lib-header",
            onSelect: config.tabs.onSelect,
        });
    }

    let searchInput: HTMLInputElement | undefined;
    let actionButton: HTMLButtonElement | undefined;
    if (config.search || config.action) {
        const bar = parent.createDiv({ cls: "sm-cc-searchbar" });
        if (config.search) {
            searchInput = bar.createEl("input", {
                attr: {
                    type: "text",
                    placeholder: config.search.placeholder,
                },
            }) as HTMLInputElement;
            if (config.search.value) {
                searchInput.value = config.search.value;
            }
            searchInput.disabled = Boolean(config.search.disabled);
            searchInput.oninput = () => {
                if (!config.search?.onChange) return;
                const next = searchInput ? searchInput.value.trim() : "";
                config.search.onChange(next);
            };
        }

        if (config.action) {
            actionButton = bar.createEl("button", { text: config.action.label, attr: { type: "button" } });
            applyMapButtonStyle(actionButton);
            actionButton.disabled = Boolean(config.action.disabled);
            actionButton.onclick = () => {
                if (!config.action?.onClick || actionButton?.disabled) return;
                const value = searchInput ? searchInput.value.trim() : "";
                config.action.onClick(value);
            };
        }
    }

    return {
        titleEl,
        tabNavigation,
        searchInput,
        actionButton,
        setActiveTab(tabId: T) {
            tabNavigation?.setActiveTab(tabId);
        },
        setSearchValue(value: string) {
            if (searchInput) {
                searchInput.value = value;
            }
        },
        focusSearch() {
            searchInput?.focus();
        },
        destroy() {
            tabNavigation?.destroy();
        },
    };
}
