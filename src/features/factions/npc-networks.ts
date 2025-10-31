/**
 * Complex NPC Networks - Dynamic Relationship Graphs Between NPCs
 *
 * Phase 8.7: Enables tracking of personal relationships between individual NPCs
 * across factions, creating a dynamic social network that affects diplomacy,
 * betrayals, and story events.
 */

import type { FactionData, FactionMember, NPCPersonality } from "../../workmodes/library/factions/types";

// ============================================================================
// NPC Relationship Types
// ============================================================================

/**
 * Relationship between two NPCs
 */
export interface NPCRelationship {
    /** Source NPC name */
    source: string;
    /** Target NPC name */
    target: string;
    /** Relationship type */
    type: "friend" | "rival" | "mentor" | "student" | "family" | "lover" | "enemy" | "ally" | "colleague";
    /** Relationship strength (-100 to +100) */
    strength: number;
    /** History of interactions */
    history?: string[];
    /** Shared secrets */
    shared_secrets?: string[];
    /** Last interaction date */
    last_interaction?: string;
}

/**
 * Network graph containing all NPC relationships
 */
export interface NPCNetwork {
    /** All relationships in the network */
    relationships: NPCRelationship[];
    /** Relationship clusters (groups of closely connected NPCs) */
    clusters?: NPCCluster[];
}

/**
 * Cluster of closely connected NPCs
 */
export interface NPCCluster {
    /** Cluster ID */
    id: string;
    /** NPCs in this cluster */
    members: string[];
    /** Average relationship strength within cluster */
    cohesion: number;
    /** Cluster type */
    type: "cabal" | "friendship_circle" | "family_unit" | "professional_network" | "conspiracy";
}

// ============================================================================
// Relationship Management
// ============================================================================

/**
 * Create a new relationship between two NPCs
 */
export function createNPCRelationship(
    network: NPCNetwork,
    source: string,
    target: string,
    type: NPCRelationship["type"],
    strength: number,
): NPCRelationship {
    const relationship: NPCRelationship = {
        source,
        target,
        type,
        strength: Math.max(-100, Math.min(100, strength)),
        history: [],
        shared_secrets: [],
        last_interaction: new Date().toISOString().split("T")[0],
    };

    network.relationships.push(relationship);
    return relationship;
}

/**
 * Get all relationships for a specific NPC
 */
export function getNPCRelationships(network: NPCNetwork, npcName: string): NPCRelationship[] {
    return network.relationships.filter(
        (r) => r.source === npcName || r.target === npcName,
    );
}

/**
 * Get relationship between two specific NPCs
 */
export function getRelationshipBetween(
    network: NPCNetwork,
    npc1: string,
    npc2: string,
): NPCRelationship | undefined {
    return network.relationships.find(
        (r) =>
            (r.source === npc1 && r.target === npc2) ||
            (r.source === npc2 && r.target === npc1),
    );
}

/**
 * Update relationship strength based on interaction
 */
export function updateRelationshipStrength(
    relationship: NPCRelationship,
    delta: number,
    reason?: string,
): void {
    relationship.strength = Math.max(-100, Math.min(100, relationship.strength + delta));
    relationship.last_interaction = new Date().toISOString().split("T")[0];

    if (reason) {
        relationship.history = relationship.history || [];
        relationship.history.push(`${new Date().toISOString().split("T")[0]}: ${reason}`);

        // Keep only last 10 history entries
        if (relationship.history.length > 10) {
            relationship.history = relationship.history.slice(-10);
        }
    }
}

/**
 * Share a secret between two NPCs
 */
export function shareSecret(
    relationship: NPCRelationship,
    secret: string,
): { success: boolean; error?: string } {
    if (relationship.strength < 20) {
        return { success: false, error: "Relationship not strong enough to share secrets" };
    }

    relationship.shared_secrets = relationship.shared_secrets || [];
    relationship.shared_secrets.push(secret);

    // Sharing secrets strengthens relationship
    updateRelationshipStrength(relationship, 5, "Shared a secret");

    return { success: true };
}

