// src/ui/map-header.ts
// Wiederverwendbarer Header für Map-Features (Open/Create/Save + Titel/Dateiname).

import { App, Notice, TFile, setIcon } from "obsidian";
import { applyMapButtonStyle, promptCreateMap, promptMapSelection } from "./map-workflows";
import { saveMap, saveMapAs } from "../core/save";

export type MapHeaderSaveMode = "save" | "saveAs";

export type MapHeaderOptions = {
    /** Überschrift im Header. */
    title: string;
    /** Optionales Startfile für die Anzeige. */
    initialFile?: TFile | null;
    /** Text, wenn keine Karte selektiert ist. Standard: "—". */
    emptyLabel?: string;
    /** Optionalen Inhalt für die linke Seite der zweiten Zeile einsetzen. */
    secondaryLeftSlot?: (host: HTMLElement) => void;
    /** Optionaler Slot rechts neben dem Titel. */
    titleRightSlot?: (host: HTMLElement) => void;
    /** Button-Beschriftungen / Notices anpassen. */
    labels?: {
        open?: string;
        create?: string;
        save?: string;
        saveAs?: string;
        trigger?: string;
    };
    notices?: {
        missingFile?: string;
        saveSuccess?: string;
        saveError?: string;
    };
    /** Callback nach dem Öffnen einer vorhandenen Karte. */
    onOpen?: (file: TFile) => void | Promise<void>;
    /** Callback nach Erstellung einer neuen Karte. */
    onCreate?: (file: TFile) => void | Promise<void>;
    /**
     * Optionaler Save-Hook. Rückgabewert `true` signalisiert, dass das Speichern
     * vollständig behandelt wurde und kein Default-Save mehr nötig ist.
     */
    onSave?: (mode: MapHeaderSaveMode, file: TFile | null) => void | Promise<void | boolean> | boolean;
};

export type MapHeaderHandle = {
    /** Wurzel-Element des Headers. */
    readonly root: HTMLElement;
    /** Linker Slot der zweiten Zeile (Map-Name oder Custom-Inhalt). */
    readonly secondaryLeftSlot: HTMLElement;
    /** Slot rechts neben dem Titel. */
    readonly titleRightSlot: HTMLElement;
    /** Aktualisiert den Dateinamen im Header und merkt sich das aktuelle File. */
    setFileLabel(file: TFile | null): void;
    /** Optional andere Überschrift setzen. */
    setTitle(title: string): void;
    /** Event-Handler entfernen und DOM säubern. */
    destroy(): void;
};

export function createMapHeader(app: App, host: HTMLElement, options: MapHeaderOptions): MapHeaderHandle {
    const labels = {
        open: options.labels?.open ?? "Open Map",
        create: options.labels?.create ?? "Create",
        save: options.labels?.save ?? "Speichern",
        saveAs: options.labels?.saveAs ?? "Speichern als",
        trigger: options.labels?.trigger ?? "Los",
    } as const;
    const notices = {
        missingFile: options.notices?.missingFile ?? "Keine Karte ausgewählt.",
        saveSuccess: options.notices?.saveSuccess ?? "Gespeichert.",
        saveError: options.notices?.saveError ?? "Speichern fehlgeschlagen.",
    } as const;

    let currentFile: TFile | null = options.initialFile ?? null;
    let destroyed = false;

    const root = host.createDiv({ cls: "sm-map-header" });
    // Historische Klasse weiterreichen, damit bestehende Styles greifen.
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

    const openBtn = row1.createEl("button", { text: labels.open });
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

    const createBtn = row1.createEl("button");
    createBtn.append(" ", "+");
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

    const triggerBtn = row2.createEl("button", { text: labels.trigger });
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
            console.error("[map-header] save failed", err);
            new Notice(notices.saveError);
        }
    };

    function setFileLabel(file: TFile | null) {
        currentFile = file;
        if (nameBox) {
            nameBox.textContent = file?.basename ?? options.emptyLabel ?? "—";
        }
        secondaryLeftSlot.dataset.fileLabel = file?.basename ?? options.emptyLabel ?? "—";
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
