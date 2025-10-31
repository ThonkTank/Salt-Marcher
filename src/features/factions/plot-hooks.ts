/**
 * Plot Hook Generator
 *
 * Generates plot hooks and story opportunities from faction interactions,
 * conflicts, discoveries, and simulation events.
 */

import type { FactionData, FactionRelationship } from "../../workmodes/library/factions/types";
import type { FactionDecision } from "./ai-types";
import type { SimulationEvent } from "./faction-simulation";

/**
 * Plot hook for GM story planning
 */
export interface PlotHook {
    /** Hook title */
    title: string;
    /** Detailed description */
    description: string;
    /** Hook category */
    category: "conflict" | "alliance" | "discovery" | "crisis" | "opportunity" | "mystery";
    /** Urgency (1-5, 5 = immediate) */
    urgency: number;
    /** Involved factions */
    factions: string[];
    /** Suggested quest objectives */
    objectives?: string[];
    /** Potential rewards */
    rewards?: string[];
    /** Complications */
    complications?: string[];
}

/**
 * Generate plot hooks from faction decisions
 */
export function generatePlotHooksFromDecision(
    faction: FactionData,
    decision: FactionDecision,
    context?: { nearbyFactions?: FactionData[] },
): PlotHook[] {
    const hooks: PlotHook[] = [];

    switch (decision.type) {
        case "expand_territory":
            hooks.push({
                title: `${faction.name} Expansion`,
                description: `${faction.name} seeks to expand their territory. This could threaten local settlements or bring them into conflict with neighboring factions.`,
                category: "conflict",
                urgency: 3,
                factions: [faction.name],
                objectives: [
                    `Negotiate with ${faction.name} to prevent conflict`,
                    `Warn settlements in the expansion path`,
                    `Ally with ${faction.name} to support their expansion`,
                ],
                complications: ["Local settlements resist", "Rival faction objects", "Harsh terrain complicates expansion"],
            });
            break;

        case "establish_camp":
            hooks.push({
                title: `New ${faction.name} Outpost`,
                description: `${faction.name} is establishing a new camp. This could be a trading opportunity, a strategic threat, or a source of information.`,
                category: "opportunity",
                urgency: 2,
                factions: [faction.name],
                objectives: [
                    "Investigate the new camp",
                    "Offer assistance in building",
                    "Trade with the new outpost",
                ],
                rewards: ["Trading opportunities", "Faction reputation", "Strategic information"],
            });
            break;

        case "raid_target":
            if (decision.params?.targetFaction) {
                hooks.push({
                    title: `${faction.name} Plans Raid`,
                    description: `${faction.name} is planning a raid against ${decision.params.targetFaction}. The party could intervene, assist, or exploit the chaos.`,
                    category: "conflict",
                    urgency: 4,
                    factions: [faction.name, decision.params.targetFaction],
                    objectives: [
                        `Warn ${decision.params.targetFaction}`,
                        `Join the raid with ${faction.name}`,
                        "Negotiate peace between factions",
                        "Use the distraction to pursue own goals",
                    ],
                    complications: ["Raid happens sooner than expected", "Third faction gets involved", "Civilians caught in crossfire"],
                });
            }
            break;

        case "form_alliance":
            if (decision.params?.targetFaction) {
                hooks.push({
                    title: `Alliance Negotiations`,
                    description: `${faction.name} is seeking an alliance with ${decision.params.targetFaction}. This could shift the balance of power in the region.`,
                    category: "alliance",
                    urgency: 2,
                    factions: [faction.name, decision.params.targetFaction],
                    objectives: [
                        "Facilitate the alliance",
                        "Sabotage the negotiations",
                        "Broker a better deal for one side",
                    ],
                    rewards: ["Diplomatic reputation", "Favor from one or both factions"],
                });
            }
            break;

        case "research_magic":
            hooks.push({
                title: `${faction.name} Magical Research`,
                description: `${faction.name} is conducting magical research. This could yield powerful artifacts, dangerous knowledge, or unintended consequences.`,
                category: "mystery",
                urgency: 2,
                factions: [faction.name],
                objectives: [
                    "Learn what they're researching",
                    "Steal research notes",
                    "Assist in the research",
                ],
                rewards: ["Magical knowledge", "Artifact", "Spell scrolls"],
                complications: ["Research backfires", "Other factions want the knowledge", "Ethical concerns"],
            });
            break;

        case "send_expedition":
            hooks.push({
                title: `${faction.name} Expedition`,
                description: `${faction.name} is sending an expedition. The party could join, follow, or compete with them.`,
                category: "opportunity",
                urgency: 3,
                factions: [faction.name],
                objectives: [
                    "Join the expedition",
                    "Follow secretly",
                    "Reach the destination first",
                ],
                rewards: ["Treasure", "Discovery", "Faction reputation"],
            });
            break;

        case "recruit_units":
            hooks.push({
                title: `${faction.name} Recruiting`,
                description: `${faction.name} is actively recruiting new members. This could be a chance to infiltrate, join legitimately, or learn their plans.`,
                category: "opportunity",
                urgency: 2,
                factions: [faction.name],
                objectives: [
                    "Join the faction",
                    "Infiltrate as a recruit",
                    "Disrupt recruitment",
                ],
            });
            break;

        case "defend_territory":
            hooks.push({
                title: `${faction.name} Under Threat`,
                description: `${faction.name} is fortifying defenses against threats. They may seek allies or mercenaries.`,
                category: "crisis",
                urgency: 4,
                factions: [faction.name],
                objectives: [
                    "Offer military assistance",
                    "Investigate the threat",
                    "Exploit their weakness",
                ],
                rewards: ["Gold payment", "Faction gratitude", "Salvage from battles"],
            });
            break;
    }

    return hooks;
}

