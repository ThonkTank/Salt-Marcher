// src/ui/map-workflows.ts
// Gemeinsame Helfer für Map-spezifische UI-Flows (Open/Create/Render)

import { App, Notice, TFile } from "obsidian";
import { createHexMapFile } from "../core/map-maker";
import { getAllMapFiles, getFirstHexBlock } from "../core/map-list";
import { parseOptions, type HexOptions } from "../core/options";
import { renderHexMap, type RenderHandles } from "../core/hex-mapper/hex-render";
import { MapSelectModal, NameInputModal } from "./modals";

export type PromptMapSelectionOptions = {
    /** Hinweistext, falls keine Karten vorhanden sind. */
    emptyMessage?: string;
};

export type PromptCreateMapOptions = {
    /** Hinweistext nach erfolgreicher Erstellung. */
    successMessage?: string;
};

export type RenderHexMapFromFileOptions = {
    /** CSS-Klasse für den erzeugten Container. Standard: "hex3x3-container" */
    containerClass?: string;
    /** Zusätzliche Inline-Styles, die auf den Container angewendet werden. */
    containerStyle?: Partial<CSSStyleDeclaration>;
    /** Hinweistext, wenn kein hex3x3-Block gefunden wird. */
    missingBlockMessage?: string;
};

export type RenderHexMapResult = {
    host: HTMLElement;
    options: HexOptions;
    handles: RenderHandles;
};

/** Vereinheitlicht das Styling der Map-Buttons (Open/Create/Save/etc.). */
export function applyMapButtonStyle(button: HTMLElement) {
    Object.assign(button.style, {
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "6px 10px",
        cursor: "pointer",
    } satisfies Partial<CSSStyleDeclaration>);
}

/** Öffnet die Karten-Auswahl per Modal und ruft bei Erfolg den Callback auf. */
export async function promptMapSelection(
    app: App,
    onSelect: (file: TFile) => void | Promise<void>,
    options?: PromptMapSelectionOptions,
) {
    const files = await getAllMapFiles(app);
    if (!files.length) {
        new Notice(options?.emptyMessage ?? "Keine Karten gefunden.");
        return;
    }
    new MapSelectModal(app, files, async (file) => {
        await onSelect(file);
    }).open();
}

/** Fragt nach einem Kartennamen, erzeugt die Datei und ruft anschließend den Callback. */
export function promptCreateMap(
    app: App,
    onCreate: (file: TFile) => void | Promise<void>,
    options?: PromptCreateMapOptions,
) {
    new NameInputModal(app, async (name) => {
        const file = await createHexMapFile(app, name);
        new Notice(options?.successMessage ?? "Karte erstellt.");
        await onCreate(file);
    }).open();
}

/**
 * Rendert eine Hex-Map in einen neuen `.hex3x3-container` und liefert Handles zurück.
 * Gibt `null` zurück, falls der Codeblock fehlt.
 */
export async function renderHexMapFromFile(
    app: App,
    host: HTMLElement,
    file: TFile,
    options?: RenderHexMapFromFileOptions,
): Promise<RenderHexMapResult | null> {
    const container = host.createDiv({ cls: options?.containerClass ?? "hex3x3-container" });
    Object.assign(container.style, { width: "100%", height: "100%" }, options?.containerStyle ?? {});

    const block = await getFirstHexBlock(app, file);
    if (!block) {
        container.createEl("div", {
            text: options?.missingBlockMessage ?? "Kein hex3x3-Block in dieser Datei.",
        });
        return null;
    }

    const parsed = parseOptions(block);
    const handles = await renderHexMap(app, container, parsed, file.path);
    return { host: container, options: parsed, handles };
}
