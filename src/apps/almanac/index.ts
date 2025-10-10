// src/apps/almanac/index.ts
// Obsidian ItemView entry point for the Almanac workmode.

/**
 * @file Almanac View
 * @description Main view entry point for the Almanac workmode. Registers as an Obsidian ItemView.
 * @module apps/almanac
 */

import type { App } from "obsidian";
import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_ALMANAC = "almanac-view";
export const VIEW_ALMANAC = VIEW_TYPE_ALMANAC;

export class AlmanacView extends ItemView {
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
        const container = this.containerEl;
        const content = container.children[1] as HTMLElement;
        content.empty();

        const placeholder = content.createDiv({ cls: "almanac-placeholder" });
        placeholder.createEl("h2", { text: "Almanac front-end removed" });
        placeholder.createEl("p", {
            text: "The Almanac's interactive interface has been removed. Existing calendar data remains available for other modules.",
        });
    }

    async onClose(): Promise<void> {
        // No resources to release after the front-end removal.
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
