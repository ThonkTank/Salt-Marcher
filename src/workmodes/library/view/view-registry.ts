// src/workmodes/library/view/view-registry.ts
// Definiert View-Konfigurationen für alle Library-Modi (Metadaten-Anzeige, Aktionen, Layout).
import type { App } from "obsidian";
import type { FilterableLibraryMode, LibraryEntry } from "../core/data-sources";
import { loadCreaturePreset } from "../core/creature-presets";
import { createCreatureFile, type StatblockData } from "../core/creature-files";
import { loadSpellFile, type SpellData } from "../core/spell-files";
import { loadItemFile, type ItemData } from "../core/item-files";
import { loadEquipmentFile, type EquipmentData } from "../core/equipment-files";
import { openCreateModal } from "../../../features/data-manager";
import { createStandardActions } from "../../../features/data-manager/browse/action-factory";
import { creatureSpec } from "../create/creature/creature-spec";
import { spellSpec } from "../create/spell/spell-spec";
import { itemSpec } from "../create/item/item-spec";
import { equipmentSpec } from "../create/equipment/equipment-spec";
import { formatSpellLevel } from "./filter-registry";
import type { WorkmodeTileMetadata, WorkmodeTileAction } from "../../../ui/workmode/list-renderer";

export type MetadataField<M extends FilterableLibraryMode> = WorkmodeTileMetadata<LibraryEntry<M>>;

export interface LibraryActionContext<M extends FilterableLibraryMode> {
    readonly app: App;
    reloadEntries: () => Promise<void>;
    getRenderer: () => LibraryViewConfig<M>;
    getFilterSelection?: (id: string) => string | undefined;
}

export type ActionDefinition<M extends FilterableLibraryMode> = WorkmodeTileAction<LibraryEntry<M>, LibraryActionContext<M>>;

export interface LibraryViewConfig<M extends FilterableLibraryMode> {
    readonly metadataFields: MetadataField<M>[];
    readonly actions: ActionDefinition<M>[];
    readonly handleCreate: (context: LibraryActionContext<M>, name: string) => Promise<void>;
}

export type LibraryViewConfigMap = {
    [M in FilterableLibraryMode]: LibraryViewConfig<M>;
};


// ============================================================================
// Creatures Configuration
// ============================================================================

const creaturesMetadata: MetadataField<"creatures">[] = [
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

const creaturesActions: ActionDefinition<"creatures">[] = createStandardActions("creature", () => ({
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

// ============================================================================
// Spells Configuration
// ============================================================================

const spellsMetadata: MetadataField<"spells">[] = [
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

const spellsActions: ActionDefinition<"spells">[] = createStandardActions("spell", () => ({
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

// ============================================================================
// Items Configuration
// ============================================================================

const itemsMetadata: MetadataField<"items">[] = [
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

const itemsActions: ActionDefinition<"items">[] = createStandardActions("item", () => ({
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

// ============================================================================
// Equipment Configuration
// ============================================================================

const equipmentMetadata: MetadataField<"equipment">[] = [
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

const equipmentActions: ActionDefinition<"equipment">[] = createStandardActions("equipment", () => ({
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

// ============================================================================
// View Config Registry
// ============================================================================

export const LIBRARY_VIEW_CONFIGS: LibraryViewConfigMap = {
    creatures: {
        metadataFields: creaturesMetadata,
        actions: creaturesActions,
        handleCreate: async (context, name) => {
            const { app } = context;
            const result = await openCreateModal(creatureSpec, {
                app,
                preset: name,
            });
            if (result) {
                await context.reloadEntries();
                await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
            }
        },
    },
    spells: {
        metadataFields: spellsMetadata,
        actions: spellsActions,
        handleCreate: async (context, name) => {
            const { app } = context;
            const trimmed = name.trim();
            const preset: SpellData = { name: trimmed || "Neuer Zauber" };

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
        },
    },
    items: {
        metadataFields: itemsMetadata,
        actions: itemsActions,
        handleCreate: async (context, name) => {
            const { app } = context;
            const result = await openCreateModal(itemSpec, {
                app,
                preset: name,
            });
            if (result) {
                await context.reloadEntries();
                await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
            }
        },
    },
    equipment: {
        metadataFields: equipmentMetadata,
        actions: equipmentActions,
        handleCreate: async (context, name) => {
            const { app } = context;
            const result = await openCreateModal(equipmentSpec, {
                app,
                preset: name,
            });
            if (result) {
                await context.reloadEntries();
                await app.workspace.openLinkText(result.filePath, result.filePath, true, { state: { mode: "source" } });
            }
        },
    },
};
