// src/workmodes/library/locations/dungeon-view.ts
// Dedicated view for rendering dungeon grid maps

import { ItemView, type WorkspaceLeaf, type App, TFile } from "obsidian";
import { GridRenderer } from "../../../features/dungeons/rendering/grid-renderer";
import type { LocationData } from "./types";
import { isDungeonLocation } from "./types";
import { logger } from "../../../app/plugin-logger";
import { readFrontmatter } from "../../../features/data-manager/browse/frontmatter-utils";

export const VIEW_TYPE_DUNGEON = "salt-dungeon-view";

/**
 * Dungeon View: Canvas-based grid renderer for dungeon locations.
 * Displays rooms, doors, and features on a visual grid.
 */
export class DungeonView extends ItemView {
    private dungeon: LocationData | null = null;
    private renderer: GridRenderer | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private controlsContainer: HTMLElement | null = null;
    private tooltipDiv: HTMLElement | null = null;

    // View options
    private showGrid = true;
    private showCoordinates = false;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_DUNGEON;
    }

    getDisplayText(): string {
        return this.dungeon?.name || "Dungeon";
    }

    getIcon(): string {
        return "map";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass("sm-dungeon-view");

        // Create controls container
        this.controlsContainer = container.createDiv({ cls: "sm-dungeon-controls" });
        this.renderControls();

        // Create canvas container
        const canvasContainer = container.createDiv({ cls: "sm-dungeon-canvas-container" });
        this.canvas = canvasContainer.createEl("canvas", { cls: "sm-dungeon-canvas" });
        this.canvas.style.cursor = "grab"; // Set cursor for pan

        // Create tooltip (initially hidden)
        this.tooltipDiv = container.createDiv({ cls: "sm-dungeon-tooltip" });
        this.tooltipDiv.style.display = "none";
        this.tooltipDiv.style.position = "absolute";
        this.tooltipDiv.style.pointerEvents = "none"; // Don't block mouse events
        this.tooltipDiv.style.background = "rgba(0, 0, 0, 0.85)";
        this.tooltipDiv.style.color = "white";
        this.tooltipDiv.style.padding = "8px 12px";
        this.tooltipDiv.style.borderRadius = "4px";
        this.tooltipDiv.style.fontSize = "12px";
        this.tooltipDiv.style.zIndex = "1000";
        this.tooltipDiv.style.maxWidth = "300px";
        this.tooltipDiv.style.whiteSpace = "pre-wrap";

        // Initialize renderer if dungeon data is available
        if (this.dungeon && isDungeonLocation(this.dungeon)) {
            this.initializeRenderer();
        }
    }

    async onClose(): Promise<void> {
        this.renderer = null;
        this.canvas = null;
        this.controlsContainer = null;
        this.tooltipDiv = null;
        this.dungeon = null;
    }

    /**
     * Set the dungeon data to display
     */
    setDungeon(dungeon: LocationData): void {
        if (!isDungeonLocation(dungeon)) {
            logger.error("[dungeon-view] Cannot display non-dungeon location", { type: dungeon.type });
            return;
        }

        this.dungeon = dungeon;

        // Re-initialize renderer if view is already open
        if (this.canvas) {
            this.initializeRenderer();
        }
    }

    /**
     * Initialize the grid renderer with current dungeon data
     */
    private initializeRenderer(): void {
        if (!this.canvas || !this.dungeon || !isDungeonLocation(this.dungeon)) {
            return;
        }

        try {
            this.renderer = new GridRenderer(this.canvas, {
                gridWidth: this.dungeon.grid_width,
                gridHeight: this.dungeon.grid_height,
                cellSize: this.dungeon.cell_size || 40,
                showGrid: this.showGrid,
                showCoordinates: this.showCoordinates,
            });

            // Register callback for transform changes (zoom/pan)
            this.renderer.setOnTransformChange(() => {
                if (this.dungeon && isDungeonLocation(this.dungeon)) {
                    this.renderer?.render(this.dungeon);
                }
            });

            // Register callback for hover changes (tooltips)
            this.renderer.setOnHoverChange((element) => {
                this.updateTooltip(element);
            });

            this.renderer.render(this.dungeon);
        } catch (error) {
            logger.error("[dungeon-view] Failed to initialize renderer", error);
        }
    }

    /**
     * Render view controls (toggle buttons)
     */
    private renderControls(): void {
        if (!this.controlsContainer) return;

        this.controlsContainer.empty();

        // Grid toggle
        const gridToggle = this.controlsContainer.createEl("button", {
            cls: this.showGrid ? "sm-dungeon-control-active" : "sm-dungeon-control",
            text: "📏 Grid",
        });

        gridToggle.addEventListener("click", () => {
            this.showGrid = !this.showGrid;
            this.updateRenderer();
            this.renderControls();
        });

        // Coordinates toggle
        const coordsToggle = this.controlsContainer.createEl("button", {
            cls: this.showCoordinates ? "sm-dungeon-control-active" : "sm-dungeon-control",
            text: "🔢 Coordinates",
        });

        coordsToggle.addEventListener("click", () => {
            this.showCoordinates = !this.showCoordinates;
            this.updateRenderer();
            this.renderControls();
        });

        // Export button (future: PNG snapshot)
        const exportBtn = this.controlsContainer.createEl("button", {
            cls: "sm-dungeon-control",
            text: "💾 Export",
            attr: { disabled: "true", title: "Coming soon" },
        });
    }

    /**
     * Update renderer options and re-render
     */
    private updateRenderer(): void {
        if (!this.renderer || !this.dungeon || !isDungeonLocation(this.dungeon)) {
            return;
        }

        this.renderer.setOptions({
            showGrid: this.showGrid,
            showCoordinates: this.showCoordinates,
        });

        this.renderer.render(this.dungeon);
    }

    /**
     * Update tooltip visibility and content based on hovered element
     */
    private updateTooltip(element: { type: "door"; data: any; canvasX: number; canvasY: number } | { type: "feature"; data: any; canvasX: number; canvasY: number } | null): void {
        if (!this.tooltipDiv) return;

        if (!element) {
            // Hide tooltip
            this.tooltipDiv.style.display = "none";
            return;
        }

        // Format tooltip content
        let content = "";
        if (element.type === "door") {
            const door = element.data;
            content = `🚪 Door ${door.id}\n`;
            if (door.leads_to) {
                content += `Leads to: ${door.leads_to}\n`;
            }
            if (door.locked) {
                content += "🔒 Locked\n";
            }
            if (door.description) {
                content += `\n${door.description}`;
            }
        } else if (element.type === "feature") {
            const feature = element.data;
            const typeLabel = feature.type.charAt(0).toUpperCase() + feature.type.slice(1);
            content = `${this.getFeatureIcon(feature.type)} Feature ${feature.id} (${typeLabel})\n`;
            if (feature.description) {
                content += `\n${feature.description}`;
            }
        }

        // Update content
        this.tooltipDiv.textContent = content;

        // Position tooltip near mouse (offset to avoid cursor overlap)
        const offsetX = 15;
        const offsetY = 15;
        this.tooltipDiv.style.left = `${element.canvasX + offsetX}px`;
        this.tooltipDiv.style.top = `${element.canvasY + offsetY}px`;

        // Show tooltip
        this.tooltipDiv.style.display = "block";
    }

    /**
     * Get icon for feature type
     */
    private getFeatureIcon(type: string): string {
        switch (type) {
            case "secret":
                return "🔍";
            case "trap":
            case "hazard":
                return "⚠️";
            case "treasure":
                return "💰";
            default:
                return "📦";
        }
    }
}

