// Ziel: Terrain Effect Trigger System für Combat
// Siehe: docs/services/combatTracking.md (Phase 5)
//
// Wendet Terrain-Effects basierend auf Trigger-Typ an:
// - on-enter: Beim Betreten einer Cell
// - on-leave: Beim Verlassen einer Cell
// - on-start-turn: Bei Turn Start
// - on-end-turn: Bei Turn End
//
// Effect-Typen:
// - damage-on-enter/start/end: Schaden anwenden
// - condition-on-enter: Condition hinzufügen
// - condition-while-in: Condition bei Turn Start refreshen
// - teleporter: Position ändern

import type { Combatant, CombatState, GridPosition, ConditionState, HPChange } from '@/types/combat';
import type { CombatCellEffect, CombatTerrainEffectType } from '@/types/combatTerrain';
import { DEFAULT_CELL_PROPERTIES } from '@/types/combatTerrain';
import { positionToKey, keyToPosition } from '@/utils/squareSpace/grid';
import {
  diceExpressionToPMF,
  applyDamageToHP,
  getExpectedValue,
} from '@/utils';
import {
  getHP,
  setHP,
  setPosition,
  addCondition,
} from '../combatTracking/combatState';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[terrainEffects]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

/** Trigger-Typ für Terrain-Effects. */
export type TerrainTrigger = 'on-enter' | 'on-start-turn' | 'on-end-turn' | 'on-leave';

/** Mapping von Effect-Type zu Trigger. */
const EFFECT_TRIGGER_MAP: Record<CombatTerrainEffectType, TerrainTrigger | null> = {
  // Movement (handled by terrainMovement.ts, not here)
  'difficult': null,
  'impassable': null,
  'size-restricted': null,
  'shooting-only': null,
  // Visibility (handled by gridLineOfSight.ts)
  'blocks-los': null,
  'obscured-light': null,
  'obscured-heavy': null,
  // Damage
  'damage-on-enter': 'on-enter',
  'damage-on-start': 'on-start-turn',
  'damage-on-end': 'on-end-turn',
  // Conditions
  'condition-on-enter': 'on-enter',
  'condition-while-in': 'on-start-turn',
  // Interactive
  'door-closed': null,
  'door-open': null,
  'teleporter': 'on-enter',
};

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Wendet Terrain-Schaden auf einen Combatant an.
 * Mutiert HP und gibt HPChange zurück (für Protocol-Aggregation).
 */
function applyTerrainDamage(
  combatant: Combatant,
  effect: CombatCellEffect,
  position: GridPosition
): HPChange | null {
  const damage = effect.params?.damage;
  if (!damage) {
    debug('applyTerrainDamage: no damage defined', { effect });
    return null;
  }

  const damagePMF = diceExpressionToPMF(damage);
  const currentHP = getHP(combatant);
  const newHP = applyDamageToHP(currentHP, damagePMF);
  const damageDealt = getExpectedValue(damagePMF);

  setHP(combatant, newHP);

  debug('applyTerrainDamage:', {
    combatant: combatant.name,
    damage,
    damageType: effect.params?.damageType,
    damageDealt,
    position: positionToKey(position),
  });

  return {
    combatantId: combatant.id,
    combatantName: combatant.name,
    delta: -Math.round(damageDealt),  // negativ = Schaden
    source: 'terrain',
    sourceDetail: effect.params?.damageType ?? undefined,
  };
}

/**
 * Fügt eine Condition durch Terrain hinzu.
 */
function applyTerrainCondition(
  combatant: Combatant,
  effect: CombatCellEffect,
  position: GridPosition
): void {
  const conditionName = effect.params?.condition;
  if (!conditionName) {
    debug('applyTerrainCondition: no condition defined', { effect });
    return;
  }

  const condition: ConditionState = {
    name: `terrain-${conditionName}`,
    probability: 1.0,
    effect: conditionName,
  };

  addCondition(combatant, condition);

  debug('applyTerrainCondition:', {
    combatant: combatant.name,
    condition: conditionName,
    position: positionToKey(position),
  });
}

