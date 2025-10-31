/**
 * Advanced Military - Unit Veterancy, Equipment Degradation, Supply Lines
 *
 * Phase 8.6: Extends military simulation with veterancy system that improves units over time,
 * equipment degradation mechanics, and supply line logistics for military operations.
 */

import type {
    FactionData,
    FactionMember,
    MilitaryUnit,
    SupplyLine,
} from "../../workmodes/library/factions/types";

// ============================================================================
// Veterancy System
// ============================================================================

/**
 * Gain veterancy from combat experience
 */
export function gainVeterancy(member: FactionMember, experiencePoints: number): void {
    if (member.is_named) return; // Named NPCs don't use veterancy system

    const currentVeterancy = member.veterancy || 0;
    const newVeterancy = Math.min(100, currentVeterancy + experiencePoints);
    member.veterancy = newVeterancy;
}

/**
 * Calculate veterancy bonus (0 to +50% effectiveness)
 */
export function calculateVeterancyBonus(veterancy: number = 0): number {
    // Veterancy provides up to 50% bonus at max level
    return 1 + (veterancy / 100) * 0.5;
}

/**
 * Award veterancy to surviving units after battle
 */
export function awardBattleVeterancy(
    faction: FactionData,
    outcome: "victory" | "defeat" | "stalemate",
): void {
    if (!faction.members) return;

    // Victory grants more veterancy
    const baseExperience = outcome === "victory" ? 15 : outcome === "stalemate" ? 10 : 5;

    for (const member of faction.members) {
        if (!member.is_named && member.status === "Active") {
            // Add some randomness
            const experience = baseExperience + Math.floor(Math.random() * 5);
            gainVeterancy(member, experience);
        }
    }
}

/**
 * Get veterancy level description
 */
export function getVeterancyLevel(veterancy: number = 0): string {
    if (veterancy >= 80) return "Elite";
    if (veterancy >= 60) return "Veteran";
    if (veterancy >= 40) return "Experienced";
    if (veterancy >= 20) return "Trained";
    return "Green";
}

// ============================================================================
// Equipment Degradation
// ============================================================================

/**
 * Degrade equipment after combat
 */
export function degradeEquipment(member: FactionMember, amount: number): void {
    if (member.is_named) return; // Named NPCs handle equipment differently

    const currentCondition = member.equipment_condition || 100;
    const newCondition = Math.max(0, currentCondition - amount);
    member.equipment_condition = newCondition;
}

/**
 * Calculate equipment effectiveness (0 to 100%)
 */
export function calculateEquipmentEffectiveness(condition: number = 100): number {
    // Equipment below 50% condition loses effectiveness rapidly
    if (condition < 50) {
        return condition / 50; // 0% to 100% effective
    }
    return 1; // Full effectiveness
}

/**
 * Repair equipment (costs resources)
 */
export function repairEquipment(
    faction: FactionData,
    member: FactionMember,
    repairAmount: number,
): { success: boolean; cost?: number; error?: string } {
    if (member.is_named) {
        return { success: false, error: "Named NPCs use different equipment system" };
    }

    const currentCondition = member.equipment_condition || 100;
    const targetCondition = Math.min(100, currentCondition + repairAmount);
    const actualRepair = targetCondition - currentCondition;

    // Cost: 1 equipment + 2 gold per 10 points repaired
    const cost = Math.ceil(actualRepair / 10);
    const goldCost = cost * 2;

    if (!faction.resources) {
        return { success: false, error: "Faction has no resources" };
    }

    if ((faction.resources.equipment || 0) < cost) {
        return { success: false, error: "Insufficient equipment resources" };
    }

    if ((faction.resources.gold || 0) < goldCost) {
        return { success: false, error: "Insufficient gold" };
    }

    // Deduct costs
    faction.resources.equipment = (faction.resources.equipment || 0) - cost;
    faction.resources.gold = (faction.resources.gold || 0) - goldCost;

    // Apply repair
    member.equipment_condition = targetCondition;

    return { success: true, cost: cost + goldCost };
}

/**
 * Apply equipment degradation after battle
 */
export function applyBattleDegradation(
    faction: FactionData,
    severity: "light" | "moderate" | "heavy",
): void {
    if (!faction.members) return;

    const degradationAmount = {
        light: 5,
        moderate: 15,
        heavy: 30,
    }[severity];

    for (const member of faction.members) {
        if (!member.is_named && member.status === "Active") {
            degradeEquipment(member, degradationAmount);
        }
    }
}

// ============================================================================
// Supply Line System
// ============================================================================

/**
 * Establish a supply line between locations
 */
