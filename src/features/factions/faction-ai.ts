/**
 * Faction AI - Decision Engine
 *
 * Core AI logic for faction decision-making based on goals, resources, and context.
 * Evaluates faction state and generates prioritized action plans.
 */

import type {
    FactionAIContext,
    FactionDecision,
    FactionDecisionType,
    GoalWeights,
    ResourceEvaluation,
} from "./ai-types";
import type { FactionData, FactionResources } from "../../workmodes/library/factions/types";

/**
 * Evaluate faction state and generate prioritized decision
 */
export function evaluateFactionDecision(context: FactionAIContext): FactionDecision {
    const { faction } = context;

    // Calculate goal weights from faction tags
    const goalWeights = calculateGoalWeights(faction);

    // Evaluate resource state
    const resourceEval = evaluateResources(faction.resources || {});

    // Generate candidate decisions
    const candidates: FactionDecision[] = [];

    // Resource-critical decisions (highest priority)
    if (resourceEval.gold.critical) {
        candidates.push(createGatherResourcesDecision("gold", goalWeights));
    }
    if (resourceEval.food.critical) {
        candidates.push(createGatherResourcesDecision("food", goalWeights));
    }

    // Goal-driven decisions
    for (const goalTag of faction.goal_tags || []) {
        const goalDecisions = generateGoalDecisions(goalTag.value, goalWeights, context);
        candidates.push(...goalDecisions);
    }

    // Defense decisions (if threats exist)
    if (context.threats && context.threats.length > 0) {
        candidates.push(createDefenseDecision(context.threats, goalWeights));
    }

    // Expansion decisions (if opportunities exist)
    if (context.opportunities && context.opportunities.length > 0) {
        candidates.push(createExpansionDecision(context.opportunities, goalWeights));
    }

    // Diplomacy decisions (if nearby factions exist)
    if (context.nearbyFactions && context.nearbyFactions.length > 0) {
        candidates.push(...generateDiplomacyDecisions(faction, context.nearbyFactions, goalWeights));
    }

    // Fallback: rest and recover
    if (candidates.length === 0) {
        candidates.push(createRestDecision());
    }

    // Sort by priority (descending)
    candidates.sort((a, b) => b.priority - a.priority);

    // Return highest priority decision
    return candidates[0];
}

/**
 * Calculate goal weights from faction tags
 */
function calculateGoalWeights(faction: FactionData): GoalWeights {
    const weights: GoalWeights = {
        expansion: 0,
        wealth: 0,
        military: 0,
        magic: 0,
        influence: 0,
        stability: 0,
    };

    for (const tag of faction.goal_tags || []) {
        const goal = tag.value.toLowerCase();

        // Map goal tags to weights
        if (goal.includes("conquest") || goal.includes("expand")) {
            weights.expansion += 10;
            weights.military += 5;
        }
        if (goal.includes("defense") || goal.includes("protect") || goal.includes("stability")) {
            weights.stability += 10;
            weights.military += 3;
        }
        if (goal.includes("trade") || goal.includes("wealth") || goal.includes("prosperity")) {
            weights.wealth += 10;
            weights.influence += 5;
        }
        if (goal.includes("knowledge") || goal.includes("research") || goal.includes("magic")) {
            weights.magic += 10;
        }
        if (goal.includes("influence") || goal.includes("political") || goal.includes("diplomacy")) {
            weights.influence += 10;
        }
    }

    // Apply influence tags
    for (const tag of faction.influence_tags || []) {
        const influence = tag.value.toLowerCase();

        if (influence.includes("military")) {
            weights.military += 5;
        }
        if (influence.includes("political")) {
            weights.influence += 5;
        }
        if (influence.includes("religious") || influence.includes("scholarly")) {
            weights.magic += 3;
        }
    }

    // Normalize: ensure at least base value for stability
    if (weights.stability === 0) {
        weights.stability = 3; // Every faction needs some stability
    }

    return weights;
}

/**
 * Evaluate resource state
 */
function evaluateResources(resources: FactionResources): {
    [K in keyof FactionResources]: ResourceEvaluation;
} {
    const defaults = {
        gold: 1000,
        food: 500,
        equipment: 200,
        magic: 50,
        influence: 30,
    };

    const result: any = {};

    for (const [key, minValue] of Object.entries(defaults)) {
        const current = resources[key] || 0;
        const critical = current < minValue * 0.2; // Critical at 20% of minimum

        result[key] = {
            critical,
            current,
            minimum: minValue,
            productionRate: 0, // TODO: Calculate from jobs
            consumptionRate: 0, // TODO: Calculate from member upkeep
        };
    }

    return result;
}

/**
 * Create resource gathering decision
 */
function createGatherResourcesDecision(
    resourceType: string,
    weights: GoalWeights,
): FactionDecision {
    return {
        type: "gather_resources",
        priority: 90, // High priority when resources are critical
        reasoning: `Critical ${resourceType} shortage - immediate gathering required`,
        requiredResources: {},
        expectedOutcome: `Increase ${resourceType} reserves`,
        duration: 7, // 1 week
        params: {
            resourceType,
            targetAmount: resourceType === "gold" ? 500 : 200,
        },
    };
}

