// src/ui/map-manager.ts
// Central manager that coordinates map selection, creation, and deletion flows.

import { App, Notice, TFile } from "obsidian";
import {
    promptCreateMap,
    promptMapSelection,
    type PromptCreateMapOptions,
    type PromptMapSelectionOptions,
} from "./map-workflows";
import { ConfirmDeleteModal } from "./confirm-delete";
import { deleteMapAndTiles } from "../core/map-delete";

export type MapManagerOptions = {
    /** Initial file tracked by the internal state. */
    initialFile?: TFile | null;
    /** Optional overrides for notice copy. */
    notices?: {
        missingSelection?: string;
    };
    /** Extra options for the selection dialogs. */
    selectOptions?: PromptMapSelectionOptions;
    createOptions?: PromptCreateMapOptions;
    /** Callback invoked after every state update. */
    onChange?: (file: TFile | null) => void | Promise<void>;
};

export type MapManagerHandle = {
    /** Returns the currently tracked map file. */
    getFile(): TFile | null;
    /** Updates the state (e.g. when a file is assigned externally). */
    setFile(file: TFile | null): Promise<void>;
    /** Opens the selection dialog and applies the chosen file. */
    open(): Promise<void>;
    /** Launches the creation dialog and tracks the new map. */
    create(): void;
    /** Opens the delete dialog; on success the state is cleared. */
    deleteCurrent(): void;
};

export function createMapManager(app: App, options: MapManagerOptions = {}): MapManagerHandle {
    const notices = {
        missingSelection: options.notices?.missingSelection ?? "No map selected.",
    } as const;

    let current: TFile | null = options.initialFile ?? null;

    const applyChange = async (file: TFile | null) => {
        current = file;
        await options.onChange?.(file);
    };

    const setFile = async (file: TFile | null) => {
        await applyChange(file);
    };

    const open = async () => {
        await promptMapSelection(
            app,
            async (file) => {
                await applyChange(file);
            },
            options.selectOptions,
        );
    };

    const create = () => {
        promptCreateMap(
            app,
            async (file) => {
                await applyChange(file);
            },
            options.createOptions,
        );
    };

    const deleteCurrent = () => {
        const target = current;
        if (!target) {
            new Notice(notices.missingSelection);
            return;
        }
        new ConfirmDeleteModal(app, target, async () => {
            try {
                await deleteMapAndTiles(app, target);
                if (current && current.path === target.path) {
                    await applyChange(null);
                }
            } catch (error) {
                console.error("Map deletion failed", error);
                new Notice("Could not delete the map. Check the console for details.");
            }
        }).open();
    };

    return {
        getFile: () => current,
        setFile,
        open,
        create,
        deleteCurrent,
    };
}
