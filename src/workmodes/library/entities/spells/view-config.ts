// src/workmodes/library/entities/spells/view-config.ts
// View configuration for spells list: metadata fields, actions, and create handler

import type { App } from "obsidian";
import type { LibraryEntry } from "../../storage/data-sources";
import { loadSpellFile, type SpellData } from "../../storage/spells";
import { openCreateModal } from "../../../../features/data-manager";
import { createStandardActions } from "../../../../features/data-manager/browse/action-factory";
import { spellSpec } from "./create-spec";
import { formatSpellLevel } from "./list-schema";
import type { WorkmodeTileMetadata, WorkmodeTileAction } from "../../../../ui/workmode/list-renderer";

export interface LibraryActionContext {
    readonly app: App;
    reloadEntries: () => Promise<void>;
    getRenderer: () => LibraryViewConfig;
    getFilterSelection?: (id: string) => string | undefined;
}

export type MetadataField = WorkmodeTileMetadata<LibraryEntry<"spells">>;
export type ActionDefinition = WorkmodeTileAction<LibraryEntry<"spells">, LibraryActionContext>;

export interface LibraryViewConfig {
    readonly metadataFields: MetadataField[];
    readonly actions: ActionDefinition[];
    readonly handleCreate: (context: LibraryActionContext, name: string) => Promise<void>;
}

// Metadata fields for spell list tiles
const metadataFields: MetadataField[] = [
    {
        id: "level",
        cls: "sm-cc-item__type",
        getValue: (entry) => formatSpellLevel(entry.level),
    },
    {
        id: "school",
        cls: "sm-cc-item__cr",
        getValue: (entry) => entry.school,
    },
];

// Actions available for each spell (Open, Edit, Duplicate, Delete)
const actions: ActionDefinition[] = createStandardActions("spell", () => ({
    id: "edit",
    label: "Edit",
    execute: async (entry, context) => {
        const { app } = context;
        try {
            const spellData = await loadSpellFile(app, entry.file);
            const result = await openCreateModal(spellSpec, {
                app,
                preset: spellData,
            });
            if (result) {
                await context.reloadEntries();
                await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
            }
        } catch (err) {
            console.error("Failed to load spell for editing", err);
        }
    },
}));

// Handler for creating new spells
const handleCreate = async (context: LibraryActionContext, name: string): Promise<void> => {
    const { app } = context;
    const trimmed = name.trim();
    const preset: SpellData = { name: trimmed || "Neuer Zauber" };

    // Apply active filters as defaults
    if (context.getFilterSelection) {
        const levelFilter = context.getFilterSelection("level");
        if (levelFilter) {
            const parsed = Number(levelFilter);
            if (Number.isFinite(parsed)) preset.level = parsed;
        }
        const schoolFilter = context.getFilterSelection("school");
        if (schoolFilter) preset.school = schoolFilter;
        const ritualFilter = context.getFilterSelection("ritual");
        if (ritualFilter === "true") preset.ritual = true;
        if (ritualFilter === "false") preset.ritual = false;
    }

    const result = await openCreateModal(spellSpec, {
        app,
        preset,
    });
    if (result) {
        await context.reloadEntries();
        await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
    }
};

// Export the complete view configuration
export const spellViewConfig: LibraryViewConfig = {
    metadataFields,
    actions,
    handleCreate,
};
