/**
 * Dynamic Faction Relationships - Relations Change Based on Actions
 *
 * Manages faction relationship updates based on actions, events, and interactions.
 * Relationships shift dynamically from hostile (-100) to allied (+100).
 */

import type { FactionData, FactionRelationship } from "../../workmodes/library/factions/types";
import type { FactionDecisionType } from "./ai-types";

/**
 * Relationship change based on action types
 */
const RELATIONSHIP_IMPACTS: Record<string, number> = {
    // Positive impacts
    form_alliance: 30,
    trade_resources: 10,
    send_aid: 20,
    defend_ally: 25,
    share_knowledge: 15,

    // Negative impacts
    declare_war: -50,
    raid_target: -40,
    betray_treaty: -60,
    steal_resources: -30,
    sabotage: -35,

    // Neutral/context-dependent
    expand_territory: -5, // Slight tension when expanding near others
    establish_camp: 0,
    recruit_units: 0,
};

/**
 * Get relationship value with a specific faction
 */
export function getRelationshipValue(faction: FactionData, targetFactionName: string): number {
    const relationship = faction.faction_relationships?.find((r) => r.faction_name === targetFactionName);
    return relationship?.value ?? 0; // Default to neutral if no relationship exists
}

/**
 * Update relationship value based on an action
 */
export function updateRelationshipByAction(
    faction: FactionData,
    targetFactionName: string,
    actionType: FactionDecisionType | string,
    customImpact?: number
): FactionRelationship {
    // Get current relationship or create new one
    let relationship = faction.faction_relationships?.find((r) => r.faction_name === targetFactionName);

    if (!relationship) {
        relationship = {
            faction_name: targetFactionName,
            value: 0,
            type: "neutral",
        };
        faction.faction_relationships = faction.faction_relationships || [];
        faction.faction_relationships.push(relationship);
    }

    // Apply impact
    const impact = customImpact ?? RELATIONSHIP_IMPACTS[actionType] ?? 0;
    relationship.value = Math.max(-100, Math.min(100, relationship.value + impact));

    // Update relationship type based on value
    relationship.type = getRelationshipType(relationship.value);

    return relationship;
}

/**
 * Determine relationship type from numeric value
 */
export function getRelationshipType(
    value: number
): "allied" | "neutral" | "hostile" | "trade" | "rivalry" | "vassal" {
    if (value >= 60) return "allied";
    if (value >= 20) return "trade";
    if (value <= -60) return "hostile";
    if (value <= -20) return "rivalry";
    return "neutral";
}

/**
 * Apply decay to all relationships over time (relationships drift toward neutral)
 */
export function applyRelationshipDecay(faction: FactionData, decayRate: number = 0.5): void {
    if (!faction.faction_relationships) return;

    for (const relationship of faction.faction_relationships) {
        if (relationship.value > 0) {
            // Positive relationships decay slowly toward neutral
            relationship.value = Math.max(0, relationship.value - decayRate);
        } else if (relationship.value < 0) {
            // Negative relationships also drift toward neutral
            relationship.value = Math.min(0, relationship.value + decayRate);
        }

        // Update type after decay
        relationship.type = getRelationshipType(relationship.value);
    }
}

/**
 * Check if two factions are at war (hostile relationship)
 */
export function areFactionsAtWar(
    faction1: FactionData,
    faction2Name: string,
    threshold: number = -60
): boolean {
    const relationshipValue = getRelationshipValue(faction1, faction2Name);
    return relationshipValue <= threshold;
}

/**
 * Check if two factions are allied
 */
export function areFactionsAllied(
    faction1: FactionData,
    faction2Name: string,
    threshold: number = 60
): boolean {
    const relationshipValue = getRelationshipValue(faction1, faction2Name);
    return relationshipValue >= threshold;
}

/**
 * Get all hostile factions
 */
export function getHostileFactions(faction: FactionData, threshold: number = -40): string[] {
    return (
        faction.faction_relationships
            ?.filter((r) => r.value <= threshold)
            .map((r) => r.faction_name) || []
    );
}

/**
 * Get all allied factions
 */
export function getAlliedFactions(faction: FactionData, threshold: number = 40): string[] {
    return (
        faction.faction_relationships
            ?.filter((r) => r.value >= threshold)
            .map((r) => r.faction_name) || []
    );
}

/**
 * Propagate relationship changes to allied factions
 * "Enemy of my friend is my enemy"
 */
export function propagateRelationshipChange(
    sourceFaction: FactionData,
    targetFaction: string,
    allFactions: FactionData[],
    propagationFactor: number = 0.3
): void {
    const allies = getAlliedFactions(sourceFaction, 50);

    for (const allyName of allies) {
        const ally = allFactions.find((f) => f.name === allyName);
        if (!ally) continue;

        const sourceRelationship = getRelationshipValue(sourceFaction, targetFaction);
        const impact = Math.floor(sourceRelationship * propagationFactor);

        updateRelationshipByAction(ally, targetFaction, "influenced_by_ally", impact);
    }
}

/**
 * Mutual relationship improvement (e.g., after successful trade)
 */
export function improveMutualRelationship(
    faction1: FactionData,
    faction2: FactionData,
    amount: number
): void {
    updateRelationshipByAction(faction1, faction2.name, "mutual_improvement", amount);
    updateRelationshipByAction(faction2, faction1.name, "mutual_improvement", amount);
}

/**
 * Mutual relationship degradation (e.g., after a border skirmish)
 */
export function degradeMutualRelationship(
    faction1: FactionData,
    faction2: FactionData,
    amount: number
): void {
    updateRelationshipByAction(faction1, faction2.name, "mutual_degradation", -amount);
    updateRelationshipByAction(faction2, faction1.name, "mutual_degradation", -amount);
}
