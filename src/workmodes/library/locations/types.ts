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
}
