// src/workmodes/library/locations/types.ts
// Type definitions for location entities

export type LocationType =
    | "Stadt"
    | "Dorf"
    | "Weiler"
    | "Gebäude"
    | "Dungeon"
    | "Camp"
    | "Landmark"
    | "Ruine"
    | "Festung";

export type OwnerType = "faction" | "npc" | "none";

export interface LocationData {
    name: string;
    type: LocationType;
    description?: string;
    parent?: string; // Parent location name (for hierarchy)
    owner_type?: OwnerType;
    owner_name?: string; // Faction or NPC name
    region?: string; // Optional region association
    coordinates?: string; // Optional hex coordinates (e.g., "12,34")
    notes?: string;
    // Dungeon-specific fields (only used when type === "Dungeon")
    grid_width?: number;
    grid_height?: number;
    cell_size?: number; // Grid cell size in pixels (default: 40)
    rooms?: DungeonRoom[];
    tokens?: DungeonToken[]; // Tokens placed on the grid
}

// Dungeon-specific types
export interface DungeonRoom {
    id: string; // R1, R2, R3, ...
    name: string; // Room name (e.g., "Entrance Hall")
    description?: string; // Markdown description with sensory details
    grid_bounds: GridBounds; // Room area on grid
    doors: DungeonDoor[];
    features: DungeonFeature[];
}

export interface GridBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface DungeonDoor {
    id: string; // T1, T2, T3, ...
    position: GridPosition;
    leads_to?: string; // Target room ID or "outside"
    locked: boolean;
    description?: string;
}

export interface DungeonFeature {
    id: string; // F1, F2, F3, ...
    type: DungeonFeatureType;
    position: GridPosition;
    description: string;
}

export type DungeonFeatureType =
    | "secret"      // G (Geheimnisse)
    | "trap"        // H (Hindernisse/Hazards)
    | "treasure"    // S (Schätze)
    | "hazard"      // H (andere Gefahren)
    | "furniture"   // (Möbel, Dekoration)
    | "other";      // (Sonstiges)

export interface GridPosition {
    x: number;
    y: number;
}

// Token types
export type TokenType = "player" | "npc" | "monster" | "object";

export interface DungeonToken {
    id: string; // Unique token ID (e.g., "token-1", "token-2")
    type: TokenType;
    position: GridPosition;
    label: string; // Display name (e.g., "Gandalf", "Goblin 1", "Chest")
    color?: string; // Hex color for token (default: type-based)
    size?: number; // Token size multiplier (default: 1.0)
}

// Helper functions
export function getFeatureTypePrefix(type: DungeonFeatureType): string {
    switch (type) {
        case "secret":
            return "G"; // Geheimnisse
        case "trap":
        case "hazard":
            return "H"; // Hindernisse/Hazards
        case "treasure":
            return "S"; // Schätze
        case "furniture":
        case "other":
            return "F"; // Features (generic)
    }
}

export function getFeatureTypeLabel(type: DungeonFeatureType): string {
    switch (type) {
        case "secret":
            return "Secret";
        case "trap":
            return "Trap";
        case "treasure":
            return "Treasure";
        case "hazard":
            return "Hazard";
        case "furniture":
            return "Furniture";
        case "other":
            return "Other";
    }
}

// Token helpers
export function getDefaultTokenColor(type: TokenType): string {
    switch (type) {
        case "player":
            return "#4a90e2"; // Blue
        case "npc":
            return "#50c878"; // Green
        case "monster":
            return "#e74c3c"; // Red
        case "object":
            return "#f39c12"; // Orange
    }
}

// Type guard
export function isDungeonLocation(data: LocationData): data is LocationData & Required<Pick<LocationData, 'grid_width' | 'grid_height'>> {
    return data.type === "Dungeon" && typeof data.grid_width === "number" && typeof data.grid_height === "number";
}
