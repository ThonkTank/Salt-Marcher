/**
 * Advanced Diplomacy - Secret Treaties, Espionage, Diplomatic Incidents
 *
 * Phase 8.6: Extends diplomacy with covert operations, intelligence gathering,
 * and incident management that affects faction relationships.
 */

import type {
    FactionData,
    DiplomaticTreaty,
    EspionageOperation,
    DiplomaticIncident,
} from "../../workmodes/library/factions/types";

// ============================================================================
// Secret Treaties
// ============================================================================

/**
 * Create a secret treaty (hidden from other factions)
 */
export function createSecretTreaty(
    faction: FactionData,
    partners: string[],
    type: DiplomaticTreaty["type"],
    terms: string,
    duration?: number,
): DiplomaticTreaty {
    const today = new Date().toISOString().split("T")[0];
    const expires = duration
        ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        : undefined;

    const treaty: DiplomaticTreaty = {
        id: `treaty_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        partners,
        terms,
        signed: today,
        expires,
        status: "active",
        is_secret: true,
    };

    faction.treaties = faction.treaties || [];
    faction.treaties.push(treaty);

    return treaty;
}

/**
 * Check if a treaty is secret
 */
export function isSecretTreaty(treaty: DiplomaticTreaty): boolean {
    return treaty.is_secret === true;
}

/**
 * Reveal secret treaty (e.g., through espionage)
 */
export function revealSecretTreaty(treaty: DiplomaticTreaty): void {
    treaty.is_secret = false;
}

/**
 * Get all secret treaties for a faction
 */
export function getSecretTreaties(faction: FactionData): DiplomaticTreaty[] {
    return faction.treaties?.filter((t) => isSecretTreaty(t)) || [];
}

// ============================================================================
// Espionage Operations
// ============================================================================

/**
 * Launch an espionage operation
 */
export function launchEspionageOperation(
    faction: FactionData,
    target: string,
    type: EspionageOperation["type"],
    agent?: string,
): { success: boolean; operation?: EspionageOperation; error?: string } {
    // Base cost depends on operation type
    const costMap: Record<EspionageOperation["type"], number> = {
        infiltrate: 100,
        sabotage: 200,
        steal_secrets: 150,
        assassinate: 300,
        counter_intel: 100,
    };

    const cost = costMap[type];

    // Check resources
    if (!faction.resources || (faction.resources.gold || 0) < cost) {
        return { success: false, error: "Insufficient gold" };
    }

    // Deduct cost
    faction.resources.gold = (faction.resources.gold || 0) - cost;

    // Calculate success chance based on faction's magic/influence resources
    const intelligence = (faction.resources.influence || 0) + (faction.resources.magic || 0) / 10;
    const baseChance = Math.min(80, 30 + intelligence);

    // Create operation
    const operation: EspionageOperation = {
        id: `espionage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        target,
        type,
        agent,
        started: new Date().toISOString().split("T")[0],
        status: "active",
        success_chance: baseChance,
        cost,
    };

    faction.espionage_operations = faction.espionage_operations || [];
    faction.espionage_operations.push(operation);

    return { success: true, operation };
}

/**
 * Resolve espionage operation (call after duration)
 */
export function resolveEspionageOperation(
    faction: FactionData,
    operationId: string,
): { outcome: "success" | "failure" | "discovered"; result?: string } {
    const operation = faction.espionage_operations?.find((op) => op.id === operationId);
    if (!operation || operation.status !== "active") {
        return { outcome: "failure", result: "Operation not found or not active" };
    }

    const successRoll = Math.random() * 100;
    const discoveryRoll = Math.random() * 100;

    // Check if discovered (10% base chance)
    if (discoveryRoll < 10) {
        operation.status = "discovered";
        return {
            outcome: "discovered",
            result: `${operation.type} operation was discovered by ${operation.target}`,
        };
    }

    // Check success
    if (successRoll < (operation.success_chance || 50)) {
        operation.status = "success";

        let result = "";
        switch (operation.type) {
            case "infiltrate":
                result = `Successfully infiltrated ${operation.target}. Gained intelligence.`;
                faction.resources = faction.resources || {};
                faction.resources.influence = (faction.resources.influence || 0) + 10;
                break;
            case "sabotage":
                result = `Sabotage operation against ${operation.target} succeeded.`;
                break;
            case "steal_secrets":
                result = `Stole valuable secrets from ${operation.target}.`;
                faction.resources = faction.resources || {};
                faction.resources.magic = (faction.resources.magic || 0) + 20;
                break;
            case "assassinate":
                result = `Assassination attempt against ${operation.target} succeeded.`;
                break;
            case "counter_intel":
                result = `Successfully countered espionage from ${operation.target}.`;
                break;
        }

        return { outcome: "success", result };
    } else {
        operation.status = "failure";
        return {
            outcome: "failure",
            result: `${operation.type} operation against ${operation.target} failed`,
        };
    }
}

/**
 * Counter an espionage operation (defensive action)
 */
export function counterEspionage(
    faction: FactionData,
    cost: number = 50,
): { success: boolean; error?: string } {
    if (!faction.resources || (faction.resources.gold || 0) < cost) {
        return { success: false, error: "Insufficient gold" };
    }

    // Deduct cost
    faction.resources.gold = (faction.resources.gold || 0) - cost;

    // Increase detection chance for future operations (implementation would track this)
    faction.resources.influence = (faction.resources.influence || 0) + 5;

    return { success: true };
}