export function establishSupplyLine(
    faction: FactionData,
    origin: string,
    destination: string,
    resource: string,
    amount: number,
    security: number = 50,
): SupplyLine {
    const supplyLine: SupplyLine = {
        id: `supply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        origin,
        destination,
        resource,
        amount,
        status: "active",
        security,
    };

    faction.supply_lines = faction.supply_lines || [];
    faction.supply_lines.push(supplyLine);

    return supplyLine;
}

/**
 * Process supply lines (call daily)
 */
export function processSupplyLines(faction: FactionData): { delivered: number; disrupted: number } {
    if (!faction.supply_lines || faction.supply_lines.length === 0) {
        return { delivered: 0, disrupted: 0 };
    }

    let delivered = 0;
    let disrupted = 0;

    for (const line of faction.supply_lines) {
        if (line.status !== "active") continue;

        // Calculate raid risk based on security
        const raidChance = Math.max(0, (100 - line.security) / 100 * 0.1); // 0-10% chance

        if (Math.random() < raidChance) {
            // Supply line disrupted!
            line.status = "disrupted";
            disrupted++;
        } else {
            // Successful delivery
            delivered++;
            // Resources transferred at destination (handled by integration layer)
        }
    }

    return { delivered, disrupted };
}

/**
 * Repair disrupted supply line
 */
export function repairSupplyLine(
    faction: FactionData,
    supplyLineId: string,
    resourceCost: number = 100,
): { success: boolean; error?: string } {
    const line = faction.supply_lines?.find((l) => l.id === supplyLineId);
    if (!line) {
        return { success: false, error: "Supply line not found" };
    }

    if (line.status !== "disrupted") {
        return { success: false, error: "Supply line is not disrupted" };
    }

    // Check resources
    if (!faction.resources || (faction.resources.gold || 0) < resourceCost) {
        return { success: false, error: "Insufficient gold to repair" };
    }

    // Deduct cost and repair
    faction.resources.gold = (faction.resources.gold || 0) - resourceCost;
    line.status = "active";

    return { success: true };
}

/**
 * Sever supply line permanently (e.g., due to enemy action)
 */
export function severSupplyLine(faction: FactionData, supplyLineId: string): boolean {
    const line = faction.supply_lines?.find((l) => l.id === supplyLineId);
    if (!line) return false;

    line.status = "severed";
    return true;
}

/**
 * Get total supply line throughput for a resource
 */
export function getSupplyThroughput(faction: FactionData, resource: string): number {
    if (!faction.supply_lines) return 0;

    return faction.supply_lines
        .filter((l) => l.resource === resource && l.status === "active")
        .reduce((sum, l) => sum + l.amount, 0);
}

/**
 * Calculate supply line security based on military presence
 */
export function calculateSupplyLineSecurity(
    faction: FactionData,
    origin: string,
    destination: string,
): number {
    // Base security
    let security = 30;

    // Check for military units at origin/destination
    if (faction.members) {
        for (const member of faction.members) {
            if (member.position?.type === "poi") {
                const location = member.position.location_name || "";
                if (location === origin || location === destination) {
                    if (member.role === "Guard" || member.role === "Warrior") {
                        security += 10;
                    }
                }
            }
        }
    }

    return Math.min(100, security);
}

// ============================================================================
// Combined Military Effectiveness
// ============================================================================

/**
 * Calculate total military effectiveness including veterancy and equipment
 */
export function calculateMilitaryEffectiveness(member: FactionMember): number {
    let effectiveness = 1.0;

    // Apply veterancy bonus
    if (member.veterancy !== undefined) {
        effectiveness *= calculateVeterancyBonus(member.veterancy);
    }

    // Apply equipment condition penalty
    if (member.equipment_condition !== undefined) {
        effectiveness *= calculateEquipmentEffectiveness(member.equipment_condition);
    }

    return effectiveness;
}

/**
 * Convert faction members to military units with effectiveness modifiers
 */
export function convertToMilitaryUnitsAdvanced(faction: FactionData): MilitaryUnit[] {
    if (!faction.members) return [];

    const units: MilitaryUnit[] = [];

    for (const member of faction.members) {
        if (member.is_named || !member.statblock_ref) continue;

        const effectiveness = calculateMilitaryEffectiveness(member);

        units.push({
            name: member.name,
            quantity: member.quantity || 1,
            statblock_ref: member.statblock_ref,
            training: Math.floor((member.veterancy || 0) * effectiveness),
            morale: 75, // Base morale
            equipment_quality: Math.floor((member.equipment_condition || 100) * effectiveness),
        });
    }

    return units;
}
