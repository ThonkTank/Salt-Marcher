// src/workmodes/library/locations/tree-builder.ts
// Builds hierarchical tree structure from flat location list

import type { LocationData } from './calendar-types';

export interface LocationTreeNode {
    location: LocationData;
    children: LocationTreeNode[];
    depth: number;
}

/**
 * Builds a hierarchical tree from a flat list of locations.
 * Handles cycles, orphans, and missing parents gracefully.
 *
 * @param locations - Flat list of all locations
 * @returns Array of root nodes (locations without parents or with missing parents)
 */
export function buildLocationTree(locations: LocationData[]): LocationTreeNode[] {
    // Create a map of location name → location data for quick lookup
    const locationMap = new Map<string, LocationData>();
    for (const loc of locations) {
        locationMap.set(loc.name, loc);
    }

    // Helper to check if a location is part of a cycle
    function isInCycle(locName: string): boolean {
        const visited = new Set<string>();
        let current = locName;

        while (current) {
            if (visited.has(current)) {
                return true; // Cycle detected
            }
            visited.add(current);

            const loc = locationMap.get(current);
            if (!loc || !loc.parent || loc.parent.trim() === "") {
                return false; // Reached root
            }

            current = loc.parent;
        }

        return false;
    }

    // Create a map of parent name → child locations
    const childrenMap = new Map<string, LocationData[]>();
    const roots: LocationData[] = [];

    for (const loc of locations) {
        if (!loc.parent || loc.parent.trim() === "") {
            // No parent → this is a root node
            roots.push(loc);
        } else if (!locationMap.has(loc.parent)) {
            // Parent doesn't exist → treat as orphan (root)
            roots.push(loc);
        } else if (isInCycle(loc.name)) {
            // Part of a cycle → treat as root to break the cycle
            roots.push(loc);
        } else {
            // Valid parent → add to children map
            if (!childrenMap.has(loc.parent)) {
                childrenMap.set(loc.parent, []);
            }
            childrenMap.get(loc.parent)!.push(loc);
        }
    }

    // Recursive function to build tree nodes
    function buildNode(loc: LocationData, depth: number, visited: Set<string>): LocationTreeNode | null {
        // Cycle detection: if we've already visited this node in the current path, skip it
        if (visited.has(loc.name)) {
            return null;
        }

        visited.add(loc.name);

        const children: LocationTreeNode[] = [];
        const childLocations = childrenMap.get(loc.name) || [];

        for (const child of childLocations) {
            const childNode = buildNode(child, depth + 1, new Set(visited));
            if (childNode !== null) {
                children.push(childNode);
            }
        }

        return {
            location: loc,
            children,
            depth,
        };
    }

    // Build tree nodes for all roots
    const treeNodes: LocationTreeNode[] = [];
    for (const root of roots) {
        const node = buildNode(root, 0, new Set());
        if (node !== null) {
            treeNodes.push(node);
        }
    }

    return treeNodes;
}

/**
 * Flattens a tree into a depth-first ordered list.
 * Useful for rendering in list view with indentation.
 */
export function flattenTree(nodes: LocationTreeNode[]): LocationTreeNode[] {
    const result: LocationTreeNode[] = [];

    function traverse(node: LocationTreeNode) {
        result.push(node);
        for (const child of node.children) {
            traverse(child);
        }
    }

    for (const node of nodes) {
        traverse(node);
    }

    return result;
}

/**
 * Finds a node in the tree by location name.
 */
export function findNodeByName(nodes: LocationTreeNode[], name: string): LocationTreeNode | null {
    for (const node of nodes) {
        if (node.location.name === name) {
            return node;
        }
        const found = findNodeByName(node.children, name);
        if (found !== null) {
            return found;
        }
    }
    return null;
}

/**
 * Builds a breadcrumb path from root to a given location.
 * Returns array of location names from root to target.
 */
export function buildBreadcrumbs(locations: LocationData[], targetName: string): string[] {
    const locationMap = new Map<string, LocationData>();
    for (const loc of locations) {
        locationMap.set(loc.name, loc);
    }

    const path: string[] = [];
    let current = locationMap.get(targetName);

    // Traverse upwards until we reach a root (no parent)
    const visited = new Set<string>();
    while (current && !visited.has(current.name)) {
        visited.add(current.name);
        path.unshift(current.name);

        if (!current.parent || current.parent.trim() === "") {
            break;
        }

        current = locationMap.get(current.parent);
    }

    return path;
}
