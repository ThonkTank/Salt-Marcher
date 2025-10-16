// src/ui/maps/workflows/map-workflows.ts
// Shared helpers for map-specific UI flows (Open/Create/Render).

import { App, Notice, TFile } from "obsidian";
import { createHexMapFile } from "../../../features/maps/data/map-repository";
import { getAllMapFiles, getFirstHexBlock } from "../components/map-list";
import { parseOptions, type HexOptions } from "../../../features/maps/domain/options";
import { renderHexMap, type RenderHandles } from "../../../features/maps/rendering/hex-render";
import { MapSelectModal, NameInputModal } from "../../components/modals";

export type PromptMapSelectionOptions = {
    /** Message shown when no maps are available. */
    emptyMessage?: string;
};

export type PromptCreateMapOptions = {
    /** Notice displayed after a map has been created. */
    successMessage?: string;
};

export type RenderHexMapFromFileOptions = {
    /** CSS class for the generated container. Default: "hex3x3-container". */
    containerClass?: string;
    /** Additional inline styles applied to the container. */
    containerStyle?: Partial<CSSStyleDeclaration>;
    /** Message shown when no hex3x3 block can be located. */
    missingBlockMessage?: string;
};

export type RenderHexMapResult = {
    host: HTMLElement;
    options: HexOptions;
    handles: RenderHandles;
};

/** Normalises the styling of map buttons (Open/Create/Save/etc.). */
export function applyMapButtonStyle(button: HTMLElement) {
    Object.assign(button.style, {
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "6px 10px",
        cursor: "pointer",
    } satisfies Partial<CSSStyleDeclaration>);
}

/** Opens the map-selection modal and runs the callback when confirmed. */
export async function promptMapSelection(
    app: App,
    onSelect: (file: TFile) => void | Promise<void>,
    options?: PromptMapSelectionOptions,
) {
    const files = await getAllMapFiles(app);
    if (!files.length) {
        new Notice(options?.emptyMessage ?? "No maps available.");
        return;
    }
    new MapSelectModal(app, files, async (file) => {
        await onSelect(file);
    }).open();
}

/** Prompts for a map name, creates the file, then runs the callback. */
export function promptCreateMap(
    app: App,
    onCreate: (file: TFile) => void | Promise<void>,
    options?: PromptCreateMapOptions,
) {
    new NameInputModal(app, async (name) => {
        const file = await createHexMapFile(app, name);
        new Notice(options?.successMessage ?? "Map created.");
        await onCreate(file);
    }).open();
}

/**
 * Renders a hex map into a new `.hex3x3-container` and returns handles.
 * Returns `null` when the block is missing.
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
            text: options?.missingBlockMessage ?? "No hex3x3 block found in this file.",
        });
        return null;
    }

    const parsed = parseOptions(block);
    const handles = await renderHexMap(app, container, parsed, file.path);
    return { host: container, options: parsed, handles };
}
