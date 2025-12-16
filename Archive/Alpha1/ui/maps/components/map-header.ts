// src/ui/maps/components/map-header.ts
// Reusable header for map-focused features (Open/Create/Save + title/file name).

import type { App, TFile} from "obsidian";
import { Notice, setIcon } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ui-map-header');
import { enhanceSelectToSearch } from "../../components/search-dropdown";
import { applyMapButtonStyle, promptCreateMap, promptMapSelection } from "../workflows/map-workflows";
import { saveMap, saveMapAs } from "../workflows/save";

export type MapHeaderSaveMode = "save" | "saveAs";

export type MapHeaderOptions = {
    /** Header title. */
    title: string;
    /** Optional initial file displayed to the user. */
    initialFile?: TFile | null;
    /** Fallback label when no map is selected. Default: "—". */
    emptyLabel?: string;
    /** Optional content injected into the left side of the second row. */
    secondaryLeftSlot?: (host: HTMLElement) => void;
    /** Optional slot rendered next to the title. */
    titleRightSlot?: (host: HTMLElement) => void;
    /** Override button labels / notices. */
    labels?: {
        open?: string;
        create?: string;
        delete?: string;
        save?: string;
        saveAs?: string;
        trigger?: string;
    };
    notices?: {
        missingFile?: string;
        saveSuccess?: string;
        saveError?: string;
    };
    /** Callback invoked after opening an existing map. */
    onOpen?: (file: TFile) => void | Promise<void>;
    /** Callback invoked after creating a new map. */
    onCreate?: (file: TFile) => void | Promise<void>;
    /** Callback invoked after a deletion was confirmed. */
    onDelete?: (file: TFile) => void | Promise<void>;
    /**
     * Optional save hook. Returning `true` indicates that the handler fully processed
     * persistence and the default save routine should be skipped.
     */
    onSave?: (mode: MapHeaderSaveMode, file: TFile | null) => void | Promise<void | boolean> | boolean;
};

export type MapHeaderHandle = {
    /** Root element of the header. */
    readonly root: HTMLElement;
    /** Left slot in the second row (map name or custom content). */
    readonly secondaryLeftSlot: HTMLElement;
    /** Slot rendered to the right of the title. */
    readonly titleRightSlot: HTMLElement;
    /** Updates the displayed file name and tracks the current file. */
    setFileLabel(file: TFile | null): void;
    /** Allows features to override the title. */
    setTitle(title: string): void;
    /** Removes event handlers and detaches the DOM. */
    destroy(): void;
};

