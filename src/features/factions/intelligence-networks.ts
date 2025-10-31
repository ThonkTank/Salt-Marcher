/**
 * Intelligence Networks - Persistent Spy Networks and Counter-Intelligence
 *
 * Phase 8.7: Implements persistent intelligence networks with agents, safe houses,
 * information gathering, counter-intelligence operations, and intelligence analysis.
 */

import type { FactionData, EspionageOperation } from "../../workmodes/library/factions/types";

// ============================================================================
// Intelligence Network Types
// ============================================================================

/**
 * Intelligence agent
 */
export interface IntelligenceAgent {
    /** Agent ID */
    id: string;
    /** Agent codename */
    codename: string;
    /** Real name (if known) */
    real_name?: string;
    /** Agent type */
    type: "spy" | "informant" | "assassin" | "saboteur" | "analyst" | "handler";
    /** Skill level (0-100) */
    skill: number;
    /** Cover identity */
    cover: string;
    /** Location */
    location: string;
    /** Status */
    status: "active" | "deep_cover" | "burned" | "captured" | "eliminated" | "retired";
    /** Loyalty (0-100) */
    loyalty: number;
    /** Current assignment */
    assignment?: string;
}

/**
 * Intelligence network
 */
export interface IntelligenceNetwork {
    /** Network ID */
    id: string;
    /** Owning faction */
    faction: string;
    /** Network name */
    name: string;
    /** Active agents */
    agents: IntelligenceAgent[];
    /** Safe houses */
    safe_houses: SafeHouse[];
    /** Intelligence reports */
    reports: IntelligenceReport[];
    /** Network efficiency (0-100) */
    efficiency: number;
    /** Network security (0-100) */
    security: number;
}

/**
 * Safe house for agent operations
 */
export interface SafeHouse {
    /** Safe house ID */
    id: string;
    /** Location */
    location: string;
    /** Cover business */
    cover: string;
    /** Security level (0-100) */
    security: number;
    /** Capacity (max agents) */
    capacity: number;
    /** Current agents */
    agents: string[];
    /** Status */
    status: "active" | "compromised" | "abandoned";
}

/**
 * Intelligence report
 */
export interface IntelligenceReport {
    /** Report ID */
    id: string;
    /** Date generated */
    date: string;
    /** Source agent */
    source: string;
    /** Target faction */
    target: string;
    /** Report type */
    type: "military" | "economic" | "political" | "social" | "technological";
    /** Reliability (0-100) */
    reliability: number;
    /** Intel summary */
    summary: string;
    /** Detailed findings */
    findings: Record<string, any>;
    /** Urgency (1-5) */
    urgency: number;
}

// ============================================================================
// Network Management
// ============================================================================

/**
 * Create a new intelligence network
 */
export function createIntelligenceNetwork(
    faction: FactionData,
    name: string,
): IntelligenceNetwork {
    return {
        id: `network_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        faction: faction.name,
        name,
        agents: [],
        safe_houses: [],
        reports: [],
        efficiency: 50,
        security: 50,
    };
}

/**
 * Recruit an agent
 */
export function recruitAgent(
    network: IntelligenceNetwork,
    type: IntelligenceAgent["type"],
    location: string,
    skill: number = 50,
): { success: boolean; agent?: IntelligenceAgent; error?: string } {
    // Cost scales with skill level
    const recruitmentCost = 100 + skill * 10;

    const codenames = [
        "Shadow", "Raven", "Whisper", "Ghost", "Viper", "Falcon",
        "Blade", "Echo", "Storm", "Frost", "Phoenix", "Serpent",
    ];

    const covers = [
        "merchant", "scholar", "priest", "guard", "servant", "artisan",
        "minstrel", "sailor", "farmer", "clerk", "scribe", "trader",
    ];

    const agent: IntelligenceAgent = {
        id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        codename: codenames[Math.floor(Math.random() * codenames.length)],
        type,
        skill,
        cover: covers[Math.floor(Math.random() * covers.length)],
        location,
        status: "active",
        loyalty: 70,
    };

    network.agents.push(agent);

    return { success: true, agent };
}

/**
 * Establish a safe house
 */
export function establishSafeHouse(
    network: IntelligenceNetwork,
    location: string,
    cover: string,
    security: number = 50,
): { success: boolean; safe_house?: SafeHouse; error?: string } {
    const safeHouse: SafeHouse = {
        id: `safehouse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        location,
        cover,
        security,
        capacity: 5,
        agents: [],
        status: "active",
    };

    network.safe_houses.push(safeHouse);

    return { success: true, safe_house: safeHouse };
}

// ============================================================================
// Intelligence Operations
// ============================================================================

/**
 * Assign agent to intelligence gathering
 */
