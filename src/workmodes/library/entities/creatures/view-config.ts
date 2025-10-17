// src/workmodes/library/entities/creatures/view-config.ts
// View configuration for creatures list: metadata fields, actions, and create handler

import type { App } from "obsidian";
import type { LibraryEntry } from "../../storage/data-sources";
import { loadCreaturePreset } from "../../storage/creatures";
import { openCreateModal } from "../../../../features/data-manager";
import { createStandardActions } from "../../../../features/data-manager/browse/action-factory";
import { creatureSpec } from "./create-spec";
import type { WorkmodeTileMetadata, WorkmodeTileAction } from "../../../../ui/workmode/list-renderer";

export interface LibraryActionContext {
    readonly app: App;
    reloadEntries: () => Promise<void>;
    getRenderer: () => LibraryViewConfig;
    getFilterSelection?: (id: string) => string | undefined;
}

export type MetadataField = WorkmodeTileMetadata<LibraryEntry<"creatures">>;
export type ActionDefinition = WorkmodeTileAction<LibraryEntry<"creatures">, LibraryActionContext>;

export interface LibraryViewConfig {
    readonly metadataFields: MetadataField[];
    readonly actions: ActionDefinition[];
    readonly handleCreate: (context: LibraryActionContext, name: string) => Promise<void>;
}

// Metadata fields for creature list tiles
const metadataFields: MetadataField[] = [
    {
        id: "type",
        cls: "sm-cc-item__type",
        getValue: (entry) => entry.type,
    },
    {
        id: "cr",
        cls: "sm-cc-item__cr",
        getValue: (entry) => entry.cr ? `CR ${entry.cr}` : undefined,
    },
];

// Actions available for each creature (Open, Edit, Duplicate, Delete)
const actions: ActionDefinition[] = createStandardActions("creature", () => ({
    id: "edit",
    label: "Edit",
    execute: async (entry, context) => {
        const { app } = context;
        try {
            const creatureData = await loadCreaturePreset(app, entry.file);
            const result = await openCreateModal(creatureSpec, {
                app,
                preset: creatureData,
            });
            if (result) {
                await context.reloadEntries();
                await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
            }
        } catch (err) {
            console.error("Failed to load creature for editing", err);
        }
    },
}));

// Handler for creating new creatures
const handleCreate = async (context: LibraryActionContext, name: string): Promise<void> => {
    const { app } = context;
    const result = await openCreateModal(creatureSpec, {
        app,
        preset: name,
    });
    if (result) {
        await context.reloadEntries();
        await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
    }
};

// Export the complete view configuration
export const creatureViewConfig: LibraryViewConfig = {
    metadataFields,
    actions,
    handleCreate,
};
