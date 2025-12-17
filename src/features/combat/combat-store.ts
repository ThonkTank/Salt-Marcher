/**
 * Combat feature in-memory state store.
 *
 * Manages combat state using immutable update patterns.
 */

import type { CombatParticipant, Condition, ConditionType, CombatEffect } from '@core/schemas';
import type { EntityId } from '@core/types';
import { type InternalCombatState, createInitialInternalCombatState } from './types';

// ============================================================================
// Store Interface
// ============================================================================

export interface CombatStore {
  // === Queries ===

  getState(): Readonly<InternalCombatState>;
  getParticipant(participantId: string): CombatParticipant | null;

  // === Mutations ===

  /** Start combat session */
  startCombat(
    combatId: string,
    participants: CombatParticipant[],
    encounterId?: EntityId<'encounter'>
  ): void;

  /** End combat session */
  endCombat(): void;

  /** Update initiative order */
  setInitiativeOrder(order: string[]): void;

  /** Advance to next turn */
  advanceTurn(): { newRound: boolean };

  /** Update participant HP */
  updateParticipantHp(participantId: string, currentHp: number): void;

  /** Add condition to participant */
  addCondition(participantId: string, condition: Condition): void;

  /** Remove condition from participant */
  removeCondition(participantId: string, conditionType: ConditionType): void;

  /** Add effect to participant */
  addEffect(participantId: string, effect: CombatEffect): void;

  /** Remove effect from participant */
  removeEffect(participantId: string, effectId: string): void;

  /** Update participant initiative */
  updateInitiative(participantId: string, initiative: number): void;

  /** Set concentration spell */
  setConcentration(participantId: string, spell: string | undefined): void;

  /** Decrement effect durations at end of turn */
  decrementEffectDurations(participantId: string): CombatEffect[];

  /** Decrement condition durations at end of turn */
  decrementConditionDurations(participantId: string): Condition[];
}

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Create combat store instance.
 */
export function createCombatStore(): CombatStore {
  let state: InternalCombatState = createInitialInternalCombatState();

  function updateParticipant(
    participantId: string,
    updater: (p: CombatParticipant) => CombatParticipant
  ): void {
    state = {
      ...state,
      participants: state.participants.map((p) => (p.id === participantId ? updater(p) : p)),
    };
  }

  return {
    // === Queries ===

    getState(): Readonly<InternalCombatState> {
      return state;
    },

    getParticipant(participantId: string): CombatParticipant | null {
      return state.participants.find((p) => p.id === participantId) ?? null;
    },

    // === Mutations ===

    startCombat(
      combatId: string,
      participants: CombatParticipant[],
      encounterId?: EntityId<'encounter'>
    ): void {
      // Sort by initiative (descending)
      const sorted = [...participants].sort((a, b) => b.initiative - a.initiative);
      const initiativeOrder = sorted.map((p) => p.id);

      state = {
        status: 'active',
        combatId,
        encounterId,
        participants: sorted,
        initiativeOrder,
        currentTurnIndex: 0,
        roundNumber: 1,
      };
    },

    endCombat(): void {
      state = createInitialInternalCombatState();
    },

    setInitiativeOrder(order: string[]): void {
      state = {
        ...state,
        initiativeOrder: order,
        participants: order
          .map((id) => state.participants.find((p) => p.id === id))
          .filter((p): p is CombatParticipant => p !== undefined),
      };
    },

    advanceTurn(): { newRound: boolean } {
      const nextIndex = state.currentTurnIndex + 1;
      const newRound = nextIndex >= state.initiativeOrder.length;

      state = {
        ...state,
        currentTurnIndex: newRound ? 0 : nextIndex,
        roundNumber: newRound ? state.roundNumber + 1 : state.roundNumber,
      };

      return { newRound };
    },

    updateParticipantHp(participantId: string, currentHp: number): void {
      updateParticipant(participantId, (p) => ({
        ...p,
        currentHp,
      }));
    },

    addCondition(participantId: string, condition: Condition): void {
      updateParticipant(participantId, (p) => ({
        ...p,
        conditions: [...p.conditions.filter((c) => c.type !== condition.type), condition],
      }));
    },

    removeCondition(participantId: string, conditionType: ConditionType): void {
      updateParticipant(participantId, (p) => ({
        ...p,
        conditions: p.conditions.filter((c) => c.type !== conditionType),
      }));
    },

    addEffect(participantId: string, effect: CombatEffect): void {
      updateParticipant(participantId, (p) => ({
        ...p,
        effects: [...p.effects.filter((e) => e.id !== effect.id), effect],
      }));
    },

    removeEffect(participantId: string, effectId: string): void {
      updateParticipant(participantId, (p) => ({
        ...p,
        effects: p.effects.filter((e) => e.id !== effectId),
      }));
    },

    updateInitiative(participantId: string, initiative: number): void {
      updateParticipant(participantId, (p) => ({
        ...p,
        initiative,
      }));

      // Re-sort initiative order
      const sorted = [...state.participants].sort((a, b) => b.initiative - a.initiative);
      state = {
        ...state,
        participants: sorted,
        initiativeOrder: sorted.map((p) => p.id),
      };
    },

    setConcentration(participantId: string, spell: string | undefined): void {
      updateParticipant(participantId, (p) => ({
        ...p,
        concentratingOn: spell,
      }));
    },

    decrementEffectDurations(participantId: string): CombatEffect[] {
      const participant = state.participants.find((p) => p.id === participantId);
      if (!participant) return [];

      const expired: CombatEffect[] = [];
      const remaining: CombatEffect[] = [];

      for (const effect of participant.effects) {
        if (effect.duration === undefined) {
          remaining.push(effect);
        } else if (effect.duration <= 1) {
          expired.push(effect);
        } else {
          remaining.push({ ...effect, duration: effect.duration - 1 });
        }
      }

      updateParticipant(participantId, (p) => ({
        ...p,
        effects: remaining,
      }));

      return expired;
    },

    decrementConditionDurations(participantId: string): Condition[] {
      const participant = state.participants.find((p) => p.id === participantId);
      if (!participant) return [];

      const expired: Condition[] = [];
      const remaining: Condition[] = [];

      for (const condition of participant.conditions) {
        if (condition.duration === undefined) {
          remaining.push(condition);
        } else if (condition.duration <= 1) {
          expired.push(condition);
        } else {
          remaining.push({ ...condition, duration: condition.duration - 1 });
        }
      }

      updateParticipant(participantId, (p) => ({
        ...p,
        conditions: remaining,
      }));

      return expired;
    },
  };
}