export function assignIntelligenceGathering(
    network: IntelligenceNetwork,
    agentId: string,
    target: string,
    type: IntelligenceReport["type"],
): { success: boolean; error?: string } {
    const agent = network.agents.find((a) => a.id === agentId);
    if (!agent) {
        return { success: false, error: "Agent not found" };
    }

    if (agent.status !== "active") {
        return { success: false, error: "Agent not available" };
    }

    agent.assignment = `Gathering ${type} intelligence on ${target}`;
    agent.status = "deep_cover";

    return { success: true };
}

/**
 * Generate intelligence report from agent
 */
export function generateIntelligenceReport(
    network: IntelligenceNetwork,
    agentId: string,
    target: string,
    targetFaction?: FactionData,
): { success: boolean; report?: IntelligenceReport; error?: string } {
    const agent = network.agents.find((a) => a.id === agentId);
    if (!agent) {
        return { success: false, error: "Agent not found" };
    }

    // Extract intelligence type from assignment
    const assignmentMatch = agent.assignment?.match(/Gathering (\w+) intelligence/);
    const type = (assignmentMatch?.[1] as IntelligenceReport["type"]) || "political";

    // Reliability based on agent skill and loyalty
    const reliability = Math.min(100, (agent.skill + agent.loyalty) / 2);

    // Generate findings based on type
    const findings = generateFindings(type, targetFaction);

    // Determine urgency based on findings
    const urgency = calculateUrgency(findings);

    const report: IntelligenceReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString().split("T")[0],
        source: agent.codename,
        target,
        type,
        reliability,
        summary: generateSummary(type, findings),
        findings,
        urgency,
    };

    network.reports.push(report);

    // Agent returns to active status
    agent.status = "active";
    agent.assignment = undefined;

    return { success: true, report };
}

/**
 * Generate findings based on intelligence type
 */
function generateFindings(
    type: IntelligenceReport["type"],
    faction?: FactionData,
): Record<string, any> {
    if (!faction) {
        return { status: "no data available" };
    }

    switch (type) {
        case "military":
            return {
                military_strength: calculateMilitaryStrength(faction),
                unit_count: faction.members?.filter((m) => !m.is_named).length || 0,
                fortifications: faction.members?.filter((m) => m.job?.type === "guard").length || 0,
                readiness: Math.floor(Math.random() * 100),
            };

        case "economic":
            return {
                gold: faction.resources?.gold || 0,
                trade_routes: faction.trade_routes?.length || 0,
                production_capacity: faction.production_chains?.length || 0,
                economic_health: Math.floor(Math.random() * 100),
            };

        case "political":
            return {
                alliances: faction.faction_relationships?.filter((r) => r.value > 60).length || 0,
                enemies: faction.faction_relationships?.filter((r) => r.value < -60).length || 0,
                influence: faction.resources?.influence || 0,
                stability: Math.floor(Math.random() * 100),
            };

        case "social":
            return {
                morale: Math.floor(Math.random() * 100),
                unrest: Math.floor(Math.random() * 100),
                loyalty: Math.floor(Math.random() * 100),
                population: faction.members?.reduce((sum, m) => sum + (m.quantity || 1), 0) || 0,
            };

        case "technological":
            return {
                magic_resources: faction.resources?.magic || 0,
                research_projects: faction.members?.filter((m) => m.job?.type === "research").length || 0,
                innovations: Math.floor(Math.random() * 10),
            };

        default:
            return {};
    }
}

/**
 * Calculate military strength from faction data
 */
function calculateMilitaryStrength(faction: FactionData): number {
    if (!faction.members) return 0;

    let strength = 0;
    for (const member of faction.members) {
        const quantity = member.quantity || 1;
        const veterancy = (member.veterancy || 50) / 100;
        const equipment = (member.equipment_condition || 75) / 100;

        strength += quantity * veterancy * equipment;
    }

    return Math.floor(strength);
}

/**
 * Generate summary from findings
 */
function generateSummary(type: IntelligenceReport["type"], findings: Record<string, any>): string {
    const templates: Record<IntelligenceReport["type"], string> = {
        military: `Military assessment: ${findings.unit_count} units, strength ${findings.military_strength}, readiness ${findings.readiness}%`,
        economic: `Economic assessment: ${findings.gold} gold, ${findings.trade_routes} trade routes, health ${findings.economic_health}%`,
        political: `Political assessment: ${findings.alliances} allies, ${findings.enemies} enemies, influence ${findings.influence}`,
        social: `Social assessment: morale ${findings.morale}%, unrest ${findings.unrest}%, population ${findings.population}`,
        technological: `Technological assessment: ${findings.magic_resources} magic resources, ${findings.research_projects} active research projects`,
    };

    return templates[type];
}

