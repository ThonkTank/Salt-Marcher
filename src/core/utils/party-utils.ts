/**
 * Party Utilities - Health Summary Calculation
 *
 * Provides functions for calculating party health status.
 *
 * @see docs/features/Character-System.md
 * @see docs/application/SessionRunner.md#party-sektion
 */

import type { Character } from '@core/schemas';

// ============================================================================
// Types
// ============================================================================

/**
 * Health category for a single character.
 */
export type HealthCategory = 'ok' | 'wounded' | 'critical' | 'down';

/**
 * Summary of party health status.
 * Used by SessionRunner Party Section.
 */
export interface HealthSummary {
  /** Number of characters at full HP */
  ok: number;
  /** Number of characters above 25% HP but below max */
  wounded: number;
  /** Number of characters at or below 25% HP (but alive) */
  critical: number;
  /** Number of characters at 0 HP */
  down: number;
  /** Human-readable display string: "All OK", "1 Wounded", "2 Critical" */
  display: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * HP threshold for critical status (25% or less).
 */
const CRITICAL_THRESHOLD = 0.25;

// ============================================================================
// Functions
// ============================================================================

/**
 * Determine the health category of a single character.
 *
 * @param character - Character to categorize
 * @returns Health category
 */
export function getHealthCategory(character: Character): HealthCategory {
  const { currentHp, maxHp } = character;

  if (currentHp <= 0) {
    return 'down';
  }

  if (currentHp >= maxHp) {
    return 'ok';
  }

  const hpPercent = currentHp / maxHp;

  if (hpPercent <= CRITICAL_THRESHOLD) {
    return 'critical';
  }

  return 'wounded';
}

/**
 * Calculate the health summary for a party of characters.
 *
 * @param characters - Array of party characters
 * @returns Health summary with counts and display string
 *
 * @example
 * const summary = calculateHealthSummary(party);
 * // { ok: 3, wounded: 1, critical: 0, down: 0, display: "1 Wounded" }
 */
export function calculateHealthSummary(
  characters: readonly Character[]
): HealthSummary {
  const summary: HealthSummary = {
    ok: 0,
    wounded: 0,
    critical: 0,
    down: 0,
    display: '',
  };

  // Count characters in each category
  for (const character of characters) {
    const category = getHealthCategory(character);
    summary[category]++;
  }

  // Generate display string
  summary.display = formatHealthDisplay(summary);

  return summary;
}

/**
 * Format the health summary as a human-readable string.
 *
 * Priority order (most severe first):
 * 1. Down (0 HP)
 * 2. Critical (<=25% HP)
 * 3. Wounded (<100% HP)
 * 4. All OK
 *
 * @param summary - Health summary counts
 * @returns Display string like "All OK", "1 Wounded", "2 Critical, 1 Down"
 */
function formatHealthDisplay(summary: HealthSummary): string {
  const parts: string[] = [];

  // Add in severity order (most severe first)
  if (summary.down > 0) {
    parts.push(`${summary.down} Down`);
  }

  if (summary.critical > 0) {
    parts.push(`${summary.critical} Critical`);
  }

  if (summary.wounded > 0) {
    parts.push(`${summary.wounded} Wounded`);
  }

  // If no injuries, show "All OK"
  if (parts.length === 0) {
    return 'All OK';
  }

  return parts.join(', ');
}

/**
 * Create an empty health summary (no characters).
 */
export function createEmptyHealthSummary(): HealthSummary {
  return {
    ok: 0,
    wounded: 0,
    critical: 0,
    down: 0,
    display: 'No Party',
  };
}
