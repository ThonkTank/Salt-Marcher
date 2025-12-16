// src/features/events/timeline-view.ts
// Timeline View for Event History - displays chronological list of triggered events

import type { App , WorkspaceLeaf } from "obsidian";
import { ItemView } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("event-timeline-view");
import { createWorkmodeHeader, type WorkmodeHeaderHandle } from "../data-manager/browse/workmode-header";
import { isTriggeredEvent } from "./event-history-types";
import type { EventHistoryStore } from "./event-history-store";
import type { TimelineEntry, TimelineFilter, TimelineSortOptions } from "./event-history-types";

export const VIEW_TYPE_TIMELINE = "event-timeline-view";

/**
 * Timeline View - displays all triggered events and phenomena in chronological order
 */
export class TimelineView extends ItemView {
    private readonly store: EventHistoryStore;
    private header?: WorkmodeHeaderHandle;
    private rootEl?: HTMLDivElement;
    private filterBarEl?: HTMLDivElement;
    private sortBarEl?: HTMLDivElement;
    private timelineListEl?: HTMLDivElement;
    private emptyStateEl?: HTMLDivElement;

    private unsubscribeTimeline?: () => void;

    // Current filter/sort state
    private currentFilter: TimelineFilter = {};
    private currentSort: TimelineSortOptions = {
        field: "triggeredAt",
        order: "desc",
    };

    constructor(leaf: WorkspaceLeaf, store: EventHistoryStore) {
        super(leaf);
        this.store = store;
    }

    getViewType(): string {
        return VIEW_TYPE_TIMELINE;
    }

    getDisplayText(): string {
        return "Event Timeline";
    }

    getIcon(): string {
        return "clock";
    }

    async onOpen(): Promise<void> {
        const content = this.contentEl;
        content.empty();
        content.addClass("sm-timeline-view");

        this.header = createWorkmodeHeader(content, {
            title: "Event Timeline",
            search: {
                placeholder: "Search events…",
                disabled: true, // TODO: Enable search in future iteration
            },
            action: {
                label: "Clear timeline",
                onClick: () => this.handleClearTimeline(),
            },
        });

        this.rootEl = content.createDiv({ cls: "sm-timeline-container" });

        // Render filter bar
        this.renderFilterBar();

        // Render sort bar
        this.renderSortBar();

        // Timeline list container
        this.timelineListEl = this.rootEl.createDiv({ cls: "sm-timeline-list" });

        // Empty state
        this.emptyStateEl = this.rootEl.createDiv({
            cls: "sm-timeline-empty",
            text: "No events have been triggered yet. Travel mode and calendar advances will populate this timeline.",
        });

        // Subscribe to store changes
        this.unsubscribeTimeline = this.store.subscribeTimeline(() => {
            this.renderTimeline();
        });

        // Initial render
        this.renderTimeline();

        logger.info("View opened");
    }

    async onClose(): Promise<void> {
        this.unsubscribeTimeline?.();
        this.unsubscribeTimeline = undefined;
        this.header?.destroy();
        this.header = undefined;
        this.contentEl.removeClass("sm-timeline-view");
        logger.info("View closed");
    }

    /**
     * Render filter controls
     */
    private renderFilterBar(): void {
        if (!this.rootEl) return;

        this.filterBarEl = this.rootEl.createDiv({ cls: "sm-timeline-filters" });

        const scopeLabel = this.filterBarEl.createEl("label", {
            cls: "sm-timeline-filter-label",
            text: "Scope:",
        });
        const scopeSelect = this.filterBarEl.createEl("select", {
            cls: "sm-timeline-filter-select",
        }) as HTMLSelectElement;
        scopeSelect.createEl("option", { value: "", text: "All" });
        scopeSelect.createEl("option", { value: "global", text: "Global" });
        scopeSelect.createEl("option", { value: "travel", text: "Travel" });
        scopeSelect.addEventListener("change", () => {
            this.currentFilter.scope = scopeSelect.value === "" ? undefined : (scopeSelect.value as "global" | "travel");
            this.renderTimeline();
        });

        const categoryLabel = this.filterBarEl.createEl("label", {
            cls: "sm-timeline-filter-label",
            text: "Category:",
        });
        const categoryInput = this.filterBarEl.createEl("input", {
            cls: "sm-timeline-filter-input",
            attr: { type: "text", placeholder: "e.g., festival" },
        }) as HTMLInputElement;
        categoryInput.addEventListener("input", () => {
            this.currentFilter.category = categoryInput.value.trim() || undefined;
            this.renderTimeline();
        });

        const clearButton = this.filterBarEl.createEl("button", {
            cls: "sm-timeline-filter-clear",
            text: "Clear filters",
        });
        clearButton.addEventListener("click", () => {
            scopeSelect.value = "";
            categoryInput.value = "";
            this.currentFilter = {};
            this.renderTimeline();
        });
    }

