// Ziel: Zone-Effect Evaluation und Application
// Siehe: docs/services/combatTracking.md
//
// Evaluiert trigger-basierte Effects aus ActiveZones bei Movement und Turn-Events.
// Spirit Guardians, Moonbeam, etc. verwenden dieses System.

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Single trigger statt separate on*-Handler
// - Spec: docs/types/combatEvent.md#zones (Zeile 693-741)
// - isInZoneRadius() + applyZoneEffect() verwenden zone.effect.trigger
// - Laut Spec: zone.onEnter, zone.onExit, zone.onStartTurn, zone.onEndTurn separat
// - Vereinfachung bis Schema-Update
//
// [HACK]: Numerische DC statt Formula-DC
// - rollSaveCheck() erwartet numeric dc (Zeile 258)
// - Spec: Formula-DC mit @-Referenzen (docs/types/combatEvent.md#formula-dc)
// - Benötigt Formula-Parser in resolveEffects.ts oder shared util
//
// [TODO]: Zone terrainEffect Support
// - Spec: docs/types/combatEvent.md#zones
// - ZoneDefinition.terrainEffect fehlt in Implementation
// - getZoneSpeedModifier() behandelt nur speedModifier, nicht terrainEffect
//
// [TODO]: Zone attached origin für Spirit Guardians
// - Spec: docs/types/combatEvent.md#zones (origin: { type: 'attached', to: 'self' })
// - isInZoneRadius() verwendet statische Owner-Position
// - Braucht: Zone-Position folgt Owner bei Movement
//
// [HACK]: Nur damage und apply-condition Effects
// - applyZoneEffect() (Zeile 163-231) behandelt nur diese zwei Effect-Typen
// - Andere Effects (push, pull, grant-*, etc.) werden ignoriert

import type { Effect } from '@/types/entities/combatEvent';
import type {
  Combatant,
  CombatState,
  HPChange,
  ActiveZone,
  GridPosition,
  ZoneEffect,
} from '@/types/combat';
import type { EffectTrigger } from '@/constants/action';
import { getDistanceFeet } from '@/utils/squareSpace/grid';
import { rollDice } from '@/utils/probability/random';
import { getPosition, getAbilities, addCondition } from './combatState';
import { isHostile, isAllied } from '../combatantAI/helpers/combatHelpers';
import type { AbilityScores } from '@/types/entities/creature';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[zoneEffects]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

export interface ZoneEffectResult {
  hpChanges: HPChange[];
  conditionsApplied: string[];
}

// ============================================================================
// ZONE EVALUATION
// ============================================================================

/**
 * Wendet Zone-Effects auf einen Combatant an.
 * Wird bei Movement (on-enter) und Turn-Events (on-start-turn, on-end-turn) aufgerufen.
 *
 * D&D 5e Regeln:
 * - Zone-Damage tritt maximal 1x pro Turn auf (triggeredThisTurn tracking)
 * - Gilt nicht für den Owner der Zone
 * - targetFilter filtert nach allegiance
 *
 * @param combatant Der Combatant der geprüft wird
 * @param trigger Der Trigger-Typ (on-enter, on-start-turn, etc.)
 * @param state CombatState mit activeZones
 * @returns Ergebnis mit HP-Änderungen und angewendeten Conditions
 */
export function applyZoneEffects(
  combatant: Combatant,
  trigger: EffectTrigger,
  state: CombatState
): ZoneEffectResult {
  const result: ZoneEffectResult = { hpChanges: [], conditionsApplied: [] };

  if (!state.activeZones || state.activeZones.length === 0) {
    return result;
  }

  const combatantPos = getPosition(combatant);

  for (const zone of state.activeZones) {
    // Skip own zones (can't hurt yourself with Spirit Guardians)
    if (zone.ownerId === combatant.id) continue;

    // Check trigger match - HACK: siehe Header - single trigger statt on*
    if (zone.effect.trigger !== trigger) continue;

    // Check target filter (enemies/allies/all)
    if (!isValidZoneTarget(combatant, zone, state)) continue;

    // Check if in radius
    if (!isInZoneRadius(combatantPos, zone, state)) continue;

    // Check "once per turn" (D&D 5e: Spirit Guardians triggers max 1x/turn)
    if (zone.triggeredThisTurn.has(combatant.id)) {
      debug('applyZoneEffects: already triggered this turn', {
        zone: zone.sourceActionId,
        combatant: combatant.id,
      });
      continue;
    }
    zone.triggeredThisTurn.add(combatant.id);

    // Apply effect
    const effectResult = applyZoneEffect(combatant, zone, state);
    result.hpChanges.push(...effectResult.hpChanges);
    result.conditionsApplied.push(...effectResult.conditionsApplied);

    debug('applyZoneEffects: applied', {
      zone: zone.sourceActionId,
      trigger,
      combatant: combatant.id,
      damage: effectResult.hpChanges.reduce((sum, c) => sum + Math.abs(c.delta), 0),
      conditions: effectResult.conditionsApplied,
    });
  }

  return result;
}

