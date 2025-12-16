// src/workmodes/almanac/view/event-context-menu.ts
// Context menu component for quick event actions

import { Notice } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-event-context-menu');
import type { CalendarEvent } from "../helpers";

export interface EventContextMenuOptions {
    /** The event to show actions for */
    readonly event: CalendarEvent;
    /** Callback when Edit Event is clicked */
    readonly onEdit: (event: CalendarEvent) => void;
    /** Callback when Duplicate is clicked */
    readonly onDuplicate: (event: CalendarEvent) => void;
    /** Callback when priority is changed */
    readonly onChangePriority: (event: CalendarEvent, newPriority: number) => Promise<void>;
    /** Callback when category is changed */
    readonly onChangeCategory: (event: CalendarEvent, newCategory: string) => Promise<void>;
    /** Optional callback when Mark as Read is clicked */
    readonly onMarkAsRead?: (event: CalendarEvent) => void;
    /** Callback when Delete is clicked */
    readonly onDelete: (event: CalendarEvent) => void;
    /** Optional list of recent categories for quick selection */
    readonly recentCategories?: string[];
}

/**
 * Event Context Menu
 *
 * Shows a right-click context menu with quick actions for calendar events.
 * Provides shortcuts for common operations without opening the full editor.
 *
 * Menu Structure:
 * ```
 * ┌─────────────────────┐
 * │ Edit Event       ⌘E │
 * │ Duplicate        ⌘D │
 * │ ──────────────────── │
 * │ Mark as Read        │
 * │ Change Priority   ▶ │ → [Urgent, High, Normal, Low]
 * │ Change Category   ▶ │ → [Recent categories + Custom...]
 * │ ──────────────────── │
 * │ Delete Event     ⌫  │
 * └─────────────────────┘
 * ```
 *
 * Features:
 * - Positioned at cursor (right-click location)
 * - Submenu support for Priority/Category
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Auto-close on click outside
 * - Obsidian-style menu CSS
 *
 * Usage:
 * ```typescript
 * element.addEventListener('contextmenu', (e) => {
 *     e.preventDefault();
 *     showEventContextMenu(e.clientX, e.clientY, {
 *         event,
 *         onEdit: (event) => { ... },
 *         onDuplicate: (event) => { ... },
 *         onChangePriority: async (event, priority) => { ... },
 *         onChangeCategory: async (event, category) => { ... },
 *         onDelete: (event) => { ... },
 *     });
 * });
 * ```
 */
export function showEventContextMenu(
    x: number,
    y: number,
    options: EventContextMenuOptions,
): void {
    logger.info("Showing menu", { eventId: options.event.id, x, y });

    // Remove any existing menu
    const existingMenu = document.querySelector('.sm-event-context-menu');
    existingMenu?.remove();

    // Create menu container
    const menu = document.createElement('div');
    menu.classList.add('sm-event-context-menu');

    // Position menu at cursor
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Create menu items
    const items: Array<{ label: string; shortcut?: string; action: () => void; divider?: boolean; danger?: boolean; hasSubmenu?: boolean }> = [
        {
            label: 'Edit Event',
            shortcut: '⌘E',
            action: () => {
                logger.info("Edit clicked");
                options.onEdit(options.event);
                closeMenu();
            },
        },
        {
            label: 'Duplicate',
            shortcut: '⌘D',
            action: () => {
                logger.info("Duplicate clicked");
                options.onDuplicate(options.event);
                closeMenu();
            },
        },
        { label: '', action: () => {}, divider: true }, // Divider
    ];

    // Add Mark as Read if callback provided
    if (options.onMarkAsRead) {
        items.push({
            label: 'Mark as Read',
            action: () => {
                logger.info("Mark as Read clicked");
                options.onMarkAsRead!(options.event);
                closeMenu();
            },
        });
    }

    // Add Priority submenu
    items.push({
        label: 'Change Priority',
        action: () => {}, // No action, opens submenu
        hasSubmenu: true,
    });

    // Add Category submenu
    items.push({
        label: 'Change Category',
        action: () => {}, // No action, opens submenu
        hasSubmenu: true,
    });

    items.push({ label: '', action: () => {}, divider: true }); // Divider

    // Add Delete
    items.push({
        label: 'Delete Event',
        shortcut: '⌫',
        action: () => {
            logger.info("Delete clicked");
            options.onDelete(options.event);
            closeMenu();
        },
        danger: true,
    });

    // Render menu items
    for (const item of items) {
        if (item.divider) {
            const divider = document.createElement('div');
            divider.classList.add('sm-event-context-menu__divider');
            menu.appendChild(divider);
            continue;
        }

        const menuItem = document.createElement('div');
        menuItem.classList.add('sm-event-context-menu__item');
        if (item.danger) {
            menuItem.classList.add('sm-event-context-menu__item--danger');
        }

        const labelSpan = document.createElement('span');
        labelSpan.textContent = item.label;
        menuItem.appendChild(labelSpan);

        if (item.shortcut) {
            const shortcutSpan = document.createElement('span');
            shortcutSpan.classList.add('sm-event-context-menu__shortcut');
            shortcutSpan.textContent = item.shortcut;
            menuItem.appendChild(shortcutSpan);
        }

        if (item.hasSubmenu) {
            const arrow = document.createElement('span');
            arrow.classList.add('sm-event-context-menu__arrow');
            arrow.textContent = '▶';
            menuItem.appendChild(arrow);

            // Show submenu on hover
            menuItem.addEventListener('mouseenter', () => {
                if (item.label === 'Change Priority') {
                    showPrioritySubmenu(menuItem, options);
                } else if (item.label === 'Change Category') {
                    showCategorySubmenu(menuItem, options);
                }
            });
        } else {
            menuItem.addEventListener('click', item.action);
        }

        menu.appendChild(menuItem);
    }

    // Add menu to body
    document.body.appendChild(menu);

    // Adjust position if menu goes off-screen
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
    }

    // Close menu on click outside
    const handleClickOutside = (e: MouseEvent): void => {
        if (!menu.contains(e.target as Node)) {
            closeMenu();
        }
    };

    // Close menu on Escape key
    const handleEscapeKey = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
            closeMenu();
        }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    function closeMenu(): void {
        logger.info("Closing menu");
        menu.remove();
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
    }
}

