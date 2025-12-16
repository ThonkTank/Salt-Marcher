// src/features/events/inbox-status-bar.ts
// StatusBar widget showing unread inbox count with dropdown menu

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("event-inbox-status-bar");
import type { EventHistoryStore } from "./event-history-store";
import type { InboxItem } from "./event-history-types";

/**
 * Inbox StatusBar Widget
 *
 * Displays unread event count in statusbar with click-to-open menu
 */
export class InboxStatusBar {
    private readonly app: App;
    private readonly store: EventHistoryStore;
    private readonly statusBarItem: HTMLElement;
    private unsubscribe?: () => void;
    private currentCount = 0;

    constructor(app: App, store: EventHistoryStore, statusBarItem: HTMLElement) {
        this.app = app;
        this.store = store;
        this.statusBarItem = statusBarItem;

        this.setupStatusBarItem();
        this.subscribeToInbox();
    }

    /**
     * Setup the statusbar item appearance and click handler
     */
    private setupStatusBarItem(): void {
        this.statusBarItem.addClass("sm-inbox-statusbar");
        this.statusBarItem.setAttribute("aria-label", "Event Inbox");

        // Click handler to open menu
        this.statusBarItem.addEventListener("click", (event) => {
            this.openInboxMenu(event);
        });
    }

    /**
     * Subscribe to inbox changes and update display
     */
    private subscribeToInbox(): void {
        this.unsubscribe = this.store.subscribeInboxCount((count) => {
            this.currentCount = count;
            this.updateDisplay(count);
        });

        logger.info("Subscribed to inbox updates");
    }

    /**
     * Update the statusbar display with current count
     */
    private updateDisplay(count: number): void {
        if (count === 0) {
            this.statusBarItem.setText("📬 Inbox");
            this.statusBarItem.removeClass("sm-inbox-statusbar--has-unread");
        } else {
            this.statusBarItem.setText(`📬 Inbox (${count})`);
            this.statusBarItem.addClass("sm-inbox-statusbar--has-unread");
        }

        logger.info("Display updated", { count });
    }

    /**
     * Open the inbox menu at cursor position
     */
    private openInboxMenu(event: MouseEvent): void {
        const inbox = this.store.getInbox();

        // Import Menu dynamically to avoid circular dependencies
        const { Menu } = require("obsidian");
        const menu = new Menu();

        if (inbox.length === 0) {
            menu.addItem((item) => {
                item.setTitle("No unread events").setDisabled(true);
            });
        } else {
            // Add inbox items to menu
            for (const item of inbox.slice(0, 10)) {
                // Limit to 10 items
                menu.addItem((menuItem) => {
                    const title = this.formatInboxItemTitle(item);
                    menuItem.setTitle(title).onClick(() => {
                        this.handleInboxItemClick(item);
                    });
                });
            }

            // Separator before actions
            menu.addSeparator();

            // "Mark all as read" action
            menu.addItem((item) => {
                item.setTitle("Mark all as read")
                    .setIcon("check-check")
                    .onClick(() => {
                        this.handleMarkAllAsRead();
                    });
            });
        }

        // "Open Timeline" action
        menu.addSeparator();
        menu.addItem((item) => {
            item.setTitle("Open Timeline")
                .setIcon("clock")
                .onClick(() => {
                    this.handleOpenTimeline();
                });
        });

        // Show menu at mouse position
        menu.showAtMouseEvent(event);

        logger.info("Menu opened", { itemCount: inbox.length });
    }

    /**
     * Format an inbox item for display in menu
     */
    private formatInboxItemTitle(item: InboxItem): string {
        const priorityIndicator = item.priority >= 80 ? "❗" : item.priority >= 50 ? "•" : "◦";
        const typeIndicator = item.type === "event" ? "📅" : "🌙";
        return `${priorityIndicator} ${typeIndicator} ${item.title}`;
    }

    /**
     * Handle click on an inbox item
     */
    private handleInboxItemClick(item: InboxItem): void {
        // Mark as read
        this.store.markAsRead(item.entryId);

        logger.info("Item clicked and marked as read", {
            entryId: item.entryId,
            title: item.title,
        });

        // TODO: Optional - open Timeline View and scroll to entry
        // For now, just mark as read
    }

    /**
     * Handle "Mark all as read" action
     */
    private handleMarkAllAsRead(): void {
        this.store.markAllAsRead();
        logger.info("All inbox items marked as read");
    }

    /**
     * Handle "Open Timeline" action
     */
    private async handleOpenTimeline(): Promise<void> {
        try {
            const { openTimelineView, globalEventHistoryStore } = await import("./index");
            await openTimelineView(this.app, globalEventHistoryStore);
            logger.info("Timeline view opened");
        } catch (error) {
            logger.error("Failed to open Timeline view", error);
        }
    }

    /**
     * Cleanup and unsubscribe
     */
    destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.statusBarItem.empty();
        logger.info("Destroyed");
    }
}

/**
 * Create and initialize inbox statusbar widget
 */
export function createInboxStatusBar(app: App, store: EventHistoryStore, statusBarItem: HTMLElement): InboxStatusBar {
    return new InboxStatusBar(app, store, statusBarItem);
}
