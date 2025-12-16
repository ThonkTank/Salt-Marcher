/**
 * Map Logic Service
 *
 * Pure map creation functions.
 *
 * @module services/map/map-logic
 */

import type { MapData } from '../../schemas';
import { createEmptyMap } from '../../utils/map';

/**
 * Create a new map (pure, no storage).
 */
export function createNewMap(name: string, radius: number, hexSize?: number): MapData {
	return createEmptyMap(name, radius, hexSize);
}