// ============================================================================
// Network Analysis
// ============================================================================

/**
 * Find all friends of a specific NPC (strength >= 40)
 */
export function getFriends(network: NPCNetwork, npcName: string): string[] {
    const relationships = getNPCRelationships(network, npcName);
    return relationships
        .filter((r) => r.strength >= 40)
        .map((r) => (r.source === npcName ? r.target : r.source));
}

/**
 * Find all enemies of a specific NPC (strength <= -40)
 */
export function getEnemies(network: NPCNetwork, npcName: string): string[] {
    const relationships = getNPCRelationships(network, npcName);
    return relationships
        .filter((r) => r.strength <= -40)
        .map((r) => (r.source === npcName ? r.target : r.source));
}

/**
 * Calculate influence of an NPC based on network position
 */
export function calculateNPCInfluence(network: NPCNetwork, npcName: string): number {
    const relationships = getNPCRelationships(network, npcName);

    if (relationships.length === 0) return 0;

    // Influence = number of connections × average relationship strength
    const totalStrength = relationships.reduce((sum, r) => sum + Math.abs(r.strength), 0);
    const avgStrength = totalStrength / relationships.length;

    return relationships.length * (avgStrength / 100);
}

/**
 * Find mutual friends between two NPCs
 */
export function findMutualFriends(
    network: NPCNetwork,
    npc1: string,
    npc2: string,
): string[] {
    const friends1 = new Set(getFriends(network, npc1));
    const friends2 = new Set(getFriends(network, npc2));

    return Array.from(friends1).filter((f) => friends2.has(f));
}

/**
 * Calculate "degrees of separation" between two NPCs
 */
export function calculateSeparation(
    network: NPCNetwork,
    npc1: string,
    npc2: string,
): number | null {
    const visited = new Set<string>();
    const queue: { npc: string; depth: number }[] = [{ npc: npc1, depth: 0 }];

    while (queue.length > 0) {
        const current = queue.shift()!;

        if (current.npc === npc2) {
            return current.depth;
        }

        if (visited.has(current.npc)) continue;
        visited.add(current.npc);

        // Add all connected NPCs to queue
        const connections = getNPCRelationships(network, current.npc);
        for (const rel of connections) {
            const next = rel.source === current.npc ? rel.target : rel.source;
            if (!visited.has(next)) {
                queue.push({ npc: next, depth: current.depth + 1 });
            }
        }
    }

    return null; // Not connected
}

// ============================================================================
// Cluster Detection
// ============================================================================

/**
 * Detect clusters of closely connected NPCs
 */
export function detectClusters(network: NPCNetwork, minClusterSize: number = 3): NPCCluster[] {
    const clusters: NPCCluster[] = [];
    const assigned = new Set<string>();

    // Get all unique NPCs in the network
    const allNPCs = new Set<string>();
    network.relationships.forEach((r) => {
        allNPCs.add(r.source);
        allNPCs.add(r.target);
    });

    // For each unassigned NPC, try to build a cluster
    for (const npc of allNPCs) {
        if (assigned.has(npc)) continue;

        const cluster = buildCluster(network, npc, assigned);

        if (cluster.length >= minClusterSize) {
            const cohesion = calculateClusterCohesion(network, cluster);
            const type = determineClusterType(network, cluster);

            clusters.push({
                id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                members: cluster,
                cohesion,
                type,
            });

            cluster.forEach((member) => assigned.add(member));
        }
    }

    return clusters;
}

/**
 * Build a cluster starting from a seed NPC
 */
function buildCluster(network: NPCNetwork, seed: string, assigned: Set<string>): string[] {
    const cluster = new Set<string>([seed]);
    const candidates = new Set<string>();

    // Get all strong relationships (>= 40) for seed
    const seedRels = getNPCRelationships(network, seed);
    seedRels.forEach((r) => {
        if (r.strength >= 40) {
            const other = r.source === seed ? r.target : r.source;
            if (!assigned.has(other)) {
                candidates.add(other);
            }
        }
    });

    // Expand cluster with candidates that have strong connections to cluster members
    for (const candidate of candidates) {
        let strongConnections = 0;

        for (const member of cluster) {
            const rel = getRelationshipBetween(network, candidate, member);
            if (rel && rel.strength >= 40) {
                strongConnections++;
            }
        }

        // Add to cluster if connected to at least 50% of members
        if (strongConnections >= cluster.size * 0.5) {
            cluster.add(candidate);
        }
    }

    return Array.from(cluster);
}

