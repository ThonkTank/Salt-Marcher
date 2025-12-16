// src/workmodes/session-runner/combat-logic.ts
// Shared combat tracking logic extracted from combat-presenter.ts
// Pure functions for initiative, HP, temp HP, and defeated status management

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-combat-logic");

/**
 * Combat participant interface (shared across presenters)
 */
export interface CombatParticipantWithTemp {
    readonly id: string;
    readonly creatureId: string;
    readonly name: string;
    readonly initiative: number;
    readonly currentHp: number;
    readonly maxHp: number;
    readonly tempHp: number;
    readonly defeated: boolean;
}

/**
 * Update a participant's initiative value
 */
export function updateParticipantInitiative(
    participant: CombatParticipantWithTemp,
    initiative: number
): CombatParticipantWithTemp {
    return {
        ...participant,
        initiative: Math.max(0, Math.floor(initiative)),
    };
}

/**
 * Update a participant's HP (current and/or max)
 */
export function updateParticipantHp(
    participant: CombatParticipantWithTemp,
    currentHp: number,
    maxHp?: number
): CombatParticipantWithTemp {
    const sanitizedCurrent = Math.max(0, Math.floor(currentHp));
    const sanitizedMax = maxHp !== undefined ? Math.max(0, Math.floor(maxHp)) : participant.maxHp;
    const clampedCurrent = Math.min(sanitizedCurrent, sanitizedMax);

    return {
        ...participant,
        currentHp: clampedCurrent,
        maxHp: sanitizedMax,
        defeated: clampedCurrent <= 0,
    };
}

/**
 * Apply damage to a participant (temp HP first, then regular HP per 5e rules)
 */
export function applyDamageToParticipant(
    participant: CombatParticipantWithTemp,
    amount: number
): CombatParticipantWithTemp {
    const sanitizedAmount = Math.max(0, Math.floor(amount));

    // Damage temp HP first, then regular HP (5e rules)
    let remainingDamage = sanitizedAmount;
    let newTempHp = participant.tempHp;
    let newCurrentHp = participant.currentHp;

    if (newTempHp > 0) {
        const tempDamage = Math.min(remainingDamage, newTempHp);
        newTempHp -= tempDamage;
        remainingDamage -= tempDamage;
    }

    if (remainingDamage > 0) {
        newCurrentHp = Math.max(0, newCurrentHp - remainingDamage);
    }

    return {
        ...participant,
        currentHp: newCurrentHp,
        tempHp: newTempHp,
        defeated: newCurrentHp <= 0,
    };
}

/**
 * Apply healing to a participant (cannot exceed max HP)
 */
export function applyHealingToParticipant(
    participant: CombatParticipantWithTemp,
    amount: number
): CombatParticipantWithTemp {
    const sanitizedAmount = Math.max(0, Math.floor(amount));
    const newHp = Math.min(participant.maxHp, participant.currentHp + sanitizedAmount);

    return {
        ...participant,
        currentHp: newHp,
        defeated: newHp <= 0,
    };
}

/**
 * Update a participant's temporary HP (replaces existing temp HP, does not stack per 5e rules)
 */
export function updateParticipantTempHp(
    participant: CombatParticipantWithTemp,
    tempHp: number
): CombatParticipantWithTemp {
    return {
        ...participant,
        tempHp: Math.max(0, Math.floor(tempHp)),
    };
}

/**
 * Toggle a participant's defeated status
 */
export function toggleParticipantDefeated(
    participant: CombatParticipantWithTemp
): CombatParticipantWithTemp {
    return {
        ...participant,
        defeated: !participant.defeated,
    };
}

/**
 * Sort participants by initiative (descending order)
 */
export function sortParticipantsByInitiative(
    participants: ReadonlyArray<CombatParticipantWithTemp>
): ReadonlyArray<CombatParticipantWithTemp> {
    return Object.freeze([...participants].sort((a, b) => b.initiative - a.initiative));
}

/**
 * Find a participant by ID
 */
export function findParticipantById(
    participants: ReadonlyArray<CombatParticipantWithTemp>,
    id: string
): { participant: CombatParticipantWithTemp; index: number } | null {
    const index = participants.findIndex((p) => p.id === id);
    if (index === -1) {
        logger.warn("Participant not found", { id });
        return null;
    }
    return { participant: participants[index], index };
}

/**
 * Update a specific participant in the participants array
 */
export function updateParticipantInArray(
    participants: ReadonlyArray<CombatParticipantWithTemp>,
    index: number,
    updatedParticipant: CombatParticipantWithTemp
): ReadonlyArray<CombatParticipantWithTemp> {
    const newParticipants = [...participants];
    newParticipants[index] = updatedParticipant;
    return Object.freeze(newParticipants) as ReadonlyArray<CombatParticipantWithTemp>;
}

/**
 * Convert a Combatant to a CombatParticipantWithTemp
 */
export function combatantToParticipant(
    combatant: {
        id: string;
        name: string;
        initiative: number;
        currentHp: number;
        maxHp: number;
        characterId?: string;
    }
): CombatParticipantWithTemp {
    return {
        id: combatant.id,
        creatureId: combatant.characterId || combatant.id, // Use characterId if available, otherwise use id
        name: combatant.name,
        initiative: combatant.initiative,
        currentHp: combatant.currentHp,
        maxHp: combatant.maxHp,
        tempHp: 0, // Start with no temp HP
        defeated: combatant.currentHp <= 0, // Set defeated if HP is 0 or less
    };
}