    /**
     * Render sort controls
     */
    private renderSortBar(): void {
        if (!this.rootEl) return;

        this.sortBarEl = this.rootEl.createDiv({ cls: "sm-timeline-sort" });

        const sortLabel = this.sortBarEl.createEl("label", {
            cls: "sm-timeline-sort-label",
            text: "Sort by:",
        });

        const sortFieldSelect = this.sortBarEl.createEl("select", {
            cls: "sm-timeline-sort-select",
        }) as HTMLSelectElement;
        sortFieldSelect.createEl("option", { value: "triggeredAt", text: "Triggered time" });
        sortFieldSelect.createEl("option", { value: "timestamp", text: "Event date" });
        sortFieldSelect.createEl("option", { value: "priority", text: "Priority" });
        sortFieldSelect.createEl("option", { value: "title", text: "Title" });
        sortFieldSelect.value = this.currentSort.field;
        sortFieldSelect.addEventListener("change", () => {
            this.currentSort.field = sortFieldSelect.value as TimelineSortOptions["field"];
            this.renderTimeline();
        });

        const sortOrderSelect = this.sortBarEl.createEl("select", {
            cls: "sm-timeline-sort-select",
        }) as HTMLSelectElement;
        sortOrderSelect.createEl("option", { value: "desc", text: "Newest first" });
        sortOrderSelect.createEl("option", { value: "asc", text: "Oldest first" });
        sortOrderSelect.value = this.currentSort.order;
        sortOrderSelect.addEventListener("change", () => {
            this.currentSort.order = sortOrderSelect.value as "asc" | "desc";
            this.renderTimeline();
        });
    }

    /**
     * Render timeline entries
     */
    private renderTimeline(): void {
        if (!this.timelineListEl || !this.emptyStateEl) return;

        // Get filtered and sorted timeline
        const filteredEntries = this.store.getFilteredTimeline(this.currentFilter);
        const sortedEntries = this.sortEntries(filteredEntries, this.currentSort);

        // Clear list
        this.timelineListEl.empty();

        // Show/hide empty state
        if (sortedEntries.length === 0) {
            this.emptyStateEl.removeClass("sm-timeline-hidden");
            return;
        }

        this.emptyStateEl.addClass("sm-timeline-hidden");

        // Render each entry
        for (const entry of sortedEntries) {
            this.renderEntry(entry);
        }

        logger.info("Rendered timeline", {
            total: sortedEntries.length,
            filter: this.currentFilter,
            sort: this.currentSort,
        });
    }

    /**
     * Sort timeline entries (helper because we need to handle both timestamp and triggeredAt)
     */
    private sortEntries(entries: TimelineEntry[], sortOptions: TimelineSortOptions): TimelineEntry[] {
        const sorted = [...entries];
        sorted.sort((a, b) => {
            let compareA: number | string;
            let compareB: number | string;

            switch (sortOptions.field) {
                case "timestamp":
                    compareA = a.timestamp.year * 10000 + a.timestamp.day;
                    compareB = b.timestamp.year * 10000 + b.timestamp.day;
                    break;
                case "triggeredAt":
                    compareA = a.triggeredAt.getTime();
                    compareB = b.triggeredAt.getTime();
                    break;
                case "priority":
                    compareA = isTriggeredEvent(a) ? a.priority ?? 50 : 50;
                    compareB = isTriggeredEvent(b) ? b.priority ?? 50 : 50;
                    break;
                case "title":
                    compareA = isTriggeredEvent(a) ? a.title : (a as any).title ?? "";
                    compareB = isTriggeredEvent(b) ? b.title : (b as any).title ?? "";
                    break;
                default:
                    return 0;
            }

            if (compareA < compareB) return sortOptions.order === "asc" ? -1 : 1;
            if (compareA > compareB) return sortOptions.order === "asc" ? 1 : -1;
            return 0;
        });
        return sorted;
    }