/**
 * Prüft ob Combatant innerhalb des Zone-Radius ist.
 */
function isInZoneRadius(
  combatantPos: GridPosition,
  zone: ActiveZone,
  state: CombatState
): boolean {
  const owner = state.combatants.find(c => c.id === zone.ownerId);
  if (!owner) return false;

  // Check if effect type is create-zone
  if (zone.effect.type !== 'create-zone' || !zone.effect.zone) return false;

  const ownerPos = getPosition(owner);
  const distance = getDistanceFeet(combatantPos, ownerPos, state.grid);

  return distance <= zone.effect.zone.radius;
}

/**
 * Prüft ob Combatant ein gültiges Ziel für die Zone ist.
 * Basierend auf zone.effect.zone.targetFilter.
 * Verwendet isHostile/isAllied aus combatHelpers (Single Source of Truth).
 */
function isValidZoneTarget(
  combatant: Combatant,
  zone: ActiveZone,
  state: CombatState
): boolean {
  const owner = state.combatants.find(c => c.id === zone.ownerId);
  if (!owner) return false;

  // Check if effect type is create-zone
  if (zone.effect.type !== 'create-zone' || !zone.effect.zone) return false;

  const filter = zone.effect.zone.targetFilter ?? 'all';
  const ownerGroup = owner.combatState.groupId;
  const combatantGroup = combatant.combatState.groupId;

  // Use canonical alliance helpers (Single Source of Truth)
  if (filter === 'enemies' && !isHostile(ownerGroup, combatantGroup, state.alliances)) return false;
  if (filter === 'allies' && !isAllied(ownerGroup, combatantGroup, state.alliances)) return false;

  return true;
}

/**
 * Wendet einen einzelnen Zone-Effect auf einen Combatant an.
 * Behandelt Damage (mit optionalem Save) und Conditions.
 */
function applyZoneEffect(
  combatant: Combatant,
  zone: ActiveZone,
  state: CombatState
): ZoneEffectResult {
  const result: ZoneEffectResult = { hpChanges: [], conditionsApplied: [] };
  const effect = zone.effect;

  // Get damage/save/condition from flat properties or zone definition
  const zoneDamage = effect.damage ?? effect.zone?.damage;
  const zoneSave = effect.save ?? effect.zone?.save;
  const zoneCondition = effect.condition ?? effect.zone?.condition;

  // Damage with optional save - HACK: siehe Header - nur damage + apply-condition
  if (zoneDamage?.dice) {
    let damage = rollDice(zoneDamage.dice);
    if (zoneDamage.modifier) damage += zoneDamage.modifier;

    // Save reduces damage - HACK: siehe Header - numerische DC statt Formula-DC
    if (zoneSave) {
      const saveSuccess = rollSaveCheck(combatant, zoneSave.ability, zoneSave.dc);

      if (saveSuccess) {
        if (zoneSave.onSave === 'half') {
          damage = Math.floor(damage / 2);
          debug('applyZoneEffect: save success, half damage', { damage });
        } else if (zoneSave.onSave === 'none') {
          damage = 0;
          debug('applyZoneEffect: save success, no damage');
        }
      } else {
        debug('applyZoneEffect: save failed');
      }
    }

    if (damage > 0) {
      // Apply damage to combatant HP
      applyZoneDamage(combatant, damage);

      result.hpChanges.push({
        combatantId: combatant.id,
        combatantName: combatant.name,
        delta: -damage,
        source: 'zone',
        sourceDetail: `zone:${zone.sourceActionId}`,
      });

      debug('applyZoneEffect: damage applied', {
        combatant: combatant.id,
        damage,
        damageType: zoneDamage.type,
      });
    }
  }

  // Condition application
  if (zoneCondition) {
    addCondition(combatant, {
      name: zoneCondition,
      probability: 1.0,
      effect: zoneCondition,
      duration: undefined, // Zone effects don't have duration on the flat structure
      sourceId: zone.ownerId,
    });
    result.conditionsApplied.push(zoneCondition);

    debug('applyZoneEffect: condition applied', {
      combatant: combatant.id,
      condition: effect.condition,
    });
  }

  return result;
}

/**
 * Wendet Schaden auf einen Combatant an.
 * Reduziert HP als deterministische Subtraktion von der PMF.
 */
