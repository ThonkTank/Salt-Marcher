/**
 * Encounter Table Types
 *
 * Defines data structures for random encounter tables used in Session Runner.
 * Tables contain weighted entries that reference creatures and specify spawn quantities.
 */

/**
 * Single entry in an encounter table
 */
export type EncounterTableEntry = {
    /** Weight for random selection (higher = more likely) */
    weight: number;

    /** Creature name(s) to spawn - references Library creatures */
    creatures: string[];

    /** Quantity formula (e.g. "1d4", "2", "1d6+2") */
    quantity?: string;

    /** Optional description/flavor text */
    description?: string;

    /** CR range override for this entry (optional) */
    crRange?: {
        min?: number;
        max?: number;
    };
};

/**
 * Complete encounter table data structure
 */
export type EncounterTableData = {
    /** Unique identifier */
    name: string;

    /** Display name (UI) */
    display_name?: string;

    /** Optional description */
    description?: string;

    // Tag-based filtering (matches playlist pattern)
    terrain_tags?: Array<{ value: string }>;
    weather_tags?: Array<{ value: string }>;
    time_of_day_tags?: Array<{ value: string }>;
    faction_tags?: Array<{ value: string }>;
    situation_tags?: Array<{ value: string }>;

    /** CR range for this table (filters creatures) */
    crRange?: {
        min?: number;  // e.g. 0, 0.125, 0.25, 0.5, 1, 2, etc.
        max?: number;
    };

    /** Encounter entries with weights */
    entries: EncounterTableEntry[];
};

/**
 * Browse view metadata
 */
export type EncounterTableEntryMeta = {
    smType: "encounter-table";
    name: string;
    display_name?: string;
    description?: string;
    terrain_tags?: string[];
    weather_tags?: string[];
    time_of_day_tags?: string[];
    faction_tags?: string[];
    situation_tags?: string[];
    entry_count?: number;
    crRange?: {
        min?: number;
        max?: number;
    };
};
