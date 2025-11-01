// src/workmodes/almanac/view/event-editor-modal.ts
// Event editor modal for creating/editing calendar events and phenomena

import { App, Modal } from "obsidian";
import type { CalendarEvent } from "../domain";
import { logger } from "../../../app/plugin-logger";

export interface EventEditorModalOptions {
    /** Existing event to edit, or undefined to create new event */
    readonly event?: CalendarEvent;
    /** Callback when event is saved */
    readonly onSave?: (event: CalendarEvent) => void;
}

/**
 * Event Editor Modal
 *
 * Placeholder modal for creating and editing calendar events.
 * Currently shows "Coming Soon" message.
 *
 * Future implementation will include:
 * - Event title, description, category fields
 * - Timestamp picker (year/month/day/hour/minute)
 * - Recurrence pattern editor
 * - Tags and metadata management
 */
export class EventEditorModal extends Modal {
    private options: EventEditorModalOptions;

    constructor(app: App, options: EventEditorModalOptions = {}) {
        super(app);
        this.options = options;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sm-almanac-event-editor");

        const isEditMode = !!this.options.event;
        const title = isEditMode ? "Edit Event" : "Create Event";

        contentEl.createEl("h2", { text: title });

        // MVP placeholder notice
        const notice = contentEl.createDiv({ cls: "sm-almanac-event-editor__notice" });
        notice.createEl("h3", { text: "Coming Soon" });
        notice.createEl("p", {
            text: "The event editor is currently under development. Full event creation and editing functionality will be available in a future update.",
        });

        // Future features list
        const futureFeatures = notice.createDiv({ cls: "sm-almanac-event-editor__features" });
        futureFeatures.createEl("h4", { text: "Planned Features:" });
        const featureList = futureFeatures.createEl("ul");
        featureList.createEl("li", { text: "Event title, description, and category" });
        featureList.createEl("li", { text: "Precise timestamp selection (date and time)" });
        featureList.createEl("li", { text: "Recurrence patterns (daily, weekly, monthly, yearly)" });
        featureList.createEl("li", { text: "Tags for organization and filtering" });
        featureList.createEl("li", { text: "Integration with faction goals and calendar hooks" });

        // Close button
        const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
        const closeBtn = btnRow.createEl("button", { text: "Close" });
        closeBtn.addEventListener("click", () => this.close());

        logger.info("[almanac] Event editor modal opened", { isEditMode });
    }

    onClose(): void {
        this.contentEl.removeClass("sm-almanac-event-editor");
        this.contentEl.empty();
    }
}

/**
 * Opens the event editor modal
 *
 * @param app - Obsidian App instance
 * @param options - Editor options (event to edit, save callback)
 */
export function openEventEditor(app: App, options: EventEditorModalOptions = {}): void {
    const modal = new EventEditorModal(app, options);
    modal.open();
}