/**
 * Calculate urgency from findings
 */
function calculateUrgency(findings: Record<string, any>): number {
    let urgency = 1;

    // High military readiness
    if (findings.readiness && findings.readiness > 80) urgency = Math.max(urgency, 4);

    // Economic crisis
    if (findings.economic_health && findings.economic_health < 30) urgency = Math.max(urgency, 3);

    // High unrest
    if (findings.unrest && findings.unrest > 70) urgency = Math.max(urgency, 4);

    // Many enemies
    if (findings.enemies && findings.enemies > 2) urgency = Math.max(urgency, 3);

    return urgency;
}

// ============================================================================
// Counter-Intelligence
// ============================================================================

/**
 * Detect enemy agents
 */
export function detectEnemyAgents(
    network: IntelligenceNetwork,
    targetNetwork: IntelligenceNetwork,
): { detected: IntelligenceAgent[]; missed: number } {
    const detected: IntelligenceAgent[] = [];
    let missed = 0;

    for (const agent of targetNetwork.agents) {
        // Detection chance based on network security and agent skill
        const detectionChance = (network.security / 100) * (1 - agent.skill / 100);

        if (Math.random() < detectionChance) {
            detected.push(agent);
            agent.status = "burned";
        } else {
            missed++;
        }
    }

    return { detected, missed };
}

/**
 * Interrogate captured agent
 */
export function interrogateAgent(
    agent: IntelligenceAgent,
): {
    information_gained: string[];
    agent_turned: boolean;
} {
    const informationGained: string[] = [];

    // Information gained based on agent loyalty
    const infoChance = (100 - agent.loyalty) / 100;

    if (Math.random() < infoChance) {
        informationGained.push(`Agent's real name: ${agent.real_name || "Unknown"}`);
    }

    if (Math.random() < infoChance * 0.7) {
        informationGained.push(`Current assignment: ${agent.assignment || "None"}`);
    }

    if (Math.random() < infoChance * 0.5) {
        informationGained.push("Information about other agents");
    }

    // Chance to turn agent (double agent)
    const turnChance = (100 - agent.loyalty) / 200; // Half the info chance
    const agentTurned = Math.random() < turnChance;

    if (agentTurned) {
        agent.status = "active"; // Now working for interrogator
        agent.loyalty = 30; // Low initial loyalty
    }

    return { information_gained: informationGained, agent_turned: agentTurned };
}

/**
 * Plant false intelligence
 */
export function plantFalseIntelligence(
    network: IntelligenceNetwork,
    targetNetwork: IntelligenceNetwork,
    falseReport: Partial<IntelligenceReport>,
): { success: boolean; detected: boolean } {
    // Success chance based on network efficiency
    const successChance = network.efficiency / 100;

    if (Math.random() > successChance) {
        return { success: false, detected: false };
    }

    // Detection chance based on target's security
    const detectionChance = targetNetwork.security / 200; // Half of security rating

    const detected = Math.random() < detectionChance;

    if (!detected) {
        // Plant the false report
        const report: IntelligenceReport = {
            id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString().split("T")[0],
            source: "Unknown",
            target: targetNetwork.faction,
            type: falseReport.type || "political",
            reliability: 80, // Appears reliable
            summary: falseReport.summary || "False intelligence",
            findings: falseReport.findings || {},
            urgency: falseReport.urgency || 3,
        };

        targetNetwork.reports.push(report);
    }

    return { success: true, detected };
}

// ============================================================================
// Network Analysis
// ============================================================================

/**
 * Analyze intelligence reports for patterns
 */
