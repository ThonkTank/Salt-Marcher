// src/workmodes/library/entities/factions/types.ts
// Type definitions for faction entities

/**
 * Position tracking for faction members and units
 */
export interface FactionPosition {
  /** Type of location: map hex coordinates, POI name, or expedition route */
  type: "hex" | "poi" | "expedition" | "unassigned";
  /** Hex coordinates (q,r,s) for map positions */
  coords?: { q: number; r: number; s: number };
  /** POI/Location name for named places */
  location_name?: string;
  /** Expedition route description */
  route?: string;
}

/**
 * Job assignment for faction members
 */
export interface FactionJob {
  /** Job type: crafting, resource gathering, training, summoning, etc. */
  type: "crafting" | "gathering" | "training" | "summoning" | "guard" | "patrol" | "research";
  /** Building/facility where job is performed */
  building?: string;
  /** Progress/status of the job */
  progress?: number;
  /** Resources consumed or produced */
  resources?: Record<string, number>;
}

/**
 * Faction member: can be a named NPC or a unit type with quantity
 */
export interface FactionMember {
  /** Name of the NPC or unit type (e.g., "Captain Thorne" or "Goblin Warrior") */
  name: string;
  /** Role within the faction */
  role?: string;
  /** Current status */
  status?: string;
  /** Whether this is a named NPC (true) or generic unit type (false) */
  is_named?: boolean;
  /** For unit types: quantity available */
  quantity?: number;
  /** Reference to creature statblock in library (for combat stats) */
  statblock_ref?: string;
  /** Current position/location */
  position?: FactionPosition;
  /** Current job assignment */
  job?: FactionJob;
  /** Additional notes */
  notes?: string;
}

/**
 * Structured resource tracking
 */
export interface FactionResources {
  /** Gold/currency */
  gold?: number;
  /** Food supplies */
  food?: number;
  /** Military equipment */
  equipment?: number;
  /** Magic items or components */
  magic?: number;
  /** Influence/reputation points */
  influence?: number;
  /** Custom resources */
  [key: string]: number | undefined;
}

/**
 * Relationship with another faction
 */
export interface FactionRelationship {
  /** Name of the other faction */
  faction_name: string;
  /** Relationship value: -100 (hostile) to +100 (allied) */
  value: number;
  /** Type of relationship */
  type?: "allied" | "neutral" | "hostile" | "trade" | "rivalry" | "vassal";
  /** Notes about the relationship */
  notes?: string;
}

/**
 * Complete faction data structure
 */
export interface FactionData {
  name: string;
  motto?: string;
  headquarters?: string;
  territory?: string;
  influence_tags?: Array<{ value: string }>;
  culture_tags?: Array<{ value: string }>;
  goal_tags?: Array<{ value: string }>;
  summary?: string;
  /** Structured resource tracking (replaces 'assets' textarea) */
  resources?: FactionResources;
  /** Legacy assets field (for backward compatibility) */
  assets?: string;
  /** Structured relationships (replaces 'relationships' textarea) */
  faction_relationships?: FactionRelationship[];
  /** Legacy relationships field (for backward compatibility) */
  relationships?: string;
  /** Faction members with position and job tracking */
  members?: FactionMember[];
}
