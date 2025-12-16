// src/workmodes/library/locations/dungeon-view.ts
// Dedicated view for rendering dungeon grid maps

import { ItemView } from "obsidian";
import type { TFile, WorkspaceLeaf, App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-locations');
import { readFrontmatter } from "@features/data-manager/browse/frontmatter-utils";
import { GridRenderer } from "@features/dungeons/grid-renderer";
import { TokenCreationModal, type TokenCreationData } from "@features/dungeons/token-creation-modal";
import { isDungeonLocation } from "./location-types";
import type { LocationData, DungeonToken } from "./location-types";

export const VIEW_TYPE_DUNGEON = "salt-dungeon-view";

/**
 * Dungeon View: Canvas-based grid renderer for dungeon locations.
 * Displays rooms, doors, and features on a visual grid.
 */
export class DungeonView extends ItemView {
    private dungeon: LocationData | null = null;
    private dungeonFile: TFile | null = null; // Track the file being edited
    private renderer: GridRenderer | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private controlsContainer: HTMLElement | null = null;
    private tooltipDiv: HTMLElement | null = null;
    private detailPanel: HTMLElement | null = null;

    // View options
    private showGrid = true;
    private showCoordinates = false;
    private tokenPlacementMode = false; // Toggle for token placement mode
    private pendingToken: TokenCreationData | null = null; // Token waiting to be placed
    private selectedToken: DungeonToken | null = null; // Currently selected token

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

        // Create detail panel (initially hidden)
        this.detailPanel = container.createDiv({ cls: "sm-dungeon-detail-panel" });
        this.detailPanel.style.display = "none";
        this.detailPanel.style.position = "absolute";
        this.detailPanel.style.right = "0";
        this.detailPanel.style.top = "0";
        this.detailPanel.style.width = "300px";
        this.detailPanel.style.height = "100%";
        this.detailPanel.style.background = "var(--background-primary)";
        this.detailPanel.style.borderLeft = "1px solid var(--background-modifier-border)";
        this.detailPanel.style.padding = "16px";
        this.detailPanel.style.overflowY = "auto";
        this.detailPanel.style.zIndex = "100";

        // Initialize renderer if dungeon data is available
        if (this.dungeon && isDungeonLocation(this.dungeon)) {
            this.initializeRenderer();
        }

        // Register keyboard shortcuts
        this.registerDomEvent(document, "keydown", (event: KeyboardEvent) => {
            this.handleKeyDown(event);
        });
    }

    async onClose(): Promise<void> {
        this.renderer = null;
        this.canvas = null;
        this.controlsContainer = null;
        this.tooltipDiv = null;
        this.detailPanel = null;
        this.dungeon = null;
        this.selectedToken = null;
    }

    /**
     * Set the dungeon data to display
     */
    setDungeon(dungeon: LocationData, file?: TFile): void {
        if (!isDungeonLocation(dungeon)) {
            logger.error("Cannot display non-dungeon location", { type: dungeon.type });
            return;
        }

        this.dungeon = dungeon;
        this.dungeonFile = file || null;

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
                    this.renderControls(); // Update zoom indicator
                }
            });

            // Register callback for hover changes (tooltips)
            this.renderer.setOnHoverChange((element) => {
                this.updateTooltip(element);
            });

            // Register callback for room selection (detail panel)
            this.renderer.setOnRoomSelect((room) => {
                this.updateDetailPanel(room);
            });

            // Register callback for token placement
            this.renderer.setOnTokenPlace((gridX, gridY) => {
                this.placeToken(gridX, gridY);
            });

            // Register callback for token selection
            this.renderer.setOnTokenSelect((token) => {
                this.updateTokenDetail(token);
            });

            this.renderer.render(this.dungeon);
        } catch (error) {
            logger.error("Failed to initialize renderer", error);
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

        // Zoom indicator
        const zoomIndicator = this.controlsContainer.createEl("span", {
            cls: "sm-dungeon-zoom-indicator",
        });
        zoomIndicator.style.padding = "4px 12px";
        zoomIndicator.style.fontSize = "12px";
        zoomIndicator.style.color = "var(--text-muted)";
        zoomIndicator.style.marginLeft = "8px";

        if (this.renderer) {
            const scale = this.renderer.getScale();
            zoomIndicator.textContent = `${Math.round(scale * 100)}%`;
        } else {
            zoomIndicator.textContent = "100%";
        }

        // Reset view button
        const resetBtn = this.controlsContainer.createEl("button", {
            cls: "sm-dungeon-control",
            text: "🔄 Reset View",
        });

        resetBtn.addEventListener("click", () => {
            if (this.renderer && this.dungeon && isDungeonLocation(this.dungeon)) {
                this.renderer.resetView();
                this.renderer.render(this.dungeon);
                this.renderControls(); // Update zoom indicator
            }
        });

        // Add Token button
        const addTokenBtn = this.controlsContainer.createEl("button", {
            cls: this.tokenPlacementMode ? "sm-dungeon-control-active" : "sm-dungeon-control",
            text: "➕ Add Token",
        });

        addTokenBtn.addEventListener("click", () => {
            // Open token creation modal
            const modal = new TokenCreationModal(this.app, (data) => {
                // Store pending token and enter placement mode
                this.pendingToken = data;
                this.tokenPlacementMode = true;
                this.renderControls(); // Update button state

                // Enable placement mode on renderer
                if (this.renderer) {
                    this.renderer.setTokenPlacementMode(true);
                }

                // Update canvas cursor
                if (this.canvas) {
                    this.canvas.style.cursor = "crosshair";
                }

                logger.info("Token ready for placement", { token: data });
            });

            modal.open();
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
    private updateTooltip(element: { type: "door"; data: any; canvasX: number; canvasY: number } | { type: "feature"; data: any; canvasX: number; canvasY: number } | { type: "token"; data: any; canvasX: number; canvasY: number } | null): void {
        if (!this.tooltipDiv) return;

        if (!element) {
            // Hide tooltip
            this.tooltipDiv.style.display = "none";
            return;
        }

        // Format tooltip content
        let content = "";
        if (element.type === "token") {
            const token = element.data;
            const typeEmoji = token.type === "player" ? "🧙" : token.type === "npc" ? "🙂" : token.type === "monster" ? "👹" : "📦";
            content = `${typeEmoji} ${token.label}\n`;
            content += `Type: ${token.type}\n`;
            content += `Position: (${token.position.x}, ${token.position.y})\n`;
            if (token.size && token.size !== 1.0) {
                content += `Size: ${token.size}x\n`;
            }
            content += "\nClick to select";
        } else if (element.type === "door") {
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

    /**
     * Update detail panel with room information
     */
    private updateDetailPanel(room: any | null): void {
        if (!this.detailPanel) return;

        if (!room) {
            // Hide panel
            this.detailPanel.style.display = "none";
            return;
        }

        // Clear panel
        this.detailPanel.empty();

        // Create close button
        const header = this.detailPanel.createDiv({ cls: "sm-dungeon-detail-header" });
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.marginBottom = "16px";

        const closeBtn = header.createEl("button", { text: "✕", cls: "sm-dungeon-detail-close" });
        closeBtn.style.background = "none";
        closeBtn.style.border = "none";
        closeBtn.style.fontSize = "20px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.padding = "0";
        closeBtn.style.marginLeft = "auto";
        closeBtn.addEventListener("click", () => {
            this.detailPanel!.style.display = "none";
            // Clear highlight in renderer
            if (this.dungeon && isDungeonLocation(this.dungeon)) {
                this.renderer?.render(this.dungeon);
            }
        });

        // Room title
        const title = this.detailPanel.createEl("h3", { text: `Room ${room.id}` });
        title.style.marginTop = "0";
        title.style.marginBottom = "8px";

        if (room.name) {
            const subtitle = this.detailPanel.createEl("h4", { text: room.name });
            subtitle.style.marginTop = "0";
            subtitle.style.marginBottom = "16px";
            subtitle.style.color = "var(--text-muted)";
        }

        // Grid bounds
        const bounds = this.detailPanel.createEl("p");
        bounds.style.fontSize = "12px";
        bounds.style.color = "var(--text-muted)";
        bounds.style.marginBottom = "16px";
        bounds.textContent = `Bounds: (${room.grid_bounds.x},${room.grid_bounds.y}) → (${room.grid_bounds.width}×${room.grid_bounds.height})`;

        // Description
        if (room.description) {
            const descHeader = this.detailPanel.createEl("h5", { text: "Description" });
            descHeader.style.marginTop = "16px";
            descHeader.style.marginBottom = "8px";

            const desc = this.detailPanel.createEl("p", { text: room.description });
            desc.style.marginBottom = "16px";
        }

        // Doors
        if (room.doors && room.doors.length > 0) {
            const doorsHeader = this.detailPanel.createEl("h5", { text: "Doors" });
            doorsHeader.style.marginTop = "16px";
            doorsHeader.style.marginBottom = "8px";

            const doorsList = this.detailPanel.createEl("ul");
            doorsList.style.marginTop = "0";
            doorsList.style.paddingLeft = "20px";

            for (const door of room.doors) {
                const doorItem = doorsList.createEl("li");
                doorItem.style.marginBottom = "8px";

                let doorText = `🚪 ${door.id} (${door.position.x},${door.position.y})`;
                if (door.leads_to) {
                    doorText += ` → ${door.leads_to}`;
                }
                if (door.locked) {
                    doorText += " 🔒";
                }

                doorItem.textContent = doorText;

                if (door.description) {
                    const doorDesc = doorItem.createDiv();
                    doorDesc.style.fontSize = "11px";
                    doorDesc.style.color = "var(--text-muted)";
                    doorDesc.style.marginTop = "4px";
                    doorDesc.textContent = door.description;
                }
            }
        }

        // Features
        if (room.features && room.features.length > 0) {
            const featuresHeader = this.detailPanel.createEl("h5", { text: "Features" });
            featuresHeader.style.marginTop = "16px";
            featuresHeader.style.marginBottom = "8px";

            const featuresList = this.detailPanel.createEl("ul");
            featuresList.style.marginTop = "0";
            featuresList.style.paddingLeft = "20px";

            for (const feature of room.features) {
                const featureItem = featuresList.createEl("li");
                featureItem.style.marginBottom = "8px";

                const icon = this.getFeatureIcon(feature.type);
                const typeLabel = feature.type.charAt(0).toUpperCase() + feature.type.slice(1);
                let featureText = `${icon} ${feature.id} (${typeLabel}, ${feature.position.x},${feature.position.y})`;

                featureItem.textContent = featureText;

                if (feature.description) {
                    const featureDesc = featureItem.createDiv();
                    featureDesc.style.fontSize = "11px";
                    featureDesc.style.color = "var(--text-muted)";
                    featureDesc.style.marginTop = "4px";
                    featureDesc.textContent = feature.description;
                }
            }
        }

        // Show panel
        this.detailPanel.style.display = "block";
    }

    /**
     * Save dungeon data back to file
     */
    private async saveDungeonToFile(): Promise<void> {
        if (!this.dungeonFile || !this.dungeon || !isDungeonLocation(this.dungeon)) {
            logger.warn("Cannot save: no file or invalid dungeon");
            return;
        }

        try {
            // Read current file content
            const content = await this.app.vault.read(this.dungeonFile);

            // Parse frontmatter
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (!fmMatch) {
                logger.error("File has no frontmatter");
                return;
            }

            const [, fmText, body] = fmMatch;

            // Parse YAML frontmatter
            // Simple approach: split into lines and update the tokens field
            const fmLines = fmText.split("\n");
            const updatedFmLines: string[] = [];
            let inTokensArray = false;
            let tokensInserted = false;

            for (const line of fmLines) {
                // Skip existing tokens array
                if (line.startsWith("tokens:")) {
                    inTokensArray = true;
                    continue;
                }

                if (inTokensArray) {
                    // Check if we're still in the tokens array (indented or array item)
                    if (line.startsWith("  ") || line.startsWith("- ")) {
                        continue; // Skip tokens array content
                    } else {
                        // Exited tokens array, insert new tokens here
                        inTokensArray = false;
                        if (!tokensInserted && this.dungeon.tokens && this.dungeon.tokens.length > 0) {
                            updatedFmLines.push("tokens:");
                            for (const token of this.dungeon.tokens) {
                                updatedFmLines.push(`  - id: ${token.id}`);
                                updatedFmLines.push(`    type: ${token.type}`);
                                updatedFmLines.push(`    position:`);
                                updatedFmLines.push(`      x: ${token.position.x}`);
                                updatedFmLines.push(`      y: ${token.position.y}`);
                                updatedFmLines.push(`    label: ${token.label}`);
                                if (token.color) {
                                    updatedFmLines.push(`    color: ${token.color}`);
                                }
                                if (token.size && token.size !== 1.0) {
                                    updatedFmLines.push(`    size: ${token.size}`);
                                }
                            }
                            tokensInserted = true;
                        }
                        updatedFmLines.push(line);
                    }
                } else {
                    updatedFmLines.push(line);
                }
            }

            // If tokens weren't inserted yet (no tokens field existed), add them at the end
            if (!tokensInserted && this.dungeon.tokens && this.dungeon.tokens.length > 0) {
                updatedFmLines.push("tokens:");
                for (const token of this.dungeon.tokens) {
                    updatedFmLines.push(`  - id: ${token.id}`);
                    updatedFmLines.push(`    type: ${token.type}`);
                    updatedFmLines.push(`    position:`);
                    updatedFmLines.push(`      x: ${token.position.x}`);
                    updatedFmLines.push(`      y: ${token.position.y}`);
                    updatedFmLines.push(`    label: ${token.label}`);
                    if (token.color) {
                        updatedFmLines.push(`    color: ${token.color}`);
                    }
                    if (token.size && token.size !== 1.0) {
                        updatedFmLines.push(`    size: ${token.size}`);
                    }
                }
            }

            // Reconstruct file content
            const newContent = `---\n${updatedFmLines.join("\n")}\n---\n${body}`;

            // Write back to file
            await this.app.vault.modify(this.dungeonFile, newContent);

            logger.info("Dungeon saved to file", { file: this.dungeonFile.path });
        } catch (error) {
            logger.error("Failed to save dungeon", error);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // Delete key - delete selected token
        if (event.key === "Delete" && this.selectedToken) {
            event.preventDefault();
            this.deleteToken(this.selectedToken.id);
        }
    }

    /**
     * Update token detail view
     */
    private updateTokenDetail(token: DungeonToken | null): void {
        if (!this.detailPanel) return;

        // Update selected token reference
        this.selectedToken = token;

        if (!token) {
            // Hide panel
            this.detailPanel.style.display = "none";
            return;
        }

        // Clear panel
        this.detailPanel.empty();

        // Create close button
        const header = this.detailPanel.createDiv({ cls: "sm-dungeon-detail-header" });
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.marginBottom = "16px";

        const closeBtn = header.createEl("button", { text: "✕", cls: "sm-dungeon-detail-close" });
        closeBtn.style.background = "none";
        closeBtn.style.border = "none";
        closeBtn.style.fontSize = "20px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.padding = "0";
        closeBtn.style.marginLeft = "auto";
        closeBtn.addEventListener("click", () => {
            this.detailPanel!.style.display = "none";
            // Clear selection in renderer
            if (this.renderer && this.dungeon && isDungeonLocation(this.dungeon)) {
                this.renderer.render(this.dungeon);
            }
        });

        // Token type emoji
        const typeEmoji = token.type === "player" ? "🧙" : token.type === "npc" ? "🙂" : token.type === "monster" ? "👹" : "📦";

        // Token title
        const title = this.detailPanel.createEl("h3", { text: `${typeEmoji} ${token.label}` });
        title.style.marginTop = "0";
        title.style.marginBottom = "8px";

        // Token type
        const typeLabel = this.detailPanel.createEl("h4", { text: token.type.charAt(0).toUpperCase() + token.type.slice(1) });
        typeLabel.style.marginTop = "0";
        typeLabel.style.marginBottom = "16px";
        typeLabel.style.color = "var(--text-muted)";

        // Position
        const position = this.detailPanel.createEl("p");
        position.style.fontSize = "12px";
        position.style.color = "var(--text-muted)";
        position.style.marginBottom = "8px";
        position.textContent = `Position: (${token.position.x}, ${token.position.y})`;

        // Color preview
        if (token.color) {
            const colorContainer = this.detailPanel.createDiv();
            colorContainer.style.fontSize = "12px";
            colorContainer.style.color = "var(--text-muted)";
            colorContainer.style.marginBottom = "8px";
            colorContainer.style.display = "flex";
            colorContainer.style.alignItems = "center";

            const colorLabel = colorContainer.createSpan({ text: "Color: " });
            const colorSwatch = colorContainer.createEl("span");
            colorSwatch.style.display = "inline-block";
            colorSwatch.style.width = "20px";
            colorSwatch.style.height = "20px";
            colorSwatch.style.borderRadius = "50%";
            colorSwatch.style.border = "1px solid var(--background-modifier-border)";
            colorSwatch.style.marginLeft = "8px";
            colorSwatch.style.backgroundColor = token.color;
        }

        // Size
        if (token.size && token.size !== 1.0) {
            const size = this.detailPanel.createEl("p");
            size.style.fontSize = "12px";
            size.style.color = "var(--text-muted)";
            size.style.marginBottom = "16px";
            size.textContent = `Size: ${token.size}x`;
        }

        // Action buttons
        const actionsContainer = this.detailPanel.createDiv({ cls: "sm-token-actions" });
        actionsContainer.style.marginTop = "24px";
        actionsContainer.style.display = "flex";
        actionsContainer.style.gap = "8px";

        // Delete button
        const deleteBtn = actionsContainer.createEl("button", { text: "🗑️ Delete", cls: "sm-dungeon-control" });
        deleteBtn.style.flex = "1";
        deleteBtn.addEventListener("click", () => {
            this.deleteToken(token.id);
        });

        // Edit button
        const editBtn = actionsContainer.createEl("button", { text: "✏️ Edit", cls: "sm-dungeon-control" });
        editBtn.style.flex = "1";
        editBtn.addEventListener("click", () => {
            this.editToken(token);
        });

        // Show panel
        this.detailPanel.style.display = "block";
    }

    /**
     * Delete a token by ID
     */
    private deleteToken(tokenId: string): void {
        if (!this.dungeon || !isDungeonLocation(this.dungeon)) {
            logger.warn("Cannot delete token: invalid dungeon");
            return;
        }

        if (!this.dungeon.tokens || this.dungeon.tokens.length === 0) {
            logger.warn("Cannot delete token: no tokens");
            return;
        }

        // Find token index
        const tokenIndex = this.dungeon.tokens.findIndex((t) => t.id === tokenId);

        if (tokenIndex === -1) {
            logger.warn("Token not found", { tokenId });
            return;
        }

        // Remove token from array
        this.dungeon.tokens.splice(tokenIndex, 1);

        logger.info("Token deleted", { tokenId });

        // Clear selected token reference
        this.selectedToken = null;

        // Hide detail panel
        if (this.detailPanel) {
            this.detailPanel.style.display = "none";
        }

        // Re-render to remove token from canvas
        if (this.renderer) {
            this.renderer.render(this.dungeon);
        }

        // Persist changes to file
        this.saveDungeonToFile();
    }

    /**
     * Edit a token's properties
     */
    private editToken(token: DungeonToken): void {
        if (!this.dungeon || !isDungeonLocation(this.dungeon)) {
            logger.warn("Cannot edit token: invalid dungeon");
            return;
        }

        // Open modal with pre-filled data
        const modal = new TokenCreationModal(
            this.app,
            (data) => {
                // Find token in array
                const tokenIndex = this.dungeon!.tokens?.findIndex((t) => t.id === token.id);

                if (tokenIndex === undefined || tokenIndex === -1) {
                    logger.warn("Token not found for edit", { tokenId: token.id });
                    return;
                }

                // Update token properties (keep position and id)
                const updatedToken: DungeonToken = {
                    ...token,
                    type: data.type,
                    label: data.label,
                    color: data.color,
                    size: data.size,
                };

                this.dungeon!.tokens![tokenIndex] = updatedToken;

                logger.info("Token updated", { token: updatedToken });

                // Update selected token reference
                this.selectedToken = updatedToken;

                // Re-render to show updated token
                if (this.renderer) {
                    this.renderer.render(this.dungeon!);
                }

                // Update detail panel with new data
                this.updateTokenDetail(updatedToken);

                // Persist changes to file
                this.saveDungeonToFile();
            },
            {
                type: token.type,
                label: token.label,
                color: token.color,
                size: token.size,
            },
        );

        modal.open();
    }

    /**
     * Place a token at the specified grid coordinates
     */
    private placeToken(gridX: number, gridY: number): void {
        if (!this.pendingToken || !this.dungeon || !isDungeonLocation(this.dungeon)) {
            logger.warn("Cannot place token: no pending token or invalid dungeon");
            return;
        }

        // Generate unique token ID
        const existingTokens = this.dungeon.tokens || [];
        const tokenId = `token-${existingTokens.length + 1}`;

        // Create new token
        const newToken: DungeonToken = {
            id: tokenId,
            type: this.pendingToken.type,
            position: { x: gridX, y: gridY },
            label: this.pendingToken.label,
            color: this.pendingToken.color,
            size: this.pendingToken.size,
        };

        // Add token to dungeon
        if (!this.dungeon.tokens) {
            this.dungeon.tokens = [];
        }
        this.dungeon.tokens.push(newToken);

        logger.info("Token placed", { token: newToken });

        // Exit placement mode
        this.tokenPlacementMode = false;
        this.pendingToken = null;

        // Disable placement mode on renderer
        if (this.renderer) {
            this.renderer.setTokenPlacementMode(false);
        }

        // Update canvas cursor
        if (this.canvas) {
            this.canvas.style.cursor = "grab";
        }

        // Re-render to show new token
        if (this.renderer) {
            this.renderer.render(this.dungeon);
        }

        // Update controls to reflect mode change
        this.renderControls();

        // Persist changes to file
        this.saveDungeonToFile();
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
        logger.warn("Cannot open non-dungeon location in dungeon view", { type: locationType });
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
        tokens: Array.isArray(frontmatter.tokens) ? frontmatter.tokens as any : undefined,
    };

    if (!isDungeonLocation(location)) {
        logger.error("Location has type 'Dungeon' but missing grid dimensions");
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
        view.setDungeon(location, file);
    }

    // Reveal the leaf
    app.workspace.revealLeaf(leaf);
}
