/**
 * Collection Utilities
 *
 * Generic utilities for array and Map operations.
 *
 * @module utils/common/collection
 */

// ============================================================================
// Grouping Utilities
// ============================================================================

/**
 * Group items by a key derived from each item.
 * Generic replacement for manual Map-building loops.
 *
 * @param items - Array of items to group
 * @param keyFn - Function to extract group key from each item
 * @returns Map of keys to arrays of items
 *
 * @example
 * const creatures = [{ name: 'Goblin', cr: '1/4' }, { name: 'Orc', cr: '1/2' }];
 * const byCr = groupBy(creatures, c => c.cr);
 * // Map { '1/4' => [{ name: 'Goblin', cr: '1/4' }], '1/2' => [{ name: 'Orc', cr: '1/2' }] }
 */
export function groupBy<T, K extends string | number>(
	items: T[],
	keyFn: (item: T) => K
): Map<K, T[]> {
	const groups = new Map<K, T[]>();
	for (const item of items) {
		const key = keyFn(item);
		const existing = groups.get(key) ?? [];
		existing.push(item);
		groups.set(key, existing);
	}
	return groups;
}

/**
 * Group items with optional key (items with undefined keys are excluded).
 *
 * @param items - Array of items to group
 * @param keyFn - Function to extract optional group key
 * @returns Map of keys to arrays of items (excludes items with undefined key)
 *
 * @example
 * const items = [{ name: 'A', tag: 'x' }, { name: 'B' }, { name: 'C', tag: 'x' }];
 * const byTag = groupByOptional(items, i => i.tag);
 * // Map { 'x' => [{ name: 'A', tag: 'x' }, { name: 'C', tag: 'x' }] }
 */
export function groupByOptional<T, K extends string | number>(
	items: T[],
	keyFn: (item: T) => K | undefined
): Map<K, T[]> {
	const groups = new Map<K, T[]>();
	for (const item of items) {
		const key = keyFn(item);
		if (key === undefined) continue;
		const existing = groups.get(key) ?? [];
		existing.push(item);
		groups.set(key, existing);
	}
	return groups;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Remove duplicates from array based on key function.
 *
 * @example
 * const items = [{ id: 1, name: 'A' }, { id: 1, name: 'B' }, { id: 2, name: 'C' }];
 * uniqueBy(items, i => i.id); // [{ id: 1, name: 'A' }, { id: 2, name: 'C' }]
 */
export function uniqueBy<T, K>(items: T[], keyFn: (item: T) => K): T[] {
	const seen = new Set<K>();
	return items.filter((item) => {
		const key = keyFn(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Partition array into two based on predicate.
 *
 * @returns [matching, notMatching]
 *
 * @example
 * const [evens, odds] = partition([1, 2, 3, 4], n => n % 2 === 0);
 * // evens = [2, 4], odds = [1, 3]
 */
export function partition<T>(
	items: T[],
	predicate: (item: T) => boolean
): [T[], T[]] {
	const matching: T[] = [];
	const notMatching: T[] = [];
	for (const item of items) {
		if (predicate(item)) {
			matching.push(item);
		} else {
			notMatching.push(item);
		}
	}
	return [matching, notMatching];
}