/**
 * Open a dungeon location in Dungeon View
 */
export async function openDungeonView(app: App, file: TFile): Promise<void> {
    // Read frontmatter to get location data
    const frontmatter = await readFrontmatter(app, file);

    // Validate it's a dungeon
    const locationType = typeof frontmatter.type === "string" ? frontmatter.type : "Unknown";
    if (locationType !== "Dungeon") {
        logger.warn("[dungeon-view] Cannot open non-dungeon location in dungeon view", { type: locationType });
        return;
    }

    // Build LocationData from frontmatter
    const location: LocationData = {
        name: file.basename,
        type: locationType as any,
        description: typeof frontmatter.description === "string" ? frontmatter.description : undefined,
        parent: typeof frontmatter.parent === "string" ? frontmatter.parent : undefined,
        owner_type: typeof frontmatter.owner_type === "string" ? frontmatter.owner_type as any : undefined,
        owner_name: typeof frontmatter.owner_name === "string" ? frontmatter.owner_name : undefined,
        region: typeof frontmatter.region === "string" ? frontmatter.region : undefined,
        coordinates: typeof frontmatter.coordinates === "string" ? frontmatter.coordinates : undefined,
        notes: typeof frontmatter.notes === "string" ? frontmatter.notes : undefined,
        grid_width: typeof frontmatter.grid_width === "number" ? frontmatter.grid_width : undefined,
        grid_height: typeof frontmatter.grid_height === "number" ? frontmatter.grid_height : undefined,
        cell_size: typeof frontmatter.cell_size === "number" ? frontmatter.cell_size : undefined,
        rooms: Array.isArray(frontmatter.rooms) ? frontmatter.rooms as any : undefined,
    };

    if (!isDungeonLocation(location)) {
        logger.error("[dungeon-view] Location has type 'Dungeon' but missing grid dimensions");
        return;
    }

    // Open or reuse existing dungeon view
    const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_DUNGEON);
    let leaf: WorkspaceLeaf;

    if (leaves.length > 0) {
        // Reuse existing view
        leaf = leaves[0];
    } else {
        // Create new leaf
        leaf = app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_TYPE_DUNGEON, active: true });
    }

    // Set dungeon data
    const view = leaf.view;
    if (view instanceof DungeonView) {
        view.setDungeon(location);
    }

    // Reveal the leaf
    app.workspace.revealLeaf(leaf);
}
