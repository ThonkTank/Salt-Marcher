/**
 * Diplomatic Events - Treaties, Betrayals, Negotiations
 *
 * Manages diplomatic interactions between factions including treaty formation,
 * betrayals, negotiations, and diplomatic event generation.
 */

import type { FactionData, DiplomaticTreaty } from "../../workmodes/library/factions/types";
import { getRelationshipValue, updateRelationshipByAction } from "./relationships";

/**
 * Propose a treaty between factions
 */
export function proposeTreaty(
    proposer: FactionData,
    receiver: FactionData,
    type: "alliance" | "non_aggression" | "trade_agreement" | "mutual_defense" | "vassal",
    terms: string,
    currentDate: string
): { accepted: boolean; treaty?: DiplomaticTreaty; reason?: string } {
    const relationship = getRelationshipValue(proposer, receiver.name);

    // Acceptance based on relationship value and treaty type
    let acceptanceThreshold = 0;

    switch (type) {
        case "alliance":
            acceptanceThreshold = 50; // Requires strong positive relationship
            break;
        case "mutual_defense":
            acceptanceThreshold = 40;
            break;
        case "trade_agreement":
            acceptanceThreshold = 20;
            break;
        case "non_aggression":
            acceptanceThreshold = -20; // Can be accepted even with slight hostility
            break;
        case "vassal":
            acceptanceThreshold = 60; // Requires very strong relationship or defeat
            break;
    }

    if (relationship < acceptanceThreshold) {
        return {
            accepted: false,
            reason: `Relationship too low (${relationship} < ${acceptanceThreshold})`,
        };
    }

    // Treaty accepted - create it
    const treaty: DiplomaticTreaty = {
        id: `${proposer.name}_${receiver.name}_${type}_${Date.now()}`,
        type,
        partners: [proposer.name, receiver.name],
        terms,
        signed: currentDate,
        status: "active",
    };

    // Add treaty to both factions
    proposer.treaties = proposer.treaties || [];
    receiver.treaties = receiver.treaties || [];
    proposer.treaties.push(treaty);
    receiver.treaties.push({ ...treaty }); // Copy to receiver

    // Improve relationship based on treaty type
    const relationshipBonus = type === "alliance" ? 30 : type === "mutual_defense" ? 20 : 10;
    updateRelationshipByAction(proposer, receiver.name, "form_alliance", relationshipBonus);
    updateRelationshipByAction(receiver, proposer.name, "form_alliance", relationshipBonus);

    return { accepted: true, treaty };
}

/**
 * Violate a treaty (e.g., declaring war despite non-aggression pact)
 */
export function violateTreaty(
    violator: FactionData,
    treaty: DiplomaticTreaty,
    allFactions: FactionData[]
): void {
    // Mark treaty as violated
    const violatorTreaty = violator.treaties?.find((t) => t.id === treaty.id);
    if (violatorTreaty) {
        violatorTreaty.status = "violated";
    }

    // Severe relationship penalty with all partners
    for (const partnerName of treaty.partners) {
        if (partnerName === violator.name) continue;

        updateRelationshipByAction(violator, partnerName, "betray_treaty", -60);

        // Mark treaty as violated for partners too
        const partner = allFactions.find((f) => f.name === partnerName);
        if (partner) {
            const partnerTreaty = partner.treaties?.find((t) => t.id === treaty.id);
            if (partnerTreaty) {
                partnerTreaty.status = "violated";
            }
        }
    }
}

/**
 * Nullify a treaty (mutual agreement to end it)
 */
export function nullifyTreaty(faction1: FactionData, faction2: FactionData, treatyId: string): boolean {
    const treaty1 = faction1.treaties?.find((t) => t.id === treatyId);
    const treaty2 = faction2.treaties?.find((t) => t.id === treatyId);

    if (!treaty1 || !treaty2) return false;

    treaty1.status = "nullified";
    treaty2.status = "nullified";

    // Minor relationship penalty (much less than violation)
    updateRelationshipByAction(faction1, faction2.name, "end_treaty", -5);
    updateRelationshipByAction(faction2, faction1.name, "end_treaty", -5);

    return true;
}

/**
 * Check if treaty has expired
 */
export function checkTreatyExpiration(treaty: DiplomaticTreaty, currentDate: string): boolean {
    if (!treaty.expires) return false;

    // Simple date comparison (assumes ISO format YYYY-MM-DD)
    return currentDate >= treaty.expires;
}

