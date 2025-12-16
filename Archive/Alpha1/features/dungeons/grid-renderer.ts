// src/features/dungeons/rendering/grid-renderer.ts
// Canvas-based grid renderer for dungeon maps

import { isDungeonLocation, getFeatureTypePrefix, getDefaultTokenColor } from "@services/domain";
import type { LocationData, DungeonRoom, DungeonDoor, DungeonFeature, DungeonToken } from "@services/domain";

// ============================================================================
// TYPES
// ============================================================================

export interface GridRendererOptions {
    gridWidth: number;      // Number of cells horizontally
    gridHeight: number;     // Number of cells vertically
    cellSize: number;       // Size of each cell in pixels
    showGrid: boolean;      // Show grid lines
    showCoordinates: boolean; // Show cell coordinates
}

const DEFAULT_OPTIONS: GridRendererOptions = {
    gridWidth: 30,
    gridHeight: 20,
    cellSize: 40,
    showGrid: true,
    showCoordinates: false,
};

// ============================================================================
// GRID RENDERER
// ============================================================================

export class GridRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private options: GridRendererOptions;

    // Transform state for zoom/pan
    private scale: number = 1.0;
    private offsetX: number = 0;
    private offsetY: number = 0;
    private minScale: number = 0.5;
    private maxScale: number = 3.0;

    // Pan state
    private isPanning: boolean = false;
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;

    // Callback for view updates
    private onTransformChange?: () => void;

    // Highlight state
    private highlightedRoomId: string | null = null;
    private currentDungeon: LocationData | null = null;

    // Hover state for tooltips
    private hoveredElement: { type: "door"; data: DungeonDoor } | { type: "feature"; data: DungeonFeature } | { type: "token"; data: DungeonToken } | null = null;
    private onHoverChange?: (element: { type: "door"; data: DungeonDoor; canvasX: number; canvasY: number } | { type: "feature"; data: DungeonFeature; canvasX: number; canvasY: number } | { type: "token"; data: DungeonToken; canvasX: number; canvasY: number } | null) => void;

    // Token selection state
    private selectedTokenId: string | null = null;
    private onTokenSelect?: (token: DungeonToken | null) => void;

    // Room selection callback
    private onRoomSelect?: (room: DungeonRoom | null) => void;

    // Token placement mode
    private tokenPlacementMode: boolean = false;
    private onTokenPlace?: (gridX: number, gridY: number) => void;

    constructor(canvas: HTMLCanvasElement, options: Partial<GridRendererOptions> = {}) {
        this.canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D rendering context");
        }
        this.ctx = ctx;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.updateCanvasSize();
        this.initializeEventListeners();
    }

    /**
     * Set callback for transform changes (zoom/pan)
     */
    setOnTransformChange(callback: () => void): void {
        this.onTransformChange = callback;
    }

    /**
     * Set callback for hover changes (tooltips)
     */
    setOnHoverChange(callback: (element: { type: "door"; data: DungeonDoor; canvasX: number; canvasY: number } | { type: "feature"; data: DungeonFeature; canvasX: number; canvasY: number } | null) => void): void {
        this.onHoverChange = callback;
    }

    /**
     * Set callback for room selection changes (detail panel)
     */
    setOnRoomSelect(callback: (room: DungeonRoom | null) => void): void {
        this.onRoomSelect = callback;
    }

    /**
     * Enable/disable token placement mode
     */
    setTokenPlacementMode(enabled: boolean): void {
        this.tokenPlacementMode = enabled;
    }

    /**
     * Set callback for token placement (grid coordinates)
     */
    setOnTokenPlace(callback: (gridX: number, gridY: number) => void): void {
        this.onTokenPlace = callback;
    }

    /**
     * Set callback for token selection
     */
    setOnTokenSelect(callback: (token: DungeonToken | null) => void): void {
        this.onTokenSelect = callback;
    }

    /**
     * Render a dungeon location onto the canvas
     */
    render(dungeon: LocationData): void {
        if (!isDungeonLocation(dungeon)) {
            throw new Error("Cannot render non-dungeon location");
        }

        // Store current dungeon for click detection
        this.currentDungeon = dungeon;

        // Update options from dungeon data
        this.options.gridWidth = dungeon.grid_width;
        this.options.gridHeight = dungeon.grid_height;
        if (dungeon.cell_size) {
            this.options.cellSize = dungeon.cell_size;
        }

        this.updateCanvasSize();
        this.clear();

        // Apply transform (zoom/pan)
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Render layers
        if (this.options.showGrid) {
            this.renderGrid();
        }
        if (this.options.showCoordinates) {
            this.renderCoordinates();
        }

        // Render rooms
        if (dungeon.rooms && dungeon.rooms.length > 0) {
            this.renderRooms(dungeon.rooms);
        }

        // Render tokens (after rooms, before doors/features)
        if (dungeon.tokens && dungeon.tokens.length > 0) {
            this.renderTokens(dungeon.tokens);
        }

        // Render doors and features for each room
        if (dungeon.rooms && dungeon.rooms.length > 0) {
            for (const room of dungeon.rooms) {
                if (room.doors && room.doors.length > 0) {
                    this.renderDoors(room.doors);
                }
                if (room.features && room.features.length > 0) {
                    this.renderFeatures(room.features);
                }
            }
        }

        // Restore transform
        this.ctx.restore();
    }

    /**
     * Clear the canvas
     */
    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Fill with background color
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Update renderer options
     */
    setOptions(options: Partial<GridRendererOptions>): void {
        this.options = { ...this.options, ...options };
        this.updateCanvasSize();
    }

    /**
     * Get current canvas dimensions
     */
    getDimensions(): { width: number; height: number } {
        return {
            width: this.options.gridWidth * this.options.cellSize,
            height: this.options.gridHeight * this.options.cellSize,
        };
    }

    /**
     * Get current zoom scale
     */
    getScale(): number {
        return this.scale;
    }

    /**
     * Reset view to default (scale=1, centered)
     */
    resetView(): void {
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    /**
     * Destroy renderer and remove event listeners
     */
    destroy(): void {
        this.canvas.removeEventListener("wheel", this.handleWheel);
        this.canvas.removeEventListener("mousedown", this.handleMouseDown);
        this.canvas.removeEventListener("mousemove", this.handleMouseMove);
        this.canvas.removeEventListener("mouseup", this.handleMouseUp);
        this.canvas.removeEventListener("mouseleave", this.handleMouseLeave);
        this.canvas.removeEventListener("click", this.handleClick);
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    /**
     * Update canvas size based on grid dimensions
     */
    private updateCanvasSize(): void {
        const width = this.options.gridWidth * this.options.cellSize;
        const height = this.options.gridHeight * this.options.cellSize;

        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
    }

    /**
     * Render grid lines
     */
    private renderGrid(): void {
        const { gridWidth, gridHeight, cellSize } = this.options;
        const width = gridWidth * cellSize;
        const height = gridHeight * cellSize;

        this.ctx.strokeStyle = "#d0d0d0";
        this.ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= gridWidth; x++) {
            const px = x * cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(px, 0);
            this.ctx.lineTo(px, height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= gridHeight; y++) {
            const py = y * cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, py);
            this.ctx.lineTo(width, py);
            this.ctx.stroke();
        }
    }

    /**
     * Render cell coordinate labels
     */
    private renderCoordinates(): void {
        const { gridWidth, gridHeight, cellSize } = this.options;

        this.ctx.fillStyle = "#999999";
        this.ctx.font = "10px sans-serif";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "top";

        // Render coordinates for every 5th cell
        for (let x = 0; x < gridWidth; x += 5) {
            for (let y = 0; y < gridHeight; y += 5) {
                const px = x * cellSize + 2;
                const py = y * cellSize + 2;
                this.ctx.fillText(`${x},${y}`, px, py);
            }
        }
    }

    /**
     * Render room boundaries and labels
     */
    private renderRooms(rooms: DungeonRoom[]): void {
        const colors = [
            "#ffd8a8",  // Warm beige
            "#c5f6fa",  // Light cyan
            "#d0ebff",  // Light blue
            "#e3fafc",  // Very light cyan
            "#fff3bf",  // Light yellow
            "#f3f0ff",  // Light purple
            "#ffe3e3",  // Light pink
            "#d3f9d8",  // Light green
        ];

        rooms.forEach((room, index) => {
            const { x, y, width, height } = room.grid_bounds;
            const pixelPos = this.gridToPixel(x, y);
            const pixelWidth = width * this.options.cellSize;
            const pixelHeight = height * this.options.cellSize;

            const isHighlighted = room.id === this.highlightedRoomId;

            // Fill room background
            this.ctx.fillStyle = isHighlighted ? "#fffacd" : colors[index % colors.length];
            this.ctx.fillRect(pixelPos.x, pixelPos.y, pixelWidth, pixelHeight);

            // Draw room boundary (thicker and glowing if highlighted)
            if (isHighlighted) {
                // Glow effect
                this.ctx.shadowColor = "#ffd700";
                this.ctx.shadowBlur = 15;
                this.ctx.strokeStyle = "#ffd700";
                this.ctx.lineWidth = 4;
            } else {
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = "#666666";
                this.ctx.lineWidth = 2;
            }
            this.ctx.strokeRect(pixelPos.x, pixelPos.y, pixelWidth, pixelHeight);

            // Reset shadow
            this.ctx.shadowBlur = 0;

            // Draw room ID in center
            const centerX = pixelPos.x + pixelWidth / 2;
            const centerY = pixelPos.y + pixelHeight / 2;

            this.ctx.fillStyle = "#000000";
            this.ctx.font = "bold 16px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(room.id, centerX, centerY);

            // Draw room name below ID (if fits)
            if (room.name && pixelHeight > 50) {
                this.ctx.font = "12px sans-serif";
                this.ctx.fillText(room.name, centerX, centerY + 20);
            }
        });
    }

    /**
     * Render door markers
     */
    private renderDoors(doors: DungeonDoor[]): void {
        doors.forEach((door) => {
            const { x, y } = door.position;
            const pixelPos = this.gridToPixel(x, y);
            const centerX = pixelPos.x + this.options.cellSize / 2;
            const centerY = pixelPos.y + this.options.cellSize / 2;

            // Draw door icon (🚪)
            this.ctx.font = "20px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText("🚪", centerX, centerY);

            // Draw lock icon if locked
            if (door.locked) {
                this.ctx.font = "12px sans-serif";
                this.ctx.fillText("🔒", centerX + 10, centerY - 10);
            }

            // Draw door ID label
            this.ctx.font = "10px sans-serif";
            this.ctx.fillStyle = "#000000";
            this.ctx.fillText(door.id, centerX, centerY + 15);
        });
    }

    /**
     * Render feature markers
     */
    private renderFeatures(features: DungeonFeature[]): void {
        features.forEach((feature) => {
            const { x, y } = feature.position;
            const pixelPos = this.gridToPixel(x, y);
            const centerX = pixelPos.x + this.options.cellSize / 2;
            const centerY = pixelPos.y + this.options.cellSize / 2;

            // Get icon based on feature type
            let icon = "📦";  // Default (furniture/other)
            if (feature.type === "secret") {
                icon = "🔍";  // Secret/Hidden
            } else if (feature.type === "trap" || feature.type === "hazard") {
                icon = "⚠️";  // Trap/Hazard
            } else if (feature.type === "treasure") {
                icon = "💰";  // Treasure
            }

            // Draw feature icon
            this.ctx.font = "18px sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(icon, centerX, centerY);

            // Draw feature ID label with prefix
            const prefix = getFeatureTypePrefix(feature.type);
            this.ctx.font = "bold 10px sans-serif";
            this.ctx.fillStyle = "#000000";
            this.ctx.fillText(`${prefix}${feature.id}`, centerX, centerY + 15);
        });
    }

    /**
     * Render token markers (players, NPCs, monsters, objects)
     */
    private renderTokens(tokens: DungeonToken[]): void {
        tokens.forEach((token) => {
            const { x, y } = token.position;
            const pixelPos = this.gridToPixel(x, y);
            const centerX = pixelPos.x + this.options.cellSize / 2;
            const centerY = pixelPos.y + this.options.cellSize / 2;

            // Get token color (custom or default for type)
            const color = token.color || getDefaultTokenColor(token.type);

            // Calculate token radius (default size: 40% of cell)
            const baseRadius = this.options.cellSize * 0.4;
            const size = token.size || 1.0;
            const radius = baseRadius * size;

            const isSelected = token.id === this.selectedTokenId;

            // Draw token circle
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw token border (thicker and glowing if selected)
            if (isSelected) {
                // Glow effect for selected token
                this.ctx.shadowColor = "#ffd700";
                this.ctx.shadowBlur = 15;
                this.ctx.strokeStyle = "#ffd700";
                this.ctx.lineWidth = 4;
            } else {
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = "#000000";
                this.ctx.lineWidth = 2;
            }
            this.ctx.stroke();

            // Reset shadow
            this.ctx.shadowBlur = 0;

            // Draw token label below the circle
            this.ctx.font = "bold 10px sans-serif";
            this.ctx.fillStyle = "#000000";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "top";
            this.ctx.fillText(token.label, centerX, centerY + radius + 2);
        });
    }

    /**
     * Initialize event listeners for zoom/pan/click/hover
     */
    private initializeEventListeners(): void {
        // Zoom with mouse wheel
        this.canvas.addEventListener("wheel", this.handleWheel);

        // Pan with mouse drag
        this.canvas.addEventListener("mousedown", this.handleMouseDown);
        this.canvas.addEventListener("mousemove", this.handleMouseMove);
        this.canvas.addEventListener("mouseup", this.handleMouseUp);
        this.canvas.addEventListener("mouseleave", this.handleMouseLeave);

        // Click for selection
        this.canvas.addEventListener("click", this.handleClick);
    }

    /**
     * Handle mouse wheel for zoom
     */
    private handleWheel = (event: WheelEvent): void => {
        event.preventDefault();

        // Calculate new scale
        const zoomFactor = 1 + event.deltaY * -0.001;
        const newScale = this.scale * zoomFactor;

        // Constrain scale
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));

        // TODO: Zoom towards mouse position (not implemented yet)
        // For now, zoom towards center

        // Notify view of transform change
        this.onTransformChange?.();
    };

    /**
     * Handle mouse down for pan start
     */
    private handleMouseDown = (event: MouseEvent): void => {
        if (event.button === 0) { // Left click
            this.isPanning = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            this.canvas.style.cursor = "grabbing";
        }
    };

    /**
     * Handle mouse move for pan and hover detection
     */
    private handleMouseMove = (event: MouseEvent): void => {
        if (this.isPanning) {
            // Pan mode: update offsets
            const deltaX = event.clientX - this.lastMouseX;
            const deltaY = event.clientY - this.lastMouseY;

            this.offsetX += deltaX;
            this.offsetY += deltaY;

            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            // Notify view of transform change
            this.onTransformChange?.();
        } else {
            // Hover mode: detect doors/features
            if (!this.currentDungeon || !isDungeonLocation(this.currentDungeon)) {
                return;
            }

            // Get canvas-relative coordinates
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = event.clientX - rect.left;
            const canvasY = event.clientY - rect.top;

            // Transform to world coordinates
            const worldX = (canvasX - this.offsetX) / this.scale;
            const worldY = (canvasY - this.offsetY) / this.scale;

            // Convert to grid coordinates
            const gridCoord = this.pixelToGrid(worldX, worldY);

            // Check for token, door, or feature at position (priority: token > door > feature)
            const token = this.findTokenAtPosition(gridCoord.x, gridCoord.y);
            const door = !token ? this.findDoorAtPosition(gridCoord.x, gridCoord.y) : null;
            const feature = !token && !door ? this.findFeatureAtPosition(gridCoord.x, gridCoord.y) : null;

            // Determine new hover state
            let newHover: typeof this.hoveredElement = null;
            if (token) {
                newHover = { type: "token", data: token };
            } else if (door) {
                newHover = { type: "door", data: door };
            } else if (feature) {
                newHover = { type: "feature", data: feature };
            }

            // Check if hover changed
            const hoverChanged =
                (this.hoveredElement === null && newHover !== null) ||
                (this.hoveredElement !== null && newHover === null) ||
                (this.hoveredElement !== null && newHover !== null &&
                    (this.hoveredElement.type !== newHover.type ||
                        (this.hoveredElement.type === "token" && newHover.type === "token" && this.hoveredElement.data.id !== newHover.data.id) ||
                        (this.hoveredElement.type === "door" && newHover.type === "door" && this.hoveredElement.data.id !== newHover.data.id) ||
                        (this.hoveredElement.type === "feature" && newHover.type === "feature" && this.hoveredElement.data.id !== newHover.data.id)));

            if (hoverChanged) {
                this.hoveredElement = newHover;

                // Notify view with canvas coordinates for tooltip positioning
                if (newHover) {
                    if (newHover.type === "token") {
                        this.onHoverChange?.({ type: "token", data: newHover.data, canvasX, canvasY });
                    } else if (newHover.type === "door") {
                        this.onHoverChange?.({ type: "door", data: newHover.data, canvasX, canvasY });
                    } else {
                        this.onHoverChange?.({ type: "feature", data: newHover.data, canvasX, canvasY });
                    }
                } else {
                    this.onHoverChange?.(null);
                }
            }
        }
    };

    /**
     * Handle mouse up for pan end
     */
    private handleMouseUp = (): void => {
        this.isPanning = false;
        this.canvas.style.cursor = "grab";
    };

    /**
     * Handle mouse leave to clear hover state
     */
    private handleMouseLeave = (): void => {
        this.isPanning = false;
        this.canvas.style.cursor = "grab";

        // Clear hover state
        if (this.hoveredElement !== null) {
            this.hoveredElement = null;
            this.onHoverChange?.(null);
        }
    };

    /**
     * Handle click for room selection or token placement
     */
    private handleClick = (event: MouseEvent): void => {
        if (!this.currentDungeon || !isDungeonLocation(this.currentDungeon)) {
            return;
        }

        // Get canvas-relative coordinates
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        // Transform to world coordinates (account for zoom/pan)
        const worldX = (canvasX - this.offsetX) / this.scale;
        const worldY = (canvasY - this.offsetY) / this.scale;

        // Convert to grid coordinates
        const gridCoord = this.pixelToGrid(worldX, worldY);

        // Token placement mode takes priority
        if (this.tokenPlacementMode) {
            // Notify view of token placement at grid coordinates
            this.onTokenPlace?.(gridCoord.x, gridCoord.y);
            return;
        }

        // Check if token was clicked (tokens have priority over rooms)
        const clickedToken = this.findTokenAtPosition(gridCoord.x, gridCoord.y);

        if (clickedToken) {
            // Toggle token selection: if same token, clear; otherwise select new token
            if (this.selectedTokenId === clickedToken.id) {
                this.selectedTokenId = null;
                this.onTokenSelect?.(null);
            } else {
                this.selectedTokenId = clickedToken.id;
                this.onTokenSelect?.(clickedToken);
            }

            // Re-render to show selection highlight
            this.onTransformChange?.();
            return;
        }

        // Room selection mode (no token clicked)
        // Find clicked room
        const clickedRoom = this.findRoomAtPosition(gridCoord.x, gridCoord.y);

        let selectedRoom: DungeonRoom | null = null;

        if (clickedRoom) {
            // Toggle highlight: if same room, clear; otherwise highlight new room
            if (this.highlightedRoomId === clickedRoom.id) {
                this.highlightedRoomId = null;
                selectedRoom = null;
            } else {
                this.highlightedRoomId = clickedRoom.id;
                selectedRoom = clickedRoom;
            }
        } else {
            // Clicked on background, clear highlight
            this.highlightedRoomId = null;
            selectedRoom = null;
        }

        // Notify view of room selection change
        this.onRoomSelect?.(selectedRoom);

        // Re-render to show highlight
        this.onTransformChange?.();
    };

    /**
     * Find room at grid position
     */
    private findRoomAtPosition(gridX: number, gridY: number): DungeonRoom | null {
        if (!this.currentDungeon || !isDungeonLocation(this.currentDungeon) || !this.currentDungeon.rooms) {
            return null;
        }

        for (const room of this.currentDungeon.rooms) {
            const { x, y, width, height } = room.grid_bounds;
            if (gridX >= x && gridX < x + width && gridY >= y && gridY < y + height) {
                return room;
            }
        }

        return null;
    }

    /**
     * Find door at grid position (searches all rooms)
     */
    private findDoorAtPosition(gridX: number, gridY: number): DungeonDoor | null {
        if (!this.currentDungeon || !isDungeonLocation(this.currentDungeon) || !this.currentDungeon.rooms) {
            return null;
        }

        for (const room of this.currentDungeon.rooms) {
            if (!room.doors || room.doors.length === 0) continue;

            for (const door of room.doors) {
                if (door.position.x === gridX && door.position.y === gridY) {
                    return door;
                }
            }
        }

        return null;
    }

    /**
     * Find feature at grid position (searches all rooms)
     */
    private findFeatureAtPosition(gridX: number, gridY: number): DungeonFeature | null {
        if (!this.currentDungeon || !isDungeonLocation(this.currentDungeon) || !this.currentDungeon.rooms) {
            return null;
        }

        for (const room of this.currentDungeon.rooms) {
            if (!room.features || room.features.length === 0) continue;

            for (const feature of room.features) {
                if (feature.position.x === gridX && feature.position.y === gridY) {
                    return feature;
                }
            }
        }

        return null;
    }

    /**
     * Find token at grid position
     */
    private findTokenAtPosition(gridX: number, gridY: number): DungeonToken | null {
        if (!this.currentDungeon || !isDungeonLocation(this.currentDungeon) || !this.currentDungeon.tokens) {
            return null;
        }

        for (const token of this.currentDungeon.tokens) {
            if (token.position.x === gridX && token.position.y === gridY) {
                return token;
            }
        }

        return null;
    }

    /**
     * Convert grid coordinates to pixel coordinates
     */
    private gridToPixel(gridX: number, gridY: number): { x: number; y: number } {
        return {
            x: gridX * this.options.cellSize,
            y: gridY * this.options.cellSize,
        };
    }

    /**
     * Convert pixel coordinates to grid coordinates
     */
    private pixelToGrid(pixelX: number, pixelY: number): { x: number; y: number } {
        return {
            x: Math.floor(pixelX / this.options.cellSize),
            y: Math.floor(pixelY / this.options.cellSize),
        };
    }
}
