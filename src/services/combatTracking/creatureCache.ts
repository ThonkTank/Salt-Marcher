// Ziel: Cache für geladene CreatureDefinitions + resolved Actions
// Siehe: docs/services/combatTracking.md
//
// Wiederverwendbar für NPCs mit gleichem Creature-Typ.
// 5 Goblins = 1 Vault-Lookup statt 5.

import type { CreatureDefinition, Action } from '@/types/entities';
import { vault } from '@/infrastructure/vault/vaultInstance';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[creatureCache]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

/** Cache-Entry mit CreatureDefinition + resolved Actions. */
export interface ResolvedCreature {
  definition: CreatureDefinition;
  actions: Action[];  // Resolved: creature.actions + actionIds aus Vault
}

// ============================================================================
// CACHE
// ============================================================================

const creatureCache = new Map<string, ResolvedCreature>();

/**
 * Lädt CreatureDefinition mit resolved Actions (gecached).
 * Wiederverwendbar für NPCs mit gleichem Creature-Typ.
 */
export function getResolvedCreature(creatureId: string): ResolvedCreature {
  const cached = creatureCache.get(creatureId);
  if (cached) {
    debug('cache hit:', creatureId);
    return cached;
  }

  debug('cache miss, loading:', creatureId);
  const definition = vault.getEntity<CreatureDefinition>('creature', creatureId);
  const actions = resolveActions(definition);

  const resolved: ResolvedCreature = { definition, actions };
  creatureCache.set(creatureId, resolved);

  debug('cached:', creatureId, { actionsCount: actions.length });
  return resolved;
}

/**
 * Lädt mehrere CreatureDefinitions auf einmal (batch).
 * Optimiert für Encounter mit mehreren Creature-Typen.
 */
export function preloadCreatures(creatureIds: string[]): void {
  const uniqueIds = [...new Set(creatureIds)];
  for (const id of uniqueIds) {
    if (!creatureCache.has(id)) {
      getResolvedCreature(id);
    }
  }
  debug('preloaded:', uniqueIds.length, 'creatures');
}

/** Cache leeren (z.B. bei Session-Ende oder Vault-Änderung). */
export function clearCreatureCache(): void {
  const size = creatureCache.size;
  creatureCache.clear();
  debug('cleared cache:', size, 'entries');
}

/** Cache-Statistiken für Debugging. */
export function getCreatureCacheStats(): { size: number; ids: string[] } {
  return {
    size: creatureCache.size,
    ids: [...creatureCache.keys()],
  };
}

// ============================================================================
// ACTION RESOLUTION
// ============================================================================

/**
 * Resolved Actions aus creature.actions + actionIds.
 * Falls keine Actions vorhanden: Default-Action basierend auf CR.
 */
function resolveActions(creature: CreatureDefinition): Action[] {
  const actions: Action[] = [...(creature.actions ?? [])];

  // Lade referenzierte Actions aus Vault
  if (creature.actionIds?.length) {
    for (const actionId of creature.actionIds) {
      try {
        const action = vault.getEntity<Action>('action', actionId);
        actions.push(action);
        debug('resolved actionId:', actionId);
      } catch {
        debug('actionId not found, skipping:', actionId);
      }
    }
  }

  // Fallback: Default-Action wenn keine Actions vorhanden
  if (actions.length === 0) {
    debug('no actions, using default for CR:', creature.cr);
    actions.push(getDefaultCreatureAction(creature.cr));
  }

  return actions;
}

/**
 * Generiert Default-Action für Creature ohne Actions.
 * CR-skalierte Natural Attack.
 */
function getDefaultCreatureAction(cr: number): Action {
  const attackBonus = Math.max(2, Math.floor(cr) + 3);
  const damageBonus = Math.max(1, Math.floor(cr));
  const diceCount = Math.max(1, Math.floor(cr / 3));

  return {
    name: 'Natural Attack',
    actionType: 'melee-weapon',
    timing: { type: 'action' },
    range: { type: 'reach', normal: 5 },
    targeting: { type: 'single' },
    attack: { bonus: attackBonus },
    damage: { dice: `${diceCount}d6`, modifier: damageBonus, type: 'bludgeoning' },
  } as unknown as Action;
}
