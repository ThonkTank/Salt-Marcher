// src/workmodes/almanac/index.ts
// Obsidian ItemView entry point for the Almanac workmode.

/**
 * @file Almanac View
 * @description Main view entry point for the Almanac workmode. Registers as an Obsidian ItemView.
 * @module apps/almanac
 */

import type { App } from "obsidian";
import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { createWorkmodeHeader, type WorkmodeHeaderHandle } from "../../ui";
import { openEventEditor } from "./view/event-editor-modal";
import { logger } from "../../app/plugin-logger";

export const VIEW_TYPE_ALMANAC = "almanac-view";
export const VIEW_ALMANAC = VIEW_TYPE_ALMANAC;

export class AlmanacView extends ItemView {
    private header?: WorkmodeHeaderHandle;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_ALMANAC;
    }

    getDisplayText(): string {
        return "Almanac";
    }

    getIcon(): string {
        return "calendar";
    }

    async onOpen(): Promise<void> {
        const content = this.contentEl;
        content.empty();
        content.addClass("sm-almanac");

        this.header = createWorkmodeHeader(content, {
            title: "Almanac",
            search: {
                placeholder: "Search events…",
                disabled: false,
                onChange: (query: string) => {
                    logger.info("[almanac] Search query changed", { query });
                    // MVP: Show placeholder notice
                    if (query.trim()) {
                        new Notice("Event search coming soon in a future update");
                    }
                },
            },
            action: {
                label: "Add event",
                disabled: false,
                onClick: () => {
                    logger.info("[almanac] Opening event editor for new event");
                    openEventEditor(this.app, {
                        onSave: (event) => {
                            logger.info("[almanac] Event saved", { eventId: event.id });
                            new Notice("Event saved successfully");
                            // Future: Refresh event list
                        },
                    });
                },
            },
        });

        const mainContent = content.createDiv({ cls: "sm-almanac__content" });

        // Import and render MVP components dynamically
        const { renderAlmanacMVP } = await import("./view/almanac-mvp");
        await renderAlmanacMVP(this.app, mainContent);
    }

    async onClose(): Promise<void> {
        this.header?.destroy();
        this.header = undefined;
        this.contentEl.removeClass("sm-almanac");
    }
}

/**
 * Opens or activates the Almanac view in the main workspace
 */
export async function openAlmanac(app: App): Promise<void> {
    const { workspace } = app;

    // Check if view is already open
    const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_ALMANAC);

    if (existingLeaves.length > 0) {
        // Activate existing leaf
        workspace.revealLeaf(existingLeaves[0]);
        return;
    }

    // Create new leaf in main workspace (new tab)
    const leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_ALMANAC, active: true });
    workspace.revealLeaf(leaf);
}