export function analyzeIntelligence(
    network: IntelligenceNetwork,
    targetFaction: string,
): {
    threat_level: number;
    opportunities: string[];
    warnings: string[];
    recommendations: string[];
} {
    const reports = network.reports.filter((r) => r.target === targetFaction);

    if (reports.length === 0) {
        return {
            threat_level: 50, // Unknown
            opportunities: [],
            warnings: ["No intelligence available"],
            recommendations: ["Establish intelligence gathering operations"],
        };
    }

    // Calculate threat level from recent reports
    const recentReports = reports.slice(-5);
    let threatLevel = 50;

    for (const report of recentReports) {
        if (report.type === "military" && report.findings.readiness > 80) {
            threatLevel += 10;
        }
        if (report.type === "political" && report.findings.enemies > 2) {
            threatLevel += 5;
        }
        if (report.type === "economic" && report.findings.economic_health < 30) {
            threatLevel -= 10;
        }
    }

    threatLevel = Math.max(0, Math.min(100, threatLevel));

    // Identify opportunities
    const opportunities: string[] = [];
    for (const report of recentReports) {
        if (report.type === "social" && report.findings.unrest > 70) {
            opportunities.push("High unrest - potential for rebellion or defection");
        }
        if (report.type === "economic" && report.findings.gold < 500) {
            opportunities.push("Low resources - vulnerable to economic warfare");
        }
        if (report.type === "military" && report.findings.readiness < 40) {
            opportunities.push("Poor military readiness - vulnerable to attack");
        }
    }

    // Identify warnings
    const warnings: string[] = [];
    for (const report of recentReports) {
        if (report.urgency >= 4) {
            warnings.push(`High urgency report: ${report.summary}`);
        }
        if (report.type === "military" && report.findings.military_strength > 500) {
            warnings.push("Strong military force detected - invasion risk");
        }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (threatLevel > 70) {
        recommendations.push("Prepare defensive measures");
        recommendations.push("Increase counter-intelligence operations");
    } else if (threatLevel < 30) {
        recommendations.push("Consider diplomatic or economic pressure");
        recommendations.push("Potential opportunity for expansion");
    }

    if (opportunities.length > 0) {
        recommendations.push("Exploit identified opportunities");
    }

    return { threat_level: threatLevel, opportunities, warnings, recommendations };
}

/**
 * Calculate network effectiveness
 */
export function calculateNetworkEffectiveness(network: IntelligenceNetwork): number {
    if (network.agents.length === 0) return 0;

    const activeAgents = network.agents.filter((a) => a.status === "active" || a.status === "deep_cover");
    const avgSkill = activeAgents.reduce((sum, a) => sum + a.skill, 0) / activeAgents.length;
    const avgLoyalty = activeAgents.reduce((sum, a) => sum + a.loyalty, 0) / activeAgents.length;

    const activeSafeHouses = network.safe_houses.filter((sh) => sh.status === "active").length;

    // Effectiveness = (avg skill + avg loyalty) / 2 * (1 + safe houses * 0.1) * efficiency
    const base = (avgSkill + avgLoyalty) / 2;
    const safeHouseBonus = 1 + activeSafeHouses * 0.1;
    const efficiency = network.efficiency / 100;

    return Math.min(100, Math.floor(base * safeHouseBonus * efficiency));
}

/**
 * Update network security after operations
 */
export function updateNetworkSecurity(
    network: IntelligenceNetwork,
    operation: "success" | "failure" | "compromise",
): void {
    switch (operation) {
        case "success":
            network.security = Math.min(100, network.security + 5);
            network.efficiency = Math.min(100, network.efficiency + 3);
            break;

        case "failure":
            network.security = Math.max(0, network.security - 3);
            network.efficiency = Math.max(0, network.efficiency - 2);
            break;

        case "compromise":
            network.security = Math.max(0, network.security - 20);
            network.efficiency = Math.max(0, network.efficiency - 15);

            // Mark random safe house as compromised
            const activeSafeHouses = network.safe_houses.filter((sh) => sh.status === "active");
            if (activeSafeHouses.length > 0) {
                const compromised = activeSafeHouses[Math.floor(Math.random() * activeSafeHouses.length)];
                compromised.status = "compromised";
            }
            break;
    }
}

// ============================================================================
// Covert Operations
// ============================================================================

/**
 * Execute covert operation using agents
 */
export function executeCovertOperation(
    network: IntelligenceNetwork,
    agentIds: string[],
    operationType: "infiltration" | "sabotage" | "assassination" | "theft" | "rescue",
    difficulty: number,
): {
    success: boolean;
    casualties: string[];
    burned: string[];
    intelligence_gained?: string;
} {
    const agents = network.agents.filter((a) => agentIds.includes(a.id));

    if (agents.length === 0) {
        return { success: false, casualties: [], burned: [] };
    }

    // Calculate success chance
    const avgSkill = agents.reduce((sum, a) => sum + a.skill, 0) / agents.length;
    const teamBonus = agents.length > 1 ? 10 : 0;
    const successChance = (avgSkill + teamBonus - difficulty) / 100;

    const success = Math.random() < successChance;

    const casualties: string[] = [];
    const burned: string[] = [];

    if (!success) {
        // Operation failed - casualties and burned covers
        for (const agent of agents) {
            const casualtyChance = 0.2; // 20% chance of death
            const burnChance = 0.5; // 50% chance of burned cover

            if (Math.random() < casualtyChance) {
                agent.status = "eliminated";
                casualties.push(agent.codename);
            } else if (Math.random() < burnChance) {
                agent.status = "burned";
                burned.push(agent.codename);
            }
        }

        updateNetworkSecurity(network, "failure");
    } else {
        updateNetworkSecurity(network, "success");
    }

    return {
        success,
        casualties,
        burned,
        intelligence_gained: success ? "Valuable intelligence obtained" : undefined,
    };
}
