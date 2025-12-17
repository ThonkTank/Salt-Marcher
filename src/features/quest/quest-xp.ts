/**
 * Quest XP calculation utilities.
 *
 * Implements the 40/60 XP split:
 * - 40% of encounter XP is awarded immediately
 * - 60% is accumulated in the quest pool (if assigned to a quest)
 * - Quest pool is paid out on quest completion
 *
 * @see docs/features/Quest-System.md
 */

// ============================================================================
// XP Split Constants
// ============================================================================

/**
 * Immediate XP percentage (40%).
 * Given at encounter resolution, regardless of quest assignment.
 */
export const IMMEDIATE_XP_PERCENT = 0.4;

/**
 * Quest pool XP percentage (60%).
 * Accumulated when encounter is assigned to a quest slot.
 * Paid out at quest completion.
 *
 * For random encounters (not assigned to quest), this 60% is forfeited.
 */
export const QUEST_POOL_XP_PERCENT = 0.6;

// ============================================================================
// XP Calculation Functions
// ============================================================================

/**
 * Calculate immediate XP award (40%).
 * This is given immediately after encounter resolution.
 *
 * @param baseXP - Total XP from the encounter
 * @returns XP to award immediately
 */
export function calculateImmediateXP(baseXP: number): number {
  return Math.floor(baseXP * IMMEDIATE_XP_PERCENT);
}

/**
 * Calculate quest pool XP (60%).
 * This is accumulated when encounter is assigned to a quest slot.
 *
 * @param baseXP - Total XP from the encounter
 * @returns XP to accumulate in quest pool
 */
export function calculateQuestPoolXP(baseXP: number): number {
  return Math.floor(baseXP * QUEST_POOL_XP_PERCENT);
}

/**
 * Calculate total quest completion XP.
 * Sum of all accumulated XP from quest encounters.
 *
 * @param accumulatedXP - XP accumulated in quest pool
 * @param bonusXP - Optional quest completion bonus
 * @returns Total XP to award on quest completion
 */
export function calculateQuestCompletionXP(
  accumulatedXP: number,
  bonusXP: number = 0
): number {
  return accumulatedXP + bonusXP;
}

/**
 * Get XP breakdown for display.
 *
 * @param baseXP - Total XP from encounter
 * @returns Breakdown of immediate vs quest pool XP
 */
export function getXPBreakdown(baseXP: number): {
  immediate: number;
  questPool: number;
  total: number;
} {
  const immediate = calculateImmediateXP(baseXP);
  const questPool = calculateQuestPoolXP(baseXP);

  return {
    immediate,
    questPool,
    total: immediate + questPool,
  };
}

/**
 * Format XP split for display.
 *
 * @param baseXP - Total XP from encounter
 * @returns Formatted string describing the split
 */
export function formatXPSplit(baseXP: number): string {
  const { immediate, questPool } = getXPBreakdown(baseXP);
  return `${immediate} XP sofort / ${questPool} XP Quest-Pool`;
}