// ============================================================================
// Diplomatic Incidents
// ============================================================================

/**
 * Create a diplomatic incident
 */
export function createDiplomaticIncident(
    faction: FactionData,
    type: DiplomaticIncident["type"],
    involvedFactions: string[],
    relationshipImpact: number,
    description: string,
): DiplomaticIncident {
    const incident: DiplomaticIncident = {
        id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        factions: [faction.name, ...involvedFactions],
        date: new Date().toISOString().split("T")[0],
        relationship_impact: relationshipImpact,
        status: "unresolved",
        description,
    };

    faction.diplomatic_incidents = faction.diplomatic_incidents || [];
    faction.diplomatic_incidents.push(incident);

    return incident;
}

/**
 * Resolve a diplomatic incident
 */
export function resolveDiplomaticIncident(
    faction: FactionData,
    incidentId: string,
    resolution: "negotiated" | "escalated",
): { success: boolean; error?: string } {
    const incident = faction.diplomatic_incidents?.find((i) => i.id === incidentId);
    if (!incident) {
        return { success: false, error: "Incident not found" };
    }

    if (resolution === "negotiated") {
        incident.status = "resolved";
        // Reduce relationship impact by 50%
        incident.relationship_impact = Math.floor(incident.relationship_impact / 2);
    } else {
        incident.status = "escalated";
        // Double relationship impact
        incident.relationship_impact *= 2;
    }

    return { success: true };
}

/**
 * Generate diplomatic incident from espionage discovery
 */
export function generateEspionageIncident(
    sourceFaction: FactionData,
    targetFaction: string,
    operation: EspionageOperation,
): DiplomaticIncident {
    const description = `${sourceFaction.name} was caught conducting ${operation.type} operation`;

    return createDiplomaticIncident(
        sourceFaction,
        "spy_discovered",
        [targetFaction],
        -40, // Major relationship penalty
        description,
    );
}

/**
 * Generate diplomatic incident from treaty breach
 */
export function generateTreatyBreachIncident(
    faction: FactionData,
    treaty: DiplomaticTreaty,
    breachDescription: string,
): DiplomaticIncident {
    return createDiplomaticIncident(
        faction,
        "treaty_breach",
        treaty.partners,
        -60, // Severe relationship penalty
        breachDescription,
    );
}

/**
 * Generate border dispute incident
 */
export function generateBorderDisputeIncident(
    faction: FactionData,
    opposingFaction: string,
    location: string,
): DiplomaticIncident {
    const description = `Territorial dispute over ${location}`;

    return createDiplomaticIncident(
        faction,
        "border_dispute",
        [opposingFaction],
        -20, // Moderate relationship penalty
        description,
    );
}

/**
 * Get all unresolved incidents
 */
export function getUnresolvedIncidents(faction: FactionData): DiplomaticIncident[] {
    return faction.diplomatic_incidents?.filter((i) => i.status === "unresolved") || [];
}

/**
 * Get incidents involving a specific faction
 */
export function getIncidentsWithFaction(
    faction: FactionData,
    targetFaction: string,
): DiplomaticIncident[] {
    return (
        faction.diplomatic_incidents?.filter((i) => i.factions.includes(targetFaction)) || []
    );
}

// ============================================================================
// Diplomatic Intelligence
// ============================================================================

/**
 * Gather intelligence on another faction (reveals some secrets)
 */
export function gatherIntelligence(
    faction: FactionData,
    target: string,
    cost: number = 100,
): { success: boolean; intelligence?: string[]; error?: string } {
    if (!faction.resources || (faction.resources.gold || 0) < cost) {
        return { success: false, error: "Insufficient gold" };
    }

    // Deduct cost
    faction.resources.gold = (faction.resources.gold || 0) - cost;

    const intelligence: string[] = [];

    // Basic intelligence (always revealed)
    intelligence.push(`${target} has been observed conducting military operations`);

    // 50% chance to reveal a secret treaty
    if (Math.random() < 0.5) {
        intelligence.push(`${target} may have secret agreements with other factions`);
    }

    // 30% chance to reveal resource levels
    if (Math.random() < 0.3) {
        intelligence.push(`${target} appears to have moderate to high resource reserves`);
    }

    // 20% chance to reveal military strength
    if (Math.random() < 0.2) {
        intelligence.push(`${target} has a substantial military presence`);
    }

    return { success: true, intelligence };
}

/**
 * Plant false intelligence (misinformation campaign)
 */
export function plantFalseIntelligence(
    faction: FactionData,
    target: string,
    falseInfo: string,
    cost: number = 150,
): { success: boolean; error?: string } {
    if (!faction.resources || (faction.resources.gold || 0) < cost) {
        return { success: false, error: "Insufficient gold" };
    }

    // Deduct cost
    faction.resources.gold = (faction.resources.gold || 0) - cost;

    // Success chance based on influence
    const successChance = Math.min(80, 40 + (faction.resources.influence || 0) / 2);

    if (Math.random() * 100 < successChance) {
        return { success: true };
    }

    // If failed, may cause an incident
    createDiplomaticIncident(
        faction,
        "spy_discovered",
        [target],
        -30,
        "Misinformation campaign discovered",
    );

    return { success: false, error: "Misinformation campaign failed and was discovered" };
}
