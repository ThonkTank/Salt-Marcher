// src/workmodes/cartographer/editor/tools/feature-brush/feature-brush-options.ts
// UI panel and interaction logic for terrain feature brush

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-feature-brush");
import { cornerToPixel, pixelToCorner, findPathBetweenCorners, adjacentCorners, findNearestCorner, getAllCornersForHexes, type CornerCoord } from "@features/maps/rendering/core/rendering-hex-geometry";
import { coordsInRadius } from "@geometry";
import {
    buildForm,
    type FormSelectHandle,
    type FormHintHandle,
    type FormButtonHandle,
    type FormTextHandle,
} from "@ui/components/form-builder";
import { enhanceSelectToSearch } from "@ui/components/search-dropdown";
import {
    createInitialState,
    startPath,
    addToPath,
    removeLastFromPath,
    clearPath,
    finishPath,
    eraseFeatureAt,
    isAdjacentToLast,
    type FeatureBrushState,
    type FeatureBrushMode,
} from "./feature-brush-core";
import type { HexOptions } from "@features/maps/config/options";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type { AxialCoord } from "@features/maps/rendering/rendering-types";
import type { TerrainFeatureType } from "@features/maps";

const TOOL_LABEL = "Feature Brush";

export type FeatureBrushPanelContext = {
    app: App;
    getFile(): TFile | null;
    getHandles(): RenderHandles | null;
    getOptions(): HexOptions | null;
    getBase(): AxialCoord;
    getPadding(): number;
    getAbortSignal(): AbortSignal | null;
    setStatus(message: string): void;
    toContentPoint(ev: MouseEvent | PointerEvent): DOMPoint | null;
    getSurface(): any;
};

export type FeatureBrushPanelControls = {
    activate(): void;
    deactivate(): void;
    onMapRendered(): void;
    handleHexClick(coord: AxialCoord, event: PointerEvent): Promise<boolean>;
    setDisabled(disabled: boolean): void;
    destroy(): void;
};

const FEATURE_TYPE_OPTIONS: Array<{ label: string; value: TerrainFeatureType }> = [
    { label: "🌊 River", value: "river" },
    { label: "⛰️ Cliff", value: "cliff" },
    { label: "🛤️ Road", value: "road" },
    { label: "🚧 Border", value: "border" },
    { label: "📏 Elevation Line", value: "elevation-line" },
];

const FEATURE_TYPE_ICONS: Record<TerrainFeatureType, string> = {
    river: "🌊",
    cliff: "⛰️",
    road: "🛤️",
    border: "🚧",
    "elevation-line": "📏",
};

const MODE_OPTIONS: Array<{ label: string; value: FeatureBrushMode }> = [
    { label: "Draw", value: "draw" },
    { label: "Erase", value: "erase" },
];

