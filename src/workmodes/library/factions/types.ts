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
 * Trade route between factions
 */
export interface TradeRoute {
  /** Name of the partner faction */
  partner_faction: string;
  /** Goods being traded */
  goods: string[];
  /** Value per cycle (in gold) */
  value: number;
  /** Route status */
  status: "active" | "suspended" | "severed";
  /** Path description */
  route_description?: string;
}

/**
 * Market data for economic simulation
 */
export interface MarketData {
  /** Resource/good name */
  resource: string;
  /** Base price */
  base_price: number;
  /** Supply quantity */
  supply: number;
  /** Demand quantity */
  demand: number;
  /** Current market price (calculated from supply/demand) */
  current_price?: number;
}

/**
 * Military unit composition
 */
export interface MilitaryUnit {
  /** Unit name */
  name: string;
  /** Quantity */
  quantity: number;
  /** Reference to creature statblock */
  statblock_ref: string;
  /** Training level (0-100) */
  training: number;
  /** Morale level (0-100) */
  morale: number;
  /** Equipment quality (0-100) */
  equipment_quality: number;
}

/**
 * Battle or siege event
 */
export interface MilitaryEngagement {
  /** Engagement ID */
  id: string;
  /** Type of engagement */
  type: "battle" | "siege" | "skirmish" | "raid";
  /** Opposing faction */
  opponent: string;
  /** Location (hex or POI) */
  location: string;
  /** Start date */
  started: string;
  /** Status */
  status: "ongoing" | "victory" | "defeat" | "retreat" | "stalemate";
  /** Units committed */
  committed_units: MilitaryUnit[];
  /** Casualties */
  casualties?: number;
}

/**
 * Diplomatic treaty or agreement
 */
export interface DiplomaticTreaty {
  /** Treaty ID */
  id: string;
  /** Type of treaty */
  type: "alliance" | "non_aggression" | "trade_agreement" | "mutual_defense" | "vassal";
  /** Partner faction(s) */
  partners: string[];
  /** Terms of the treaty */
  terms: string;
  /** Start date */
  signed: string;
  /** Expiration date (if temporary) */
  expires?: string;
  /** Status */
  status: "active" | "violated" | "expired" | "nullified";
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
  /** Parent faction (for subfactions) */
  parent_faction?: string;
  /** Subfactions under this faction */
  subfactions?: string[];
  /** Trade routes */
  trade_routes?: TradeRoute[];
  /** Market data for economic simulation */
  markets?: MarketData[];
  /** Military engagements */
  military_engagements?: MilitaryEngagement[];
  /** Diplomatic treaties */
  treaties?: DiplomaticTreaty[];
}
