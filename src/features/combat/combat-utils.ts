/**
 * Combat utility functions.
 *
 * Pure functions for combat calculations.
 */

import type { CombatParticipant, CombatEffect, CreatureInstance, CreatureDefinition } from '@core/schemas';
import { SECONDS_PER_ROUND } from '@core/schemas';
import { calculateXP, CR_XP_TABLE } from '@core/utils';

// ============================================================================
// XP Calculation (uses @core/utils/creature-utils)
// ============================================================================

// Re-export for backwards compatibility
export { CR_XP_TABLE as CR_TO_XP };

/**
 * Get XP value for a creature by CR.
 * @deprecated Use calculateXP from @core/utils instead
 */
export function getXpForCr(cr: number): number {
  return calculateXP(cr);
}

/**
 * Calculate total XP for defeated creatures.
 * Uses the CR stored directly on the participant.
 */
export function calculateCombatXp(participants: readonly CombatParticipant[]): number {
  let totalXp = 0;

  for (const participant of participants) {
    // Only count defeated creatures (not PCs)
    if (participant.type === 'creature' && participant.currentHp <= 0) {
      const cr = participant.cr ?? 0;
      totalXp += calculateXP(cr);
    }
  }

  return totalXp;
}

// ============================================================================
// Concentration
// ============================================================================

/**
 * Calculate concentration save DC for damage taken.
 * DC = max(10, damage / 2)
 */
export function calculateConcentrationDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

/**
 * Check if participant needs concentration check.
 */
export function needsConcentrationCheck(participant: CombatParticipant): boolean {
  return participant.concentratingOn !== undefined && participant.concentratingOn !== '';
}

// ============================================================================
// Combat Duration
// ============================================================================

/**
 * Calculate combat duration in game time.
 */
export function calculateCombatDuration(rounds: number): { hours: number; minutes: number } {
  const totalSeconds = rounds * SECONDS_PER_ROUND;
  const totalMinutes = Math.floor(totalSeconds / 60);

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

// ============================================================================
// Creature Instance Creation
// ============================================================================

/**
 * Create a creature runtime instance from a definition.
 * Used when spawning creatures for combat.
 *
 * @see docs/domain/Creature.md#combat-feature
 */
export function createCombatCreature(definition: CreatureDefinition): CreatureInstance {
  return {
    instanceId: `${definition.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    definitionId: definition.id,
    currentHp: definition.maxHp,
    tempHp: 0,
    conditions: [],
    hasActed: false,
  };
}

// ============================================================================
// Participant Creation
// ============================================================================

/**
 * Create combat participant from creature instance and definition.
 */
export function createParticipantFromCreature(
  instance: CreatureInstance,
  definition: CreatureDefinition,
  initiative: number
): CombatParticipant {
  return {
    id: instance.instanceId,
    type: 'creature',
    entityId: instance.instanceId,
    name: definition.name,
    initiative,
    maxHp: definition.maxHp,
    currentHp: instance.currentHp,
    conditions: [...instance.conditions],
    effects: [],
    concentratingOn: instance.concentrationSpell,
    cr: definition.cr,
  };
}

/**
 * Create combat participant for a PC/character.
 */
export function createParticipantFromCharacter(
  characterId: string,
  name: string,
  maxHp: number,
  currentHp: number,
  initiative: number
): CombatParticipant {
  return {
    id: `char-${characterId}`,
    type: 'character',
    entityId: characterId,
    name,
    initiative,
    maxHp,
    currentHp,
    conditions: [],
    effects: [],
  };
}

// ============================================================================
// Downed/Death Checks
// ============================================================================

/**
 * Check if participant is downed (0 HP but not dead).
 */
export function isParticipantDowned(participant: CombatParticipant): boolean {
  return participant.currentHp <= 0 && participant.type === 'character';
}

/**
 * Check if creature is dead (0 HP and is a creature).
 */
export function isCreatureDead(participant: CombatParticipant): boolean {
  return participant.currentHp <= 0 && participant.type === 'creature';
}

// ============================================================================
// Effect Filtering
// ============================================================================

/**
 * Get effects that trigger at start of turn.
 */
export function getStartOfTurnEffects(participant: CombatParticipant): CombatEffect[] {
  return participant.effects.filter((e) => e.trigger === 'start-of-turn');
}

/**
 * Get effects that trigger at end of turn.
 */
export function getEndOfTurnEffects(participant: CombatParticipant): CombatEffect[] {
  return participant.effects.filter((e) => e.trigger === 'end-of-turn');
}

// ============================================================================
// Initiative Helpers
// ============================================================================

/**
 * Generate unique combat session ID.
 */
export function generateCombatId(): string {
  return `combat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
