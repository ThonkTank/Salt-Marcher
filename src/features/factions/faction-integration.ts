/**
 * Faction Integration (Phase 8.4 - Full Implementation)
 *
 * Integration points between faction system and encounters/calendar/map.
 *
 * Features:
 * - Full YAML parsing for faction data (members, resources, relationships)
 * - Coordinate conversion: cube {q,r,s} → axial {q,r} → oddr {r,c}
 * - POI→coordinate lookup via callback function
 * - Calendar date integration for simulation timing
 * - Persistence: Simulation results saved back to faction files
 * - Event generation for calendar inbox
 */

import type { App, TFile } from "obsidian";
import * as yaml from "js-yaml";
import type { FactionData, FactionMember } from "../../workmodes/library/factions/types";
import type { SimulationTick, FactionSimulationResult } from "./faction-simulation";
import type { LocationMarker } from "../maps/state/location-marker-store";
import { simulateFactionTick } from "./faction-simulation";
import { factionToMarkdown } from "../../workmodes/library/factions/serializer";
import { logger } from "../../app/plugin-logger";
import { cubeToAxial } from "../maps/rendering/core/hex-geom";
import type { Coord } from "../maps/rendering/core/hex-geom";

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
 * @param app - Obsidian App instance
 * @param poiLookup - Optional function to resolve POI names to coordinates
 *
 * @example
 * const camps = await getAllFactionCamps(app, (poiName) => {
 *   const marker = locationMarkerStore.getByLocationName(poiName);
 *   return marker?.coord;
 * });
 * locationMarkerStore.setMarkers(camps);
 */
