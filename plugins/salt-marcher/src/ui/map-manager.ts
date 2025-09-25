// src/ui/map-manager.ts
// Gemeinsame Verwaltung für Map-Auswahl, Erstellung und Löschung.

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
    /** Startdatei für den internen State. */
    initialFile?: TFile | null;
    /** Überschriebene Texte für Notices. */
    notices?: {
        missingSelection?: string;
    };
    /** Zusätzliche Optionen für die Auswahldialoge. */
    selectOptions?: PromptMapSelectionOptions;
    createOptions?: PromptCreateMapOptions;
    /** Callback nach jeder State-Änderung. */
    onChange?: (file: TFile | null) => void | Promise<void>;
};

export type MapManagerHandle = {
    /** Gibt die aktuell gemerkte Karte zurück. */
    getFile(): TFile | null;
    /** Setzt den State (z. B. wenn extern ein File zugewiesen wurde). */
    setFile(file: TFile | null): Promise<void>;
    /** Öffnet den Auswahl-Dialog und aktualisiert den State nach Auswahl. */
    open(): Promise<void>;
    /** Startet den Create-Dialog und setzt den State auf die neue Karte. */
    create(): void;
    /** Öffnet den Delete-Dialog; bei Erfolg wird der State geleert. */
    deleteCurrent(): void;
};

export function createMapManager(app: App, options: MapManagerOptions = {}): MapManagerHandle {
    const notices = {
        missingSelection: options.notices?.missingSelection ?? "Keine Karte ausgewählt.",
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
            await deleteMapAndTiles(app, target);
            if (current && current.path === target.path) {
                await applyChange(null);
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
