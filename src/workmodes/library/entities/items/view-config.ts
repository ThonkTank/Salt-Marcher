// src/workmodes/library/entities/items/view-config.ts
// View configuration for items list: metadata fields, actions, and create handler

import type { App } from "obsidian";
import type { LibraryEntry } from "../../storage/data-sources";
import { loadItemFile } from "../../storage/items";
import { openCreateModal } from "../../../../features/data-manager";
import { createStandardActions } from "../../../../features/data-manager/browse/action-factory";
import { itemSpec } from "./create-spec";
import type { WorkmodeTileMetadata, WorkmodeTileAction } from "../../../../ui/workmode/list-renderer";

export interface LibraryActionContext {
    readonly app: App;
    reloadEntries: () => Promise<void>;
    getRenderer: () => LibraryViewConfig;
    getFilterSelection?: (id: string) => string | undefined;
}

export type MetadataField = WorkmodeTileMetadata<LibraryEntry<"items">>;
export type ActionDefinition = WorkmodeTileAction<LibraryEntry<"items">, LibraryActionContext>;

export interface LibraryViewConfig {
    readonly metadataFields: MetadataField[];
    readonly actions: ActionDefinition[];
    readonly handleCreate: (context: LibraryActionContext, name: string) => Promise<void>;
}

// Metadata fields for item list tiles
const metadataFields: MetadataField[] = [
    {
        id: "category",
        cls: "sm-cc-item__type",
        getValue: (entry) => entry.category,
    },
    {
        id: "rarity",
        cls: "sm-cc-item__cr",
        getValue: (entry) => entry.rarity,
    },
];

// Actions available for each item (Open, Edit, Duplicate, Delete)
const actions: ActionDefinition[] = createStandardActions("item", () => ({
    id: "edit",
    label: "Edit",
    execute: async (entry, context) => {
        const { app } = context;
        try {
            const itemData = await loadItemFile(app, entry.file);
            const result = await openCreateModal(itemSpec, {
                app,
                preset: itemData,
            });
            if (result) {
                await context.reloadEntries();
                await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
            }
        } catch (err) {
            console.error("Failed to edit item", err);
        }
    },
}));

// Handler for creating new items
const handleCreate = async (context: LibraryActionContext, name: string): Promise<void> => {
    const { app } = context;
    const result = await openCreateModal(itemSpec, {
        app,
        preset: name,
    });
    if (result) {
        await context.reloadEntries();
        await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
    }
};

// Export the complete view configuration
export const itemViewConfig: LibraryViewConfig = {
    metadataFields,
    actions,
    handleCreate,
};
