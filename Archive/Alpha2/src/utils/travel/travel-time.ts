/**
 * Travel Time Calculation Utilities
 *
 * Pure functions for calculating travel duration based on route and terrain.
 *
 * @module utils/travel
 */

import type { Route } from '../../schemas/travel';
import type { TileData } from '../../schemas/map';
import type { CoordKey } from '../../schemas/geometry';
import type { TravelDuration } from '../../schemas/calendar';
import { coordToKey } from '../hex';
import {
	TERRAIN_TRAVEL_MULTIPLIERS,
	BASE_HEXES_PER_DAY,
	TRAVEL_HOURS_PER_DAY,
} from '../../constants/travel';

/**
 * Calculate travel time for a single hex based on terrain.
 * Returns time in days (fractional).
 */
export function calculateHexTravelTime(
	terrain: string,
	multipliers: Record<string, number> = TERRAIN_TRAVEL_MULTIPLIERS
): number {
	const multiplier = multipliers[terrain] ?? 1;
	const baseTimePerHex = 1 / BASE_HEXES_PER_DAY; // days per hex at normal pace
	return baseTimePerHex * multiplier;
}

/**
 * Calculate total travel time for a route.
 *
 * @param route - The route with path coordinates
 * @param tiles - Map of tiles with terrain data
 * @param multipliers - Optional custom terrain multipliers
 * @returns Total travel time in days (fractional)
 */
export function calculateRouteTravelTime(
	route: Route,
	tiles: Map<CoordKey, TileData>,
	multipliers: Record<string, number> = TERRAIN_TRAVEL_MULTIPLIERS
): number {
	if (route.path.length <= 1) return 0;

	let totalDays = 0;

	// Skip the first hex (starting position)
	for (let i = 1; i < route.path.length; i++) {
		const coord = route.path[i];
		const key = coordToKey(coord);
		const tile = tiles.get(key);
		const terrain = tile?.terrain ?? 'grassland';

		totalDays += calculateHexTravelTime(terrain, multipliers);
	}

	return totalDays;
}

/**
 * Convert fractional days to a TravelDuration object.
 */
export function daysToTravelDuration(totalDays: number): TravelDuration {
	const wholeDays = Math.floor(totalDays);
	const fractionalDay = totalDays - wholeDays;
	const hours = Math.round(fractionalDay * TRAVEL_HOURS_PER_DAY);

	return {
		totalDays,
		days: wholeDays,
		hours: hours >= TRAVEL_HOURS_PER_DAY ? 0 : hours, // Handle rounding edge case
	};
}

/**
 * Convert TravelDuration to total hours.
 * Inverse of daysToTravelDuration (approximately).
 */
export function travelDurationToHours(duration: TravelDuration): number {
	return duration.days * TRAVEL_HOURS_PER_DAY + duration.hours;
}

/**
 * Calculate travel time and return as TravelDuration.
 */
export function calculateTravelDuration(
	route: Route,
	tiles: Map<CoordKey, TileData>,
	multipliers?: Record<string, number>
): TravelDuration {
	const totalDays = calculateRouteTravelTime(route, tiles, multipliers);
	return daysToTravelDuration(totalDays);
}
