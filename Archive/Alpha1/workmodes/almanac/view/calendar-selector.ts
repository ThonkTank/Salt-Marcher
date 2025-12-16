// src/workmodes/almanac/view/calendar-selector.ts
// Calendar selector dropdown component for switching between calendars

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-calendar-selector');
import { openLibrary } from "../../library/view";
import type { CalendarSchema } from "../helpers";

export interface CalendarSelectorOptions {
    readonly app: App;
    readonly activeCalendarId: string | null;
    readonly availableCalendars: ReadonlyArray<CalendarSchema>;
    readonly onCalendarChange: (calendarId: string) => void;
}

export interface CalendarSelectorHandle {
    readonly root: HTMLElement;
    update(activeCalendarId: string | null, calendars: ReadonlyArray<CalendarSchema>): void;
    destroy(): void;
}

/**
 * Calendar Selector Component
 *
 * Provides a dropdown button for selecting the active calendar.
 * Shows current calendar name with dropdown arrow.
 * Clicking opens a list of all available calendars.
 */
export function createCalendarSelector(
    options: CalendarSelectorOptions
): CalendarSelectorHandle {
    const { app, onCalendarChange } = options;
    let activeCalendarId = options.activeCalendarId;
    let availableCalendars = options.availableCalendars;
    let isOpen = false;

    // Root container
    const root = document.createElement("div");
    root.classList.add("sm-almanac-toolbar__calendar-selector");

    // Dropdown button
    const button = document.createElement("button");
    button.classList.add("sm-calendar-selector__button");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    root.appendChild(button);

    // Dropdown menu
    const dropdown = document.createElement("div");
    dropdown.classList.add("sm-calendar-dropdown");
    dropdown.setAttribute("role", "menu");
    dropdown.style.display = "none";
    root.appendChild(dropdown);

    function getActiveCalendar(): CalendarSchema | null {
        if (!activeCalendarId) return null;
        return availableCalendars.find(c => c.id === activeCalendarId) || null;
    }

    function updateButton(): void {
        const activeCalendar = getActiveCalendar();

        if (!activeCalendar) {
            button.innerHTML = `<span class="sm-calendar-selector__icon">📅</span><span class="sm-calendar-selector__text">No Calendar</span><span class="sm-calendar-selector__arrow">▼</span>`;
            button.setAttribute("title", "Select calendar (C)");
        } else {
            const name = activeCalendar.name || activeCalendar.id;
            button.innerHTML = `<span class="sm-calendar-selector__icon">📅</span><span class="sm-calendar-selector__text">${name}</span><span class="sm-calendar-selector__arrow">▼</span>`;
            button.setAttribute("title", `Current: ${name} (Click to change, or press C)`);
        }
    }

    function renderDropdown(): void {
        dropdown.replaceChildren();

        if (availableCalendars.length === 0) {
            // No calendars - show create link
            const emptyItem = dropdown.createDiv({ cls: "sm-calendar-dropdown__empty" });
            emptyItem.textContent = "No calendars available";

            const createLink = dropdown.createDiv({ cls: "sm-calendar-dropdown__create" });
            createLink.innerHTML = `<span>+ Create Calendar in Library</span>`;
            createLink.addEventListener("click", () => {
                closeDropdown();
                openLibrary(app);
            });
            return;
        }

        // Render calendar list
        availableCalendars.forEach(calendar => {
            const item = dropdown.createDiv({ cls: "sm-calendar-dropdown__item" });
            const isActive = calendar.id === activeCalendarId;

            if (isActive) {
                item.classList.add("is-active");
            }

            const icon = item.createSpan({ cls: "sm-calendar-dropdown__icon" });
            icon.textContent = "📅";

            const name = item.createSpan({ cls: "sm-calendar-dropdown__name" });
            name.textContent = calendar.name || calendar.id;

            if (isActive) {
                const checkmark = item.createSpan({ cls: "sm-calendar-dropdown__checkmark" });
                checkmark.textContent = "✓";
            }

            // Metadata (month count, epoch year)
            const meta = item.createDiv({ cls: "sm-calendar-dropdown__meta" });
            meta.textContent = `${calendar.months.length} months`;
            if (calendar.epoch) {
                meta.textContent += ` • Epoch ${calendar.epoch.year}`;
            }

            item.addEventListener("click", () => {
                if (calendar.id !== activeCalendarId) {
                    logger.info("Calendar changed", {
                        from: activeCalendarId,
                        to: calendar.id
                    });
                    onCalendarChange(calendar.id);
                }
                closeDropdown();
            });
        });

        // Add separator
        const separator = dropdown.createDiv({ cls: "sm-calendar-dropdown__separator" });

        // Add "Create New Calendar" link
        const createLink = dropdown.createDiv({ cls: "sm-calendar-dropdown__create" });
        createLink.innerHTML = `<span>+ Create New Calendar</span>`;
        createLink.addEventListener("click", () => {
            closeDropdown();
            openLibrary(app);
        });
    }

    function openDropdown(): void {
        isOpen = true;
        dropdown.style.display = "block";
        button.setAttribute("aria-expanded", "true");
        button.classList.add("is-open");
        renderDropdown();
        logger.info("Dropdown opened", { calendars: availableCalendars.length });
    }

    function closeDropdown(): void {
        isOpen = false;
        dropdown.style.display = "none";
        button.setAttribute("aria-expanded", "false");
        button.classList.remove("is-open");
        logger.info("Dropdown closed");
    }

    function toggleDropdown(): void {
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    // Button click handler
    button.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (isOpen && !root.contains(e.target as Node)) {
            closeDropdown();
        }
    });

    // Close dropdown on Escape key
    document.addEventListener("keydown", (e) => {
        if (isOpen && e.key === "Escape") {
            closeDropdown();
            button.focus();
        }
    });

    // Initial render
    updateButton();

    return {
        root,
        update(newActiveCalendarId: string | null, newCalendars: ReadonlyArray<CalendarSchema>): void {
            activeCalendarId = newActiveCalendarId;
            availableCalendars = newCalendars;
            updateButton();
            if (isOpen) {
                renderDropdown();
            }
        },
        destroy(): void {
            // Cleanup will be handled by parent
        }
    };
}