/**
 * Show Priority Submenu
 */
function showPrioritySubmenu(parentItem: HTMLElement, options: EventContextMenuOptions): void {
    // Remove any existing submenu
    const existingSubmenu = document.querySelector('.sm-event-context-menu__submenu');
    existingSubmenu?.remove();

    const submenu = document.createElement('div');
    submenu.classList.add('sm-event-context-menu__submenu');

    const priorities = [
        { label: 'Urgent', value: 10, color: '#EF4444' },
        { label: 'High', value: 7, color: '#F59E0B' },
        { label: 'Normal', value: 5, color: '#3B82F6' },
        { label: 'Low', value: 2, color: '#6B7280' },
    ];

    for (const priority of priorities) {
        const item = document.createElement('div');
        item.classList.add('sm-event-context-menu__item');

        const indicator = document.createElement('span');
        indicator.classList.add('sm-event-context-menu__priority-indicator');
        indicator.style.backgroundColor = priority.color;
        item.appendChild(indicator);

        const label = document.createElement('span');
        label.textContent = priority.label;
        item.appendChild(label);

        item.addEventListener('click', async () => {
            logger.info("Priority changed", { priority: priority.value });
            try {
                await options.onChangePriority(options.event, priority.value);
                new Notice(`Priority changed to ${priority.label}`);
            } catch (error) {
                logger.error("Failed to change priority", { error });
                new Notice(`Failed to change priority: ${error instanceof Error ? error.message : String(error)}`);
            }
            submenu.remove();
        });

        submenu.appendChild(item);
    }

    // Position submenu to the right of parent item
    const parentRect = parentItem.getBoundingClientRect();
    submenu.style.left = `${parentRect.right + 5}px`;
    submenu.style.top = `${parentRect.top}px`;

    document.body.appendChild(submenu);
}

/**
 * Show Category Submenu
 */
function showCategorySubmenu(parentItem: HTMLElement, options: EventContextMenuOptions): void {
    // Remove any existing submenu
    const existingSubmenu = document.querySelector('.sm-event-context-menu__submenu');
    existingSubmenu?.remove();

    const submenu = document.createElement('div');
    submenu.classList.add('sm-event-context-menu__submenu');

    const categories = options.recentCategories ?? ['Political', 'Combat', 'Social', 'Travel'];

    for (const category of categories) {
        const item = document.createElement('div');
        item.classList.add('sm-event-context-menu__item');
        item.textContent = category;

        item.addEventListener('click', async () => {
            logger.info("Category changed", { category });
            try {
                await options.onChangeCategory(options.event, category);
                new Notice(`Category changed to ${category}`);
            } catch (error) {
                logger.error("Failed to change category", { error });
                new Notice(`Failed to change category: ${error instanceof Error ? error.message : String(error)}`);
            }
            submenu.remove();
        });

        submenu.appendChild(item);
    }

    // Add "Custom..." option
    const customItem = document.createElement('div');
    customItem.classList.add('sm-event-context-menu__item');
    customItem.textContent = 'Custom...';
    customItem.addEventListener('click', () => {
        submenu.remove();
        // Open full editor for custom category input
        options.onEdit(options.event);
    });
    submenu.appendChild(customItem);

    // Position submenu to the right of parent item
    const parentRect = parentItem.getBoundingClientRect();
    submenu.style.left = `${parentRect.right + 5}px`;
    submenu.style.top = `${parentRect.top}px`;

    document.body.appendChild(submenu);
}
