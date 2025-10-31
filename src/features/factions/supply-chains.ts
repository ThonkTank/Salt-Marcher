/**
 * Advanced Supply Chains - Multi-step Production Dependencies
 *
 * Phase 8.7: Implements complex production chains where outputs from one
 * process become inputs for another, creating interdependent resource networks.
 */

import type { FactionData, ProductionChain } from "../../workmodes/library/factions/types";

// ============================================================================
// Supply Chain Types
// ============================================================================

/**
 * Supply chain node representing a production step
 */
export interface SupplyChainNode {
    /** Node ID */
    id: string;
    /** Production chain reference */
    production_chain_id: string;
    /** Dependencies (nodes that must complete first) */
    dependencies: string[];
    /** Status */
    status: "pending" | "active" | "blocked" | "completed" | "failed";
    /** Completion percentage */
    completion: number;
}

/**
 * Complete supply chain graph
 */
export interface SupplyChain {
    /** Chain ID */
    id: string;
    /** Chain name */
    name: string;
    /** All nodes in the chain */
    nodes: SupplyChainNode[];
    /** Final output resource */
    final_output: Record<string, number>;
    /** Overall chain status */
    status: "not_started" | "in_progress" | "completed" | "failed";
    /** Faction owner */
    owner: string;
}

/**
 * Supply chain template for common production sequences
 */
export interface SupplyChainTemplate {
    /** Template name */
    name: string;
    /** Steps in order */
    steps: Array<{
        production: string; // References production chain template
        duration: number;
    }>;
    /** Final output description */
    output_description: string;
}

// ============================================================================
// Supply Chain Templates
// ============================================================================

/**
 * Pre-defined supply chain templates
 */
export const SUPPLY_CHAIN_TEMPLATES: Record<string, SupplyChainTemplate> = {
    master_weaponsmith: {
        name: "Master Weaponsmith",
        steps: [
            { production: "weapon_forging", duration: 7 },
            { production: "armor_crafting", duration: 10 },
        ],
        output_description: "Complete military equipment set",
    },
    feast_preparation: {
        name: "Feast Preparation",
        steps: [
            { production: "bread_baking", duration: 2 },
            { production: "ale_brewing", duration: 14 },
        ],
        output_description: "Full feast supplies",
    },
    arcane_research: {
        name: "Arcane Research",
        steps: [
            { production: "scroll_scribing", duration: 3 },
            { production: "potion_brewing", duration: 5 },
        ],
        output_description: "Arcane research materials",
    },
    enchanted_gear: {
        name: "Enchanted Gear",
        steps: [
            { production: "weapon_forging", duration: 7 },
            { production: "scroll_scribing", duration: 3 },
            { production: "potion_brewing", duration: 5 },
        ],
        output_description: "Magically enhanced equipment",
    },
};

// ============================================================================
// Chain Creation
// ============================================================================

/**
 * Create a supply chain from template
 */
export function createSupplyChain(
    faction: FactionData,
    templateKey: keyof typeof SUPPLY_CHAIN_TEMPLATES,
): { success: boolean; chain?: SupplyChain; error?: string } {
    const template = SUPPLY_CHAIN_TEMPLATES[templateKey];
    if (!template) {
        return { success: false, error: "Unknown template" };
    }

    const nodes: SupplyChainNode[] = [];
    let previousNodeId: string | null = null;

    // Create nodes for each step
    for (let i = 0; i < template.steps.length; i++) {
        const step = template.steps[i];
        const nodeId = `node_${Date.now()}_${i}`;

        nodes.push({
            id: nodeId,
            production_chain_id: step.production,
            dependencies: previousNodeId ? [previousNodeId] : [],
            status: i === 0 ? "active" : "pending",
            completion: 0,
        });

        previousNodeId = nodeId;
    }

    const chain: SupplyChain = {
        id: `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: template.name,
        nodes,
        final_output: {}, // Will be calculated on completion
        status: "in_progress",
        owner: faction.name,
    };

    return { success: true, chain };
}

/**
 * Create a custom supply chain
 */
export function createCustomSupplyChain(
    faction: FactionData,
    name: string,
    productionSteps: string[],
): { success: boolean; chain?: SupplyChain; error?: string } {
    if (productionSteps.length === 0) {
        return { success: false, error: "At least one production step required" };
    }

    const nodes: SupplyChainNode[] = [];
    let previousNodeId: string | null = null;

    for (let i = 0; i < productionSteps.length; i++) {
        const nodeId = `node_${Date.now()}_${i}`;

        nodes.push({
            id: nodeId,
            production_chain_id: productionSteps[i],
            dependencies: previousNodeId ? [previousNodeId] : [],
            status: i === 0 ? "active" : "pending",
            completion: 0,
        });

        previousNodeId = nodeId;
    }

    const chain: SupplyChain = {
        id: `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        nodes,
        final_output: {},
        status: "in_progress",
        owner: faction.name,
    };

    return { success: true, chain };
}

// ============================================================================
// Chain Execution
// ============================================================================

/**
 * Process supply chain for one day
 */
