// src/ui/maps/workflows/map-workflows.ts
// Shared helpers for map-specific UI flows (Open/Create/Render).

import type { App, TFile } from "obsidian";
import { Notice } from "obsidian";
import { createHexMapFile } from "@features/maps/data/map-repository";
import { parseOptions, type HexOptions } from "@features/maps/config/options";
import { renderHexMap, type RenderHandles } from "@features/maps/rendering/hex-render";
import { MapSelectModal, MapCreationModal, type MapCreationProgressOptions } from "../../components/modals";
import { getAllMapFiles, getFirstHexBlock } from "../components/map-list";
import { MapDimensions } from "@features/maps/config/map-dimensions";
import { configurableLogger } from "@services/logging/configurable-logger";
const logger = configurableLogger.forModule('ui-map-workflows');

export type PromptMapSelectionOptions = {
    /** Message shown when no maps are available. */
    emptyMessage?: string;
};

export type PromptCreateMapOptions = {
    /** Notice displayed after a map has been created. */
    successMessage?: string;
};

export type RenderHexMapFromFileOptions = {
    /** CSS class for the generated container. Default: "sm-map-container". */
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

/** Prompts for map creation with size and coastline options, creates the file, then runs the callback. */
export function promptCreateMap(
    app: App,
    onCreate: (file: TFile) => void | Promise<void>,
    options?: PromptCreateMapOptions,
) {
    new MapCreationModal(app, async (result, progressOptions) => {
        logger.debug(`Modal result: ${JSON.stringify(result)}`);

        const dimensions = MapDimensions.fromTravelDays(result.sizeInDays);
        logger.debug(`Calculated dimensions: tileRadius=${dimensions.tileRadius}, tileCount=${dimensions.tileCount}`);
        logger.debug(`Expected hexagonal tile count formula: 3*N*(N+1)+1 = 3*${dimensions.tileRadius}*(${dimensions.tileRadius}+1)+1 = ${3 * dimensions.tileRadius * (dimensions.tileRadius + 1) + 1}`);

        // TODO: Wave 3-A will wire progressOptions through to createHexMapFile
        // For now, just show 100% when complete
        const file = await createHexMapFile(app, {
            name: result.name,
            dimensions,
            generation: {
                coastEdges: result.coastEdges
            }
        });

        // Report completion
        progressOptions?.onProgress?.(100);

        logger.debug(`Map created: ${file.path}`);
        new Notice(options?.successMessage ?? "Map created.");
        await onCreate(file);
    }).open();
}

/**
 * Renders a hex map into a new `.sm-map-container` and returns handles.
 * Returns `null` when the block is missing.
 */
export async function renderHexMapFromFile(
    app: App,
    host: HTMLElement,
    file: TFile,
    options?: RenderHexMapFromFileOptions,
): Promise<RenderHexMapResult | null> {
    const container = host.createDiv({ cls: options?.containerClass ?? "sm-map-container" });
    Object.assign(container.style, { width: "100%", height: "100%" }, options?.containerStyle ?? {});

    const block = await getFirstHexBlock(app, file);
    if (!block) {
        container.createEl("div", {
            text: options?.missingBlockMessage ?? "No hex3x3 block found in this file.",
        });
        return null;
    }

    const parsed = parseOptions(block);
    const handles = await renderHexMap(app, container, file, parsed);
    return { host: container, options: parsed, handles };
}