/** Result of a teleporter effect. */
export interface TeleportResult {
  fromPosition: GridPosition;
  toPosition: GridPosition;
}

/**
 * Teleportiert einen Combatant zu einer Ziel-Cell.
 * Gibt TeleportResult zurück oder null wenn keine Ziel-Cell definiert.
 */
function applyTeleporter(
  combatant: Combatant,
  effect: CombatCellEffect,
  fromPosition: GridPosition
): TeleportResult | null {
  const targetCellKey = effect.params?.targetCell;
  if (!targetCellKey) {
    debug('applyTeleporter: no targetCell defined', { effect });
    return null;
  }

  const targetPosition = keyToPosition(targetCellKey);
  // Note: Teleportation intentionally doesn't pass state - grappled targets don't follow.
  // D&D 5e RAW: Teleportation breaks grapple (target removed from reach).
  setPosition(combatant, targetPosition);

  debug('applyTeleporter:', {
    combatant: combatant.name,
    from: positionToKey(fromPosition),
    to: targetCellKey,
  });

  return { fromPosition, toPosition: targetPosition };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/** Result of terrain effect application. */
export interface TerrainEffectResult {
  hpChanges: HPChange[];
  teleported?: TeleportResult;
  conditionsApplied: string[];
}

/**
 * Wendet alle Terrain-Effects für eine Position und einen Trigger an.
 * Mutiert state in-place (HP, Conditions, Position).
 * Gibt strukturierte Ergebnisse für Protocol-Logging zurück.
 *
 * @param combatant Der betroffene Combatant
 * @param position Die Cell-Position
 * @param trigger Der auslösende Event-Typ
 * @param state Combat State (wird mutiert)
 * @returns TerrainEffectResult mit HP-Änderungen, Teleport-Info, Conditions
 */
export function applyTerrainEffects(
  combatant: Combatant,
  position: GridPosition,
  trigger: TerrainTrigger,
  state: CombatState
): TerrainEffectResult {
  const result: TerrainEffectResult = {
    hpChanges: [],
    conditionsApplied: [],
  };

  // Skip wenn Combatant tot ist
  if (combatant.combatState.isDead) {
    return result;
  }

  const key = positionToKey(position);
  const cellProps = state.terrainMap.get(key) ?? DEFAULT_CELL_PROPERTIES;

  // Keine Effects auf dieser Cell
  if (cellProps.effects.length === 0) {
    return result;
  }

  debug('applyTerrainEffects:', {
    combatant: combatant.name,
    position: key,
    trigger,
    effectCount: cellProps.effects.length,
  });

  // Iteriere durch alle Effects und prüfe ob sie zu diesem Trigger gehören
  for (const effect of cellProps.effects) {
    const effectTrigger = EFFECT_TRIGGER_MAP[effect.type];

    // Effect hat keinen Trigger oder passt nicht
    if (effectTrigger !== trigger) {
      continue;
    }

    // Effect anwenden
    switch (effect.type) {
      case 'damage-on-enter':
      case 'damage-on-start':
      case 'damage-on-end': {
        const hpChange = applyTerrainDamage(combatant, effect, position);
        if (hpChange) {
          result.hpChanges.push(hpChange);
        }
        break;
      }

      case 'condition-on-enter':
      case 'condition-while-in':
        applyTerrainCondition(combatant, effect, position);
        if (effect.params?.condition) {
          result.conditionsApplied.push(effect.params.condition);
        }
        break;

      case 'teleporter': {
        const teleportResult = applyTeleporter(combatant, effect, position);
        if (teleportResult) {
          result.teleported = teleportResult;
        }
        break;
      }

      default:
        debug('applyTerrainEffects: unhandled effect type', { type: effect.type });
    }
  }

  return result;
}
