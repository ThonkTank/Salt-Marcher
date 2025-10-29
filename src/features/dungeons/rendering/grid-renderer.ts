// src/features/dungeons/rendering/grid-renderer.ts
// Canvas-based grid renderer for dungeon maps

import type { LocationData, DungeonRoom, DungeonDoor, DungeonFeature } from "../../../workmodes/library/locations/types";
import { isDungeonLocation, getFeatureTypePrefix } from "../../../workmodes/library/locations/types";

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

    constructor(canvas: HTMLCanvasElement, options: Partial<GridRendererOptions> = {}) {
        this.canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D rendering context");
        }
        this.ctx = ctx;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.updateCanvasSize();
    }

    /**
     * Render a dungeon location onto the canvas
     */
    render(dungeon: LocationData): void {
        if (!isDungeonLocation(dungeon)) {
            throw new Error("Cannot render non-dungeon location");
        }

        // Update options from dungeon data
        this.options.gridWidth = dungeon.grid_width;
        this.options.gridHeight = dungeon.grid_height;
        if (dungeon.cell_size) {
            this.options.cellSize = dungeon.cell_size;
        }

        this.updateCanvasSize();
        this.clear();

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

            // Render doors and features for each room
            for (const room of dungeon.rooms) {
                if (room.doors && room.doors.length > 0) {
                    this.renderDoors(room.doors);
                }
                if (room.features && room.features.length > 0) {
                    this.renderFeatures(room.features);
                }
            }
        }
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

            // Fill room background
            this.ctx.fillStyle = colors[index % colors.length];
            this.ctx.fillRect(pixelPos.x, pixelPos.y, pixelWidth, pixelHeight);

            // Draw room boundary
            this.ctx.strokeStyle = "#666666";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(pixelPos.x, pixelPos.y, pixelWidth, pixelHeight);

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