export async function getAllFactionCamps(
    app: App,
    poiLookup?: (poiName: string) => Coord | null,
): Promise<LocationMarker[]> {
    const markers: LocationMarker[] = [];

    try {
        const factions = await loadAllFactions(app);

        for (const faction of factions) {
            const factionMarkers = extractCampsFromFaction(faction, poiLookup);
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
 * @param app - Obsidian App instance
 * @param calendarDate - Current calendar date (YYYY-MM-DD format)
 * @param elapsedDays - Number of days that have passed since last simulation (default: 1)
 *
 * @example
 * const result = await runDailyFactionSimulation(app, "1492-03-15", 1);
 * console.log(`Simulated ${result.factionsProcessed} factions`);
 * // Add result.events to calendar inbox
 */
export async function runDailyFactionSimulation(
    app: App,
    calendarDate?: string,
    elapsedDays: number = 1,
): Promise<{
    factionsProcessed: number;
    events: Array<{ title: string; description: string; importance: number; date: string }>;
    warnings: string[];
}> {
    const result = {
        factionsProcessed: 0,
        events: [] as Array<{ title: string; description: string; importance: number; date: string }>,
        warnings: [] as string[],
    };

    // Use provided date or fallback to current date
    const currentDate = calendarDate || new Date().toISOString().split("T")[0];

    try {
        const factions = await loadAllFactions(app);

        for (const faction of factions) {
            const tick: SimulationTick = {
                currentDate,
                elapsedDays,
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
                        date: currentDate,
                    });
                }
            }

            // Apply simulation results back to faction file
            try {
                await applySimulationResults(app, faction, simulationResult);
            } catch (error) {
                result.warnings.push(`Failed to persist ${faction.name}: ${error.message}`);
                logger.error("[faction-integration] Failed to persist faction changes", {
                    faction: faction.name,
                    error: error.message,
                });
            }
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
 *
 * @param faction - Faction data
 * @param poiLookup - Optional function to resolve POI names to coordinates
 */
function extractCampsFromFaction(
    faction: FactionData,
    poiLookup?: (poiName: string) => Coord | null,
): LocationMarker[] {
    const markers: LocationMarker[] = [];
    const campsByCoord = new Map<string, { coord: Coord; members: FactionMember[]; locationType: "hex" | "poi"; locationName?: string }>();

    // Group members by position
    for (const member of faction.members || []) {
        if (!member.position) continue;

        let coord: Coord | null = null;
        let locationType: "hex" | "poi" = "hex";
        let locationName: string | undefined;

        // Hex positions: convert cube → axial → oddr
        if (member.position.type === "hex" && member.position.coords) {
            const { q, r, s } = member.position.coords;
            // Validate cube coordinate constraint
            if (q + r + s !== 0) {
                logger.warn("[faction-integration] Invalid cube coordinate (q+r+s != 0)", {
                    faction: faction.name,
                    member: member.name,
                    coords: { q, r, s },
                });
                continue;
            }

            // Convert cube → axial → oddr
            const axial = cubeToAxial({ q, r, s });
            coord = axialToOddr(axial);
            locationType = "hex";
        }

        // POI positions: lookup coordinate from location marker store
        if (member.position.type === "poi" && member.position.location_name) {
            locationType = "poi";
            locationName = member.position.location_name;

            // Try to resolve POI to coordinate if lookup function provided
            if (poiLookup) {
                coord = poiLookup(member.position.location_name);
                if (!coord) {
                    logger.debug("[faction-integration] POI not found in location markers", {
                        faction: faction.name,
                        member: member.name,
                        poi: member.position.location_name,
                    });
                }
            } else {
                logger.debug("[faction-integration] POI position skipped (no lookup function)", {
                    faction: faction.name,
                    member: member.name,
                    poi: member.position.location_name,
                });
            }

            // Skip if we couldn't resolve the coordinate
            if (!coord) continue;
        }

        if (coord) {
            const key = `${coord.r}:${coord.c}`;
            if (!campsByCoord.has(key)) {
                campsByCoord.set(key, { coord, members: [], locationType, locationName });
            }
            campsByCoord.get(key)!.members.push(member);
        }
    }

    // Create markers for camps (3+ members)
    for (const { coord, members, locationType, locationName } of campsByCoord.values()) {
        const totalMembers = members.reduce((sum, m) => sum + (m.quantity || 1), 0);
        if (totalMembers < 3) continue; // Skip small patrols

        const marker: LocationMarker = {
            coord,
            locationName: locationName || `${faction.name} Camp`,
            locationType: "Camp",
            icon: "⛺",
            ownerType: "faction",
            ownerName: faction.name,
        };

        markers.push(marker);
    }

    return markers;
}

/**
 * Convert axial coordinates to odd-r coordinates
 * (Inline copy from hex-geom.ts to avoid circular dependencies)
 */
function axialToOddr(ax: { q: number; r: number }): Coord {
    const parity = ax.r & 1;
    const c = ax.q + ((ax.r - parity) / 2);
    return { r: ax.r, c: Math.round(c) };
}

/**
 * Apply simulation results to a faction and persist changes to file
 *
 * @param app - Obsidian App instance
 * @param faction - Faction data (with updated resources/members from simulation)
 * @param simulationResult - Simulation result containing changes
 */
async function applySimulationResults(
    app: App,
    faction: FactionData,
    simulationResult: FactionSimulationResult,
): Promise<void> {
    // Find faction file
    const factionFile = await findFactionFile(app, faction.name);
    if (!factionFile) {
        throw new Error(`Faction file not found: ${faction.name}`);
    }

    // Read current content
    const content = await app.vault.read(factionFile);
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
        throw new Error(`Invalid faction file format: ${factionFile.path}`);
    }

    // Apply resource changes from simulation
    const updatedFaction: FactionData = {
        ...faction,
    };

    // Apply resource changes
    if (Object.keys(simulationResult.resourceChanges).length > 0) {
        updatedFaction.resources = {
            ...faction.resources,
        };
        for (const [key, delta] of Object.entries(simulationResult.resourceChanges)) {
            if (delta !== undefined) {
                const current = updatedFaction.resources[key] || 0;
                updatedFaction.resources[key] = current + delta;
            }
        }
    }

    // Apply member changes
    if (updatedFaction.members) {
        // Remove members that died/left
        updatedFaction.members = updatedFaction.members.filter(
            m => !simulationResult.removedMembers.includes(m.name)
        );
        // Add new members
        updatedFaction.members.push(...simulationResult.newMembers);
        // Update job completion (clear completed jobs)
        for (const completedJob of simulationResult.completedJobs) {
            const member = updatedFaction.members.find(
                m => m.job?.type === completedJob.type && m.job?.building === completedJob.building
            );
            if (member) {
                delete member.job;
            }
        }
    }

    // Serialize to YAML + Markdown
    const yamlFrontmatter = yaml.dump(updatedFaction, { lineWidth: -1, noRefs: true });
    const markdownBody = factionToMarkdown(updatedFaction);
    const newContent = `---\n${yamlFrontmatter}---\n\n${markdownBody}`;

    // Write back to file
    await app.vault.modify(factionFile, newContent);

    try {
        logger.debug("[faction-integration] Persisted faction changes", {
            faction: faction.name,
            file: factionFile.path,
        });
    } catch {
        // logger.debug might not be available in test environment
    }
}

/**
 * Find faction file by name
 */
async function findFactionFile(app: App, factionName: string): Promise<TFile | null> {
    const files = app.vault.getMarkdownFiles();
    const factionFiles = files.filter(f =>
        f.path.startsWith("SaltMarcher/Factions/") &&
        !f.path.includes("Presets")
    );

    for (const file of factionFiles) {
        const content = await app.vault.read(file);
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;

        const parsed = yaml.load(fmMatch[1]) as any;
        if (parsed && parsed.name === factionName) {
            return file;
        }
    }

    return null;
}

/**
 * Load all factions from Library
 *
 * Parses YAML frontmatter from faction markdown files and deserializes into FactionData.
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

                // Parse YAML frontmatter
                const parsed = yaml.load(fm) as any;
                if (!parsed || typeof parsed !== "object") continue;

                // Validate required fields
                if (!parsed.name || typeof parsed.name !== "string") {
                    logger.warn("[faction-integration] Faction missing name field", {
                        file: file.path,
                    });
                    continue;
                }

                // Deserialize into FactionData
                const faction: FactionData = {
                    name: parsed.name,
                    motto: parsed.motto,
                    headquarters: parsed.headquarters,
                    territory: parsed.territory,
                    influence_tags: parsed.influence_tags,
                    culture_tags: parsed.culture_tags,
                    goal_tags: parsed.goal_tags,
                    summary: parsed.summary,
                    resources: parsed.resources,
                    faction_relationships: parsed.faction_relationships,
                    members: parsed.members,
                };

                factions.push(faction);
            } catch (error) {
                logger.warn("[faction-integration] Error loading faction file", {
                    file: file.path,
                    error: error.message,
                });
            }
        }

        try {
            logger.debug("[faction-integration] Loaded factions", {
                count: factions.length,
                factions: factions.map(f => f.name),
            });
        } catch {
            // logger.debug might not be available in test environment
        }
    } catch (error) {
        logger.error("[faction-integration] Error loading factions", {
            error: error.message,
        });
    }

    return factions;
}
