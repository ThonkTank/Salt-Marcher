// src/ui/workmode/header.ts
// Shared workmode header component combining title, tabs and search controls.

import type { TabConfig, TabNavigationHandle } from "./tab-navigation";
import { createTabNavigation } from "./tab-navigation";

export interface WorkmodeHeaderSearchAction {
    readonly label: string;
    readonly onClick: (value: string) => void;
}

export interface WorkmodeHeaderSearchConfig {
    readonly placeholder: string;
    readonly value?: string;
    readonly onInput?: (value: string) => void;
    readonly onSubmit?: (value: string) => void;
    readonly actionButton?: WorkmodeHeaderSearchAction;
    readonly inputLabel?: string;
}

export interface WorkmodeHeaderDescriptionConfig {
    readonly text?: string;
    readonly className?: string;
}

export interface WorkmodeHeaderConfig<T extends string = string> {
    readonly title: string;
    readonly className?: string;
    readonly tabs?: ReadonlyArray<TabConfig<T>>;
    readonly activeTab?: T;
    readonly onSelectTab?: (tabId: T) => void;
    readonly search?: WorkmodeHeaderSearchConfig;
    readonly description?: WorkmodeHeaderDescriptionConfig;
}

export interface WorkmodeHeaderHandle<T extends string = string> {
    readonly element: HTMLElement;
    readonly tabNavigation?: TabNavigationHandle<T>;
    setActiveTab(tabId: T): void;
    updateSearchValue(value: string): void;
    focusSearch(): void;
    setDescription(text: string): void;
    destroy(): void;
}

export function createWorkmodeHeader<T extends string = string>(
    parent: HTMLElement,
    config: WorkmodeHeaderConfig<T>,
): WorkmodeHeaderHandle<T> {
    const header = parent.createDiv({ cls: "sm-workmode-header" });
    if (config.className) {
        header.addClass(config.className);
    }

    const titleRow = header.createDiv({ cls: "sm-workmode-header__title-row" });
    titleRow.createEl("h2", { text: config.title, cls: "sm-workmode-header__title" });

    let tabNavigation: TabNavigationHandle<T> | undefined;
    if (config.tabs && config.tabs.length && config.onSelectTab && config.activeTab !== undefined) {
        tabNavigation = createTabNavigation(titleRow, {
            tabs: config.tabs,
            activeTab: config.activeTab,
            className: "sm-workmode-header__tabs",
            onSelect: config.onSelectTab,
        });
    }

    let searchInput: HTMLInputElement | undefined;
    let actionButton: HTMLButtonElement | undefined;
    let inputListener: ((event: Event) => void) | undefined;
    let submitListener: ((event: KeyboardEvent) => void) | undefined;

    if (config.search) {
        const searchRow = header.createDiv({ cls: "sm-workmode-header__search" });
        searchRow.addClass("sm-cc-searchbar");
        if (config.search.inputLabel) {
            searchRow.createEl("label", { text: config.search.inputLabel, cls: "sm-workmode-header__search-label" });
        }
        searchInput = searchRow.createEl("input", {
            attr: { type: "text", placeholder: config.search.placeholder },
            cls: "sm-workmode-header__search-input",
        }) as HTMLInputElement;
        if (config.search.value) {
            searchInput.value = config.search.value;
        }
        if (config.search.onInput) {
            inputListener = () => {
                config.search?.onInput?.(searchInput?.value ?? "");
            };
            searchInput.addEventListener("input", inputListener);
        }
        if (config.search.onSubmit) {
            submitListener = (event) => {
                if (event.key === "Enter") {
                    config.search?.onSubmit?.(searchInput?.value ?? "");
                }
            };
            searchInput.addEventListener("keydown", submitListener);
        }
        if (config.search.actionButton) {
            actionButton = searchRow.createEl("button", {
                text: config.search.actionButton.label,
                cls: "sm-workmode-header__action",
            }) as HTMLButtonElement;
            actionButton.onclick = () => {
                config.search?.actionButton?.onClick(searchInput?.value ?? "");
            };
        }
    }

    let descriptionEl: HTMLElement | undefined;
    if (config.description) {
        descriptionEl = header.createDiv({ cls: "sm-workmode-header__description" });
        if (config.description.className) {
            descriptionEl.addClass(config.description.className);
        }
        if (config.description.text !== undefined) {
            descriptionEl.setText(config.description.text);
        }
    }

    return {
        element: header,
        tabNavigation,
        setActiveTab(tabId: T) {
            tabNavigation?.setActiveTab(tabId);
        },
        updateSearchValue(value: string) {
            if (searchInput) {
                searchInput.value = value;
            }
        },
        focusSearch() {
            searchInput?.focus();
        },
        setDescription(text: string) {
            if (!descriptionEl) {
                descriptionEl = header.createDiv({ cls: "sm-workmode-header__description", text });
                if (config.description?.className) {
                    descriptionEl.addClass(config.description.className);
                }
            } else {
                descriptionEl.setText(text);
            }
        },
        destroy() {
            tabNavigation?.destroy();
            if (actionButton) {
                actionButton.onclick = null;
            }
            if (searchInput) {
                if (inputListener) {
                    searchInput.removeEventListener("input", inputListener);
                }
                if (submitListener) {
                    searchInput.removeEventListener("keydown", submitListener);
                }
            }
            header.remove();
        },
    };
}
