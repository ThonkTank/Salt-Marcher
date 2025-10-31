/**
 * Subfaction System - Organizational Hierarchy & Inheritance
 *
 * Manages subfaction relationships, resource inheritance, and hierarchy validation.
 * Subfactions inherit culture and resources from parent factions but can have
 * distinct goals and operate semi-independently.
 */

import type { FactionData, FactionResources } from "../../workmodes/library/factions/types";

/**
 * Validate subfaction hierarchy (no cycles, parent exists)
 */
export function validateSubfactionHierarchy(
    faction: FactionData,
    allFactions: FactionData[]
): { valid: boolean; error?: string } {
    // If no parent, this is a root faction - valid
    if (!faction.parent_faction) {
        return { valid: true };
    }

    // Check parent exists
    const parent = allFactions.find((f) => f.name === faction.parent_faction);
    if (!parent) {
        return {
            valid: false,
            error: `Parent faction "${faction.parent_faction}" not found`,
        };
    }

    // Check for cycles: follow parent chain up to root
    const visited = new Set<string>([faction.name]);
    let current = parent;

    while (current.parent_faction) {
        if (visited.has(current.name)) {
            return {
                valid: false,
                error: `Circular dependency detected: ${Array.from(visited).join(" → ")}`,
            };
        }
        visited.add(current.name);

        const next = allFactions.find((f) => f.name === current.parent_faction);
        if (!next) {
            return {
                valid: false,
                error: `Parent faction "${current.parent_faction}" not found in hierarchy`,
            };
        }
        current = next;
    }

    return { valid: true };
}

/**
 * Inherit resources from parent faction
 * Subfactions receive a percentage of parent resources (default 10%)
 */
export function inheritParentResources(
    subfaction: FactionData,
    parent: FactionData,
    inheritanceRate: number = 0.1
): Partial<FactionResources> {
    if (!parent.resources) {
        return {};
    }

    const inherited: Partial<FactionResources> = {};
    const resourceKeys = Object.keys(parent.resources) as Array<keyof FactionResources>;

    for (const key of resourceKeys) {
        const parentValue = parent.resources[key];
        if (typeof parentValue === "number") {
            inherited[key] = Math.floor(parentValue * inheritanceRate);
        }
    }

    return inherited;
}

/**
 * Inherit culture tags from parent (subfactions share cultural identity)
 */
export function inheritCultureTags(subfaction: FactionData, parent: FactionData): Array<{ value: string }> {
    // Combine parent and subfaction culture tags (deduplicated)
    const parentTags = parent.culture_tags?.map((t) => t.value) || [];
    const subfactionTags = subfaction.culture_tags?.map((t) => t.value) || [];
    const combined = [...new Set([...parentTags, ...subfactionTags])];

    return combined.map((value) => ({ value }));
}

/**
 * Check if a faction is a subfaction
 */
export function isSubfaction(faction: FactionData): boolean {
    return !!faction.parent_faction;
}

/**
 * Get all subfactions of a faction
 */
export function getSubfactions(faction: FactionData, allFactions: FactionData[]): FactionData[] {
    return allFactions.filter((f) => f.parent_faction === faction.name);
}

/**
 * Get the root parent of a subfaction (traverse up hierarchy)
 */
export function getRootParent(faction: FactionData, allFactions: FactionData[]): FactionData {
    if (!faction.parent_faction) {
        return faction; // Already a root faction
    }

    let current = faction;
    const visited = new Set<string>([faction.name]); // Prevent infinite loops

    while (current.parent_faction) {
        const parent = allFactions.find((f) => f.name === current.parent_faction);
        if (!parent || visited.has(parent.name)) {
            // Parent not found or cycle detected - return current as root
            return current;
        }
        visited.add(parent.name);
        current = parent;
    }

    return current;
}

/**
 * Get all factions in a hierarchy (root + all descendants)
 */
export function getHierarchy(rootFaction: FactionData, allFactions: FactionData[]): FactionData[] {
    const hierarchy: FactionData[] = [rootFaction];
    const queue: FactionData[] = [rootFaction];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const children = getSubfactions(current, allFactions);
        hierarchy.push(...children);
        queue.push(...children);
    }

    return hierarchy;
}

/**
 * Calculate combined resources across entire hierarchy
 */
export function getHierarchyResources(rootFaction: FactionData, allFactions: FactionData[]): FactionResources {
    const hierarchy = getHierarchy(rootFaction, allFactions);
    const combined: FactionResources = {};

    for (const faction of hierarchy) {
        if (!faction.resources) continue;

        const keys = Object.keys(faction.resources) as Array<keyof FactionResources>;
        for (const key of keys) {
            const value = faction.resources[key];
            if (typeof value === "number") {
                combined[key] = (combined[key] || 0) + value;
            }
        }
    }

    return combined;
}

/**
 * Transfer resources from parent to subfaction
 */
export function transferResources(
    from: FactionData,
    to: FactionData,
    resources: Partial<FactionResources>
): { success: boolean; error?: string } {
    if (!from.resources) {
        return { success: false, error: "Parent has no resources" };
    }

    const fromResources = from.resources;
    const toResources = to.resources || {};

    // Validate from has enough resources
    const resourceKeys = Object.keys(resources) as Array<keyof FactionResources>;
    for (const key of resourceKeys) {
        const amount = resources[key];
        if (typeof amount === "number") {
            const available = fromResources[key] || 0;
            if (available < amount) {
                return {
                    success: false,
                    error: `Insufficient ${key}: has ${available}, needs ${amount}`,
                };
            }
        }
    }

    // Transfer resources
    for (const key of resourceKeys) {
        const amount = resources[key];
        if (typeof amount === "number") {
            fromResources[key] = (fromResources[key] || 0) - amount;
            toResources[key] = (toResources[key] || 0) + amount;
        }
    }

    to.resources = toResources;
    return { success: true };
}