/**
 * Renew an expiring treaty
 */
export function renewTreaty(
    faction1: FactionData,
    faction2: FactionData,
    treatyId: string,
    newExpirationDate?: string
): boolean {
    const treaty1 = faction1.treaties?.find((t) => t.id === treatyId);
    const treaty2 = faction2.treaties?.find((t) => t.id === treatyId);

    if (!treaty1 || !treaty2) return false;

    // Check if both factions still have good relations
    const relationship = getRelationshipValue(faction1, faction2.name);

    // Require neutral or better relationship to renew
    if (relationship < 0) return false;

    treaty1.expires = newExpirationDate;
    treaty2.expires = newExpirationDate;

    return true;
}

/**
 * Get all active treaties for a faction
 */
export function getActiveTreaties(faction: FactionData): DiplomaticTreaty[] {
    return faction.treaties?.filter((t) => t.status === "active") || [];
}

/**
 * Get treaties with a specific faction
 */
export function getTreatiesWithFaction(faction: FactionData, partnerName: string): DiplomaticTreaty[] {
    return (
        faction.treaties?.filter((t) => t.partners.includes(partnerName) && t.status === "active") || []
    );
}

/**
 * Check if factions have a specific type of treaty
 */
export function hasTreaty(
    faction: FactionData,
    partnerName: string,
    type: DiplomaticTreaty["type"]
): boolean {
    return (
        faction.treaties?.some(
            (t) => t.partners.includes(partnerName) && t.type === type && t.status === "active"
        ) || false
    );
}

/**
 * Generate diplomatic event based on faction relationships and treaties
 */
export function generateDiplomaticEvent(
    faction: FactionData,
    allFactions: FactionData[]
): {
    type: "treaty_proposal" | "treaty_violation" | "treaty_renewal" | "alliance_opportunity" | "betrayal_warning" | null;
    description: string;
    targetFaction?: string;
    recommendedAction?: string;
} | null {
    // Check for expiring treaties
    for (const treaty of faction.treaties || []) {
        if (treaty.status !== "active" || !treaty.expires) continue;

        // Warning 30 days before expiration (simple string comparison)
        // In a real implementation, you'd use proper date math
        const partner = treaty.partners.find((p) => p !== faction.name);
        if (partner) {
            return {
                type: "treaty_renewal",
                description: `${treaty.type} treaty with ${partner} expires on ${treaty.expires}`,
                targetFaction: partner,
                recommendedAction: "Renew treaty or prepare for relationship change",
            };
        }
    }

    // Check for alliance opportunities (high positive relationships without alliance)
    for (const relationship of faction.faction_relationships || []) {
        if (relationship.value >= 60 && !hasTreaty(faction, relationship.faction_name, "alliance")) {
            return {
                type: "alliance_opportunity",
                description: `Strong relationship with ${relationship.faction_name} (${relationship.value})`,
                targetFaction: relationship.faction_name,
                recommendedAction: "Consider forming alliance",
            };
        }
    }

    // Check for betrayal warnings (allied but declining relationship)
    for (const treaty of faction.treaties || []) {
        if (treaty.type !== "alliance" || treaty.status !== "active") continue;

        const partner = treaty.partners.find((p) => p !== faction.name);
        if (!partner) continue;

        const relationship = getRelationshipValue(faction, partner);
        if (relationship < 30) {
            // Alliance at risk
            return {
                type: "betrayal_warning",
                description: `Alliance with ${partner} weakening (relationship: ${relationship})`,
                targetFaction: partner,
                recommendedAction: "Strengthen relationship or prepare for treaty violation",
            };
        }
    }

    return null;
}

/**
 * Negotiate terms (e.g., trade value, tribute amount)
 */
export function negotiateTerms(
    faction1: FactionData,
    faction2: FactionData,
    proposedValue: number
): { accepted: boolean; counterOffer?: number } {
    const relationship = getRelationshipValue(faction1, faction2.name);

    // Better relationships lead to more favorable terms
    if (relationship > 50) {
        // Allied - accept generous terms
        return { accepted: true };
    } else if (relationship > 0) {
        // Neutral - negotiate down
        const counterOffer = Math.floor(proposedValue * 0.7);
        return { accepted: false, counterOffer };
    } else {
        // Hostile - demand more
        const counterOffer = Math.floor(proposedValue * 1.5);
        return { accepted: false, counterOffer };
    }
}