/**
 * Generate decisions based on goal tags
 */
function generateGoalDecisions(
    goal: string,
    weights: GoalWeights,
    context: FactionAIContext,
): FactionDecision[] {
    const decisions: FactionDecision[] = [];
    const normalizedGoal = goal.toLowerCase();

    if (normalizedGoal.includes("conquest") || normalizedGoal.includes("expand")) {
        decisions.push({
            type: "expand_territory",
            priority: 60 + weights.expansion,
            reasoning: `Faction goal: ${goal}`,
            expectedOutcome: "Claim new territory",
            duration: 14,
        });

        decisions.push({
            type: "recruit_units",
            priority: 50 + weights.military,
            reasoning: `Build military for ${goal}`,
            requiredResources: { gold: 200 },
            expectedOutcome: "Increase military strength",
            duration: 10,
        });
    }

    if (normalizedGoal.includes("trade") || normalizedGoal.includes("wealth")) {
        decisions.push({
            type: "trade_resources",
            priority: 55 + weights.wealth,
            reasoning: `Faction goal: ${goal}`,
            expectedOutcome: "Increase wealth through trade",
            duration: 5,
        });

        decisions.push({
            type: "establish_camp",
            priority: 45 + weights.wealth,
            reasoning: "Establish trading post",
            requiredResources: { gold: 500, equipment: 100 },
            expectedOutcome: "Create permanent trade location",
            duration: 21,
            params: { buildingType: "trading_post" },
        });
    }

    if (normalizedGoal.includes("knowledge") || normalizedGoal.includes("research")) {
        decisions.push({
            type: "research_magic",
            priority: 50 + weights.magic,
            reasoning: `Faction goal: ${goal}`,
            requiredResources: { magic: 20, gold: 100 },
            expectedOutcome: "Advance magical knowledge",
            duration: 14,
        });
    }

    if (normalizedGoal.includes("defense") || normalizedGoal.includes("stability")) {
        decisions.push({
            type: "build_structure",
            priority: 40 + weights.stability,
            reasoning: `Faction goal: ${goal}`,
            requiredResources: { gold: 300, equipment: 150 },
            expectedOutcome: "Strengthen defenses",
            duration: 21,
            params: { buildingType: "fortification" },
        });
    }

    return decisions;
}

/**
 * Create defense decision
 */
function createDefenseDecision(threats: string[], weights: GoalWeights): FactionDecision {
    return {
        type: "defend_territory",
        priority: 80 + weights.stability,
        reasoning: `Active threats: ${threats.join(", ")}`,
        requiredResources: { food: 50, equipment: 30 },
        expectedOutcome: "Protect territory from threats",
        duration: 7,
        params: { threats },
    };
}

/**
 * Create expansion decision
 */
function createExpansionDecision(opportunities: string[], weights: GoalWeights): FactionDecision {
    return {
        type: "expand_territory",
        priority: 65 + weights.expansion,
        reasoning: `Opportunities available: ${opportunities.join(", ")}`,
        requiredResources: { gold: 200, food: 100 },
        expectedOutcome: "Claim new territory",
        duration: 14,
        params: { opportunities },
    };
}

/**
 * Generate diplomacy decisions
 */
function generateDiplomacyDecisions(
    faction: FactionData,
    nearbyFactions: FactionData[],
    weights: GoalWeights,
): FactionDecision[] {
    const decisions: FactionDecision[] = [];

    for (const nearby of nearbyFactions) {
        // Find existing relationship
        const relationship = faction.faction_relationships?.find(
            (rel) => rel.faction_name === nearby.name,
        );

        const relationshipValue = relationship?.value || 0;

        // Hostile factions: consider raiding or war
        if (relationshipValue < -40) {
            decisions.push({
                type: "raid_target",
                priority: 40 + weights.military,
                reasoning: `Hostile faction nearby: ${nearby.name}`,
                requiredResources: { food: 50, equipment: 50 },
                expectedOutcome: `Raid ${nearby.name} for resources`,
                duration: 3,
                params: { targetFaction: nearby.name },
            });
        }

        // Neutral factions: consider alliance or trade
        if (relationshipValue >= -20 && relationshipValue <= 20) {
            decisions.push({
                type: "form_alliance",
                priority: 35 + weights.influence,
                reasoning: `Neutral faction nearby: ${nearby.name}`,
                expectedOutcome: `Improve relations with ${nearby.name}`,
                duration: 7,
                params: { targetFaction: nearby.name },
            });
        }

        // Allied factions: consider trade
        if (relationshipValue > 40) {
            decisions.push({
                type: "trade_resources",
                priority: 30 + weights.wealth,
                reasoning: `Allied faction: ${nearby.name}`,
                expectedOutcome: `Trade with ${nearby.name}`,
                duration: 2,
                params: { targetFaction: nearby.name },
            });
        }
    }

    return decisions;
}

/**
 * Create rest decision (fallback)
 */
function createRestDecision(): FactionDecision {
    return {
        type: "rest_and_recover",
        priority: 10,
        reasoning: "No pressing needs - consolidate position",
        expectedOutcome: "Recover resources and strength",
        duration: 7,
    };
}
