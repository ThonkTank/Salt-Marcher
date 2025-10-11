// src/apps/almanac/index.ts
// Obsidian ItemView entry point for the Almanac workmode.

/**
 * @file Almanac View
 * @description Main view entry point for the Almanac workmode. Registers as an Obsidian ItemView.
 * @module apps/almanac
 */

import type { App } from "obsidian";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { createWorkmodeHeader, type WorkmodeHeaderHandle } from "../../ui/workmode";

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
        const container = this.containerEl;
        const content = container.children[1] as HTMLElement;
        content.empty();

        this.header?.destroy();
        this.header = createWorkmodeHeader(content, {
            title: this.getDisplayText(),
            description: {
                text: "The Almanac's interactive interface has been removed. Existing calendar data remains available for other modules.",
            },
        });

        const placeholder = content.createDiv({ cls: "almanac-placeholder" });
        placeholder.createEl("p", {
            text: "This view will host the unified workmode UI once the Almanac front-end returns.",
        });
    }

    async onClose(): Promise<void> {
        this.header?.destroy();
        this.header = undefined;
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