function applyZoneDamage(combatant: Combatant, damage: number): void {
  // Vereinfachte deterministische Schadensanwendung
  // Die PMF wird um den Schaden nach links verschoben
  const newPmf = new Map<number, number>();
  for (const [hp, prob] of combatant.currentHp) {
    const newHp = hp - damage;
    newPmf.set(newHp, (newPmf.get(newHp) ?? 0) + prob);
  }
  combatant.currentHp = newPmf;
}

/**
 * Führt einen Saving Throw durch.
 * Vereinfachte deterministische Version.
 * HACK: siehe Header - numerische DC statt Formula-DC
 *
 * @returns true wenn Save erfolgreich, false wenn fehlgeschlagen
 */
function rollSaveCheck(
  combatant: Combatant,
  ability: keyof AbilityScores,
  dc: number
): boolean {
  const abilities = getAbilities(combatant);
  const abilityScore = abilities[ability];
  const modifier = Math.floor((abilityScore - 10) / 2);

  // Einfacher d20 Roll + Modifier vs DC
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + modifier;

  debug('rollSaveCheck', {
    combatant: combatant.id,
    ability,
    dc,
    roll,
    modifier,
    total,
    success: total >= dc,
  });

  return total >= dc;
}

// ============================================================================
// ZONE SPEED MODIFIER
// ============================================================================

/**
 * Berechnet Speed-Modifier aus aktiven Zones.
 * Spirit Guardians halbiert z.B. die Bewegungsgeschwindigkeit von Feinden.
 *
 * @param combatant Der Combatant
 * @param state CombatState mit activeZones
 * @returns Multiplikator für Speed (z.B. 0.5 für halbe Speed)
 */
export function getZoneSpeedModifier(
  combatant: Combatant,
  state: CombatState
): number {
  if (!state.activeZones || state.activeZones.length === 0) {
    return 1.0;
  }

  const combatantPos = getPosition(combatant);
  let modifier = 1.0;

  for (const zone of state.activeZones) {
    // Skip own zones
    if (zone.ownerId === combatant.id) continue;

    // Check if effect type is create-zone
    if (zone.effect.type !== 'create-zone' || !zone.effect.zone) continue;

    // Skip if no speedModifier defined
    if (!zone.effect.zone.speedModifier) continue;

    // Check target filter
    if (!isValidZoneTarget(combatant, zone, state)) continue;

    // Check if in radius
    if (!isInZoneRadius(combatantPos, zone, state)) continue;

    // Apply speed modifier (multiplicative)
    modifier *= zone.effect.zone.speedModifier;

    debug('getZoneSpeedModifier: applied', {
      zone: zone.sourceActionId,
      combatant: combatant.id,
      speedModifier: zone.effect.zone.speedModifier,
      totalModifier: modifier,
    });
  }

  return modifier;
}

// ============================================================================
// ZONE MANAGEMENT HELPERS
// ============================================================================

/**
 * Aktiviert eine Zone bei Spell-Cast.
 * Fügt ActiveZone zum State hinzu.
 */
export function activateZone(state: CombatState, zone: ActiveZone): void {
  state.activeZones.push(zone);
  debug('activateZone:', {
    id: zone.id,
    owner: zone.ownerId,
    action: zone.sourceActionId,
  });
}

/**
 * Deaktiviert alle Zones eines Owners.
 * Wird bei Concentration-Loss aufgerufen.
 */
export function deactivateZonesForOwner(state: CombatState, ownerId: string): void {
  const before = state.activeZones.length;
  state.activeZones = state.activeZones.filter(z => z.ownerId !== ownerId);
  const removed = before - state.activeZones.length;

  if (removed > 0) {
    debug('deactivateZonesForOwner:', {
      ownerId,
      removed,
    });
  }
}

/**
 * Reset triggered-Tracking für einen Combatant bei dessen Turn-Start.
 * Erlaubt dass Zone-Effects erneut triggern können.
 */
export function resetZoneTriggersForCombatant(
  state: CombatState,
  combatantId: string
): void {
  for (const zone of state.activeZones) {
    zone.triggeredThisTurn.delete(combatantId);
  }
  debug('resetZoneTriggersForCombatant:', { combatantId });
}

/**
 * Erstellt eine ActiveZone aus einem Effect mit Zone-Definition.
 * Helper für executeAction.ts.
 */
export function createActiveZone(
  ownerId: string,
  actionId: string | undefined,
  effect: ZoneEffect | Effect
): ActiveZone {
  // Convert Effect to ZoneEffect if needed
  const zoneEffect: ZoneEffect = effect.type === 'create-zone'
    ? effect as ZoneEffect
    : { type: 'create-zone', ...effect } as ZoneEffect;

  return {
    id: `${ownerId}-${actionId ?? 'unknown'}-${Date.now()}`,
    sourceActionId: actionId ?? 'unknown',
    ownerId,
    effect: zoneEffect,
    triggeredThisTurn: new Set(),
  };
}
