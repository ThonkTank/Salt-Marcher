/**
 * Encounter Pipeline CLI Command: adjust
 *
 * Step 6: Adjusts encounter to target difficulty.
 *
 * Usage:
 *   adjust                     Roll target difficulty and adjust
 *   adjust --target moderate   Use specific target difficulty
 *   adjust --verbose           Show detailed adjustment options
 */

import type { DifficultyLevel, PipelineState } from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';
import { calculateAdjustments, rollTargetDifficulty, getTargetWinProbability } from '../pipeline/adjustments.js';

// =============================================================================
// Types
// =============================================================================

export type AdjustResult =
  | { success: true }
  | { success: false; error: string };

// =============================================================================
// Validation
// =============================================================================

const VALID_DIFFICULTIES: DifficultyLevel[] = ['trivial', 'easy', 'moderate', 'hard', 'deadly'];

function isValidDifficulty(value: string): value is DifficultyLevel {
  return VALID_DIFFICULTIES.includes(value as DifficultyLevel);
}

// =============================================================================
// Command Handler
// =============================================================================

/**
 * Handles the 'adjust' command.
 *
 * Requires: state.difficulty (from difficulty command)
 * Produces: state.balanced
 *
 * Flags:
 *   --target <difficulty>  Override rolled target difficulty
 *   --verbose              Show detailed adjustment process
 */
export function handleAdjust(
  _args: string[],
  flags: Record<string, string>,
  state: PipelineState,
  lookups: PresetLookups
): AdjustResult {
  // 1. Validate prerequisites
  if (!state.flavoured) {
    return {
      success: false,
      error: 'No flavoured encounter. Run "flavour" first.',
    };
  }

  if (!state.difficulty) {
    return {
      success: false,
      error: 'No difficulty calculated. Run "difficulty" first.',
    };
  }

  // 2. Parse flags
  let targetDifficulty: DifficultyLevel | undefined;

  if (flags['target']) {
    if (!isValidDifficulty(flags['target'])) {
      return {
        success: false,
        error: `Invalid target difficulty: ${flags['target']}. Valid: ${VALID_DIFFICULTIES.join(', ')}`,
      };
    }
    targetDifficulty = flags['target'];
  }

  const verbose = 'verbose' in flags;

  // 3. Roll or use specified target difficulty
  const finalTarget = targetDifficulty ?? rollTargetDifficulty(state.flavoured.context);
  const targetWinProb = getTargetWinProbability(finalTarget);

  // 4. Show initial state
  console.log('\n=== Encounter Adjustment ===\n');
  console.log(`  Current Difficulty:  ${state.difficulty.difficulty}`);
  console.log(`  Current Win%:        ${(state.difficulty.partyWinProbability * 100).toFixed(0)}%`);
  console.log(`  Current TPK Risk:    ${(state.difficulty.tpkRisk * 100).toFixed(0)}%`);
  console.log('');
  console.log(`  Target Difficulty:   ${finalTarget}${targetDifficulty ? ' (specified)' : ' (rolled)'}`);
  console.log(`  Target Win%:         ${(targetWinProb * 100).toFixed(0)}%`);

  // 5. Check if adjustment is needed
  if (state.difficulty.difficulty === finalTarget) {
    console.log('\n  => Already at target difficulty, no adjustment needed.\n');

    // Create balanced encounter with no adjustments
    state.balanced = {
      ...state.flavoured,
      balance: {
        targetDifficulty: finalTarget,
        actualDifficulty: state.difficulty.difficulty,
        partyWinProbability: state.difficulty.partyWinProbability,
        tpkRisk: state.difficulty.tpkRisk,
        combatProbability: 0.8, // Default for hostile encounters
        xpReward: state.difficulty.xpReward,
        adjustedXP: state.difficulty.xpReward, // No multiplier change
        adjustmentsMade: 0,
      },
      difficulty: state.difficulty,
    };

    return { success: true };
  }

  // 6. Calculate adjustments
  const result = calculateAdjustments(state.flavoured, lookups, {
    targetDifficulty: finalTarget,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // 7. Update state
  state.balanced = result.encounter;

  // 8. Output results
  const balance = result.encounter.balance;

  console.log('\n  Adjustments Applied:');

  if (balance.adjustmentsMade === 0) {
    console.log('    (none - no improvement possible)');
  } else {
    console.log(`    ${balance.adjustmentsMade} adjustment(s) made`);
  }

  console.log('\n  Final Result:');
  console.log(`    Difficulty:    ${balance.actualDifficulty}`);
  console.log(`    Win%:          ${(balance.partyWinProbability * 100).toFixed(0)}%`);
  console.log(`    TPK Risk:      ${(balance.tpkRisk * 100).toFixed(0)}%`);
  console.log(`    Combat Prob:   ${(balance.combatProbability * 100).toFixed(0)}%`);
  console.log(`    XP Reward:     ${balance.xpReward} (adjusted: ${balance.adjustedXP})`);

  if (balance.actualDifficulty !== balance.targetDifficulty) {
    console.log(`\n  ⚠ Could not reach target difficulty (${balance.targetDifficulty})`);
    console.log(`    Best achievable: ${balance.actualDifficulty}`);
  } else {
    console.log(`\n  ✓ Target difficulty reached`);
  }

  console.log('');

  return { success: true };
}
