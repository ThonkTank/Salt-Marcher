// src/workmodes/library/entities/equipment/view-config.ts
// View configuration for equipment list: metadata fields, actions, and create handler

import type { App } from "obsidian";
import type { LibraryEntry } from "../../storage/data-sources";
import { loadEquipmentFile } from "../../storage/equipment";
import { openCreateModal } from "../../../../features/data-manager";
import { createStandardActions } from "../../../../features/data-manager/browse/action-factory";
import { equipmentSpec } from "./create-spec";
import type { WorkmodeTileMetadata, WorkmodeTileAction } from "../../../../ui/workmode/list-renderer";

export interface LibraryActionContext {
    readonly app: App;
    reloadEntries: () => Promise<void>;
    getRenderer: () => LibraryViewConfig;
    getFilterSelection?: (id: string) => string | undefined;
}

export type MetadataField = WorkmodeTileMetadata<LibraryEntry<"equipment">>;
export type ActionDefinition = WorkmodeTileAction<LibraryEntry<"equipment">, LibraryActionContext>;

export interface LibraryViewConfig {
    readonly metadataFields: MetadataField[];
    readonly actions: ActionDefinition[];
    readonly handleCreate: (context: LibraryActionContext, name: string) => Promise<void>;
}

// Metadata fields for equipment list tiles
const metadataFields: MetadataField[] = [
    {
        id: "type",
        cls: "sm-cc-item__type",
        getValue: (entry) => entry.type,
    },
    {
        id: "role",
        cls: "sm-cc-item__cr",
        getValue: (entry) => entry.role,
    },
];

// Actions available for each equipment (Open, Edit, Duplicate, Delete)
const actions: ActionDefinition[] = createStandardActions("equipment", () => ({
    id: "edit",
    label: "Edit",
    execute: async (entry, context) => {
        const { app } = context;
        try {
            const equipmentData = await loadEquipmentFile(app, entry.file);
            const result = await openCreateModal(equipmentSpec, {
                app,
                preset: equipmentData,
            });
            if (result) {
                await context.reloadEntries();
                await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
            }
        } catch (err) {
            console.error("Failed to edit equipment", err);
        }
    },
}));

// Handler for creating new equipment
const handleCreate = async (context: LibraryActionContext, name: string): Promise<void> => {
    const { app } = context;
    const result = await openCreateModal(equipmentSpec, {
        app,
        preset: name,
    });
    if (result) {
        await context.reloadEntries();
        await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
    }
};

// Export the complete view configuration
export const equipmentViewConfig: LibraryViewConfig = {
    metadataFields,
    actions,
    handleCreate,
};
