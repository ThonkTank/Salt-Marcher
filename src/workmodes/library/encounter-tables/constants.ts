/**
 * Encounter Table Constants
 *
 * Tag vocabularies and default values for encounter tables.
 * Reuses tag systems from playlists for consistency.
 */

// Reuse tag vocabularies from playlists (defined in TAGS.md)
export const TERRAIN_TAGS = [
    "Forest",
    "Mountain",
    "Desert",
    "Swamp",
    "Coastal",
    "Ocean",
    "Arctic",
    "Cave",
    "Underground",
    "Urban",
    "Ruins",
    "Plains",
    "Hills",
    "Jungle",
    "Volcanic",
] as const;

export const WEATHER_TAGS = [
    "Clear",
    "Cloudy",
    "Rain",
    "Storm",
    "Snow",
    "Fog",
    "Wind",
    "Hot",
    "Cold",
] as const;

export const TIME_OF_DAY_TAGS = [
    "Dawn",
    "Morning",
    "Noon",
    "Afternoon",
    "Dusk",
    "Evening",
    "Night",
    "Midnight",
] as const;

export const FACTION_TAGS = [
    "Friendly",
    "Neutral",
    "Hostile",
    "Undead",
    "Fey",
    "Fiend",
    "Celestial",
    "Elemental",
    "Dragon",
    "Giant",
    "Humanoid",
    "Beast",
] as const;

export const SITUATION_TAGS = [
    "Exploration",
    "Combat",
    "Social",
    "Stealth",
    "Chase",
    "Rest",
    "Tension",
    "Mystery",
    "Horror",
    "Celebration",
    "Travel",
    "Dungeon",
    "Boss",
    "Victory",
    "Defeat",
] as const;

/** CR difficulty categories (matches D&D encounter building guidelines) */
export const CR_DIFFICULTY = [
    { value: "easy", label: "Easy" },
    { value: "medium", label: "Medium" },
    { value: "hard", label: "Hard" },
    { value: "deadly", label: "Deadly" },
] as const;

/** Default entry weight */
export const DEFAULT_ENTRY_WEIGHT = 1;