export function processSupplyChain(
    chain: SupplyChain,
    faction: FactionData,
): {
    completed_nodes: string[];
    blocked_nodes: string[];
    failed_nodes: string[];
    chain_completed: boolean;
} {
    const completedNodes: string[] = [];
    const blockedNodes: string[] = [];
    const failedNodes: string[] = [];

    for (const node of chain.nodes) {
        // Skip completed/failed nodes
        if (node.status === "completed" || node.status === "failed") continue;

        // Check dependencies
        const dependenciesMet = node.dependencies.every((depId) => {
            const depNode = chain.nodes.find((n) => n.id === depId);
            return depNode && depNode.status === "completed";
        });

        if (!dependenciesMet) {
            node.status = "blocked";
            blockedNodes.push(node.id);
            continue;
        }

        // Activate if pending
        if (node.status === "pending") {
            node.status = "active";
        }

        // Process active node
        if (node.status === "active") {
            // Try to start/continue production
            const productionChain = faction.production_chains?.find(
                (pc) => pc.name === node.production_chain_id || pc.id === node.production_chain_id,
            );

            if (!productionChain) {
                // Start new production chain
                // Note: This would normally call startProductionChain from advanced-economics.ts
                // For now, simulate progress
                node.completion += 10; // 10% per day

                if (node.completion >= 100) {
                    node.status = "completed";
                    node.completion = 100;
                    completedNodes.push(node.id);
                }
            } else {
                // Continue existing chain
                node.completion = productionChain.progress || 0;

                if (node.completion >= 100) {
                    node.status = "completed";
                    node.completion = 100;
                    completedNodes.push(node.id);
                }
            }
        }
    }

    // Check if entire chain is complete
    const chainCompleted = chain.nodes.every((n) => n.status === "completed");
    if (chainCompleted) {
        chain.status = "completed";
    }

    return { completed_nodes: completedNodes, blocked_nodes: blockedNodes, failed_nodes: failedNodes, chain_completed: chainCompleted };
}

/**
 * Cancel a supply chain
 */
export function cancelSupplyChain(chain: SupplyChain): void {
    chain.status = "failed";
    for (const node of chain.nodes) {
        if (node.status !== "completed") {
            node.status = "failed";
        }
    }
}

// ============================================================================
// Dependency Analysis
// ============================================================================

/**
 * Get critical path (longest dependency chain)
 */
export function getCriticalPath(chain: SupplyChain): SupplyChainNode[] {
    const visited = new Set<string>();
    let longestPath: SupplyChainNode[] = [];

    function dfs(nodeId: string, currentPath: SupplyChainNode[]): void {
        const node = chain.nodes.find((n) => n.id === nodeId);
        if (!node || visited.has(nodeId)) return;

        visited.add(nodeId);
        currentPath.push(node);

        // Find nodes that depend on this one
        const dependents = chain.nodes.filter((n) => n.dependencies.includes(nodeId));

        if (dependents.length === 0) {
            // Leaf node - check if this is the longest path
            if (currentPath.length > longestPath.length) {
                longestPath = [...currentPath];
            }
        } else {
            // Recurse to dependents
            for (const dep of dependents) {
                dfs(dep.id, [...currentPath]);
            }
        }

        visited.delete(nodeId);
    }

    // Start from root nodes (no dependencies)
    const rootNodes = chain.nodes.filter((n) => n.dependencies.length === 0);
    for (const root of rootNodes) {
        dfs(root.id, []);
    }

    return longestPath;
}

/**
 * Estimate total completion time
 */
export function estimateCompletionTime(chain: SupplyChain): number {
    const criticalPath = getCriticalPath(chain);

    // Sum durations of nodes in critical path
    // Note: Durations would need to be stored in nodes or looked up from templates
    // For now, assume 7 days per node as average
    return criticalPath.length * 7;
}

/**
 * Find bottlenecks (nodes with most dependents)
 */
export function findBottlenecks(chain: SupplyChain): SupplyChainNode[] {
    const dependentCounts = new Map<string, number>();

    for (const node of chain.nodes) {
        dependentCounts.set(node.id, 0);
    }

    for (const node of chain.nodes) {
        for (const depId of node.dependencies) {
            dependentCounts.set(depId, (dependentCounts.get(depId) || 0) + 1);
        }
    }

    // Sort by dependent count
    const sortedNodes = chain.nodes.sort(
        (a, b) => (dependentCounts.get(b.id) || 0) - (dependentCounts.get(a.id) || 0),
    );

    // Return top 3 or all if fewer
    return sortedNodes.slice(0, Math.min(3, sortedNodes.length));
}

// ============================================================================
// Resource Flow Analysis
// ============================================================================

/**
 * Calculate total resource requirements for chain
 */
export function calculateTotalRequirements(chain: SupplyChain): Record<string, number> {
    const requirements: Record<string, number> = {};

    // Would normally look up production chain inputs
    // For now, estimate based on node count
    requirements.gold = chain.nodes.length * 50;
    requirements.equipment = chain.nodes.length * 10;
    requirements.magic = chain.nodes.length * 5;

    return requirements;
}

/**
 * Check if faction has sufficient resources for chain
 */
