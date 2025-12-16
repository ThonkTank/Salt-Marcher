// src/services/domain/encounter-types.ts
// Domain-level type definitions for encounter system (no cross-layer imports)
// These types bridge the gap between travel events and encounter UI without importing from features/workmodes

/** Minimal tile coordinate representation (Axial format) */
export type EncounterTileCoord = {
    readonly q: number;
    readonly r: number;
};

/** Minimal tile data needed for encounter habitat filtering */
export type EncounterTileData = {
    readonly terrain?: string;           // TerrainType: "plains" | "hills" | "mountains" etc.
    readonly flora?: string;             // FloraType: "dense" | "medium" | "field" | "barren" etc.
    readonly region?: string;            // Region assignment
    readonly faction?: string;           // Faction ownership
    readonly moisture?: string;          // MoistureLevel for climate matching
    readonly elevation?: number;         // Height in meters (for creature habitat matching)
    readonly climate?: {
        readonly temperature?: {
            readonly min?: number;
            readonly max?: number;
            readonly avg?: number;
        };
        readonly precipitation?: {
            readonly rainfall?: number;
            readonly snow?: number;
        };
        readonly wind?: {
            readonly speed?: number;
            readonly direction?: number;
        };
        readonly cloudCover?: number;
        readonly sunlight?: number;
    };
};

/** Minimal map file representation (subset of Obsidian TFile) */
export interface IMapFile {
    readonly path: string;        // Full vault path (e.g., "Maps/WorldMap.md")
    readonly basename: string;    // Name without extension (e.g., "WorldMap")
    readonly name: string;        // Full filename (e.g., "WorldMap.md")
}

/** Minimal travel/logic state needed for encounter context */
export type EncounterLogicState = {
    readonly tokenCoord: EncounterTileCoord;  // Current party position (axial {q,r})
    readonly route: ReadonlyArray<EncounterTileCoord>;  // Waypoints (axial {q,r})
    readonly editIdx: number | null;
    readonly tokenSpeed: number;              // Party speed in mph
    readonly currentTile: EncounterTileCoord | null;
    readonly playing: boolean;
    readonly tempo?: number;                  // Playback tempo (hours per real second)
};

/** Encounter event sources */
export type EncounterEventSource = "travel" | "manual";

/** Full encounter event with all context data */
export interface EncounterEvent {
    /** Stable identifier for deduplication across store/presenter instances. */
    readonly id: string;
    /** Origin of the encounter (e.g. travel hand-off). */
    readonly source: EncounterEventSource;
    /** ISO timestamp of the triggering moment. */
    readonly triggeredAt: string;
    readonly coord: EncounterTileCoord | null;
    readonly regionName?: string;
    readonly factionName?: string;
    readonly terrainName?: string;
    readonly mapPath?: string;
    readonly mapName?: string;
    readonly encounterOdds?: number;
    readonly travelClockHours?: number;
    /** Full tile data for habitat-based creature filtering */
    readonly tileData?: EncounterTileData;
    /** Full travel state snapshot for context access */
    readonly state?: EncounterLogicState;
    /** Map file reference (subset of Obsidian TFile to avoid cross-layer imports) */
    readonly mapFile?: IMapFile;
}

/** XP modifier type for encounter rules */
export type EncounterRuleModifierType =
    | "flat"
    | "flatPerAverageLevel"
    | "flatPerTotalLevel"
    | "percentTotal"
    | "percentNextLevel";

/** Scope of an encounter rule */
export type EncounterRuleScope = "xp" | "gold";

/** Party member for encounter tracking (shared type) */
export interface EncounterPartyMember {
    readonly id: string;
    readonly name: string;
    readonly level: number;
    readonly playerName?: string;
    readonly notes?: string;
}

/** Creature in an encounter */
export interface EncounterCreature {
    readonly id: string;
    readonly name: string;
    readonly count: number;
    readonly cr: number;
    readonly source: "library" | "custom";
    readonly statblockPath?: string;
}

/** Combat participant with initiative and HP */
export interface CombatParticipant {
    readonly id: string;
    readonly creatureId: string;
    readonly name: string;
    readonly initiative: number;
    readonly currentHp: number;
    readonly maxHp: number;
    readonly defeated: boolean;
}

/** Active combat state */
export interface CombatState {
    readonly isActive: boolean;
    readonly participants: ReadonlyArray<CombatParticipant>;
    readonly activeParticipantId: string | null;
}

/** XP rule for encounter calculations */
export interface EncounterXpRule {
    readonly id: string;
    readonly title: string;
    readonly modifierType: EncounterRuleModifierType;
    readonly modifierValue: number;
    readonly modifierValueMin: number;
    readonly modifierValueMax: number;
    readonly enabled: boolean;
    readonly scope: EncounterRuleScope;
    readonly notes?: string;
}

/** XP state snapshot */
export interface EncounterXpState {
    readonly party: ReadonlyArray<EncounterPartyMember>;
    readonly encounterXp: number;
    readonly rules: ReadonlyArray<EncounterXpRule>;
}

/** Mutable XP state for updates */
export interface EncounterXpStateDraft {
    encounterXp: number;
    rules: EncounterXpRule[];
}

/** Listener for XP state changes */
export type EncounterXpStateListener = (state: EncounterXpState) => void;

/** Listener for encounter events */
export type EncounterEventListener = (event: EncounterEvent) => void;

// ============================================================================
// ENCOUNTER TABLE TYPES
// ============================================================================

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
		min?: number; // e.g. 0, 0.125, 0.25, 0.5, 1, 2, etc.
		max?: number;
	};

	/** Encounter entries with weights */
	entries: EncounterTableEntry[];
};
