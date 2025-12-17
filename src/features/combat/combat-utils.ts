/**
 * Combat utility functions.
 *
 * Pure functions for combat calculations.
 */

import type { CombatParticipant, CombatEffect, CreatureInstance, CreatureDefinition } from '@core/schemas';
import { SECONDS_PER_ROUND } from '@core/schemas';

// ============================================================================
// XP Calculation
// ============================================================================

/**
 * D&D 5e CR to XP mapping.
 */
export const CR_TO_XP: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

/**
 * Get XP value for a creature by CR.
 */
export function getXpForCr(cr: number): number {
  return CR_TO_XP[cr] ?? 0;
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
      totalXp += getXpForCr(cr);
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
    conditions: instance.conditions.map((type) => ({
      type: type as import('@core/schemas').ConditionType,
      reminder: '',
    })),
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
