/**
 * Shared Faction Types
 *
 * Faction-related type definitions shared across workmodes, features,
 * and services to eliminate layer violations.
 *
 * @module services/domain/faction-types
 */

// Plan-related imports removed during factions simplification (Phase 14)

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
	type:
		| "crafting"
		| "gathering"
		| "training"
		| "summoning"
		| "guard"
		| "patrol"
		| "research";
	/** Building/facility where job is performed */
	building?: string;
	/** Progress/status of the job */
	progress?: number;
	/** Resources consumed or produced */
	resources?: Record<string, number>;
}

/**
 * NPC Personality traits (Phase 8.6)
 */
export interface NPCPersonality {
	/** Personality quirks (e.g., "Always quotes poetry", "Afraid of heights") */
	quirks?: string[];
	/** Loyalties to other NPCs, factions, or ideals */
	loyalties?: string[];
	/** Hidden secrets or agendas */
	secrets?: string[];
	/** Trust level toward faction (0-100) */
	trust?: number;
	/** Ambition level (0-100) - likelihood of seeking advancement */
	ambition?: number;
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
	/** Personality traits (for named NPCs) - Phase 8.6 */
	personality?: NPCPersonality;
	/** Unit veterancy (for military units) - Phase 8.6 */
	veterancy?: number; // 0-100, affects combat effectiveness
	/** Equipment condition (for military units) - Phase 8.6 */
	equipment_condition?: number; // 0-100, degrades over time
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
 * Production chain - converts inputs to outputs over time (Phase 8.6)
 */
export interface ProductionChain {
	/** Chain ID */
	id: string;
	/** Name of production chain (e.g., "Weapon Forging", "Bread Baking") */
	name: string;
	/** Input resources required */
	inputs: Record<string, number>;
	/** Output resources produced */
	outputs: Record<string, number>;
	/** Time required (in days) */
	duration: number;
	/** Current progress (0-100%) */
	progress?: number;
	/** Building required */
	required_building?: string;
	/** Workers assigned */
	workers?: number;
}

/**
 * Trade good catalog entry (Phase 8.6)
 */
export interface TradeGood {
	/** Good name */
	name: string;
	/** Category (food, equipment, luxury, raw materials, etc.) */
	category: string;
	/** Base value in gold */
	base_value: number;
	/** Weight (for transport capacity) */
	weight: number;
	/** Rarity (common, uncommon, rare, etc.) */
	rarity: string;
	/** Tags for filtering */
	tags?: string[];
}

/**
 * Resource consumption rate (Phase 8.6)
 */
export interface ResourceConsumption {
	/** Resource name */
	resource: string;
	/** Amount consumed per day */
	rate: number;
	/** Reason for consumption */
	reason: string;
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
 * Supply line for military logistics (Phase 8.6)
 */
export interface SupplyLine {
	/** Supply line ID */
	id: string;
	/** Origin location (hex or POI) */
	origin: string;
	/** Destination location (hex or POI) */
	destination: string;
	/** Resource being transported */
	resource: string;
	/** Amount per cycle */
	amount: number;
	/** Status */
	status: "active" | "disrupted" | "severed";
	/** Security level (affects raid risk) */
	security: number;
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
	/** Secret treaty (hidden from other factions) - Phase 8.6 */
	is_secret?: boolean;
}

/**
 * Espionage operation (Phase 8.6)
 */
export interface EspionageOperation {
	/** Operation ID */
	id: string;
	/** Target faction */
	target: string;
	/** Operation type */
	type: "infiltrate" | "sabotage" | "steal_secrets" | "assassinate" | "counter_intel";
	/** Assigned agent */
	agent?: string;
	/** Start date */
	started: string;
	/** Status */
	status: "planning" | "active" | "success" | "failure" | "discovered";
	/** Success chance (0-100%) */
	success_chance?: number;
	/** Resources spent */
	cost?: number;
}

/**
 * Diplomatic incident (Phase 8.6)
 */
export interface DiplomaticIncident {
	/** Incident ID */
	id: string;
	/** Incident type */
	type: "border_dispute" | "trade_disagreement" | "spy_discovered" | "insult" | "treaty_breach";
	/** Involved factions */
	factions: string[];
	/** Date occurred */
	date: string;
	/** Relationship impact */
	relationship_impact: number;
	/** Resolution status */
	status: "unresolved" | "negotiating" | "resolved" | "escalated";
	/** Description */
	description: string;
}

/**
 * Complete faction data structure
 */
export interface FactionData {
	name: string;
	color?: string; // Hex color for map visualization (e.g., #e63946)
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
	/** Production chains (Phase 8.6) */
	production_chains?: ProductionChain[];
	/** Trade goods catalog (Phase 8.6) */
	trade_goods?: TradeGood[];
	/** Resource consumption rates (Phase 8.6) */
	resource_consumption?: ResourceConsumption[];
	/** Supply lines for military logistics (Phase 8.6) */
	supply_lines?: SupplyLine[];
	/** Espionage operations (Phase 8.6) */
	espionage_operations?: EspionageOperation[];
	/** Diplomatic incidents (Phase 8.6) */
	diplomatic_incidents?: DiplomaticIncident[];
	// Plan-related fields (currentPlan, activePlans, resourceReservations) removed
	// during factions simplification. Simple resource production is now inline.
}
