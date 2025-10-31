/**
 * Military Simulation - Battles, Sieges, Tactical AI
 *
 * Simulates military engagements between factions including battles, sieges,
 * and tactical decisions. Uses unit composition, training, morale, and equipment
 * to determine outcomes.
 */

import type { FactionData, MilitaryUnit, MilitaryEngagement, FactionMember } from "../../workmodes/library/factions/types";

/**
 * Calculate military strength of units
 * Factors: quantity, training, morale, equipment quality
 */
export function calculateMilitaryStrength(units: MilitaryUnit[]): number {
    let totalStrength = 0;

    for (const unit of units) {
        // Base strength = quantity
        const baseStrength = unit.quantity;

        // Multipliers based on training, morale, equipment (all 0-100 scale)
        const trainingMultiplier = 1 + (unit.training / 100);
        const moraleMultiplier = 1 + (unit.morale / 100);
        const equipmentMultiplier = 1 + (unit.equipment_quality / 100);

        const unitStrength = baseStrength * trainingMultiplier * moraleMultiplier * equipmentMultiplier;
        totalStrength += unitStrength;
    }

    return Math.floor(totalStrength);
}

/**
 * Convert faction members to military units for combat
 */
export function convertMembersToMilitaryUnits(members: FactionMember[]): MilitaryUnit[] {
    const units: MilitaryUnit[] = [];

    for (const member of members) {
        // Skip named NPCs without quantity
        if (member.is_named && !member.quantity) continue;

        units.push({
            name: member.name,
            quantity: member.quantity || 1,
            statblock_ref: member.statblock_ref || "Unknown",
            training: 50, // Default medium training
            morale: 70, // Default good morale
            equipment_quality: 50, // Default medium equipment
        });
    }

    return units;
}

/**
 * Initiate a military engagement (battle, siege, raid, etc.)
 */
export function initiateMilitaryEngagement(
    attacker: FactionData,
    defender: FactionData,
    type: "battle" | "siege" | "skirmish" | "raid",
    location: string,
    attackerUnits: MilitaryUnit[],
    currentDate: string
): MilitaryEngagement {
    const engagement: MilitaryEngagement = {
        id: `${attacker.name}_vs_${defender.name}_${Date.now()}`,
        type,
        opponent: defender.name,
        location,
        started: currentDate,
        status: "ongoing",
        committed_units: attackerUnits,
        casualties: 0,
    };

    attacker.military_engagements = attacker.military_engagements || [];
    attacker.military_engagements.push(engagement);

    return engagement;
}

/**
 * Simulate battle outcome
 * Returns victor, casualties, and updated engagement
 */
export function simulateBattle(
    attacker: FactionData,
    defender: FactionData,
    engagement: MilitaryEngagement,
    defenderUnits: MilitaryUnit[]
): {
    victor: "attacker" | "defender" | "stalemate";
    attackerCasualties: number;
    defenderCasualties: number;
    moraleImpact: number;
} {
    const attackerStrength = calculateMilitaryStrength(engagement.committed_units);
    const defenderStrength = calculateMilitaryStrength(defenderUnits);

    // Defender gets defensive bonus (20%)
    const defenderBonus = engagement.type === "siege" ? 1.5 : 1.2;
    const adjustedDefenderStrength = defenderStrength * defenderBonus;

    // Determine victor based on strength ratio
    const strengthRatio = attackerStrength / adjustedDefenderStrength;

    let victor: "attacker" | "defender" | "stalemate";
    let attackerCasualties: number;
    let defenderCasualties: number;

    if (strengthRatio > 1.5) {
        // Decisive attacker victory
        victor = "attacker";
        attackerCasualties = Math.floor(attackerStrength * 0.1); // 10% losses
        defenderCasualties = Math.floor(defenderStrength * 0.5); // 50% losses
    } else if (strengthRatio > 1.1) {
        // Narrow attacker victory
        victor = "attacker";
        attackerCasualties = Math.floor(attackerStrength * 0.25); // 25% losses
        defenderCasualties = Math.floor(defenderStrength * 0.4); // 40% losses
    } else if (strengthRatio < 0.67) {
        // Decisive defender victory
        victor = "defender";
        attackerCasualties = Math.floor(attackerStrength * 0.5); // 50% losses
        defenderCasualties = Math.floor(defenderStrength * 0.1); // 10% losses
    } else if (strengthRatio < 0.9) {
        // Narrow defender victory
        victor = "defender";
        attackerCasualties = Math.floor(attackerStrength * 0.4); // 40% losses
        defenderCasualties = Math.floor(defenderStrength * 0.25); // 25% losses
    } else {
        // Stalemate
        victor = "stalemate";
        attackerCasualties = Math.floor(attackerStrength * 0.3); // 30% losses both sides
        defenderCasualties = Math.floor(defenderStrength * 0.3);
    }

    // Morale impact based on outcome
    const moraleImpact = victor === "attacker" ? 10 : victor === "defender" ? -20 : -10;

    // Update engagement
    engagement.status = victor === "stalemate" ? "stalemate" : victor === "attacker" ? "victory" : "defeat";
    engagement.casualties = attackerCasualties;

    return { victor, attackerCasualties, defenderCasualties, moraleImpact };
}

