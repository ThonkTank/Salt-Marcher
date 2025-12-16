/**
 * Faction Types (Re-exported from shared types)
 *
 * This file maintains backward compatibility by re-exporting faction types
 * from the shared types layer (src/services/domain).
 *
 * Workmode imports can continue using this path, but features/services
 * should import directly from @services/domain to avoid layer violations.
 */

export type {
	FactionPosition,
	FactionJob,
	NPCPersonality,
	FactionMember,
	FactionResources,
	FactionRelationship,
	TradeRoute,
	MarketData,
	ProductionChain,
	TradeGood,
	ResourceConsumption,
	MilitaryUnit,
	MilitaryEngagement,
	SupplyLine,
	DiplomaticTreaty,
	EspionageOperation,
	DiplomaticIncident,
	FactionData,
} from "@services/domain";

// Plan-related re-exports (FactionActionPlan, FactionPlan, ResourceReservation)
// removed during factions simplification.
