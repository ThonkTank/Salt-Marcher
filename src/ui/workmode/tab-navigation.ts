// src/ui/workmode/tab-navigation.ts
// Reusable tab navigation component for workmode views

export interface TabConfig<T extends string = string> {
    readonly id: T;
    readonly label: string;
    readonly icon?: string;
    readonly description?: string;
    readonly disabled?: boolean;
    readonly badgeCount?: number;
}

export interface TabNavigationConfig<T extends string> {
    readonly tabs: ReadonlyArray<TabConfig<T>>;
    readonly activeTab: T;
    readonly className?: string;
    readonly onSelect: (tabId: T) => void;
}

export interface TabNavigationHandle<T extends string> {
    readonly element: HTMLElement;
    setActiveTab(tabId: T): void;
    setBadgeCount(tabId: T, count: number | undefined): void;
    setDisabled(tabId: T, disabled: boolean): void;
    destroy(): void;
}

interface TabButton {
    button: HTMLButtonElement;
    badge?: HTMLElement;
}

type CreateElFunction = (tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) => HTMLElement;

function appendElement<T extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tag: T,
    options: { cls?: string; text?: string } = {}
): HTMLElementTagNameMap[T] {
    const maybeCreateEl = (parent as HTMLElement & { createEl?: CreateElFunction }).createEl;

    if (typeof maybeCreateEl === "function") {
        return maybeCreateEl.call(parent, tag, options) as HTMLElementTagNameMap[T];
    }

    const doc = parent.ownerDocument ?? document;
    const el = doc.createElement(tag);
    if (options.cls) {
        el.className = options.cls;
    }
    if (options.text !== undefined) {
        el.textContent = options.text;
    }
    parent.appendChild(el);
    return el as HTMLElementTagNameMap[T];
}

export function createTabNavigation<T extends string>(
    parent: HTMLElement,
    config: TabNavigationConfig<T>
): TabNavigationHandle<T> {
    const container = parent.createDiv({ cls: "sm-tab-nav" });
    if (config.className) {
        container.addClass(config.className);
    }

    const buttons = new Map<T, TabButton>();
    let currentActive: T = config.activeTab;

    const updateActiveState = () => {
        for (const [tabId, { button }] of buttons.entries()) {
            button.classList.toggle("is-active", tabId === currentActive);
            button.setAttribute("aria-selected", String(tabId === currentActive));
        }
    };

    const createTabButton = (tab: TabConfig<T>): TabButton => {
        const button = container.createEl("button", {
            cls: "sm-tab-nav__button",
            attr: {
                "data-tab-id": tab.id,
                "role": "tab",
                "aria-selected": String(tab.id === currentActive),
                "tabindex": tab.id === currentActive ? "0" : "-1",
            },
        });

        if (tab.disabled) {
            button.disabled = true;
            button.addClass("is-disabled");
        }

        // Icon (optional)
        if (tab.icon) {
            const icon = appendElement(button, "span", { cls: "sm-tab-nav__icon" });
            icon.innerHTML = tab.icon; // or use setIcon from obsidian
        }

        // Label
        appendElement(button, "span", { cls: "sm-tab-nav__label", text: tab.label });

        // Badge (optional)
        let badge: HTMLElement | undefined;
        if (tab.badgeCount !== undefined && tab.badgeCount > 0) {
            badge = appendElement(button, "span", { cls: "sm-tab-nav__badge", text: String(tab.badgeCount) });
        }

        // Tooltip (optional)
        if (tab.description) {
            button.setAttribute("aria-label", tab.description);
            button.setAttribute("title", tab.description);
        }

        button.onclick = () => {
            if (button.disabled) return;
            currentActive = tab.id;
            updateActiveState();
            config.onSelect(tab.id);
        };

        return { button, badge };
    };

    // Create all tab buttons
    for (const tab of config.tabs) {
        const tabButton = createTabButton(tab);
        buttons.set(tab.id, tabButton);
    }

    updateActiveState();

    // Keyboard navigation
    container.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

        const tabIds = Array.from(buttons.keys());
        const currentIndex = tabIds.indexOf(currentActive);
        if (currentIndex === -1) return;

        let nextIndex: number;
        if (e.key === "ArrowRight") {
            nextIndex = (currentIndex + 1) % tabIds.length;
        } else {
            nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
        }

        const nextTab = tabIds[nextIndex];
        const nextButton = buttons.get(nextTab);
        if (nextButton && !nextButton.button.disabled) {
            currentActive = nextTab;
            updateActiveState();
            nextButton.button.focus();
            config.onSelect(nextTab);
        }
    });

    return {
        element: container,
        setActiveTab(tabId: T) {
            if (!buttons.has(tabId)) {
                console.warn(`Tab ${tabId} not found in navigation`);
                return;
            }
            currentActive = tabId;
            updateActiveState();
        },
        setBadgeCount(tabId: T, count: number | undefined) {
            const entry = buttons.get(tabId);
            if (!entry) return;

            if (entry.badge) {
                if (count !== undefined && count > 0) {
                    entry.badge.setText(String(count));
                    entry.badge.style.display = "";
                } else {
                    entry.badge.style.display = "none";
                }
            } else if (count !== undefined && count > 0) {
                entry.badge = appendElement(entry.button, "span", { cls: "sm-tab-nav__badge", text: String(count) });
            }
        },
        setDisabled(tabId: T, disabled: boolean) {
            const entry = buttons.get(tabId);
            if (!entry) return;
            entry.button.disabled = disabled;
            entry.button.classList.toggle("is-disabled", disabled);
        },
        destroy() {
            container.remove();
        },
    };
}