/**
 * Calculate cohesion (average relationship strength) within a cluster
 */
function calculateClusterCohesion(network: NPCNetwork, cluster: string[]): number {
    let totalStrength = 0;
    let count = 0;

    for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
            const rel = getRelationshipBetween(network, cluster[i], cluster[j]);
            if (rel) {
                totalStrength += rel.strength;
                count++;
            }
        }
    }

    return count > 0 ? totalStrength / count : 0;
}

/**
 * Determine cluster type based on relationships
 */
function determineClusterType(network: NPCNetwork, cluster: string[]): NPCCluster["type"] {
    const relationships = cluster.flatMap((npc) =>
        getNPCRelationships(network, npc).filter((r) =>
            cluster.includes(r.source) && cluster.includes(r.target),
        ),
    );

    const familyCount = relationships.filter((r) => r.type === "family").length;
    const rivalCount = relationships.filter((r) => r.type === "rival" || r.type === "enemy").length;
    const colleagueCount = relationships.filter((r) => r.type === "colleague").length;
    const friendCount = relationships.filter((r) => r.type === "friend").length;

    if (familyCount > relationships.length * 0.4) return "family_unit";
    if (rivalCount > relationships.length * 0.3) return "conspiracy";
    if (colleagueCount > relationships.length * 0.4) return "professional_network";
    if (friendCount > relationships.length * 0.5) return "friendship_circle";

    // Check for high cohesion + secrecy (cabal)
    const cohesion = calculateClusterCohesion(network, cluster);
    const hasSharedSecrets = relationships.some((r) => r.shared_secrets && r.shared_secrets.length > 0);

    if (cohesion > 70 && hasSharedSecrets) return "cabal";

    return "friendship_circle"; // Default
}

// ============================================================================
// Cross-Faction Network Effects
// ============================================================================

/**
 * Find NPCs with cross-faction relationships
 */
export function findCrossFactionRelationships(
    network: NPCNetwork,
    factions: FactionData[],
): { npc1: string; faction1: string; npc2: string; faction2: string; relationship: NPCRelationship }[] {
    const results: ReturnType<typeof findCrossFactionRelationships> = [];

    // Build NPC→Faction mapping
    const npcToFaction = new Map<string, string>();
    for (const faction of factions) {
        if (faction.members) {
            for (const member of faction.members) {
                if (member.is_named) {
                    npcToFaction.set(member.name, faction.name);
                }
            }
        }
    }

    // Find relationships that cross faction boundaries
    for (const rel of network.relationships) {
        const faction1 = npcToFaction.get(rel.source);
        const faction2 = npcToFaction.get(rel.target);

        if (faction1 && faction2 && faction1 !== faction2) {
            results.push({
                npc1: rel.source,
                faction1,
                npc2: rel.target,
                faction2,
                relationship: rel,
            });
        }
    }

    return results;
}

/**
 * Calculate faction diplomacy influence from NPC relationships
 */
export function calculateDiplomacyInfluence(
    network: NPCNetwork,
    faction1Name: string,
    faction2Name: string,
    factions: FactionData[],
): number {
    const faction1 = factions.find((f) => f.name === faction1Name);
    const faction2 = factions.find((f) => f.name === faction2Name);

    if (!faction1 || !faction2) return 0;

    const npcs1 = faction1.members?.filter((m) => m.is_named).map((m) => m.name) || [];
    const npcs2 = faction2.members?.filter((m) => m.is_named).map((m) => m.name) || [];

    let totalInfluence = 0;
    let count = 0;

    // Check all cross-faction relationships
    for (const npc1 of npcs1) {
        for (const npc2 of npcs2) {
            const rel = getRelationshipBetween(network, npc1, npc2);
            if (rel) {
                totalInfluence += rel.strength;
                count++;
            }
        }
    }

    return count > 0 ? totalInfluence / count : 0;
}