export function mountFeatureBrushPanel(
    container: HTMLElement,
    ctx: FeatureBrushPanelContext
): FeatureBrushPanelControls {
    // Use container directly as root (no wrapper div)
    const root = container;
    root.classList.add("sm-cartographer__panel--editor", "is-disabled");

    const state: FeatureBrushState = createInitialState();
    let mode: FeatureBrushMode = "draw";

    let disposed = false;
    let panelDisabled = false;

    // Preview path visual (temporary SVG path)
    let previewPath: SVGPathElement | null = null;

    // Hover state for corner detection
    let hoveredNextCorner: CornerCoord | null = null;
    let cornerHighlight: SVGCircleElement | null = null;
    let rafId: number | null = null;

    // Form controls
    let typeControl: FormSelectHandle | null = null;
    let modeControl: FormSelectHandle | null = null;
    let nameControl: FormTextHandle | null = null;
    let finishButton: FormButtonHandle | null = null;
    let undoButton: FormButtonHandle | null = null;
    let clearButton: FormButtonHandle | null = null;
    let inlineHint: FormHintHandle | null = null;

    const setPanelDisabled = (disabled: boolean) => {
        panelDisabled = disabled;
        // Only disable form controls, not root visibility (managed by activate/deactivate)
        typeControl?.setDisabled(disabled);
        modeControl?.setDisabled(disabled);
        nameControl?.setDisabled(disabled);
        finishButton?.setDisabled(disabled || !state.isDrawing || state.path.length < 1);
        undoButton?.setDisabled(disabled || state.path.length === 0);
        clearButton?.setDisabled(disabled || state.path.length === 0);
    };

    const updateStatus = (message: string) => {
        try {
            ctx.setStatus(message);
        } catch (err) {
            logger.error("failed to set status", err);
        }
    };

    const updateButtonStates = () => {
        finishButton?.setDisabled(panelDisabled || !state.isDrawing || state.path.length < 1);
        undoButton?.setDisabled(panelDisabled || state.path.length === 0);
        clearButton?.setDisabled(panelDisabled || state.path.length === 0);
    };

    type HintTone = "info" | "loading" | "error" | "warning";

    const setInlineHint = (details: { text: string; tone: HintTone } | null) => {
        inlineHint?.set(details ? { text: details.text, tone: details.tone } : null);
    };

    const form = buildForm(root, {
        sections: [
            { kind: "header", text: "Terrain Features" },
            { kind: "hint", id: "inline", cls: "sm-inline-hint", hidden: true },

            // Feature Settings Section
            { kind: "static", id: "featureSettingsHeader", cls: "sm-inspector-section__header" },
            {
                kind: "row",
                label: "Type:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "select",
                        id: "type",
                        value: state.featureType,
                        options: FEATURE_TYPE_OPTIONS,
                        enhance: (select) => enhanceSelectToSearch(select, "Search…"),
                        onChange: ({ element }) => {
                            state.featureType = element.value as TerrainFeatureType;
                            updateStatus(`Feature type: ${state.featureType}`);
                            updateStylePreview();
                        },
                    },
                ],
            },
            {
                kind: "row",
                label: "Name:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "text",
                        id: "name",
                        placeholder: "(optional)",
                        onChange: ({ element }) => {
                            state.name = element.value || undefined;
                        },
                    },
                ],
            },
            { kind: "separator" },

            // Style Preview Section
            { kind: "static", id: "stylePreviewHeader", cls: "sm-inspector-section__header" },
            { kind: "static", id: "stylePreviewBody", cls: "sm-inspector-section__body" },
            { kind: "separator" },

            // Mode Section
            { kind: "static", id: "modeHeader", cls: "sm-inspector-section__header" },
            {
                kind: "row",
                label: "Draw Mode:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "select",
                        id: "mode",
                        value: mode,
                        options: MODE_OPTIONS,
                        enhance: (select) => enhanceSelectToSearch(select, "Search…"),
                        onChange: ({ element }) => {
                            mode = element.value as FeatureBrushMode;
                            updateStatus(`Mode: ${mode}`);
                            updateModeIndicator();

                            // Clear path when switching modes
                            if (state.isDrawing) {
                                clearPath(state);
                                destroyPreview();
                                updateButtonStates();
                                updatePathDisplay();
                            }
                        },
                    },
                ],
            },
            { kind: "static", id: "modeIndicator", cls: "sm-mode-indicator" },
            { kind: "separator" },

            // Current Path Section
            { kind: "static", id: "pathHeader", cls: "sm-inspector-section__header" },
            { kind: "static", id: "pathDisplay", cls: "sm-inspector-section__body" },
            {
                kind: "row",
                label: "Actions:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "button",
                        id: "finish",
                        label: "✓ Finish",
                        disabled: true,
                        cls: "sm-btn sm-btn--primary",
                    },
                    {
                        kind: "button",
                        id: "undo",
                        label: "↶ Undo",
                        disabled: true,
                        cls: "sm-btn sm-btn--secondary",
                    },
                    {
                        kind: "button",
                        id: "clear",
                        label: "✕ Clear",
                        disabled: true,
                        cls: "sm-btn sm-btn--danger",
                    },
                ],
            },
        ],
    });

    typeControl = form.getControl("type") as FormSelectHandle;
    modeControl = form.getControl("mode") as FormSelectHandle;
    nameControl = form.getControl("name") as FormTextHandle;
    finishButton = form.getControl("finish") as FormButtonHandle;
    undoButton = form.getControl("undo") as FormButtonHandle;
    clearButton = form.getControl("clear") as FormButtonHandle;
    inlineHint = form.getHint("inline");

    // Initialize section headers
    const featureSettingsHeader = form.getElement("featureSettingsHeader");
    if (featureSettingsHeader) {
        featureSettingsHeader.createSpan({ cls: "sm-inspector-section__title", text: "Feature Settings" });
    }

    const stylePreviewHeader = form.getElement("stylePreviewHeader");
    if (stylePreviewHeader) {
        stylePreviewHeader.createSpan({ cls: "sm-inspector-section__title", text: "Style Preview" });
    }

    const modeHeader = form.getElement("modeHeader");
    if (modeHeader) {
        modeHeader.createSpan({ cls: "sm-inspector-section__title", text: "Mode" });
    }

    const pathHeader = form.getElement("pathHeader");
    if (pathHeader) {
        pathHeader.createSpan({ cls: "sm-inspector-section__title", text: "Current Path" });
    }

    // Get containers
    const stylePreviewBody = form.getElement("stylePreviewBody");
    const modeIndicator = form.getElement("modeIndicator");
    const pathDisplay = form.getElement("pathDisplay");

    // Style preview update function
    const updateStylePreview = () => {
        if (!stylePreviewBody) return;

        stylePreviewBody.empty();

        const featureCard = stylePreviewBody.createDiv({ cls: "sm-feature-item" });

        const icon = featureCard.createDiv({ cls: "sm-feature-item__icon" });
        icon.textContent = FEATURE_TYPE_ICONS[state.featureType];

        const name = featureCard.createDiv({ cls: "sm-feature-item__name" });
        name.textContent = state.featureType.charAt(0).toUpperCase() + state.featureType.slice(1);

        // Color swatch (using default colors, can be customized later)
        const colorSwatch = featureCard.createSpan({ cls: "sm-feature-color-swatch" });
        const defaultColors: Record<TerrainFeatureType, string> = {
            river: "#4A90E2",
            cliff: "#8B4513",
            road: "#A0A0A0",
            border: "#FF6B6B",
            "elevation-line": "#7B68EE",
        };
        colorSwatch.style.backgroundColor = defaultColors[state.featureType];
    };

    // Mode indicator update function
    const updateModeIndicator = () => {
        if (!modeIndicator) return;

        modeIndicator.empty();
        modeIndicator.className = `sm-mode-indicator sm-mode-indicator--${mode}`;

        const icon = mode === "draw" ? "✏️" : "🧹";
        const label = mode === "draw" ? "Draw" : "Erase";

        modeIndicator.createSpan({ text: icon });
        modeIndicator.createSpan({ text: label });
    };

    // Path display update function
    const updatePathDisplay = () => {
        if (!pathDisplay) return;

        pathDisplay.empty();

        if (state.path.length === 0) {
            pathDisplay.createDiv({
                cls: "sm-inspector-empty",
                text: "No path started. Click on a hex to begin."
            });
            return;
        }

        // Path info card
        const pathCard = pathDisplay.createDiv({ cls: "sm-feature-item" });

        const pathIcon = pathCard.createDiv({ cls: "sm-feature-item__icon" });
        pathIcon.textContent = FEATURE_TYPE_ICONS[state.featureType];

        const pathContent = pathCard.createDiv({ cls: "sm-feature-item__content" });
        pathContent.createDiv({
            text: `Path length: ${state.path.length} hex${state.path.length === 1 ? "" : "es"}`,
            cls: "sm-feature-item__name"
        });

        const coordList = pathContent.createDiv({ cls: "sm-feature-item__type" });
        if (state.path.length <= 5) {
            coordList.textContent = state.path.map(c => `(${c.q},${c.r})`).join(" → ");
        } else {
            const first = state.path[0];
            const last = state.path[state.path.length - 1];
            coordList.textContent = `(${first.q},${first.r}) → ... → (${last.q},${last.r})`;
        }

        // Progress indicator
        if (state.isDrawing) {
            const progressDiv = pathDisplay.createDiv({ cls: "sm-progress-indicator" });
            const progressLabel = progressDiv.createDiv({ cls: "sm-progress-indicator__label" });
            progressLabel.createSpan({ text: "Drawing in progress..." });
            progressLabel.createSpan({ text: `${state.path.length} points` });
        }
    };

    // Initial updates
    updateStylePreview();
    updateModeIndicator();
    updatePathDisplay();

    // Button handlers
    const handleFinish = async () => {
        const file = ctx.getFile();
        if (!file) {
            updateStatus("No map file available");
            return;
        }

        try {
            const feature = await finishPath(ctx.app, file, state);
            if (feature) {
                updateStatus(`Saved ${feature.type} with ${feature.path.corners?.length ?? 0} corners`);
                setInlineHint({
                    text: `Saved ${feature.type}: ${feature.metadata?.name || feature.id}`,
                    tone: "info",
                });
            }
            destroyPreview();
            // destroyCornerGuidance(); // TODO: Implement if needed
            updateButtonStates();
        } catch (error) {
            logger.error("Failed to finish path", error);
            updateStatus("Failed to save feature");
            setInlineHint({ text: "Failed to save feature. Check console for details.", tone: "error" });
        }
    };

    const handleUndo = () => {
        const removed = removeLastFromPath(state);
        if (removed) {
            updateStatus(`Removed ${removed.q},${removed.r} from path (${state.path.length} hexes)`);
            updatePreview();
            // updateCornerGuidance(); // TODO: Implement if needed
        }
        updateButtonStates();
        updatePathDisplay();
    };

    const handleClear = () => {
        clearPath(state);
        destroyPreview();
        // destroyCornerGuidance(); // TODO: Implement if needed
        updateStatus("Cleared path");
        setInlineHint(null);
        updateButtonStates();
        updatePathDisplay();
    };

    if (finishButton) {
        finishButton.element.addEventListener("click", () => void handleFinish());
    }
    if (undoButton) {
        undoButton.element.addEventListener("click", handleUndo);
    }
    if (clearButton) {
        clearButton.element.addEventListener("click", handleClear);
    }

    // Preview path rendering
    const createPreview = (handles: RenderHandles) => {
        if (previewPath) return;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "sm-feature-preview");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "var(--interactive-accent)");
        path.setAttribute("stroke-width", "3");
        path.setAttribute("stroke-dasharray", "8,4");
        path.setAttribute("pointer-events", "none");
        path.style.opacity = "0.8";

        handles.contentG.appendChild(path);
        previewPath = path;
        logger.info("Preview path created", {
            pathElement: !!path,
            parentElement: handles.contentG.nodeName
        });
    };

    const updatePreview = () => {
        if (!previewPath || state.path.length === 0) {
            destroyPreview();
            return;
        }

        const handles = ctx.getHandles();
        const options = ctx.getOptions();
        if (!handles || !options) return;

        // Get coordinate transformation parameters
        const radius = options.hexPixelSize ?? 42;
        const base = ctx.getBase();
        const padding = ctx.getPadding();

        // Convert corner coordinates to pixel positions in SVG canvas space
        const points = state.path.map(corner => cornerToPixel(corner, radius, base, padding));

        let pathData = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathData += ` L ${points[i].x} ${points[i].y}`;
        }

        previewPath.setAttribute("d", pathData);
    };

    const destroyPreview = () => {
        if (previewPath) {
            previewPath.remove();
            previewPath = null;
        }
    };

    // Corner highlight rendering (shows which corner is being hovered)
    const createCornerHighlight = (handles: RenderHandles) => {
        if (cornerHighlight) return;

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "sm-feature-corner-highlight");
        circle.setAttribute("r", "6");  // 6px radius
        circle.setAttribute("fill", "var(--interactive-accent)");
        circle.setAttribute("pointer-events", "none");
        circle.style.opacity = "0.7";

        handles.contentG.appendChild(circle);
        cornerHighlight = circle;
        logger.info("Corner highlight created", {
            circleElement: !!circle,
            parentElement: handles.contentG.nodeName
        });
    };

    const updateCornerHighlight = (corner: CornerCoord) => {
        if (!cornerHighlight) return;

        const handles = ctx.getHandles();
        const options = ctx.getOptions();
        if (!handles || !options) return;

        const radius = options.hexPixelSize ?? 42;
        const base = ctx.getBase();
        const padding = ctx.getPadding();

        const pos = cornerToPixel(corner, radius, base, padding);

        cornerHighlight.setAttribute("cx", String(pos.x));
        cornerHighlight.setAttribute("cy", String(pos.y));
        cornerHighlight.style.display = "block";
        logger.info("Corner highlight updated", {
            corner: `${corner.q},${corner.r}:${corner.corner}`,
            pixelPos: { x: pos.x, y: pos.y }
        });
    };

    const hideCornerHighlight = () => {
        if (cornerHighlight) {
            cornerHighlight.style.display = "none";
        }
    };

    const destroyCornerHighlight = () => {
        if (cornerHighlight) {
            cornerHighlight.remove();
            cornerHighlight = null;
        }
    };

    // Hover preview rendering with pathfinding
    const updateHoverPreview = () => {
        if (!previewPath || !state.isDrawing || state.path.length === 0) {
            destroyPreview();
            hideCornerHighlight();
            return;
        }

        const handles = ctx.getHandles();
        const options = ctx.getOptions();
        if (!handles || !options) return;

        const radius = options.hexPixelSize ?? 42;
        const base = ctx.getBase();
        const padding = ctx.getPadding();

        // Build preview path: current path + pathfinding to hovered corner (if any)
        let previewCorners = state.path;

        if (hoveredNextCorner) {
            const lastCorner = state.path[state.path.length - 1];

            // Check if hovered corner is adjacent to last corner
            const adjacent = adjacentCorners(lastCorner);
            const isAdjacent = adjacent.some(c =>
                c.q === hoveredNextCorner.q &&
                c.r === hoveredNextCorner.r &&
                c.corner === hoveredNextCorner.corner
            );

            if (isAdjacent) {
                // Simple case: just append the hovered corner
                previewCorners = [...state.path, hoveredNextCorner];
            } else {
                // Complex case: use pathfinding to show the auto-path
                const autoPath = findPathBetweenCorners(
                    lastCorner,
                    hoveredNextCorner,
                    100,  // maxDepth
                    radius,
                    base,
                    padding,
                    state.path  // avoid existing path
                );

                if (autoPath && autoPath.length > 1) {
                    // Append pathfinding results (skip first as it's already in state.path)
                    previewCorners = [...state.path, ...autoPath.slice(1)];
                } else {
                    // Pathfinding failed, just show current path
                    previewCorners = state.path;
                }
            }
        }

        const points = previewCorners.map(corner => cornerToPixel(corner, radius, base, padding));

        let pathData = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathData += ` L ${points[i].x} ${points[i].y}`;
        }

        previewPath.setAttribute("d", pathData);

        // Update corner highlight if hovering
        if (hoveredNextCorner) {
            updateCornerHighlight(hoveredNextCorner);
            logger.info("Hover preview updated with corner", {
                pathLength: state.path.length,
                previewLength: previewCorners.length,
                hoveredCorner: `${hoveredNextCorner.q},${hoveredNextCorner.r}:${hoveredNextCorner.corner}`,
                isPathfinding: previewCorners.length > state.path.length + 1
            });
        } else {
            hideCornerHighlight();
        }
    };

    // Mousemove handler with requestAnimationFrame throttling
    const handleMouseMove = (event: MouseEvent) => {
        if (!state.isDrawing || state.path.length === 0 || panelDisabled) {
            hoveredNextCorner = null;
            hideCornerHighlight();
            return;
        }

        // Throttle with requestAnimationFrame
        if (rafId !== null) return;

        rafId = requestAnimationFrame(() => {
            rafId = null;

            const contentPoint = ctx.toContentPoint(event);
            if (!contentPoint) {
                hoveredNextCorner = null;
                hideCornerHighlight();
                return;
            }

            const handles = ctx.getHandles();
            const options = ctx.getOptions();
            if (!handles || !options) return;

            const lastCorner = state.path[state.path.length - 1];
            const radius = options.hexPixelSize ?? 42;
            const base = ctx.getBase();
            const padding = ctx.getPadding();

            // GLOBAL CORNER DETECTION: Get all corners in hexagonal viewport (radius 50 from base)
            const viewportRadius = 50;
            const hexesInViewport = coordsInRadius(base, viewportRadius);
            const allCorners = getAllCornersForHexes(hexesInViewport);

            // Find nearest corner to mouse position (from ALL corners, not just 3 adjacent)
            const nearCorner = findNearestCorner(
                contentPoint.x,
                contentPoint.y,
                allCorners,
                radius,
                base,
                padding,
                30  // threshold in pixels (increased from 15 for better detection)
            );

            if (nearCorner) {
                hoveredNextCorner = nearCorner;
                createCornerHighlight(handles);
                updateHoverPreview();
            } else {
                hoveredNextCorner = null;
                hideCornerHighlight();
                updateHoverPreview();
            }
        });
    };

    const handleHexClick = async (coord: AxialCoord, event: PointerEvent): Promise<boolean> => {
        const file = ctx.getFile();
        const handles = ctx.getHandles();
        const options = ctx.getOptions();
        if (!file || !handles || !options) return false;

        if (mode === "erase") {
            const erased = await eraseFeatureAt(ctx.app, file, coord);
            if (erased) {
                updateStatus(`Erased feature at ${coord.q},${coord.r}`);
            } else {
                updateStatus(`No feature found at ${coord.q},${coord.r}`);
            }
            return true;
        }

        // Transform mouse coordinates from viewport space to camera-transformed content space
        const contentPoint = ctx.toContentPoint(event);
        if (!contentPoint) {
            updateStatus("Could not transform coordinates");
            setInlineHint({
                text: "Coordinate transformation failed. Try again.",
                tone: "error",
            });
            return false;
        }

        // Find nearest corner to mouse position (in content space)
        const base = ctx.getBase();
        const padding = ctx.getPadding();
        const corner = pixelToCorner(contentPoint.x, contentPoint.y, options.hexPixelSize ?? 42, base, padding, 15);

        if (!corner) {
            updateStatus("No corner found near click");
            setInlineHint({
                text: "Click closer to a hex corner to draw features.",
                tone: "warning",
            });
            return false;
        }

        // Draw mode
        if (!state.isDrawing) {
            startPath(state, corner);
            createPreview(handles);

            // Register mousemove listener for hover preview
            const surface = ctx.getSurface();
            if (surface?.stageEl) {
                surface.stageEl.addEventListener("mousemove", handleMouseMove);
            }

            updateStatus(`Started ${state.featureType} at corner ${corner.q},${corner.r}:${corner.corner}`);
            setInlineHint({
                text: "Click adjacent corners to draw path. Click 'Finish' when done.",
                tone: "info",
            });
        } else {
            // Check adjacency - if not adjacent, use pathfinding
            if (!isAdjacentToLast(state, corner)) {
                const lastCorner = state.path[state.path.length - 1];
                // Pass existing path to avoid shortcuts and duplicates
                const path = findPathBetweenCorners(lastCorner, corner, 100, options.hexPixelSize ?? 42, base, padding, state.path);

                if (!path || path.length < 2) {
                    setInlineHint({
                        text: "Could not find path to corner. Try clicking closer or use adjacent corners.",
                        tone: "warning",
                    });
                    return false;
                }

                // Add all intermediate corners (skip first as it's already in path)
                let addedCount = 0;
                for (let i = 1; i < path.length; i++) {
                    const added = addToPath(state, path[i]);
                    if (added) addedCount++;
                }

                updateStatus(`Auto-pathed to ${corner.q},${corner.r}:${corner.corner} (+${addedCount} corners, total: ${state.path.length})`);
                setInlineHint({
                    text: `Auto-filled ${addedCount} intermediate corners along hex edges.`,
                    tone: "info",
                });
            } else {
                // Adjacent - simple add
                const added = addToPath(state, corner);
                if (added) {
                    updateStatus(`Added corner ${corner.q},${corner.r}:${corner.corner} (${state.path.length} corners)`);
                } else {
                    updateStatus(`Corner ${corner.q},${corner.r}:${corner.corner} already in path`);
                    setInlineHint({
                        text: "This corner is already in the path. Cannot create loops.",
                        tone: "warning",
                    });
                }
            }
        }

        updateHoverPreview();
        updateButtonStates();
        updatePathDisplay();
        return true;
    };

    const dispose = () => {
        disposed = true;

        // Cancel any pending animation frame
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }

        // Remove mousemove listener
        const surface = ctx.getSurface();
        if (surface?.stageEl) {
            surface.stageEl.removeEventListener("mousemove", handleMouseMove);
        }

        destroyPreview();
        destroyCornerHighlight();

        if (finishButton) {
            finishButton.element.removeEventListener("click", () => void handleFinish());
        }
        if (undoButton) {
            undoButton.element.removeEventListener("click", handleUndo);
        }
        if (clearButton) {
            clearButton.element.removeEventListener("click", handleClear);
        }
        form.destroy();
        while (root.firstChild) {
            root.removeChild(root.firstChild);
        }
    };

    updateButtonStates();
    setInlineHint({ text: "Click on a hex to start drawing a feature path.", tone: "info" });

    return {
        activate() {
            logger.info("activate() called - removing is-disabled");
            root.classList.remove("is-disabled");
            logger.info("activate() done");
            // Nothing to do on activate (preview is created on first click)
        },
        deactivate() {
            logger.info("deactivate() called - adding is-disabled");
            root.classList.add("is-disabled");
            logger.info("deactivate() done");

            // Remove mousemove listener
            const surface = ctx.getSurface();
            if (surface?.stageEl) {
                surface.stageEl.removeEventListener("mousemove", handleMouseMove);
            }

            destroyPreview();
            destroyCornerHighlight();
            hoveredNextCorner = null;
        },
        onMapRendered() {
            // Recreate preview if we were drawing
            if (state.isDrawing && state.path.length > 0) {
                const handles = ctx.getHandles();
                const surface = ctx.getSurface();
                if (handles && surface?.stageEl) {
                    createPreview(handles);
                    updateHoverPreview();

                    // Register mousemove listener
                    surface.stageEl.addEventListener("mousemove", handleMouseMove);
                }
            }
        },
        async handleHexClick(coord, event) {
            return handleHexClick(coord, event);
        },
        setDisabled(disabled) {
            setPanelDisabled(disabled);
            if (disabled) {
                destroyPreview();
                // destroyCornerGuidance(); // TODO: Implement if needed
            }
        },
        destroy() {
            dispose();
        },
    } satisfies FeatureBrushPanelControls;
}