/**
 * Apply casualties to faction members
 */
export function applyCasualties(faction: FactionData, casualties: number, engagedUnits: MilitaryUnit[]): void {
    if (!faction.members) return;

    let remainingCasualties = casualties;

    for (const unit of engagedUnits) {
        if (remainingCasualties <= 0) break;

        // Find matching member in faction
        const member = faction.members.find((m) => m.name === unit.name);
        if (!member || !member.quantity) continue;

        const losses = Math.min(member.quantity, remainingCasualties);
        member.quantity -= losses;
        remainingCasualties -= losses;

        // Remove member entry if quantity reaches zero
        if (member.quantity <= 0) {
            faction.members = faction.members.filter((m) => m.name !== member.name);
        }
    }
}

/**
 * Update morale for units after battle
 */
export function updateMorale(units: MilitaryUnit[], moraleChange: number): void {
    for (const unit of units) {
        unit.morale = Math.max(0, Math.min(100, unit.morale + moraleChange));
    }
}

/**
 * Get all active military engagements for a faction
 */
export function getActiveEngagements(faction: FactionData): MilitaryEngagement[] {
    return faction.military_engagements?.filter((e) => e.status === "ongoing") || [];
}

/**
 * Resolve siege (longer duration, higher defender bonus)
 */
export function resolveSiege(
    attacker: FactionData,
    defender: FactionData,
    engagement: MilitaryEngagement,
    defenderUnits: MilitaryUnit[],
    daysElapsed: number
): {
    status: "ongoing" | "breakthrough" | "repelled" | "starved_out";
    attackerCasualties: number;
    defenderCasualties: number;
} {
    // Sieges are slow - require time or overwhelming force
    const attackerStrength = calculateMilitaryStrength(engagement.committed_units);
    const defenderStrength = calculateMilitaryStrength(defenderUnits);

    // Very high defender bonus for sieges
    const defenderBonus = 2.0;
    const adjustedDefenderStrength = defenderStrength * defenderBonus;

    const strengthRatio = attackerStrength / adjustedDefenderStrength;

    // Check if siege has lasted long enough
    const siegeDuration = daysElapsed;

    if (siegeDuration < 10) {
        // Siege ongoing - attrition casualties
        const attackerCasualties = Math.floor(attackerStrength * 0.02 * daysElapsed); // 2% per day
        const defenderCasualties = Math.floor(defenderStrength * 0.01 * daysElapsed); // 1% per day

        return {
            status: "ongoing",
            attackerCasualties,
            defenderCasualties,
        };
    }

    // After 10+ days, check for breakthrough or starvation
    if (strengthRatio > 2.0) {
        // Breakthrough - walls breached
        const attackerCasualties = Math.floor(attackerStrength * 0.3);
        const defenderCasualties = Math.floor(defenderStrength * 0.6);

        engagement.status = "victory";
        return {
            status: "breakthrough",
            attackerCasualties,
            defenderCasualties,
        };
    } else if (siegeDuration > 30) {
        // Defenders starved out after 30 days
        const attackerCasualties = Math.floor(attackerStrength * 0.1);
        const defenderCasualties = Math.floor(defenderStrength * 0.4);

        engagement.status = "victory";
        return {
            status: "starved_out",
            attackerCasualties,
            defenderCasualties,
        };
    } else if (strengthRatio < 0.8) {
        // Siege repelled - attacker retreats
        const attackerCasualties = Math.floor(attackerStrength * 0.4);
        const defenderCasualties = Math.floor(defenderStrength * 0.2);

        engagement.status = "defeat";
        return {
            status: "repelled",
            attackerCasualties,
            defenderCasualties,
        };
    }

    // Default: ongoing siege
    return {
        status: "ongoing",
        attackerCasualties: Math.floor(attackerStrength * 0.02 * daysElapsed),
        defenderCasualties: Math.floor(defenderStrength * 0.01 * daysElapsed),
    };
}

/**
 * Tactical AI decision for battles
 * Returns recommended action: attack, defend, retreat, flank, etc.
 */
export function getTacticalDecision(
    faction: FactionData,
    enemyStrength: number,
    ownStrength: number,
    terrain: "open" | "forest" | "mountain" | "fortified" = "open"
): "attack" | "defend" | "retreat" | "flank" | "ambush" {
    const strengthRatio = ownStrength / enemyStrength;

    // Overwhelming superiority - attack
    if (strengthRatio > 1.8) return "attack";

    // Slight advantage in favorable terrain - attack
    if (strengthRatio > 1.2 && (terrain === "fortified" || terrain === "mountain")) return "attack";

    // Outnumbered significantly - retreat
    if (strengthRatio < 0.5) return "retreat";

    // Even match in forest/mountain - use terrain for ambush/flank
    if (strengthRatio >= 0.8 && strengthRatio <= 1.2) {
        if (terrain === "forest" || terrain === "mountain") return Math.random() > 0.5 ? "ambush" : "flank";
    }

    // Default: defend
    return "defend";
}