export function createMapHeader(app: App, host: HTMLElement, options: MapHeaderOptions): MapHeaderHandle {
    const labels = {
        open: options.labels?.open ?? "Open map",
        create: options.labels?.create ?? "Create",
        delete: options.labels?.delete ?? "Delete",
        save: options.labels?.save ?? "Save",
        saveAs: options.labels?.saveAs ?? "Save as",
        trigger: options.labels?.trigger ?? "Apply",
    } as const;
    const notices = {
        missingFile: options.notices?.missingFile ?? "Select a map before continuing.",
        saveSuccess: options.notices?.saveSuccess ?? "Map saved.",
        saveError: options.notices?.saveError ?? "Saving the map failed.",
    } as const;

    let currentFile: TFile | null = options.initialFile ?? null;
    let destroyed = false;

    const root = host.createDiv({ cls: "sm-map-header" });
    // Preserve the legacy class so existing styles continue to apply.
    root.classList.add("map-editor-header");
    Object.assign(root.style, { display: "flex", flexDirection: "column", gap: ".4rem" });

    const row1 = root.createDiv();
    Object.assign(row1.style, { display: "flex", alignItems: "center", gap: ".5rem" });

    const titleGroup = row1.createDiv({ cls: "sm-map-header__title-group" });
    Object.assign(titleGroup.style, {
        display: "flex",
        alignItems: "center",
        gap: ".5rem",
        marginRight: "auto",
    });
    const titleEl = titleGroup.createEl("h2", { text: options.title });
    Object.assign(titleEl.style, { margin: 0 });

    const titleRightSlot = titleGroup.createDiv({ cls: "sm-map-header__title-slot" });
    Object.assign(titleRightSlot.style, {
        display: "flex",
        alignItems: "center",
        gap: ".5rem",
    });
    if (options.titleRightSlot) {
        options.titleRightSlot(titleRightSlot);
    } else {
        titleRightSlot.style.display = "none";
    }

    const openBtn = row1.createEl("button", { text: labels.open, attr: { type: "button" } });
    setIcon(openBtn, "folder-open");
    applyMapButtonStyle(openBtn);
    openBtn.onclick = () => {
        if (destroyed) return;
        void promptMapSelection(app, async (file) => {
            if (destroyed) return;
            setFileLabel(file);
            await options.onOpen?.(file);
        });
    };

    const createBtn = row1.createEl("button", { text: labels.create, attr: { type: "button" } });
    setIcon(createBtn, "plus");
    applyMapButtonStyle(createBtn);
    createBtn.onclick = () => {
        if (destroyed) return;
        promptCreateMap(app, async (file) => {
            if (destroyed) return;
            setFileLabel(file);
            await options.onCreate?.(file);
        });
    };

    const deleteBtn = options.onDelete
        ? row1.createEl("button", { text: labels.delete, attr: { type: "button", "aria-label": labels.delete } })
        : null;
    if (deleteBtn) {
        setIcon(deleteBtn, "trash");
        applyMapButtonStyle(deleteBtn);
        deleteBtn.onclick = () => {
            if (destroyed) return;
            if (!currentFile) {
                new Notice(notices.missingFile);
                return;
            }
            void options.onDelete?.(currentFile);
        };
    }

    const row2 = root.createDiv();
    Object.assign(row2.style, { display: "flex", alignItems: "center", gap: ".5rem" });

    const secondaryLeftSlot = row2.createDiv({ cls: "sm-map-header__secondary-left" });
    Object.assign(secondaryLeftSlot.style, {
        marginRight: "auto",
        display: "flex",
        alignItems: "center",
        gap: ".5rem",
    });

    let nameBox: HTMLElement | null = null;
    if (options.secondaryLeftSlot) {
        options.secondaryLeftSlot(secondaryLeftSlot);
    } else {
        nameBox = secondaryLeftSlot.createEl("div", {
            text: options.initialFile?.basename ?? options.emptyLabel ?? "—",
        });
        nameBox.style.opacity = ".85";
    }

    const select = row2.createEl("select");
    select.createEl("option", { text: labels.save }).value = "save";
    select.createEl("option", { text: labels.saveAs }).value = "saveAs";
    enhanceSelectToSearch(select, "Choose a save action…");

    const triggerBtn = row2.createEl("button", { text: labels.trigger, attr: { type: "button" } });
    applyMapButtonStyle(triggerBtn);
    triggerBtn.onclick = async () => {
        if (destroyed) return;
        const mode = (select.value as MapHeaderSaveMode) ?? "save";
        const file = currentFile;
        if (!file) {
            await options.onSave?.(mode, null);
            new Notice(notices.missingFile);
            return;
        }
        try {
            const handled = (await options.onSave?.(mode, file)) === true;
            if (!handled) {
                if (mode === "save") await saveMap(app, file);
                else await saveMapAs(app, file);
            }
            new Notice(notices.saveSuccess);
        } catch (err) {
            logger.error("save failed", err);
            new Notice(notices.saveError);
        }
    };

    function setFileLabel(file: TFile | null) {
        currentFile = file;
        const label = file?.basename ?? options.emptyLabel ?? "—";
        if (nameBox) {
            nameBox.textContent = label;
        }
        secondaryLeftSlot.dataset.fileLabel = label;
        if (deleteBtn) {
            deleteBtn.disabled = !file;
            deleteBtn.style.opacity = file ? "1" : "0.5";
        }
    }

    function setTitle(title: string) {
        titleEl.textContent = title;
    }

    function destroy() {
        if (destroyed) return;
        destroyed = true;
        openBtn.onclick = null;
        createBtn.onclick = null;
        triggerBtn.onclick = null;
        root.remove();
    }

    setFileLabel(currentFile);

    return { root, secondaryLeftSlot, titleRightSlot, setFileLabel, setTitle, destroy };
}