    /**
     * Render a single timeline entry
     */
    private renderEntry(entry: TimelineEntry): void {
        if (!this.timelineListEl) return;

        const entryEl = this.timelineListEl.createDiv({ cls: "sm-timeline-entry" });

        // Mark as read/unread
        const isRead = this.store.isRead(entry.id);
        if (!isRead) {
            entryEl.addClass("sm-timeline-entry--unread");
        }

        // Entry header
        const headerEl = entryEl.createDiv({ cls: "sm-timeline-entry-header" });

        // Type badge
        const typeEl = headerEl.createDiv({ cls: "sm-timeline-entry-type" });
        if (isTriggeredEvent(entry)) {
            typeEl.setText("Event");
            typeEl.addClass("sm-timeline-entry-type--event");
        } else {
            typeEl.setText("Phenomenon");
            typeEl.addClass("sm-timeline-entry-type--phenomenon");
        }

        // Title
        const titleEl = headerEl.createDiv({ cls: "sm-timeline-entry-title" });
        const title = isTriggeredEvent(entry) ? entry.title : (entry as any).title ?? entry.phenomenonId;
        titleEl.setText(title);

        // Category badge (events only)
        if (isTriggeredEvent(entry) && entry.category) {
            const categoryEl = headerEl.createDiv({ cls: "sm-timeline-entry-category" });
            categoryEl.setText(entry.category);
        }

        // Priority (events only)
        if (isTriggeredEvent(entry) && entry.priority !== undefined) {
            const priorityEl = headerEl.createDiv({ cls: "sm-timeline-entry-priority" });
            priorityEl.setText(`Priority: ${entry.priority}`);
        }

        // Meta info
        const metaEl = entryEl.createDiv({ cls: "sm-timeline-entry-meta" });

        const timestampEl = metaEl.createDiv({ cls: "sm-timeline-entry-meta-item" });
        timestampEl.createSpan({ cls: "label", text: "Event date: " });
        timestampEl.createSpan({ cls: "value", text: formatTimestamp(entry.timestamp) });

        const triggeredAtEl = metaEl.createDiv({ cls: "sm-timeline-entry-meta-item" });
        triggeredAtEl.createSpan({ cls: "label", text: "Triggered: " });
        triggeredAtEl.createSpan({ cls: "value", text: formatDate(entry.triggeredAt) });

        const scopeEl = metaEl.createDiv({ cls: "sm-timeline-entry-meta-item" });
        scopeEl.createSpan({ cls: "label", text: "Scope: " });
        scopeEl.createSpan({ cls: "value", text: entry.scope });

        const reasonEl = metaEl.createDiv({ cls: "sm-timeline-entry-meta-item" });
        reasonEl.createSpan({ cls: "label", text: "Reason: " });
        reasonEl.createSpan({ cls: "value", text: entry.reason });

        // Actions
        const actionsEl = entryEl.createDiv({ cls: "sm-timeline-entry-actions" });

        if (!isRead) {
            const markReadBtn = actionsEl.createEl("button", {
                cls: "sm-timeline-btn sm-timeline-btn-primary",
                text: "Mark as read",
            });
            markReadBtn.addEventListener("click", () => {
                this.store.markAsRead(entry.id);
                this.renderTimeline(); // Re-render to update visual state
            });
        } else {
            const markUnreadBtn = actionsEl.createEl("button", {
                cls: "sm-timeline-btn",
                text: "Mark as unread",
            });
            markUnreadBtn.addEventListener("click", () => {
                this.store.markAsUnread(entry.id);
                this.renderTimeline(); // Re-render to update visual state
            });
        }
    }

    /**
     * Handle clear timeline button
     */
    private handleClearTimeline(): void {
        const confirmed = window.confirm("Clear entire timeline? This cannot be undone.");
        if (!confirmed) return;

        this.store.clear();
        logger.info("Timeline cleared by user");
    }
}

/**
 * Format CalendarTimestamp for display
 */
function formatTimestamp(timestamp: { year: number; monthId: string; day: number }): string {
    return `${timestamp.year}-${timestamp.monthId}-${String(timestamp.day).padStart(2, "0")}`;
}

/**
 * Format Date for display
 */
function formatDate(date: Date): string {
    return date.toLocaleString();
}

/**
 * Opens or activates the Timeline view
 */
export async function openTimelineView(app: App, store: EventHistoryStore): Promise<void> {
    const { workspace } = app;

    // Check if view is already open
    const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);

    if (existingLeaves.length > 0) {
        // Activate existing leaf
        workspace.revealLeaf(existingLeaves[0]);
        return;
    }

    // Create new leaf in main workspace (new tab)
    const leaf = workspace.getLeaf(true);
    await leaf.setViewState({
        type: VIEW_TYPE_TIMELINE,
        active: true,
    });
    workspace.revealLeaf(leaf);
}