// ============================================================================
// Event Generation
// ============================================================================

/**
 * Generate plot hooks from NPC network dynamics
 */
export function generateNetworkEvents(
    network: NPCNetwork,
    factions: FactionData[],
): Array<{
    type: "love_triangle" | "betrayal_brewing" | "secret_exposed" | "alliance_forming" | "feud_escalating";
    npcs: string[];
    description: string;
    urgency: number;
}> {
    const events: ReturnType<typeof generateNetworkEvents> = [];

    // Love triangles (two people like same person)
    const allNPCs = new Set<string>();
    network.relationships.forEach((r) => {
        allNPCs.add(r.source);
        allNPCs.add(r.target);
    });

    for (const target of allNPCs) {
        const admirers = network.relationships.filter(
            (r) =>
                r.target === target &&
                (r.type === "lover" || r.type === "friend") &&
                r.strength >= 60,
        );

        if (admirers.length >= 2) {
            events.push({
                type: "love_triangle",
                npcs: [admirers[0].source, admirers[1].source, target],
                description: `${admirers[0].source} and ${admirers[1].source} both have strong feelings for ${target}`,
                urgency: 2,
            });
        }
    }

    // Betrayals brewing (low trust + high ambition + enemy relationship)
    for (const faction of factions) {
        if (!faction.members) continue;

        for (const member of faction.members) {
            if (!member.is_named || !member.personality) continue;

            const personality = member.personality;
            const trust = personality.trust ?? 50;
            const ambition = personality.ambition ?? 50;

            if (trust < 30 && ambition > 70) {
                const enemies = getEnemies(network, member.name);
                if (enemies.length > 0) {
                    events.push({
                        type: "betrayal_brewing",
                        npcs: [member.name, ...enemies.slice(0, 2)],
                        description: `${member.name} has low loyalty and high ambition, and has enemies within the faction`,
                        urgency: 4,
                    });
                }
            }
        }
    }

    // Secrets exposed (shared secrets + enemy relationship)
    for (const rel of network.relationships) {
        if (rel.shared_secrets && rel.shared_secrets.length > 0 && rel.strength < -20) {
            events.push({
                type: "secret_exposed",
                npcs: [rel.source, rel.target],
                description: `${rel.source} and ${rel.target} share secrets but have become enemies - blackmail or exposure likely`,
                urgency: 3,
            });
        }
    }

    // Alliances forming (mutual friends + cross-faction)
    const crossFaction = findCrossFactionRelationships(network, factions);
    for (const cf of crossFaction) {
        const mutualFriends = findMutualFriends(network, cf.npc1, cf.npc2);
        if (mutualFriends.length >= 2 && cf.relationship.strength >= 60) {
            events.push({
                type: "alliance_forming",
                npcs: [cf.npc1, cf.npc2, ...mutualFriends.slice(0, 2)],
                description: `${cf.npc1} (${cf.faction1}) and ${cf.npc2} (${cf.faction2}) have strong ties and mutual friends - alliance possible`,
                urgency: 2,
            });
        }
    }

    // Feuds escalating (negative relationships getting worse)
    for (const rel of network.relationships) {
        if (rel.strength <= -60 && rel.history && rel.history.length > 3) {
            const recentNegative = rel.history
                .slice(-3)
                .every((h) => h.includes("conflict") || h.includes("insult") || h.includes("betrayal"));

            if (recentNegative) {
                events.push({
                    type: "feud_escalating",
                    npcs: [rel.source, rel.target],
                    description: `Feud between ${rel.source} and ${rel.target} is escalating rapidly - violence likely`,
                    urgency: 4,
                });
            }
        }
    }

    return events.sort((a, b) => b.urgency - a.urgency);
}
