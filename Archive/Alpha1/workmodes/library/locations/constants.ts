// src/workmodes/library/locations/constants.ts
// Constants for location entity types and options

import type { LocationType, OwnerType } from './calendar-types';

export const LOCATION_TYPES: readonly LocationType[] = [
    "Stadt",
    "Dorf",
    "Weiler",
    "Gebäude",
    "Dungeon",
    "Camp",
    "Landmark",
    "Ruine",
    "Festung",
] as const;

export const OWNER_TYPES: readonly OwnerType[] = [
    "none",
    "faction",
    "npc",
] as const;

export const OWNER_TYPE_LABELS: Record<OwnerType, string> = {
    none: "Kein Besitzer",
    faction: "Fraktion",
    npc: "NPC",
};
