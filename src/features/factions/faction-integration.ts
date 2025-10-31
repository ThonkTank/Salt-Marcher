/**
 * Faction Integration (Phase 8.3 - Stub Implementation)
 *
 * Integration points between faction system and encounters/calendar/map.
 * Current implementation provides architectural stubs with TODO markers for full integration.
 *
 * TODO: Full implementations require:
 * - Proper YAML parsing for faction loading
 * - Coordinate conversion (cube {q,r,s} → axial {r,c})
 * - Location lookup for POI coordinates
 * - Calendar timestamp math
 * - Event inbox integration
 */

import type { App } from "obsidian";
import type { FactionData, FactionMember } from "../../workmodes/library/factions/types";
import type { SimulationTick, FactionSimulationResult } from "./faction-simulation";
import type { LocationMarker } from "../maps/state/location-marker-store";
import { simulateFactionTick } from "./faction-simulation";
import { logger } from "../../app/plugin-logger";

/**
 * Get faction members present at a hex coordinate (for random encounters)
 *
 * Usage: Call this when generating random encounters to check if faction members
 * are present at the encounter location.
 *
 * @example
 * const factionMembers = await getFactionMembersAtHex(app, { q: 5, r: -3, s: -2 });
 * for (const { faction, members } of factionMembers) {
 *   console.log(`${faction.name} has ${members.length} members here`);
 * }
 */
export async function getFactionMembersAtHex(
    app: App,
    hexCoord: { q: number; r: number; s: number },
): Promise<Array<{ faction: FactionData; members: FactionMember[] }>> {
    const results: Array<{ faction: FactionData; members: FactionMember[] }> = [];

    try {
        const factions = await loadAllFactions(app);

        for (const faction of factions) {
            const membersAtHex = (faction.members || []).filter(member => {
                if (!member.position || member.position.type !== "hex") return false;
                const pos = member.position.coords;
                if (!pos) return false;
                return pos.q === hexCoord.q && pos.r === hexCoord.r && pos.s === hexCoord.s;
            });

            if (membersAtHex.length > 0) {
                results.push({ faction, members: membersAtHex });
            }
        }
    } catch (error) {
        logger.error("[faction-integration] Error loading faction members at hex", {
            hexCoord,
            error: error.message,
        });
    }

    return results;
}

/**
 * Get all faction camps as location markers (for map visualization)
 *
 * Usage: Call this to get all faction camps/POIs to display on the cartographer map.
 *
 * @example
 * const camps = await getAllFactionCamps(app);
 * locationMarkerStore.setMarkers(camps);
 */
export async function getAllFactionCamps(app: App): Promise<LocationMarker[]> {
    const markers: LocationMarker[] = [];

    try {
        const factions = await loadAllFactions(app);

        for (const faction of factions) {
            const factionMarkers = extractCampsFromFaction(faction);
            markers.push(...factionMarkers);
        }
    } catch (error) {
        logger.error("[faction-integration] Error loading faction camps", {
            error: error.message,
        });
    }

    return markers;
}

/**
 * Run faction simulation for one day (for calendar integration)
 *
 * Usage: Call this when calendar advances to simulate faction activities.
 *
 * @example
 * const result = await runDailyFactionSimulation(app);
 * console.log(`Simulated ${result.factionsProcessed} factions`);
 * // Add result.events to calendar inbox
 */
export async function runDailyFactionSimulation(app: App): Promise<{
    factionsProcessed: number;
    events: Array<{ title: string; description: string; importance: number }>;
    warnings: string[];
}> {
    const result = {
        factionsProcessed: 0,
        events: [] as Array<{ title: string; description: string; importance: number }>,
        warnings: [] as string[],
    };

    try {
        const factions = await loadAllFactions(app);

        for (const faction of factions) {
            const tick: SimulationTick = {
                currentDate: new Date().toISOString().split("T")[0], // TODO: Use calendar timestamp
                elapsedDays: 1, // TODO: Calculate from calendar advance
            };

            const simulationResult = await simulateFactionTick(faction, tick);
            result.factionsProcessed++;

            // Collect important events
            for (const event of simulationResult.events) {
                if (event.importance >= 4) {
                    result.events.push({
                        title: event.title,
                        description: event.description,
                        importance: event.importance,
                    });
                }
            }

            // TODO: Apply simulation results back to faction data
            // This requires:
            // 1. Load faction file
            // 2. Update resources/members
            // 3. Save using faction serializer
        }
    } catch (error) {
        const message = `Error running faction simulation: ${error.message}`;
        result.warnings.push(message);
        logger.error("[faction-integration]", { error: message });
    }

    return result;
}

/**
 * Extract camp location markers from faction data
 */
function extractCampsFromFaction(faction: FactionData): LocationMarker[] {
    const markers: LocationMarker[] = [];
    const campsByKey = new Map<string, FactionMember[]>();

    // Group members by position
    for (const member of faction.members || []) {
        if (!member.position) continue;

        let key: string | null = null;

        // Hex positions
        if (member.position.type === "hex" && member.position.coords) {
            const { q, r, s } = member.position.coords;
            key = `hex:${q},${r},${s}`;
        }

        // POI positions
        if (member.position.type === "poi" && member.position.location_name) {
            key = `poi:${member.position.location_name}`;
        }

        if (key) {
            if (!campsByKey.has(key)) {
                campsByKey.set(key, []);
            }
            campsByKey.get(key)!.push(member);
        }
    }

    // Create markers for camps (3+ members)
    for (const [key, members] of campsByKey.entries()) {
        const totalMembers = members.reduce((sum, m) => sum + (m.quantity || 1), 0);
        if (totalMembers < 3) continue; // Skip small patrols

        // TODO: Convert positions to {r, c} coordinates
        // For hex-based camps: Need cube→axial conversion
        // For POI-based camps: Need location→coordinate lookup
        logger.debug("[faction-integration] Camp found but coordinate conversion needed", {
            faction: faction.name,
            key,
            memberCount: totalMembers,
        });
    }

    return markers;
}

/**
 * Load all factions from Library
 *
 * TODO: This is a simplified loader. Full implementation needs:
 * - Proper YAML parsing (use yaml library)
 * - Complete FactionData deserialization
 * - Error handling for malformed files
 */
async function loadAllFactions(app: App): Promise<FactionData[]> {
    const factions: FactionData[] = [];

    try {
        const files = app.vault.getMarkdownFiles();
        const factionFiles = files.filter(f =>
            f.path.startsWith("SaltMarcher/Factions/") &&
            !f.path.includes("Presets")
        );

        for (const file of factionFiles) {
            try {
                const content = await app.vault.read(file);
                const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (!fmMatch) continue;

                const fm = fmMatch[1];
                if (!fm.includes("smType: faction")) continue;

                // Extract basic fields
                const nameMatch = fm.match(/^name:\s*(.+)$/m);
                if (!nameMatch) continue;

                // TODO: Parse full YAML frontmatter into FactionData
                // For now, create minimal faction data
                const faction: FactionData = {
                    name: nameMatch[1].trim(),
                    members: [], // TODO: Parse members array from YAML
                    resources: {}, // TODO: Parse resources
                    faction_relationships: [], // TODO: Parse relationships
                };

                factions.push(faction);
            } catch (error) {
                logger.warn("[faction-integration] Error loading faction file", {
                    file: file.path,
                    error: error.message,
                });
            }
        }

        logger.debug("[faction-integration] Loaded factions", {
            count: factions.length,
            factions: factions.map(f => f.name),
        });
    } catch (error) {
        logger.error("[faction-integration] Error loading factions", {
            error: error.message,
        });
    }

    return factions;
}
