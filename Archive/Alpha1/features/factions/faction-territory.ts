/**
 * Faction Territory Calculation
 *
 * Extracts territorial claims from faction member positions and converts them
 * to overlay assignments for map rendering.
 *
 * Flow: Faction Members (cube coords) → Territory Claims → Conflict Resolution → Overlay Assignments (axial coords)
 *
 * **Bug Fixes (2025-11-07):**
 * - Fixed import path (was ./faction-types, now ../../types)
 * - Fixed position access (member.position.coords, not member.position directly)
 * - Fixed conflict resolution (now actually applies resolveConflict before return)
 *
 * **Coordinate Migration (2025-11-27):**
 * - Migrated from odd-r to axial coordinates
 * - Removed axialToOddR conversion (now uses axial directly)
 * - Uses coordToKey() for consistent "q,r" key format
 */

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("faction-territory");
import { cubeToAxial, coordToKey } from "@geometry";
import type { FactionData } from "@services/domain";
import type { FactionOverlayAssignment } from "../maps/state/faction-overlay-store";

/**
 * Calculates faction territory claims from member positions.
 *
 * Processes all faction members, extracts their hex positions (cube coordinates),
 * converts to axial coordinates, and creates overlay assignments grouped by hex.
 *
 * **Coordinate Conversion**:
 * - Members use cube coords: `{q, r, s}` where `q+r+s=0`
 * - Overlays use axial coords: `{q, r}`
 * - Conversion: cube → axial
 *
 * **Strength Accumulation**:
 * - Multiple members on same hex → accumulate strength
 * - Each member = +1 strength (or +quantity for units)
 * - Used for overlay opacity/prominence
 *
 * **Conflict Resolution**:
 * - When multiple factions claim same hex, strongest faction wins
 * - Strength = sum of all member quantities on that hex
 * - Tie-breaker: alphabetical by faction ID
 *
 * @param factions - All factions to process
 * @returns Array of overlay assignments (one per hex, conflicts resolved)
 *
 * @example
 * ```typescript
 * const factions = await loadAllFactions(app);
 * const claims = calculateFactionTerritoryClaims(factions);
 * // claims = [
 * //   { coord: {q:5,r:10}, factionId:"faction-1", strength:3, ... },
 * //   { coord: {q:5,r:11}, factionId:"faction-2", strength:1, ... }
 * // ]
 * // Note: If both factions had members on (5,10), only strongest remains
 * ```
 */
export function calculateFactionTerritoryClaims(
	factions: readonly FactionData[]
): FactionOverlayAssignment[] {
	// Map to accumulate strength per hex per faction
	// Key format: "factionId:q,r"
	const strengthByHex = new Map<string, { factionId: string; coord: { q: number; r: number }; strength: number }>();

	for (const faction of factions) {
		if (!faction.members || faction.members.length === 0) continue;

		for (const member of faction.members) {
			// Skip members without position
			if (!member.position) continue;

			// Skip non-hex positions (POIs, expeditions, unassigned)
			if (member.position.type !== "hex" || !member.position.coords) continue;

			const { q, r, s } = member.position.coords;

			// Validate cube coordinates (must satisfy q+r+s=0)
			if (q + r + s !== 0) {
				logger.warn("Invalid cube coordinates", {
					factionName: faction.name,
					memberId: member.name,
					position: member.position,
				});
				continue;
			}

			// Convert: cube → axial
			const axial = cubeToAxial({ q, r, s });

			// Create accumulation key using standard coordinate key format
			const coordKey = coordToKey(axial);
			const key = `${faction.name}:${coordKey}`;

			// Accumulate strength
			const existing = strengthByHex.get(key);
			if (existing) {
				// Multiple members on same hex - increase strength
				existing.strength += member.quantity ?? 1;
			} else {
				// First member on this hex
				strengthByHex.set(key, {
					factionId: faction.name,
					coord: axial,
					strength: member.quantity ?? 1,
				});
			}
		}
	}

	// Group assignments by hex coordinate for conflict resolution
	const assignmentsByHex = new Map<string, FactionOverlayAssignment[]>();

	for (const claim of strengthByHex.values()) {
		const faction = factions.find((f) => f.name === claim.factionId);
		if (!faction) continue;

		const hexKey = coordToKey(claim.coord);
		const assignment: FactionOverlayAssignment = {
			coord: claim.coord,
			factionId: claim.factionId,
			factionName: faction.name,
			strength: claim.strength,
			// Color will be resolved by faction-overlay-store
			// Tags could be added for filtering/visualization
			sourceId: "faction-simulation",
		};

		const existing = assignmentsByHex.get(hexKey);
		if (existing) {
			existing.push(assignment);
		} else {
			assignmentsByHex.set(hexKey, [assignment]);
		}
	}

	// Resolve conflicts: strongest faction wins each hex
	const finalAssignments: FactionOverlayAssignment[] = [];
	let conflictCount = 0;

	for (const hexAssignments of assignmentsByHex.values()) {
		if (hexAssignments.length > 1) {
			conflictCount++;
		}

		const winner = resolveConflict(hexAssignments);
		if (winner) {
			finalAssignments.push(winner);
		}
	}

	logger.info("Calculated territory claims", {
		factionCount: factions.length,
		claimCount: finalAssignments.length,
		hexCount: assignmentsByHex.size,
		conflictsResolved: conflictCount,
	});

	return finalAssignments;
}

/**
 * Calculates faction territory claims for a single faction.
 *
 * Useful for incremental updates when only one faction changes.
 *
 * @param faction - The faction to process
 * @returns Array of overlay assignments for this faction
 */
export function calculateSingleFactionClaims(faction: FactionData): FactionOverlayAssignment[] {
	return calculateFactionTerritoryClaims([faction]);
}

/**
 * Filters territory claims by hex coordinate.
 *
 * Useful for finding all factions claiming a specific hex.
 *
 * @param claims - All territory claims
 * @param coord - The hex coordinate to filter by (axial)
 * @returns Array of claims for this hex
 */
export function getClaimsForHex(
	claims: readonly FactionOverlayAssignment[],
	coord: { q: number; r: number }
): FactionOverlayAssignment[] {
	return claims.filter((claim) => claim.coord.q === coord.q && claim.coord.r === coord.r);
}

/**
 * Resolves conflicts when multiple factions claim the same hex.
 *
 * Strategy: Strongest faction wins (highest strength value).
 * In case of tie, first faction alphabetically by ID.
 *
 * @param claims - All claims for a single hex
 * @returns The winning claim, or null if no claims
 */
export function resolveConflict(
	claims: readonly FactionOverlayAssignment[]
): FactionOverlayAssignment | null {
	if (claims.length === 0) return null;
	if (claims.length === 1) return claims[0];

	// Sort by strength (descending), then by faction ID (ascending)
	const sorted = [...claims].sort((a, b) => {
		if (b.strength !== a.strength) {
			return (b.strength ?? 0) - (a.strength ?? 0);
		}
		return a.factionId.localeCompare(b.factionId);
	});

	return sorted[0];
}