/**
 * Generate plot hooks from simulation events
 */
export function generatePlotHooksFromEvent(event: SimulationEvent): PlotHook | null {
    switch (event.type) {
        case "crisis":
            return {
                title: event.title,
                description: event.description,
                category: "crisis",
                urgency: event.importance,
                factions: [event.factionName],
                objectives: [
                    "Investigate the crisis",
                    "Offer assistance",
                    "Exploit the situation",
                ],
            };

        case "discovery":
            return {
                title: event.title,
                description: event.description,
                category: "discovery",
                urgency: Math.max(2, event.importance - 1),
                factions: [event.factionName],
                objectives: [
                    "Learn what was discovered",
                    "Claim the discovery first",
                    "Trade for information",
                ],
                rewards: ["Knowledge", "Treasure", "Artifact"],
            };

        case "conflict":
            return {
                title: event.title,
                description: event.description,
                category: "conflict",
                urgency: event.importance,
                factions: [event.factionName],
                objectives: [
                    "Mediate the conflict",
                    "Choose a side",
                    "Profit from the chaos",
                ],
            };

        default:
            // Resource and completion events generally don't generate hooks
            return null;
    }
}

/**
 * Generate plot hooks from faction relationships
 */
export function generatePlotHooksFromRelationships(
    faction1: FactionData,
    faction2: FactionData,
    relationship: FactionRelationship,
): PlotHook[] {
    const hooks: PlotHook[] = [];

    if (relationship.value < -60) {
        // Deep hostility
        hooks.push({
            title: `War Between ${faction1.name} and ${faction2.name}`,
            description: `${faction1.name} and ${faction2.name} are locked in bitter conflict. This could escalate into full war.`,
            category: "conflict",
            urgency: 5,
            factions: [faction1.name, faction2.name],
            objectives: [
                "Prevent war through diplomacy",
                "Choose a side and fight",
                "Profit by selling to both sides",
            ],
            complications: ["War breaks out anyway", "Other factions join", "Civilians suffer"],
        });
    } else if (relationship.value < -20) {
        // Tension
        hooks.push({
            title: `Tensions Rising`,
            description: `Relations between ${faction1.name} and ${faction2.name} are deteriorating. Small incidents could spark larger conflicts.`,
            category: "conflict",
            urgency: 3,
            factions: [faction1.name, faction2.name],
            objectives: [
                "Improve relations",
                "Investigate the source of tension",
                "Prepare for conflict",
            ],
        });
    } else if (relationship.value > 60) {
        // Strong alliance
        hooks.push({
            title: `Alliance Opportunity`,
            description: `${faction1.name} and ${faction2.name} are close allies. This alliance could be leveraged for mutual benefit or threatened by enemies.`,
            category: "alliance",
            urgency: 2,
            factions: [faction1.name, faction2.name],
            objectives: [
                "Join the alliance",
                "Strengthen the bond",
                "Exploit the alliance",
            ],
            rewards: ["Allied support", "Trade benefits", "Strategic advantage"],
        });
    }

    return hooks;
}

/**
 * Generate comprehensive plot hooks for a faction
 */
export function generateFactionPlotHooks(
    faction: FactionData,
    allFactions: FactionData[],
): PlotHook[] {
    const hooks: PlotHook[] = [];

    // Resource crisis hooks
    if ((faction.resources?.gold || 0) < 200) {
        hooks.push({
            title: `${faction.name} Economic Troubles`,
            description: `${faction.name} is facing financial difficulties. They may seek loans, resort to banditry, or offer valuable services for gold.`,
            category: "crisis",
            urgency: 3,
            factions: [faction.name],
            objectives: [
                "Provide financial aid",
                "Offer mercenary work",
                "Take advantage of their weakness",
            ],
        });
    }

    if ((faction.resources?.food || 0) < 100) {
        hooks.push({
            title: `${faction.name} Food Shortage`,
            description: `${faction.name} is running low on food supplies. They may need to raid, trade, or relocate.`,
            category: "crisis",
            urgency: 4,
            factions: [faction.name],
            objectives: [
                "Provide food supplies",
                "Help them find new food sources",
                "Protect nearby settlements from raids",
            ],
        });
    }

    // Goal-based hooks
    for (const goalTag of faction.goal_tags || []) {
        const goal = goalTag.value.toLowerCase();

        if (goal.includes("conquest")) {
            hooks.push({
                title: `${faction.name} Expansionist Ambitions`,
                description: `${faction.name} seeks to conquer new territory. This could threaten the region.`,
                category: "conflict",
                urgency: 3,
                factions: [faction.name],
                objectives: [
                    "Oppose their expansion",
                    "Join their conquest",
                    "Warn potential targets",
                ],
            });
        }

        if (goal.includes("knowledge") || goal.includes("research")) {
            hooks.push({
                title: `${faction.name} Seeks Ancient Knowledge`,
                description: `${faction.name} is searching for lost lore and artifacts. They may hire adventurers or compete for discoveries.`,
                category: "mystery",
                urgency: 2,
                factions: [faction.name],
                objectives: [
                    "Help them find knowledge",
                    "Compete for the same discoveries",
                    "Sell them information",
                ],
                rewards: ["Gold payment", "Access to faction library", "Magical items"],
            });
        }
    }

    // Relationship hooks
    for (const relationship of faction.faction_relationships || []) {
        const otherFaction = allFactions.find((f) => f.name === relationship.faction_name);
        if (otherFaction) {
            hooks.push(...generatePlotHooksFromRelationships(faction, otherFaction, relationship));
        }
    }

    return hooks;
}
