// src/apps/library/view/view-registry.ts
// Definiert View-Konfigurationen für alle Library-Modi (Metadaten-Anzeige, Aktionen, Layout).
import type { App } from "obsidian";
import type { FilterableLibraryMode, LibraryEntry } from "../core/data-sources";
import { loadCreaturePreset } from "../core/creature-presets";
import { createCreatureFile, type StatblockData } from "../core/creature-files";
import { createSpellFile, loadSpellFile, spellToMarkdown, type SpellData } from "../core/spell-files";
import { createItemFile, loadItemFile, itemToMarkdown, type ItemData } from "../core/item-files";
import { createEquipmentFile, loadEquipmentFile, equipmentToMarkdown, type EquipmentData } from "../core/equipment-files";
import { CreateCreatureModal } from "../create";
import { CreateSpellModal } from "../create";
import { CreateItemModal } from "../create";
import { CreateEquipmentModal } from "../create/equipment";
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
// Shared Action Helpers
// ============================================================================

function createOpenAction<M extends FilterableLibraryMode>(): ActionDefinition<M> {
    return {
        id: "open",
        label: "Open",
        execute: async (entry, context) => {
            await context.app.workspace.openLinkText(entry.file.path, entry.file.path, true);
        },
    };
}

function createDeleteAction<M extends FilterableLibraryMode>(typeName: string): ActionDefinition<M> {
    return {
        id: "delete",
        label: "Delete",
        execute: async (entry, context) => {
            const question = `Delete ${entry.name}? This moves the file to the trash.`;
            const confirmation = typeof window !== "undefined" && typeof window.confirm === "function"
                ? window.confirm(question)
                : true;
            if (!confirmation) return;
            try {
                await context.app.vault.trash(entry.file, true);
                await context.reloadEntries();
            } catch (err) {
                console.error(`Failed to delete ${typeName}`, err);
            }
        },
    };
}

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

const creaturesActions: ActionDefinition<"creatures">[] = [
    createOpenAction(),
    {
        id: "edit",
        label: "Edit",
        execute: async (entry, context) => {
            const { app } = context;
            try {
                const creatureData = await loadCreaturePreset(app, entry.file);
                new CreateCreatureModal(app, creatureData.name, async (data) => {
                    const file = await createCreatureFile(app, data);
                    await context.reloadEntries();
                    await app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
                }, creatureData).open();
            } catch (err) {
                console.error("Failed to load creature for editing", err);
            }
        },
    },
    createDeleteAction("creature"),
];

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

const spellsActions: ActionDefinition<"spells">[] = [
    createOpenAction(),
    {
        id: "edit",
        label: "Edit",
        execute: async (entry, context) => {
            const { app } = context;
            try {
                const spellData = await loadSpellFile(app, entry.file);
                new CreateSpellModal(app, spellData, async (data) => {
                    const content = spellToMarkdown(data);
                    await app.vault.modify(entry.file, content);
                    await context.reloadEntries();
                }).open();
            } catch (err) {
                console.error("Failed to load spell for editing", err);
            }
        },
    },
    createDeleteAction("spell"),
];

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

const itemsActions: ActionDefinition<"items">[] = [
    createOpenAction(),
    {
        id: "edit",
        label: "Edit",
        execute: async (entry, context) => {
            const { app } = context;
            try {
                const itemData = await loadItemFile(app, entry.file);
                new CreateItemModal(app, itemData, async (updatedData) => {
                    const newContent = itemToMarkdown(updatedData);
                    await app.vault.modify(entry.file, newContent);
                    await context.reloadEntries();
                    await app.workspace.openLinkText(entry.file.path, entry.file.path, true, { state: { mode: "source" } });
                }).open();
            } catch (err) {
                console.error("Failed to edit item", err);
            }
        },
    },
    createDeleteAction("item"),
];

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

const equipmentActions: ActionDefinition<"equipment">[] = [
    createOpenAction(),
    {
        id: "edit",
        label: "Edit",
        execute: async (entry, context) => {
            const { app } = context;
            try {
                const equipmentData = await loadEquipmentFile(app, entry.file);
                new CreateEquipmentModal(app, equipmentData, async (updatedData) => {
                    const newContent = equipmentToMarkdown(updatedData);
                    await app.vault.modify(entry.file, newContent);
                    await context.reloadEntries();
                    await app.workspace.openLinkText(entry.file.path, entry.file.path, true, { state: { mode: "source" } });
                }).open();
            } catch (err) {
                console.error("Failed to edit equipment", err);
            }
        },
    },
    createDeleteAction("equipment"),
];

// ============================================================================
// View Config Registry
// ============================================================================

export const LIBRARY_VIEW_CONFIGS: LibraryViewConfigMap = {
    creatures: {
        metadataFields: creaturesMetadata,
        actions: creaturesActions,
        handleCreate: async (context, name) => {
            const { app } = context;
            new CreateCreatureModal(app, name, async (data) => {
                const file = await createCreatureFile(app, data);
                await context.reloadEntries();
                await app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }, undefined).open();
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

            new CreateSpellModal(app, preset, async (data) => {
                const file = await createSpellFile(app, data);
                await context.reloadEntries();
                await app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }).open();
        },
    },
    items: {
        metadataFields: itemsMetadata,
        actions: itemsActions,
        handleCreate: async (context, name) => {
            const { app } = context;
            new CreateItemModal(app, name, async (data) => {
                const file = await createItemFile(app, data);
                await context.reloadEntries();
                await app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }).open();
        },
    },
    equipment: {
        metadataFields: equipmentMetadata,
        actions: equipmentActions,
        handleCreate: async (context, name) => {
            const { app } = context;
            new CreateEquipmentModal(app, name, async (data) => {
                const file = await createEquipmentFile(app, data);
                await context.reloadEntries();
                await app.workspace.openLinkText(file.path, file.path, true, { state: { mode: "source" } });
            }).open();
        },
    },
};