export function canStartChain(chain: SupplyChain, faction: FactionData): { can_start: boolean; missing: string[] } {
    const requirements = calculateTotalRequirements(chain);
    const missing: string[] = [];

    for (const [resource, amount] of Object.entries(requirements)) {
        const available = faction.resources?.[resource] || 0;
        if (available < amount) {
            missing.push(`${resource} (need ${amount}, have ${available})`);
        }
    }

    return { can_start: missing.length === 0, missing };
}

// ============================================================================
// Parallelization
// ============================================================================

/**
 * Find nodes that can be executed in parallel
 */
export function findParallelNodes(chain: SupplyChain): SupplyChainNode[][] {
    const levels: SupplyChainNode[][] = [];
    const processed = new Set<string>();

    function getLevel(node: SupplyChainNode): number {
        if (node.dependencies.length === 0) return 0;

        let maxDepLevel = 0;
        for (const depId of node.dependencies) {
            const depNode = chain.nodes.find((n) => n.id === depId);
            if (depNode) {
                maxDepLevel = Math.max(maxDepLevel, getLevel(depNode));
            }
        }

        return maxDepLevel + 1;
    }

    // Group nodes by level
    for (const node of chain.nodes) {
        const level = getLevel(node);

        while (levels.length <= level) {
            levels.push([]);
        }

        levels[level].push(node);
    }

    return levels;
}

/**
 * Optimize chain execution by parallelizing independent steps
 */
export function optimizeChain(chain: SupplyChain): {
    parallelized: boolean;
    levels: number;
    time_saved: number;
} {
    const parallelLevels = findParallelNodes(chain);
    const originalTime = chain.nodes.length * 7; // Sequential
    const optimizedTime = parallelLevels.length * 7; // Parallel
    const timeSaved = originalTime - optimizedTime;

    return {
        parallelized: parallelLevels.some((level) => level.length > 1),
        levels: parallelLevels.length,
        time_saved: timeSaved,
    };
}

// ============================================================================
// Chain Events
// ============================================================================

/**
 * Supply chain event
 */
export interface SupplyChainEvent {
    /** Event type */
    type: "delay" | "failure" | "acceleration" | "quality_boost" | "resource_shortage";
    /** Affected node */
    node_id: string;
    /** Description */
    description: string;
    /** Impact on completion time (days) */
    time_impact: number;
}

/**
 * Generate random supply chain event
 */
export function generateSupplyChainEvent(
    chain: SupplyChain,
): { generated: boolean; event?: SupplyChainEvent } {
    // 10% chance per day
    if (Math.random() > 0.1) {
        return { generated: false };
    }

    const activeNodes = chain.nodes.filter((n) => n.status === "active");
    if (activeNodes.length === 0) {
        return { generated: false };
    }

    const node = activeNodes[Math.floor(Math.random() * activeNodes.length)];

    const eventTypes: SupplyChainEvent["type"][] = [
        "delay",
        "failure",
        "acceleration",
        "quality_boost",
        "resource_shortage",
    ];

    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    const descriptions: Record<SupplyChainEvent["type"], string> = {
        delay: "Equipment malfunction causes delays",
        failure: "Critical failure in production",
        acceleration: "Breakthrough improves efficiency",
        quality_boost: "Skilled craftsmanship exceeds expectations",
        resource_shortage: "Supply shortage disrupts production",
    };

    const timeImpacts: Record<SupplyChainEvent["type"], number> = {
        delay: 2,
        failure: 5,
        acceleration: -2,
        quality_boost: -1,
        resource_shortage: 3,
    };

    const event: SupplyChainEvent = {
        type,
        node_id: node.id,
        description: descriptions[type],
        time_impact: timeImpacts[type],
    };

    // Apply event effects
    if (type === "failure") {
        node.status = "failed";
    } else {
        // Adjust completion based on time impact
        const completionAdjust = (timeImpacts[type] / 7) * -10; // Convert days to % change
        node.completion = Math.max(0, Math.min(100, node.completion + completionAdjust));
    }

    return { generated: true, event };
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Get supply chain status report
 */
export function getChainReport(chain: SupplyChain): {
    name: string;
    status: string;
    overall_completion: number;
    active_nodes: number;
    completed_nodes: number;
    blocked_nodes: number;
    estimated_days_remaining: number;
} {
    const activeNodes = chain.nodes.filter((n) => n.status === "active").length;
    const completedNodes = chain.nodes.filter((n) => n.status === "completed").length;
    const blockedNodes = chain.nodes.filter((n) => n.status === "blocked").length;

    const totalCompletion =
        chain.nodes.reduce((sum, n) => sum + n.completion, 0) / chain.nodes.length;

    const remainingNodes = chain.nodes.filter((n) => n.status !== "completed").length;
    const estimatedDaysRemaining = remainingNodes * 7; // Rough estimate

    return {
        name: chain.name,
        status: chain.status,
        overall_completion: Math.round(totalCompletion),
        active_nodes: activeNodes,
        completed_nodes: completedNodes,
        blocked_nodes: blockedNodes,
        estimated_days_remaining: estimatedDaysRemaining,
    };
}
